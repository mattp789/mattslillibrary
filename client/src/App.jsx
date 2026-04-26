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
