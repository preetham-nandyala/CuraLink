import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  
  // Also check local storage just in case state hasn't synced
  const hasToken = token || localStorage.getItem('curalink_token');

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
