// client/src/screens/LibraryScreen.jsx
import { useState, useEffect } from 'react';
import { listBooks, uploadBook, deleteBook as apiDeleteBook } from '../api.js';
import BookCard from '../components/BookCard.jsx';
import Toast from '../components/Toast.jsx';

export default function LibraryScreen({ onOpen }) {
  const [books, setBooks] = useState([]);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setBooks(await listBooks());
    } catch {
      showToast('Failed to load library');
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      return showToast('Please select a PDF file');
    }
    setUploading(true);
    try {
      await uploadBook(file);
      await load();
    } catch {
      showToast('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await apiDeleteBook(id);
      setBooks(prev => prev.filter(b => b.id !== id));
    } catch {
      showToast('Delete failed');
    }
  }

  return (
    <div className="library-screen">
      <div className="library-header">
        <h1>Library</h1>
        <label className={`upload-btn${uploading ? ' disabled' : ''}`}>
          {uploading ? 'Uploading…' : 'Upload PDF'}
          <input type="file" accept=".pdf,application/pdf" onChange={handleFileChange} hidden disabled={uploading} />
        </label>
      </div>

      <div className="book-grid">
        {books.map(book => (
          <BookCard
            key={book.id}
            book={book}
            onOpen={() => onOpen(book)}
            onDelete={() => handleDelete(book.id)}
          />
        ))}
        {books.length === 0 && !uploading && (
          <p className="empty-state">No books yet — upload a PDF to get started.</p>
        )}
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
