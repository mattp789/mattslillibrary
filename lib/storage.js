// lib/storage.js
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const CACHE_DIR = path.join(__dirname, '../cache');

function ensureDirs() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function metaPath(id) {
  return path.join(UPLOADS_DIR, `${id}.meta.json`);
}

function pdfPath(id) {
  return path.join(UPLOADS_DIR, `${id}.pdf`);
}

function cachePath(id) {
  return path.join(CACHE_DIR, `${id}.json`);
}

function listBooks() {
  ensureDirs();
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.meta.json'));
  return files
    .map(f => {
      const id = f.replace('.meta.json', '');
      return JSON.parse(fs.readFileSync(metaPath(id), 'utf8'));
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function saveBook(id, meta) {
  ensureDirs();
  fs.writeFileSync(metaPath(id), JSON.stringify(meta));
}

function getBook(id) {
  const p = metaPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveWords(id, words) {
  ensureDirs();
  fs.writeFileSync(cachePath(id), JSON.stringify(words));
}

function readWords(id) {
  const p = cachePath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveProgress(id, index, wpm) {
  const meta = getBook(id);
  if (!meta) return;
  meta.progress = index;
  if (wpm !== undefined) meta.savedWpm = wpm;
  fs.writeFileSync(metaPath(id), JSON.stringify(meta));
}

function deleteBook(id) {
  [metaPath(id), pdfPath(id), cachePath(id)].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
}

module.exports = {
  ensureDirs,
  listBooks,
  saveBook,
  getBook,
  saveWords,
  readWords,
  saveProgress,
  deleteBook,
  pdfPath,
};
