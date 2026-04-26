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
