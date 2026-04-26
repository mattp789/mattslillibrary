// routes/admin.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const storage = require('../lib/storage');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, email, username, role, created_at AS "createdAt"
     FROM users ORDER BY created_at DESC`
  );
  res.json(rows);
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
  const { email, username, password, role = 'user' } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'email, username and password required' });
  }
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be user or admin' });
  }
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await db.query(
      `INSERT INTO users (email, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, role, created_at AS "createdAt"`,
      [email, username, hash, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    throw err;
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.sub) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// PUT /api/admin/users/:id/password
router.put('/users/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });
  const hash = await bcrypt.hash(password, 12);
  const { rowCount } = await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [hash, req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// GET /api/admin/books
router.get('/books', async (req, res) => {
  const { rows } = await db.query(
    `SELECT b.id, b.title,
            b.word_count  AS "wordCount",
            b.has_warning AS "hasWarning",
            b.is_shared   AS "isShared",
            b.created_at  AS "createdAt",
            u.username    AS "ownerUsername"
     FROM books b
     JOIN users u ON u.id = b.owner_id
     ORDER BY b.created_at DESC`
  );
  res.json(rows);
});

// DELETE /api/admin/books/:id
router.delete('/books/:id', async (req, res) => {
  const book = await storage.getBook(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  await storage.deleteBook(req.params.id);
  res.status(204).end();
});

// PUT /api/admin/books/:id/share
router.put('/books/:id/share', async (req, res) => {
  const { rowCount } = await db.query(
    'UPDATE books SET is_shared = TRUE WHERE id = $1',
    [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// DELETE /api/admin/books/:id/share
router.delete('/books/:id/share', async (req, res) => {
  const { rowCount } = await db.query(
    'UPDATE books SET is_shared = FALSE WHERE id = $1',
    [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
