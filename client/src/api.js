// client/src/api.js
const BASE = '/api';

export async function listBooks() {
  const res = await fetch(`${BASE}/books`);
  if (!res.ok) throw new Error('Failed to fetch books');
  return res.json();
}

export async function uploadBook(file) {
  const fd = new FormData();
  fd.append('pdf', file);
  const res = await fetch(`${BASE}/books`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function getWords(id) {
  const res = await fetch(`${BASE}/books/${id}/words`);
  if (!res.ok) throw new Error('Failed to load book');
  return res.json();
}

export async function deleteBook(id) {
  const res = await fetch(`${BASE}/books/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}
