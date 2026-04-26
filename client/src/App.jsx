import { useState } from 'react';
import LibraryScreen from './screens/LibraryScreen.jsx';
import ReaderScreen from './screens/ReaderScreen.jsx';

export default function App() {
  const [currentBook, setCurrentBook] = useState(null);

  if (currentBook) {
    return <ReaderScreen book={currentBook} onBack={() => setCurrentBook(null)} />;
  }
  return <LibraryScreen onOpen={setCurrentBook} />;
}
