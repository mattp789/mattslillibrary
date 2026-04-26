# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-tab admin panel (Users, Shared Library, All Books) that lets the admin manage accounts, the shared library, and all user books.

**Architecture:** `AdminScreen.jsx` holds three tabs as local state. Each tab fetches from the relevant `/api/admin/*` endpoints on mount. Modals and confirmation dialogs are implemented as simple conditional renders within the same component — no routing library needed. This replaces the stub created in Plan 2.

**Prerequisites:** Plans 1 and 2 must be complete before this plan is executed.

**Tech Stack:** React, existing CSS vars, admin API calls already in api.js

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Replace | `client/src/screens/AdminScreen.jsx` | Full three-tab admin panel |
| Modify | `client/src/index.css` | Admin panel styles |

---

### Task 1: Users tab

**Files:**
- Replace: `client/src/screens/AdminScreen.jsx`
- Modify: `client/src/index.css`

- [ ] **Step 1: Write failing test**

Create `client/src/screens/AdminScreen.test.jsx`:

```jsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import AdminScreen from './AdminScreen.jsx';

vi.mock('../api.js', () => ({
  adminListUsers: vi.fn(),
  adminCreateUser: vi.fn(),
  adminDeleteUser: vi.fn(),
  adminResetPassword: vi.fn(),
  adminListBooks: vi.fn(),
  adminDeleteBook: vi.fn(),
  adminShareBook: vi.fn(),
  adminUnshareBook: vi.fn(),
  uploadBook: vi.fn(),
}));

import * as api from '../api.js';

const USERS = [
  { id: 'u1', username: 'alice', email: 'alice@x.com', role: 'user', createdAt: '2026-01-01' },
];

describe('AdminScreen — Users tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.adminListUsers.mockResolvedValue(USERS);
    api.adminListBooks.mockResolvedValue([]);
  });

  test('renders Users tab by default and lists users', async () => {
    render(<AdminScreen onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeTruthy();
    });
  });

  test('shows Add User form when button clicked', async () => {
    render(<AdminScreen onBack={() => {}} />);
    await waitFor(() => screen.getByText('alice'));
    fireEvent.click(screen.getByText('Add User'));
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
  });

  test('calls adminCreateUser and refreshes list', async () => {
    api.adminCreateUser.mockResolvedValueOnce(
      { id: 'u2', username: 'bob', email: 'bob@x.com', role: 'user', createdAt: '2026-01-02' }
    );
    api.adminListUsers.mockResolvedValueOnce(USERS).mockResolvedValueOnce([...USERS,
      { id: 'u2', username: 'bob', email: 'bob@x.com', role: 'user', createdAt: '2026-01-02' },
    ]);
    render(<AdminScreen onBack={() => {}} />);
    await waitFor(() => screen.getByText('alice'));
    fireEvent.click(screen.getByText('Add User'));
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'bob' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bob@x.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw123' } });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => {
      expect(api.adminCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'bob', email: 'bob@x.com' })
      );
    });
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npm run test:client -- --reporter=verbose
```

Expected: FAIL — AdminScreen stub doesn't render a users list

- [ ] **Step 3: Create the full AdminScreen.jsx with Users tab**

