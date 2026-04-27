// routes/books.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const storage = require('../lib/storage');
const { extractWords } = require('../lib/extract');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ACCEPTED_MIME = new Set(['application/pdf', 'application/epub+zip']);
const ACCEPTED_EXT = /\.(pdf|epub)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ACCEPTED_MIME.has(file.mimetype) || ACCEPTED_EXT.test(file.originalname);
    cb(null, ok);
  },
});

router.use(requireAuth);

// GET /api/books
router.get('/', async (req, res) => {
  const books = await storage.listBooks(req.user.sub);
  res.json(books);
});

// POST /api/books
router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File must be a PDF or EPUB' });

  const id = uuidv4();
  const ext = path.extname(req.file.originalname);
  const title = path.basename(req.file.originalname, ext);
  const buffer = req.file.buffer;

  let words = [];
  let hasWarning = false;

  try {
    words = await extractWords(buffer);
    if (words.length === 0) hasWarning = true;
  } catch (err) {
    console.error('PDF extraction failed:', err);
    hasWarning = true;
  }

  await storage.uploadPdf(id, buffer);

  if (words.length > 0) {
    await storage.saveWords(id, words);
  }

  const book = await storage.saveBook(req.user.sub, {
    id,
    title,
    wordCount: words.length,
    hasWarning,
  });

  res.status(201).json({ ...book, isOwner: true });
});

// GET /api/books/:id/words
router.get('/:id/words', async (req, res) => {
  const accessible = await storage.canAccessBook(req.user.sub, req.params.id);
  if (!accessible) return res.status(404).json({ error: 'Not found' });

  const words = await storage.readWords(req.params.id);
  if (!words) return res.status(404).json({ error: 'Not found' });

  res.json(words);
});

// PUT /api/books/:id/progress
router.put('/:id/progress', async (req, res) => {
  const { index, wpm } = req.body;
  if (typeof index !== 'number') return res.status(400).json({ error: 'index required' });

  const accessible = await storage.canAccessBook(req.user.sub, req.params.id);
  if (!accessible) return res.status(404).json({ error: 'Not found' });

  await storage.saveProgress(req.user.sub, req.params.id, index, wpm || 300);
  res.status(204).end();
});

// DELETE /api/books/:id
router.delete('/:id', async (req, res) => {
  const book = await storage.getBook(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });

  const owned = await storage.isOwner(req.user.sub, req.params.id);
  if (!owned && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  await storage.deleteBook(req.params.id);
  res.status(204).end();
});

module.exports = router;
