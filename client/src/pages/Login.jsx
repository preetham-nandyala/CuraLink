import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, Loader2, Mail, Lock, ShieldCheck, ArrowRight, ArrowLeft, Sparkles, BookOpen, FlaskConical } from 'lucide-react';
import axios from 'axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Forgot Password States
  const [resetStep, setResetStep] = useState(1);
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

  const handleSendResetOtp = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL;
      await axios.post(`${API}/auth/forgot-password`, { email: resetEmail });
      setResetStep(2);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to send reset code.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyResetOtp = (e) => {
    e.preventDefault();
    if (resetOtp.length === 6) setResetStep(3);
    else setResetError('Please enter a valid 6-digit code.');
  };

  const handleFinalReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setResetError('Passwords do not match.');
    if (newPassword.length < 6) return setResetError('Password must be at least 6 characters.');

    setResetError('');
    setResetLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL;
      await axios.post(`${API}/auth/reset-password`, { email: resetEmail, otp: resetOtp, newPassword });
      setResetSuccess('Password updated! You can now log in.');
      setTimeout(() => closeModal(), 2000);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password.');
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

  const InputWithIcon = ({ icon: Icon, ...props }) => (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Icon size={18} style={{ position: 'absolute', left: '1rem', color: 'var(--outline)', pointerEvents: 'none' }} />
      <input {...props} style={{
        width: '100%', paddingLeft: '2.75rem', paddingRight: '1rem', paddingTop: '0.938rem', paddingBottom: '0.938rem',
        background: 'var(--surface-container)', border: '1.5px solid var(--outline-variant)', borderRadius: '14px',
        fontSize: '0.938rem', color: 'var(--on-surface)', outline: 'none', transition: 'all 0.2s',
        fontFamily: 'inherit',
        ...(props.style || {}),
      }}
        onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.1)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--outline-variant)'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );

  return (
    <div className="auth-page">
      {/* FORGOT PASSWORD MODAL */}
      {showForgotPassword && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={closeModal} />
          <div className="auth-card animate-scale-in" style={{ position: 'relative', zIndex: 10, maxWidth: '440px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--primary-fixed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', marginBottom: '1rem' }}>
                {resetStep === 1 && <Mail size={28} />}
                {resetStep === 2 && <ShieldCheck size={28} />}
                {resetStep === 3 && <Lock size={28} />}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--on-surface)', marginBottom: '0.375rem' }}>
                {resetStep === 1 && "Password Recovery"}
                {resetStep === 2 && "Verify Code"}
                {resetStep === 3 && "New Password"}
              </h2>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                {resetStep === 1 && "Enter your email to receive a verification code."}
                {resetStep === 2 && `Code sent to ${resetEmail}`}
                {resetStep === 3 && "Create a strong new password."}
              </p>
            </div>

            {resetError && <div style={{ background: 'var(--error-container)', color: 'var(--error)', padding: '0.75rem', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 500, textAlign: 'center', marginBottom: '1rem' }} className="animate-shake">{resetError}</div>}
            {resetSuccess && <div style={{ background: 'var(--success-container)', color: 'var(--success)', padding: '0.75rem', borderRadius: '12px', fontSize: '0.875rem', fontWeight: 500, textAlign: 'center', marginBottom: '1rem' }}>{resetSuccess}</div>}

            {resetStep === 1 && (
              <form onSubmit={handleSendResetOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <InputWithIcon icon={Mail} type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required placeholder="Enter account email" />
                <button type="submit" disabled={resetLoading} className="btn-primary" style={{ width: '100%', padding: '0.938rem', fontSize: '0.938rem' }}>
                  {resetLoading ? <Loader2 className="animate-spin" size={20} /> : "Send Reset Code"}
                </button>
              </form>
            )}

            {resetStep === 2 && (
              <form onSubmit={handleVerifyResetOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input type="text" maxLength={6} value={resetOtp} onChange={e => setResetOtp(e.target.value.replace(/\D/g, ''))} required autoFocus
                  style={{ width: '100%', padding: '1.125rem', textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.5rem', fontFamily: 'monospace', background: 'var(--surface-container)', border: '1.5px solid var(--outline-variant)', borderRadius: '14px', color: 'var(--on-surface)', outline: 'none' }}
                  placeholder="------"
                />
                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.938rem' }}>Verify Code <ArrowRight size={16} /></button>
                <button type="button" onClick={() => setResetStep(1)} style={{ background: 'none', border: 'none', color: 'var(--outline)', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <ArrowLeft size={14} /> Change email
                </button>
              </form>
            )}

            {resetStep === 3 && (
              <form onSubmit={handleFinalReset} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <InputWithIcon icon={Lock} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="New password" />
                <InputWithIcon icon={Lock} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm new password" />
                <button type="submit" disabled={resetLoading} className="btn-primary" style={{ width: '100%', padding: '0.938rem', marginTop: '0.5rem' }}>
                  {resetLoading ? <Loader2 className="animate-spin" size={20} /> : "Update Password"}
                </button>
              </form>
            )}

            <button onClick={closeModal} style={{ marginTop: '1.25rem', width: '100%', background: 'none', border: 'none', color: 'var(--outline)', fontSize: '0.813rem', cursor: 'pointer', fontWeight: 500 }}>
              Cancel recovery
            </button>
          </div>
        </div>
      )}

      {/* MAIN LOGIN CARD */}
      <div className="auth-card animate-fade-in">
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px',
            background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', marginBottom: '1.25rem',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.3)',
            transform: 'rotate(3deg)', transition: 'transform 0.3s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'rotate(0deg)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'rotate(3deg)'}
          >
            <Stethoscope size={30} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.03em', textAlign: 'center', lineHeight: 1.2 }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--on-surface-variant)', marginTop: '0.5rem', fontSize: '0.938rem', textAlign: 'center' }}>
            Sign in to access your research dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div className="animate-shake" style={{ background: 'var(--error-container)', border: '1px solid rgba(220,38,38,0.15)', color: 'var(--error)', padding: '0.875rem', borderRadius: '14px', fontSize: '0.875rem', fontWeight: 500, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '0.25rem' }}>Email</label>
            <InputWithIcon icon={Mail} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="doctor@clinic.com" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
              <button type="button" onClick={() => setShowForgotPassword(true)} style={{ background: 'none', border: 'none', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
                Forgot?
              </button>
            </div>
            <InputWithIcon icon={Lock} type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '0.938rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem' }}>
            {loading ? <><Loader2 className="animate-spin" size={20} /> Signing in...</> : "Sign In"}
          </button>
        </form>

        {/* Features */}
        <div className="feature-pills" style={{ marginTop: '1.5rem' }}>
          <span className="feature-pill"><BookOpen size={12} /> PubMed</span>
          <span className="feature-pill"><FlaskConical size={12} /> Clinical Trials</span>
          <span className="feature-pill"><Sparkles size={12} /> AI Insights</span>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--outline)' }}>
            New to CuraLink?{' '}
            <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Create Account</Link>
          </p>
          <div style={{ width: '40px', height: '3px', background: 'var(--outline-variant)', borderRadius: '99px', opacity: 0.5 }} />
        </div>
      </div>
    </div>
  );
};

export default Login;
