export default function ReaderScreen({ book, onBack }) {
  return <div className="reader-screen"><button className="back-btn" onClick={onBack}>← Back</button><p>{book.title}</p></div>;
}
