// frontend/src/context/AuthContext.jsx

import React, { createContext, useState, useContext } from 'react';
import { fetchCurrentUser } from '../api/apiService';

const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const refreshUser = async () => {
    const sessionToken = localStorage.getItem('authToken');
    if (!sessionToken) {
      logout();
      return;
    }
    try {
      const response = await fetchCurrentUser();
      const userData = response.data;

      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      setToken(sessionToken);
    } catch (error) {
      console.error("Failed to refresh user:", error);
      logout();
    }
  };

  const login = async (newToken) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    try {
      const response = await fetchCurrentUser();
      const userData = response.data;

      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (error) {
      console.error("AuthContext Error:", error);
      logout();
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
