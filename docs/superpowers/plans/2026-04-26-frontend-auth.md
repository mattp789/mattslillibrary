# Frontend Auth + Per-user UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a login screen, gate the app behind authentication, and update the book library to show per-user ownership and shared book badges.

**Architecture:** A React context (`AuthContext`) holds the authenticated user and exposes login/logout. `App.jsx` calls `GET /api/auth/me` on mount — shows a blank screen while loading, `LoginScreen` if not authenticated, and the normal library/reader if authenticated. All fetch calls gain `credentials: 'include'` so the JWT cookie is sent cross-origin. `VITE_API_URL` env var points the client at the Fly.io backend in production.

**Prerequisites:** Plan 1 (Backend Foundation) must be fully deployed and working before this plan is executed.

**Tech Stack:** React context, Vite env vars, existing CSS vars

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `client/src/api.js` | VITE_API_URL base, credentials: include, auth + admin calls |
| Create | `client/src/context/AuthContext.jsx` | User state, login, logout |
| Create | `client/src/screens/LoginScreen.jsx` | Email + password form |
| Modify | `client/src/App.jsx` | Auth gate, AuthProvider wrapper |
| Modify | `client/src/screens/LibraryScreen.jsx` | Shared badge, isOwner guard, logout button |
| Modify | `client/src/index.css` | Login screen styles |

---

### Task 1: Update client/src/api.js

**Files:**
- Modify: `client/src/api.js`

All fetch calls need `credentials: 'include'` so cookies are sent cross-origin. The base URL changes from the hardcoded `/api` to `${VITE_API_URL}/api` so production builds point at the Fly.io backend. Auth and admin calls are added.

- [ ] **Step 1: Write failing test**

Create `client/src/api.test.js`:

```js
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('login', () => {
  test('POSTs credentials and returns user on success', async () => {
    const { login } = await import('./api.js');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: '1', username: 'alice', role: 'user' }),
    });
    const user = await login('a@b.com', 'pw');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
    expect(user.username).toBe('alice');
  });

  test('throws on non-ok response', async () => {
    const { login } = await import('./api.js');
    fetch.mockResolvedValueOnce({ ok: false });
    await expect(login('a@b.com', 'bad')).rejects.toThrow();
  });
});

describe('listBooks', () => {
  test('sends credentials', async () => {
    const { listBooks } = await import('./api.js');
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    await listBooks();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/books'),
      expect.objectContaining({ credentials: 'include' })
    );
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:client -- --reporter=verbose
```

Expected: FAIL — api.js has no `login` export and no `credentials: 'include'`

- [ ] **Step 3: Replace client/src/api.js entirely**

```js
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
```

- [ ] **Step 4: Run test**

```bash
npm run test:client -- --reporter=verbose
```

Expected: PASS (api tests pass; existing tests for ORPDisplay, readerReducer, etc. still pass)

- [ ] **Step 5: Commit**

```bash
git add client/src/api.js client/src/api.test.js
git commit -m "feat: update api.js for auth, VITE_API_URL, credentials"
```

---

### Task 2: Create AuthContext

**Files:**
- Create: `client/src/context/AuthContext.jsx`

- [ ] **Step 1: Create context directory and file**

```bash
mkdir -p client/src/context
```

Create `client/src/context/AuthContext.jsx`:

```jsx
// client/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, logout as apiLogout } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = loading, null = not authenticated, object = authenticated user
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const login = (userData) => setUser(userData);

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 2: Commit**

```bash
git add client/src/context/AuthContext.jsx
git commit -m "feat: add AuthContext for user state"
```

---

### Task 3: Create LoginScreen and add CSS

**Files:**
- Create: `client/src/screens/LoginScreen.jsx`
- Modify: `client/src/index.css`

- [ ] **Step 1: Write failing test**

Create `client/src/screens/LoginScreen.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import LoginScreen from './LoginScreen.jsx';

vi.mock('../api.js', () => ({ login: vi.fn() }));
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

import * as api from '../api.js';

