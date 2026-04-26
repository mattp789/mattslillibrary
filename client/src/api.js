// client/src/api.js
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';
const OPTS = { credentials: 'include' };

// Auth
export async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    ...OPTS, method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function logout() {
  await fetch(`${BASE}/auth/logout`, { ...OPTS, method: 'POST' });
}

export async function getMe() {
  const res = await fetch(`${BASE}/auth/me`, OPTS);
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

// Books
export async function listBooks() {
  const res = await fetch(`${BASE}/books`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch books');
  return res.json();
}

export async function uploadBook(file) {
  const fd = new FormData();
  fd.append('pdf', file);
  const res = await fetch(`${BASE}/books`, { ...OPTS, method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function getWords(id) {
  const res = await fetch(`${BASE}/books/${id}/words`, OPTS);
  if (!res.ok) throw new Error('Failed to load book');
  return res.json();
}

export async function saveProgress(id, index, wpm) {
  await fetch(`${BASE}/books/${id}/progress`, {
    ...OPTS, method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, wpm }),
  });
}

export async function deleteBook(id) {
  const res = await fetch(`${BASE}/books/${id}`, { ...OPTS, method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

// Admin — users
export async function adminListUsers() {
  const res = await fetch(`${BASE}/admin/users`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function adminCreateUser(data) {
  const res = await fetch(`${BASE}/admin/users`, {
    ...OPTS, method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to create user');
  }
  return res.json();
}

export async function adminDeleteUser(id) {
  const res = await fetch(`${BASE}/admin/users/${id}`, { ...OPTS, method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete user');
}

export async function adminResetPassword(id, password) {
  const res = await fetch(`${BASE}/admin/users/${id}/password`, {
    ...OPTS, method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error('Failed to reset password');
}

// Admin — books
export async function adminListBooks() {
  const res = await fetch(`${BASE}/admin/books`, OPTS);
  if (!res.ok) throw new Error('Failed to fetch books');
  return res.json();
}

export async function adminDeleteBook(id) {
  const res = await fetch(`${BASE}/admin/books/${id}`, { ...OPTS, method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete book');
}

export async function adminShareBook(id) {
  const res = await fetch(`${BASE}/admin/books/${id}/share`, { ...OPTS, method: 'PUT' });
  if (!res.ok) throw new Error('Failed to share book');
}

export async function adminUnshareBook(id) {
  const res = await fetch(`${BASE}/admin/books/${id}/share`, { ...OPTS, method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to unshare book');
}
