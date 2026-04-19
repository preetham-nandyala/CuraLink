import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('curalink_token'));
  const [loading, setLoading] = useState(true);

  // Synchronize token state with localStorage and auth headers
  useEffect(() => {
    if (token) {
      localStorage.setItem('curalink_token', token);
      verifyToken();
    } else {
      localStorage.removeItem('curalink_token');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Handle 401 or Invalid token
        logout();
      }
    } catch (error) {
      console.error('Auth verification failed', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (jwtToken, userData) => {
    setToken(jwtToken);
    setUser(userData);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('curalink_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
