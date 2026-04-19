import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('curalink_user');
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    if (parsedUser?.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${parsedUser.token}`;
    }
    return parsedUser;
  });

  // Configure Axios interceptor for JWT
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use((config) => {
      if (user?.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
      return config;
    });

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [user]);

  const login = async (email, password) => {
    const API = import.meta.env.VITE_API_URL;
    const { data } = await axios.post(`${API}/auth/login`, { email, password });
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    sessionStorage.setItem('curalink_user', JSON.stringify(data));
  };

  const register = async (name, email, password, otp) => {
    const API = import.meta.env.VITE_API_URL;
    const { data } = await axios.post(`${API}/auth/register`, { name, email, password, otp });
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    sessionStorage.setItem('curalink_user', JSON.stringify(data));
  };

  const logout = () => {
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    sessionStorage.removeItem('curalink_user');
  };

  const verifyOtpLogin = async (data) => {
    // We already passed the completed object containing the token
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data);
    sessionStorage.setItem('curalink_user', JSON.stringify(data));
  };

  return (
    <AuthContext.Provider value={{ user, token: user?.token, login, register, logout, verifyOtpLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
