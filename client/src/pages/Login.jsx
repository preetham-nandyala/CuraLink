import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, Loader2, KeyRound, Mail, Lock, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Forgot Password States
  const [resetStep, setResetStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // --- Password Reset Handlers ---

  const handleSendResetOtp = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      await axios.post(`${API}/auth/forgot-password`, { email: resetEmail });
      setResetStep(2);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to send reset code. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyResetOtp = (e) => {
    e.preventDefault();
    if (resetOtp.length === 6) {
      setResetStep(3);
    } else {
      setResetError('Please enter a valid 6-digit code.');
    }
  };

  const handleFinalReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setResetError('Passwords do not match.');
    }
    if (newPassword.length < 6) {
      return setResetError('Password must be at least 6 characters.');
    }

    setResetError('');
    setResetLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      await axios.post(`${API}/auth/reset-password`, { 
        email: resetEmail, 
        otp: resetOtp, 
        newPassword 
      });
      setResetSuccess('Password updated successfully! You can now log in.');
      setTimeout(() => {
        closeModal();
      }, 2000);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const closeModal = () => {
    setShowForgotPassword(false);
    setResetStep(1);
    setResetEmail('');
    setResetOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setResetSuccess('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center font-body animate-fade-in px-4">
      
      {/* 🚀 MULTI-STEP FORGOT PASSWORD MODAL */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all duration-300"
            onClick={closeModal}
          />
          <div className="relative bg-surface rounded-3xl shadow-2xl z-10 p-8 w-[85vw] md:w-[60vw] lg:w-[40vw] max-w-[500px] border border-outline-variant/30 overflow-hidden transform transition-all animate-scale-in">
            
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 ring-4 ring-primary/5">
                {resetStep === 1 && <Mail size={32} />}
                {resetStep === 2 && <ShieldCheck size={32} />}
                {resetStep === 3 && <Lock size={32} />}
              </div>
              <h2 className="text-2xl font-headline font-bold text-on-surface mb-2">
                {resetStep === 1 && "Password Recovery"}
                {resetStep === 2 && "Verify Code"}
                {resetStep === 3 && "New Password"}
              </h2>
              <p className="text-on-surface-variant text-sm mb-8 leading-relaxed">
                {resetStep === 1 && "Enter your registered email to receive a 6-digit verification code."}
                {resetStep === 2 && `We've sent a secure code to ${resetEmail}. Check your inbox.`}
                {resetStep === 3 && "Create a strong new password to secure your account."}
              </p>
            </div>

            {resetError && (
              <div className="bg-error-container text-on-error-container p-3 rounded-xl text-sm font-medium text-center mb-6 animate-shake">
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="bg-success-container/20 border border-success/30 text-success p-3 rounded-xl text-sm font-medium text-center mb-6">
                {resetSuccess}
              </div>
            )}

            {/* STEP 1: EMAIL */}
            {resetStep === 1 && (
              <form onSubmit={handleSendResetOtp} className="space-y-5">
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 text-outline" size={18} />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-surface-variant/30 border border-outline-variant/50 rounded-2xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-on-surface text-[15px]"
                    placeholder="Enter account email"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={resetLoading}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {resetLoading ? <Loader2 className="animate-spin" size={20} /> : "Send Reset Code"}
                </button>
              </form>
            )}

            {/* STEP 2: OTP */}
            {resetStep === 2 && (
              <form onSubmit={handleVerifyResetOtp} className="space-y-6">
                <input
                  type="text"
                  maxLength={6}
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full py-5 text-center tracking-[0.8em] text-2xl font-mono bg-surface-variant/30 border border-outline-variant/50 rounded-2xl focus:border-primary outline-none transition-all text-on-surface shadow-inner"
                  placeholder="------"
                  autoFocus
                />
                <div className="flex flex-col gap-3">
                  <button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    Verify Code <ArrowRight size={18} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setResetStep(1)}
                    className="text-sm text-outline hover:text-primary transition-colors flex items-center justify-center gap-1"
                  >
                    <ArrowLeft size={14} /> Change email
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: NEW PASSWORD */}
            {resetStep === 3 && (
              <form onSubmit={handleFinalReset} className="space-y-4">
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 text-outline" size={18} />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-12 pr-4 py-4 bg-surface-variant/30 border border-outline-variant/50 rounded-2xl focus:border-primary outline-none transition-all text-on-surface text-[15px]"
                    placeholder="New password"
                  />
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 text-outline" size={18} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-surface-variant/30 border border-outline-variant/50 rounded-2xl focus:border-primary outline-none transition-all text-on-surface text-[15px]"
                    placeholder="Confirm new password"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={resetLoading}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 mt-4"
                >
                  {resetLoading ? <Loader2 className="animate-spin" size={20} /> : "Update Password"}
                </button>
              </form>
            )}
            
            <button 
              onClick={closeModal}
              className="mt-6 w-full text-xs text-outline font-medium hover:text-on-surface transition-colors"
            >
              Cancel recovery
            </button>
          </div>
        </div>
      )}

      {/* 🔐 MAIN LOGIN CARD */}
      <div className="w-full max-w-[420px] bg-surface md:p-8 rounded-3xl md:shadow-xl md:border md:border-outline-variant/20">
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white mb-5 shadow-lg shadow-primary/30 rotate-3 transform hover:rotate-0 transition-transform">
            <Stethoscope size={32} />
          </div>
          <h1 className="text-3xl font-bold font-headline text-on-surface tracking-tight text-center">Precise Care Starts Here</h1>
          <p className="text-on-surface-variant mt-2 text-sm">Enter details to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-error-container/20 border border-error/20 text-on-error-container p-4 rounded-2xl text-sm font-medium text-center animate-shake">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-outline uppercase ml-1">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 text-outline" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-surface-variant/10 border border-outline-variant/40 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-on-surface placeholder:text-outline/60 text-[15px]"
                placeholder="doctor@clinic.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-outline uppercase">Password</label>
              <button 
                type="button" 
                onClick={() => setShowForgotPassword(true)}
                className="text-xs font-bold text-primary hover:underline"
              >
                Forgot?
              </button>
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 text-outline" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-surface-variant/10 border border-outline-variant/40 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-on-surface placeholder:text-outline/60 text-[15px]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 mt-4 shadow-xl shadow-primary/20 text-lg active:scale-95"
          >
            {loading ? <><Loader2 className="animate-spin" size={20} /> Signing in...</> : "Sign In"}
          </button>
        </form>

        <div className="mt-10 flex flex-col items-center gap-4">
          <p className="text-sm text-outline">
            New to Curallink?{' '}
            <Link to="/register" className="text-primary font-bold hover:underline">
              Create Account
            </Link>
          </p>
          <div className="w-10 h-1 bg-outline-variant/30 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default Login;