```jsx
// client/src/screens/AdminScreen.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  adminListUsers, adminCreateUser, adminDeleteUser, adminResetPassword,
  adminListBooks, adminDeleteBook, adminShareBook, adminUnshareBook,
  uploadBook,
} from '../api.js';

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', email: '', password: '', role: 'user' });
  const [addError, setAddError] = useState('');
  const [resetTarget, setResetTarget] = useState(null); // { id, username }
  const [resetPw, setResetPw] = useState('');

  const load = useCallback(() => adminListUsers().then(setUsers), []);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setAddError('');
    try {
      await adminCreateUser(addForm);
      setAddForm({ username: '', email: '', password: '', role: 'user' });
      setShowAdd(false);
      load();
    } catch (err) {
      setAddError(err.message);
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"? This also deletes all their books.`)) return;
    await adminDeleteUser(id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const handleReset = async (e) => {
    e.preventDefault();
    await adminResetPassword(resetTarget.id, resetPw);
    setResetTarget(null);
    setResetPw('');
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Users</h2>
        <button className="admin-add-btn" onClick={() => setShowAdd(s => !s)}>
          {showAdd ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showAdd && (
        <form className="admin-form" onSubmit={handleCreate}>
          <label htmlFor="a-username">Username</label>
          <input id="a-username" required value={addForm.username}
            onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))} />

          <label htmlFor="a-email">Email</label>
          <input id="a-email" type="email" required value={addForm.email}
            onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />

          <label htmlFor="a-password">Password</label>
          <input id="a-password" type="password" required value={addForm.password}
            onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} />

          <label htmlFor="a-role">Role</label>
          <select id="a-role" value={addForm.role}
            onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          {addError && <p className="admin-error">{addError}</p>}
          <button type="submit">Create</button>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="admin-actions">
                <button onClick={() => { setResetTarget(u); setResetPw(''); }}>
                  Reset PW
                </button>
                <button className="btn-danger" onClick={() => handleDelete(u.id, u.username)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {resetTarget && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h3>Reset password for {resetTarget.username}</h3>
            <form onSubmit={handleReset}>
              <label htmlFor="r-pw">New password</label>
              <input id="r-pw" type="password" required value={resetPw}
                onChange={e => setResetPw(e.target.value)} autoFocus />
              <div className="admin-modal-btns">
                <button type="submit">Save</button>
                <button type="button" onClick={() => setResetTarget(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Library tab ─────────────────────────────────────────────────────────

function SharedLibraryTab() {
  const [books, setBooks] = useState([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() =>
    adminListBooks().then(all => setBooks(all.filter(b => b.isShared))),
  []);
  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const book = await uploadBook(file);
      // Mark as shared immediately
      await adminShareBook(book.id);
      load();
    } catch {
      alert('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleUnshare = async (id) => {
    if (!window.confirm('Unshare this book? It will return to your private library.')) return;
    await adminUnshareBook(id);
    setBooks(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>Shared Library</h2>
        <label className={`admin-add-btn${uploading ? ' disabled' : ''}`}>
          {uploading ? 'Uploading…' : 'Upload Shared Book'}
          <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
            onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <div className="book-grid">
        {books.length === 0 && (
          <div className="empty-state"><p>No shared books yet.</p></div>
        )}
        {books.map(b => (
          <div key={b.id} className="book-card">
            <div className="book-title" title={b.title}>{b.title}</div>
            <div className="word-count">{b.wordCount?.toLocaleString()} words</div>
            <div className="book-actions">
              <button onClick={() => handleUnshare(b.id)}>Unshare</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── All Books tab ──────────────────────────────────────────────────────────────

function AllBooksTab() {
  const [books, setBooks] = useState([]);

  const load = useCallback(() => adminListBooks().then(setBooks), []);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await adminDeleteBook(id);
    setBooks(prev => prev.filter(b => b.id !== id));
  };

  const handleShare = async (book) => {
    if (book.isShared) {
      await adminUnshareBook(book.id);
    } else {
      await adminShareBook(book.id);
    }
    load();
  };

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2>All Books</h2>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Owner</th>
            <th>Words</th>
            <th>Shared</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {books.map(b => (
            <tr key={b.id}>
              <td>{b.title}</td>
              <td>{b.ownerUsername}</td>
              <td>{b.wordCount?.toLocaleString()}</td>
              <td>{b.isShared ? '✓' : '—'}</td>
              <td className="admin-actions">
                <button onClick={() => handleShare(b)}>
                  {b.isShared ? 'Unshare' : 'Share'}
                </button>
                <button className="btn-danger" onClick={() => handleDelete(b.id, b.title)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── AdminScreen shell ──────────────────────────────────────────────────────────

const TABS = ['Users', 'Shared Library', 'All Books'];

export default function AdminScreen({ onBack }) {
  const [tab, setTab] = useState('Users');

  return (
    <div className="admin-screen">
      <div className="admin-top-bar">
        <button className="back-btn" onClick={onBack}>← Library</button>
        <span className="admin-title">Admin</span>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`admin-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Users'          && <UsersTab />}
      {tab === 'Shared Library' && <SharedLibraryTab />}
      {tab === 'All Books'      && <AllBooksTab />}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
npm run test:client -- --reporter=verbose
```

Expected: PASS (AdminScreen tests pass; all other tests still pass)

- [ ] **Step 5: Add admin styles to client/src/index.css**

Append to the end of `client/src/index.css`:

```css
/* ── Admin Panel ── */
.admin-screen {
  max-width: 960px;
  margin: 0 auto;
  padding: 0.75rem 1rem 2rem;
}

.admin-top-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.admin-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-muted);
}

.admin-tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
}

.admin-tab {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.admin-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.admin-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.admin-section-header h2 {
  font-size: 1.1rem;
}

.admin-add-btn {
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: var(--radius);
  padding: 0.45rem 1rem;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.admin-add-btn.disabled { opacity: 0.5; cursor: not-allowed; }

.admin-form {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.5rem;
  max-width: 400px;
}

.admin-form label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.admin-form input,
.admin-form select {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  padding: 0.45rem 0.7rem;
  font-size: 0.95rem;
  font-family: inherit;
  margin-bottom: 0.2rem;
  width: 100%;
}

.admin-form button[type="submit"] {
  margin-top: 0.4rem;
  background: var(--accent);
  color: #000;
  border: none;
  border-radius: var(--radius);
  padding: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}

.admin-error {
  color: var(--danger);
  font-size: 0.82rem;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.admin-table th,
.admin-table td {
  text-align: left;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--border);
}

.admin-table th {
  color: var(--text-muted);
  font-weight: 500;
}

.admin-actions {
  display: flex;
  gap: 0.4rem;
}

.admin-actions button {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 4px;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-danger {
  color: var(--danger) !important;
  border-color: var(--danger) !important;
}

/* Reset password modal */
.admin-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.admin-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.admin-modal h3 {
  font-size: 1rem;
}

.admin-modal label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.admin-modal input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  padding: 0.45rem 0.7rem;
  font-family: inherit;
  font-size: 0.95rem;
  margin-top: 0.25rem;
}

.admin-modal-btns {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.admin-modal-btns button {
  flex: 1;
  padding: 0.5rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 0.9rem;
}

.admin-modal-btns button[type="submit"] {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: 600;
}
```

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Smoke-test in browser**

Start dev servers:

```bash
npm run dev
```

Log in as admin, click Admin button in library. Verify:
- Users tab loads and shows your admin account
- Add User form creates a new account
- Reset Password modal works
- Shared Library tab shows shared books (empty initially)
- All Books tab lists all books across all users
- Share/Unshare toggles work

- [ ] **Step 8: Commit**

```bash
git add client/src/screens/AdminScreen.jsx client/src/screens/AdminScreen.test.jsx client/src/index.css
git commit -m "feat: full admin panel — users, shared library, all books"
```