describe('LoginScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  test('renders email and password fields', () => {
    render(<LoginScreen />);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  test('shows error message on failed login', async () => {
    api.login.mockRejectedValueOnce(new Error('bad'));
    render(<LoginScreen />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:client -- --reporter=verbose
```

Expected: FAIL — "Cannot find module './LoginScreen.jsx'"

- [ ] **Step 3: Create client/src/screens/LoginScreen.jsx**

```jsx
// client/src/screens/LoginScreen.jsx
import { useState } from 'react';
import { login as apiLogin } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await apiLogin(email, password);
      login(user);
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>RSVP Reader</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add login styles to client/src/index.css**

Append to the end of `client/src/index.css`:

```css
/* ── Login ── */
.login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 1rem;
}

.login-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2rem;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.login-card h1 {
  font-size: 1.4rem;
  text-align: center;
  color: var(--accent);
}

.login-card form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.login-card label {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.login-card input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  padding: 0.55rem 0.75rem;
  font-size: 1rem;
  font-family: inherit;
  margin-bottom: 0.4rem;
}

.login-card button[type="submit"] {
  margin-top: 0.4rem;
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: var(--radius);
  padding: 0.7rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.login-card button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-error {
  color: var(--danger);
  font-size: 0.85rem;
  text-align: center;
}
```

- [ ] **Step 5: Run test**

```bash
npm run test:client -- --reporter=verbose
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/screens/LoginScreen.jsx client/src/screens/LoginScreen.test.jsx client/src/index.css
git commit -m "feat: add login screen"
```

---

### Task 4: Update App.jsx with auth gate

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Replace client/src/App.jsx**

```jsx
// client/src/App.jsx
import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LibraryScreen from './screens/LibraryScreen.jsx';
import ReaderScreen from './screens/ReaderScreen.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import AdminScreen from './screens/AdminScreen.jsx';

function AppRoutes() {
  const { user } = useAuth();
  const [currentBook, setCurrentBook] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  if (user === undefined) return null; // loading — blank screen avoids flash

  if (!user) return <LoginScreen />;

  if (showAdmin && user.role === 'admin') {
    return <AdminScreen onBack={() => setShowAdmin(false)} />;
  }

  if (currentBook) {
    return <ReaderScreen book={currentBook} onBack={() => setCurrentBook(null)} />;
  }

  return (
    <LibraryScreen
      user={user}
      onOpen={setCurrentBook}
      onAdmin={user.role === 'admin' ? () => setShowAdmin(true) : null}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
```

Note: `AdminScreen` is imported here but doesn't exist yet — it will be created in Plan 3. Create a temporary stub now to keep the build green:

Create `client/src/screens/AdminScreen.jsx`:

```jsx
// client/src/screens/AdminScreen.jsx — stub, replaced in Plan 3
export default function AdminScreen({ onBack }) {
  return (
    <div style={{ padding: '2rem' }}>
      <button onClick={onBack}>← Back</button>
      <p>Admin panel coming soon.</p>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify no import errors**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/App.jsx client/src/screens/AdminScreen.jsx
git commit -m "feat: add auth gate and admin route to App"
```

---

### Task 5: Update LibraryScreen for per-user UI

**Files:**
- Modify: `client/src/screens/LibraryScreen.jsx`

Changes:
- Accept `user` and `onAdmin` props
- Show "Admin" button in header when `onAdmin` is provided
- Show "Sign out" button in header
- Show a "Shared" badge on books where `isShared === true`
- Hide the delete button on books where `isOwner === false`

- [ ] **Step 1: Read current LibraryScreen.jsx**

Read `client/src/screens/LibraryScreen.jsx` before editing to capture its current content.

- [ ] **Step 2: Replace client/src/screens/LibraryScreen.jsx**

```jsx
// client/src/screens/LibraryScreen.jsx
import { useState, useEffect } from 'react';
import { listBooks, uploadBook, deleteBook } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LibraryScreen({ onOpen, onAdmin }) {
  const { user, logout } = useAuth();
  const [books, setBooks] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    listBooks().then(setBooks).catch(() => showToast('Failed to load library'));
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast('Only PDF files are supported');
      return;
    }
    setUploading(true);
    try {
      const book = await uploadBook(file);
      setBooks(prev => [book, ...prev]);
      if (book.hasWarning) showToast('Upload succeeded but text extraction failed — try a text-based PDF');
    } catch {
      showToast('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    try {
      await deleteBook(id);
    } catch {
      showToast('Delete failed');
      listBooks().then(setBooks);
    }
  };

  return (
    <div className="library-screen">
      <div className="library-header">
        <h1>Library</h1>
        <div className="library-header-actions">
          {onAdmin && (
            <button className="admin-btn" onClick={onAdmin}>Admin</button>
          )}
          <label className={`upload-btn${uploading ? ' disabled' : ''}`}>
            {uploading ? 'Uploading…' : '+ Upload PDF'}
            <input
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
          <button className="signout-btn" onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="book-grid">
        {books.length === 0 && (
          <div className="empty-state">
            <p>No books yet. Upload a PDF to get started.</p>
          </div>
        )}
        {books.map(book => (
          <div key={book.id} className={`book-card${book.hasWarning ? ' has-warning' : ''}`}>
            {book.isShared && <span className="shared-badge">Shared</span>}
            {book.hasWarning && <span className="warning-badge" title="Text extraction failed">⚠</span>}
            <div className="book-title" title={book.title}>{book.title}</div>
            <div className="word-count">{book.wordCount.toLocaleString()} words</div>
            {book.hasWarning && (
              <p className="warning-msg">Text could not be extracted — this may be a scanned PDF.</p>
            )}
            <div className="book-actions">
              <button className="btn-read" onClick={() => onOpen(book)}>Read</button>
              {book.isOwner && (
                <button onClick={() => handleDelete(book.id)}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Add shared badge + header action styles to index.css**

Append to `client/src/index.css`:

```css
.library-header-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.admin-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  font-size: 0.9rem;
}

.signout-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  font-size: 0.9rem;
}

.shared-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.75rem;
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent);
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Smoke-test in browser**

Start both dev servers:

```bash
npm run dev
```

Open `http://localhost:5173`. You should see the login screen. Log in with your admin account. The library should load (empty or with books). Verify:
- "Sign out" button appears and works
- "Admin" button appears for the admin account
- Uploading a PDF works (if backend is running locally with real R2/Neon credentials)

- [ ] **Step 6: Commit**

```bash
git add client/src/screens/LibraryScreen.jsx client/src/index.css
git commit -m "feat: library shows shared badges, isOwner delete guard, admin + signout buttons"
```
