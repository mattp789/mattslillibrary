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
    try {
      await adminResetPassword(resetTarget.id, resetPw);
      setResetTarget(null);
      setResetPw('');
    } catch {
      alert('Password reset failed');
    }
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
    try {
      await adminDeleteBook(id);
      setBooks(prev => prev.filter(b => b.id !== id));
    } catch {
      alert('Delete failed');
    }
  };

  const handleShare = async (book) => {
    try {
      if (book.isShared) {
        await adminUnshareBook(book.id);
      } else {
        await adminShareBook(book.id);
      }
      load();
    } catch {
      alert('Share toggle failed');
    }
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
