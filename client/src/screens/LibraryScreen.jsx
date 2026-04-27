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
    if (!/\.(pdf|epub)$/i.test(file.name) && !['application/pdf', 'application/epub+zip'].includes(file.type)) {
      showToast('Only PDF and EPUB files are supported');
      return;
    }
    setUploading(true);
    try {
      const book = await uploadBook(file);
      setBooks(prev => [book, ...prev]);
      if (book.hasWarning) showToast(book.warningReason || 'Upload succeeded but text extraction failed');
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
            {uploading ? 'Uploading…' : '+ Upload Book'}
            <input
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
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
            <p>No books yet. Upload a PDF or EPUB to get started.</p>
          </div>
        )}
        {books.map(book => (
          <div key={book.id} className={`book-card${book.hasWarning ? ' has-warning' : ''}`}>
            {(book.isShared || book.hasWarning) && (
              <div className="book-badges">
                {book.isShared && <span className="shared-badge">Shared</span>}
                {book.hasWarning && <span className="warning-badge" title="Text extraction failed">⚠</span>}
              </div>
            )}
            <div className="book-title" title={book.title}>{book.title}</div>
            <div className="word-count">{book.wordCount.toLocaleString()} words</div>
            {book.hasWarning && (
              <p className="warning-msg">Text could not be extracted — this may be a scanned or image-only file.</p>
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
