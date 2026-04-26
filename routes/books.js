// routes/books.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const storage = require('../lib/storage');
const { extractWords } = require('../lib/extract');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../uploads'),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
    cb(null, isPdf);
  },
});

// GET /api/books
router.get('/', (req, res) => {
  res.json(storage.listBooks());
});

// POST /api/books
router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File must be a PDF' });
  }

  const id = uuidv4();
  const title = path.basename(req.file.originalname, '.pdf');
  const finalPath = storage.pdfPath(id);

  fs.renameSync(req.file.path, finalPath);

  let words = [];
  let hasWarning = false;

  try {
    words = await extractWords(finalPath);
    if (words.length === 0) hasWarning = true;
  } catch (err) {
    console.error('PDF extraction failed:', err);
    hasWarning = true;
  }

  const meta = { id, title, wordCount: words.length, hasWarning, createdAt: Date.now() };
  storage.saveBook(id, meta);

  if (words.length > 0) {
    storage.saveWords(id, words);
  }

  res.status(201).json(meta);
});

// GET /api/books/:id/words
router.get('/:id/words', (req, res) => {
  const words = storage.readWords(req.params.id);
  if (!words) return res.status(404).json({ error: 'Not found' });
  res.json(words);
});

// PUT /api/books/:id/progress
router.put('/:id/progress', (req, res) => {
  const { index, wpm } = req.body;
  if (typeof index !== 'number') return res.status(400).json({ error: 'index required' });
  const book = storage.getBook(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  storage.saveProgress(req.params.id, index, wpm);
  res.status(204).end();
});

// DELETE /api/books/:id
router.delete('/:id', (req, res) => {
  const book = storage.getBook(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  storage.deleteBook(req.params.id);
  res.status(204).end();
});

module.exports = router;
