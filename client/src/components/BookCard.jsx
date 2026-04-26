// client/src/components/BookCard.jsx
export default function BookCard({ book, onOpen, onDelete }) {
  return (
    <div className={`book-card${book.hasWarning ? ' has-warning' : ''}`}>
      {book.hasWarning && <span className="warning-badge" title="Text extraction failed">⚠</span>}
      <p className="book-title">{book.title}</p>
      <p className="word-count">{book.wordCount.toLocaleString()} words</p>
      {book.hasWarning && (
        <p className="warning-msg">Could not extract text. PDF may be scanned or image-based.</p>
      )}
      <div className="book-actions">
        <button className="btn-read" onClick={onOpen} disabled={book.hasWarning}>Read</button>
        <button onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
