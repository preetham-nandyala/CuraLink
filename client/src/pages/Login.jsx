import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = 'Enter a valid email address';
    
    if (!formData.password) newErrors.password = 'Password is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        login(data.token, data.user);
        navigate('/chat');
      } else {
        setApiError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setApiError('Unable to connect to the server. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = () => {
    navigate('/chat');
  };

  return (
    <div className="bg-surface text-on-surface font-body h-screen flex overflow-hidden antialiased">
      {/* Left Side: High-fidelity Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-container-low overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary-container/20 z-10 mix-blend-overlay"></div>
        <img alt="High-tech medical research laboratory" className="absolute inset-0 w-full h-full object-cover z-0 filter brightness-90 contrast-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdyVAfG4QQQ3Hs0ltPUey7-lGQTg1SJjBXtR6ndrhAqwNYZt-N1H5W5jewbBnsxm63ZhG34mxu23xl9Kso0lyCZl7jsiEmqinGydFpQeghDk5LSjHs662Z0GzcL33c1C4SRwT-kijs_zwAO-eHnoPl6QJlARzSdgsND4NjHSeqslBWLyPGCeatlgN95RphHpQIUM_O7d1xOJ2x67vhoSl6lI-BKuO4GtNGUX31AQCp2D4dFLKQEmchELcbuwPcEEaZnxEgqg6pNg" />
        {/* Overlay Content */}
        <div className="relative z-20 flex flex-col justify-between p-12 lg:p-16 h-full text-white w-full">
          <div>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined fill-icon text-4xl text-tertiary-fixed">biotech</span>
              <span className="font-headline font-extrabold text-2xl tracking-tighter text-white">Curalink AI</span>
            </div>
          </div>
          <div className="max-w-lg mb-8">
            <h2 className="font-headline text-3xl md:text-4xl leading-tight font-light tracking-[-0.02em] mb-4 text-white drop-shadow-md">
              Surgical Precision in Data.
            </h2>
            <p className="font-body text-sm md:text-base text-white/80 font-light leading-relaxed backdrop-blur-sm bg-primary/20 p-4 lg:p-6 rounded-xl border-l-4 border-tertiary-fixed shadow-[0px_24px_48px_rgba(0,55,120,0.1)]">
              Empowering lead oncologists and researchers with fluid, ethereal artificial intelligence to unearth breakthroughs in medical science.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 bg-surface-container-lowest overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center p-8 sm:p-12 lg:p-24">
          <div className="w-full max-w-md space-y-8 py-6">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined fill-icon text-3xl text-primary">biotech</span>
              <span className="font-headline font-extrabold text-xl tracking-tighter text-primary">Curalink</span>
            </div>
            
            {/* Header */}
            <div className="space-y-2">
              <h1 className="font-headline text-3xl font-bold tracking-tight text-primary">Welcome back</h1>
              <p className="font-body text-on-surface-variant text-sm">Sign in to continue your research protocol.</p>
            </div>

          {apiError && (
            <div className="p-3 bg-error-container border border-error/20 rounded-lg text-sm text-on-error-container font-medium text-center">
              {apiError}
            </div>
          )}

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="font-label text-sm font-medium text-on-surface-variant" htmlFor="email">Email Address</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within:text-primary transition-colors">mail</span>
                  <input 
                    className={`w-full bg-surface-container-low border-none rounded-lg py-3.5 pl-12 pr-4 text-on-surface focus:bg-surface-container-lowest focus:ring-0 focus:outline-none transition-all shadow-[inset_0_0_0_1px_transparent] focus:shadow-[inset_0_0_0_2px_rgba(0,55,120,0.4)] ${errors.email ? 'shadow-[inset_0_0_0_2px_#ba1a1a]' : ''}`}
                    id="email" 
                    name="email" 
                    placeholder="researcher@institute.edu" 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  {errors.email && <p className="mt-1.5 text-xs text-error font-medium">{errors.email}</p>}
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-label text-sm font-medium text-on-surface-variant" htmlFor="password">Password</label>
                  <button type="button" onClick={() => navigate('/forgot-password')} className="font-label text-sm font-medium text-primary hover:text-primary-container transition-colors">Forgot password?</button>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within:text-primary transition-colors">lock</span>
                  <input 
                    className={`w-full bg-surface-container-low border-none rounded-lg py-3.5 pl-12 pr-12 text-on-surface focus:bg-surface-container-lowest focus:ring-0 focus:outline-none transition-all shadow-[inset_0_0_0_1px_transparent] focus:shadow-[inset_0_0_0_2px_rgba(0,55,120,0.4)] ${errors.password ? 'shadow-[inset_0_0_0_2px_#ba1a1a]' : ''}`}
                    id="password" 
                    name="password" 
                    placeholder="••••••••" 
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors" 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-xs text-error font-medium">{errors.password}</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-3">
              <button disabled={isLoading} className="w-full bg-primary text-on-primary font-label font-medium py-3.5 rounded-md hover:bg-primary-container transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0px_8px_16px_rgba(0,55,120,0.15)] disabled:opacity-70" type="submit">
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    Sign In
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
              
              <button 
                type="button" 
                onClick={handleGuestMode} 
                className="w-full py-3.5 rounded-md border-2 border-outline-variant/30 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors shadow-sm"
              >
                Continue as Guest
              </button>
            </div>
          </form>


          {/* Footer Link */}
          <div className="text-center pt-4">
            <p className="font-body text-sm text-on-surface-variant">
              Don&apos;t have an account? 
              <button type="button" onClick={() => navigate('/register')} className="font-medium text-primary hover:text-primary-container transition-colors ml-1">Request Access</button>
            </p>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
