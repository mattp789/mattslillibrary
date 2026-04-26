// lib/storage.js
const db = require('./db');
const r2 = require('./r2');

async function listBooks(userId) {
  const { rows } = await db.query(
    `SELECT b.id, b.title,
            b.word_count  AS "wordCount",
            b.has_warning AS "hasWarning",
            b.is_shared   AS "isShared",
            b.created_at  AS "createdAt",
            (b.owner_id = $1)          AS "isOwner",
            COALESCE(p.word_index, 0)  AS progress,
            COALESCE(p.wpm, 300)       AS "savedWpm"
     FROM books b
     LEFT JOIN progress p ON p.book_id = b.id AND p.user_id = $1
     WHERE b.owner_id = $1 OR b.is_shared = TRUE
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows;
}

async function saveBook(ownerId, { id, title, wordCount, hasWarning }) {
  const { rows } = await db.query(
    `INSERT INTO books (id, owner_id, title, word_count, has_warning)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title,
               word_count  AS "wordCount",
               has_warning AS "hasWarning",
               is_shared   AS "isShared",
               created_at  AS "createdAt"`,
    [id, ownerId, title, wordCount, hasWarning]
  );
  return rows[0];
}

async function getBook(id) {
  const { rows } = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return rows[0] || null;
}

async function canAccessBook(userId, bookId) {
  const { rows } = await db.query(
    'SELECT 1 FROM books WHERE id = $1 AND (owner_id = $2 OR is_shared = TRUE)',
    [bookId, userId]
  );
  return rows.length > 0;
}

async function isOwner(userId, bookId) {
  const { rows } = await db.query(
    'SELECT 1 FROM books WHERE id = $1 AND owner_id = $2',
    [bookId, userId]
  );
  return rows.length > 0;
}

async function deleteBook(id) {
  await db.query('DELETE FROM books WHERE id = $1', [id]);
  await Promise.allSettled([
    r2.remove(`pdfs/${id}.pdf`),
    r2.remove(`cache/${id}.json`),
  ]);
}

async function saveWords(id, words) {
  await r2.upload(`cache/${id}.json`, Buffer.from(JSON.stringify(words)), 'application/json');
}

async function readWords(id) {
  try {
    const buf = await r2.download(`cache/${id}.json`);
    return JSON.parse(buf.toString());
  } catch {
    return null;
  }
}

async function uploadPdf(id, buffer) {
  await r2.upload(`pdfs/${id}.pdf`, buffer, 'application/pdf');
}

async function saveProgress(userId, bookId, wordIndex, wpm) {
  await db.query(
    `INSERT INTO progress (user_id, book_id, word_index, wpm, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, book_id) DO UPDATE
     SET word_index = $3, wpm = $4, updated_at = NOW()`,
    [userId, bookId, wordIndex, wpm]
  );
}

async function getProgress(userId, bookId) {
  const { rows } = await db.query(
    'SELECT word_index AS "wordIndex", wpm FROM progress WHERE user_id = $1 AND book_id = $2',
    [userId, bookId]
  );
  return rows[0] || { wordIndex: 0, wpm: 300 };
}

module.exports = {
  listBooks, saveBook, getBook, canAccessBook, isOwner,
  deleteBook, saveWords, readWords, uploadPdf,
  saveProgress, getProgress,
};
