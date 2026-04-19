import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, Loader2, Mail, Lock, User, ShieldCheck, ArrowLeft, Sparkles, BookOpen, FlaskConical } from 'lucide-react';
import axios from 'axios';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const navigate = useNavigate();
  const { register } = useAuth();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return setError("Please fill in all fields.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setError('');
    setLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL;
      await axios.post(`${API}/auth/send-otp`, { email });
      setSuccess('Verification code sent to your email.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!otp) return setError("Please enter the verification code.");
    setError('');
    setLoading(true);
    try {
      await register(name, email, password, otp);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const InputWithIcon = ({ icon: Icon, ...props }) => (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Icon size={18} style={{ position: 'absolute', left: '1rem', color: 'var(--outline)', pointerEvents: 'none' }} />
      <input {...props} style={{
        width: '100%', paddingLeft: '2.75rem', paddingRight: '1rem', paddingTop: '0.938rem', paddingBottom: '0.938rem',
        background: 'var(--surface-container)', border: '1.5px solid var(--outline-variant)', borderRadius: '14px',
        fontSize: '0.938rem', color: 'var(--on-surface)', outline: 'none', transition: 'all 0.2s', fontFamily: 'inherit',
        ...(props.style || {}),
      }}
        onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 4px rgba(37,99,235,0.1)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--outline-variant)'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in">
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px',
            background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', marginBottom: '1.25rem',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.3)',
            transform: 'rotate(-3deg)', transition: 'transform 0.3s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'rotate(0deg)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'rotate(-3deg)'}
          >
            <Stethoscope size={30} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--on-surface)', letterSpacing: '-0.03em', textAlign: 'center', lineHeight: 1.2 }}>
            Join CuraLink
          </h1>
          <p style={{ color: 'var(--on-surface-variant)', marginTop: '0.5rem', fontSize: '0.938rem', textAlign: 'center', maxWidth: '300px' }}>
            {step === 1 ? 'Start your evidence-based research journey' : `Verification code sent to ${email}`}
          </p>
        </div>

        {/* Notifications */}
        {error && (
          <div className="animate-shake" style={{ background: 'var(--error-container)', border: '1px solid rgba(220,38,38,0.15)', color: 'var(--error)', padding: '0.875rem', borderRadius: '14px', fontSize: '0.875rem', fontWeight: 500, textAlign: 'center', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'var(--success-container)', border: '1px solid rgba(22,163,74,0.15)', color: 'var(--success)', padding: '0.875rem', borderRadius: '14px', fontSize: '0.875rem', fontWeight: 500, textAlign: 'center', marginBottom: '1rem' }}>
            {success}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '0.25rem' }}>Full Name</label>
              <InputWithIcon icon={User} type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Dr. Jane Smith" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '0.25rem' }}>Email Address</label>
              <InputWithIcon icon={Mail} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="jane.smith@hospital.com" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '0.25rem' }}>Password</label>
              <InputWithIcon icon={Lock} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '0.938rem', fontSize: '1rem', fontWeight: 700, marginTop: '0.5rem' }}>
              {loading ? <><Loader2 className="animate-spin" size={20} /> Processing...</> : "Verify Email"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>Enter the 6-digit code from your inbox</p>
              <input type="text" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required autoFocus
                style={{ width: '100%', padding: '1.125rem', textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.5rem', fontFamily: 'monospace', background: 'var(--surface-container)', border: '1.5px solid var(--outline-variant)', borderRadius: '14px', color: 'var(--on-surface)', outline: 'none' }}
                placeholder="------"
              />
            </div>

            <button type="submit" disabled={loading || otp.length < 6} className="btn-primary" style={{ width: '100%', padding: '0.938rem', fontSize: '1rem', fontWeight: 700 }}>
              {loading ? <><Loader2 className="animate-spin" size={20} /> Joining...</> : <><ShieldCheck size={18} /> Complete Registration</>}
            </button>

            <button type="button" onClick={() => { setStep(1); setSuccess(''); setError(''); setOtp(''); }}
              style={{ width: '100%', background: 'none', border: 'none', color: 'var(--outline)', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontWeight: 500 }}>
              <ArrowLeft size={14} /> Back to details
            </button>
          </form>
        )}

        {/* Feature pills */}
        <div className="feature-pills" style={{ marginTop: '1.5rem' }}>
          <span className="feature-pill"><BookOpen size={12} /> PubMed</span>
          <span className="feature-pill"><FlaskConical size={12} /> Clinical Trials</span>
          <span className="feature-pill"><Sparkles size={12} /> AI Insights</span>
        </div>

        {/* Footer */}
        {step === 1 && (
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--outline)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
            </p>
            <div style={{ width: '40px', height: '3px', background: 'var(--outline-variant)', borderRadius: '99px', opacity: 0.5 }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
