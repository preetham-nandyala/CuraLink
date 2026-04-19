import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, Loader2, Mail, Lock, User, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = Details, 2 = OTP

  const navigate = useNavigate();
  const { register } = useAuth();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return setError("Please fill in all fields.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setError('');
    setLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      await axios.post(`${API}/auth/send-otp`, { email });
      setSuccess('Verification code sent to your email.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification code. Please try again.');
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
      setError(err.response?.data?.message || 'Registration failed. Please check your code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center font-body animate-fade-in px-4">
      <div className="w-full max-w-[440px] bg-surface p-6 md:p-10 rounded-3xl md:shadow-xl md:border md:border-outline-variant/20">
        {/* LOGO */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white mb-5 shadow-lg shadow-primary/30 -rotate-3 transform hover:rotate-0 transition-transform">
            <Stethoscope size={32} />
          </div>
          <h1 className="text-3xl font-bold font-headline text-on-surface tracking-tight text-center">Join Curallink AI</h1>
          <p className="text-on-surface-variant mt-2 text-sm text-center">
            {step === 1 ? 'Start your evidence-based research journey' : `Verification code sent to ${email}`}
          </p>
        </div>

        {/* NOTIFICATIONS */}
        <div className="space-y-4 mb-6">
          {error && (
            <div className="bg-error-container/20 border border-error/20 text-on-error-container p-4 rounded-2xl text-sm font-medium text-center animate-shake">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-success-container/10 border border-success/20 text-success p-4 rounded-2xl text-sm font-medium text-center animate-fade-in">
              {success}
            </div>
          )}
        </div>

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase ml-1">Full Name</label>
              <div className="relative flex items-center">
                <User className="absolute left-4 text-outline" size={18} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-surface-variant/10 border border-outline-variant/40 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-on-surface placeholder:text-outline/60 text-[15px]"
                  placeholder="Dr. Jane Smith"
                />
              </div>
            </div>

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
                  placeholder="jane.smith@hospital.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase ml-1">Create Password</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-4 text-outline" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
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
              {loading ? <><Loader2 className="animate-spin" size={20} /> Processing...</> : "Verify Email"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-6 animate-fade-in">
            <div className="space-y-3">
              <p className="text-center text-sm text-on-surface-variant italic">Enter the 6-digit code from your inbox</p>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full py-5 text-center tracking-[0.8em] text-2xl font-mono bg-surface-variant/10 border border-outline-variant/50 rounded-2xl focus:border-primary outline-none transition-all text-on-surface shadow-inner"
                placeholder="------"
                autoFocus
              />
            </div>

            <div className="space-y-4">
              <button 
                type="submit" 
                disabled={loading || otp.length < 6}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 text-lg disabled:opacity-50 active:scale-95"
              >
                {loading ? <><Loader2 className="animate-spin" size={20} /> Joining...</> : <><ShieldCheck size={20} /> Complete Registration</>}
              </button>

              <button 
                type="button"
                onClick={() => { setStep(1); setSuccess(''); setError(''); setOtp(''); }}
                className="w-full py-2 text-sm flex items-center justify-center gap-1 text-outline hover:text-primary transition-colors font-medium"
              >
                <ArrowLeft size={14} /> Back to details
              </button>
            </div>
          </form>
        )}

        {step === 1 && (
          <div className="mt-10 flex flex-col items-center gap-4">
            <p className="text-sm text-outline">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline">
                Sign In
              </Link>
            </p>
            <div className="w-10 h-1 bg-outline-variant/30 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
