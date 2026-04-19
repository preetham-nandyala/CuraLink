import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', otp: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ strength: 0, color: 'bg-surface-variant' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Evaluate password strength
  useEffect(() => {
    const pw = formData.password;
    if (!pw) {
      setPasswordStrength({ strength: 0, color: 'bg-surface-variant' });
      return;
    }
    
    if (pw.length < 6) {
      setPasswordStrength({ strength: 33, color: 'bg-[#ba1a1a]' }); // weak
    } else if (pw.length >= 6 && pw.length <= 9) {
      setPasswordStrength({ strength: 66, color: 'bg-[#fbbf24]' }); // fair
    } else if (pw.length >= 10 && /[^A-Za-z0-9]/.test(pw)) {
      setPasswordStrength({ strength: 100, color: 'bg-[#16a34a]' }); // strong
    } else {
      setPasswordStrength({ strength: 66, color: 'bg-[#fbbf24]' }); // fair
    }
  }, [formData.password]);

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Full name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = 'Enter a valid email address';
    
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.otp || formData.otp.length !== 6) newErrors.otp = 'Enter the 6-digit OTP';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validateStep1()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/register/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, email: formData.email })
      });
      const data = await response.json();
      
      if (response.ok) {
        setStep(2);
      } else {
        setApiError(data.message || 'Failed to send OTP');
      }
    } catch (err) {
      setApiError('Server error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpAndRegister = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validateStep2()) return;

    setIsLoading(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        otp: formData.otp
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        login(data.token, data.user);
        navigate('/chat');
      } else {
        setApiError(data.message || 'Registration failed');
      }
    } catch (err) {
      setApiError('Server error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;

  const handleGuestMode = () => {
    navigate('/chat');
  };

  return (
    <div className="bg-surface font-body text-on-surface antialiased h-screen flex overflow-hidden">
      {/* Left side */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-container-low overflow-hidden">
        <img alt="Medical researcher using digital interface" className="absolute inset-0 w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9kZWWXLw7mYiXNKnDpDF8-Hon1uv_EK8EsTQVSZzP_DEN_MhKHmfVCWAmatCHVAI_VHAJjJqJqovQsUGDnnE2qGPPPXNedUMZ1FJzY1RCArjGq5kpZV7rbHJ7PGZlGSg3nNwcHNAes1g5pQ-YvsBPn1pra0wufLB7O5CL_jvmOBnTm9xh9tN3CX24Bm5xaMtH_9VNiBw6OaOJcfiF9OSQ0D1xyx8vRcM0iF51bRTPuWobw7JfdI8xFNURgDnNWZR4_U-Gwjkc-g" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary-container/40 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low/90 via-transparent to-transparent"></div>
        <div className="absolute bottom-12 left-12 right-12 z-10 text-white">
          <h2 className="font-headline text-3xl font-bold tracking-tight mb-3 drop-shadow-md">Surgical Precision in Data.</h2>
          <p className="font-body text-base text-primary-fixed-dim drop-shadow-sm max-w-md">Join the leading network of oncologists and researchers utilizing AI-driven insights to accelerate clinical trials.</p>
        </div>
        <div className="absolute top-12 left-12 z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-lowest/20 backdrop-blur-md border border-white/10">
            <span className="material-symbols-outlined text-tertiary-fixed text-sm">auto_awesome</span>
            <span className="font-label text-sm text-white font-medium tracking-wide uppercase">Curalink AI Engine Active</span>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="w-full lg:w-1/2 bg-surface-container-lowest overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center p-8 sm:p-12 lg:p-24">
          <div className="w-full max-w-md space-y-6 py-6">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined fill-icon text-3xl text-primary">biotech</span>
              <span className="font-headline font-extrabold text-xl tracking-tighter text-primary">Curalink</span>
            </div>

            {step === 2 && (
              <button onClick={() => setStep(1)} className="mb-2 text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium">
                 <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back
              </button>
            )}

            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">
                {step === 1 ? 'Create account' : 'Verify Email'}
              </h1>
              <p className="text-on-surface-variant font-body text-sm mt-1">
                {step === 1 ? 'Enter your details to access the research platform.' : `We sent a 6-digit code to ${formData.email}`}
              </p>
            </div>

          {apiError && (
            <div className="p-3 bg-error-container border border-error/20 rounded-lg text-sm text-on-error-container font-medium text-center">
              {apiError}
            </div>
          )}

          {step === 1 ? (
            <form className="space-y-6" onSubmit={handleSendOtp}>
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block font-label text-sm font-medium text-on-surface" htmlFor="fullName">Full Name</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within:text-primary transition-colors">person</span>
                  <input 
                    className={`w-full bg-surface-container-low border-none rounded-md px-4 py-3 pl-12 font-body text-on-surface placeholder-on-surface-variant/50 focus:ring-0 focus:bg-surface-container-lowest transition-all shadow-[inset_0_0_0_1px_transparent] focus:shadow-[inset_0_0_0_2px_rgba(0,55,120,0.4)] ${errors.name ? 'shadow-[inset_0_0_0_2px_#ba1a1a]' : ''}`}
                    id="fullName" 
                    name="fullName" 
                    placeholder="Dr. Jane Doe" 
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                {errors.name && <p className="mt-1 text-xs text-error font-medium">{errors.name}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block font-label text-sm font-medium text-on-surface" htmlFor="email">Institutional Email</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within:text-primary transition-colors">mail</span>
                  <input 
                    className={`w-full bg-surface-container-low border-none rounded-md px-4 py-3 pl-12 font-body text-on-surface placeholder-on-surface-variant/50 focus:ring-0 focus:bg-surface-container-lowest transition-all shadow-[inset_0_0_0_1px_transparent] focus:shadow-[inset_0_0_0_2px_rgba(0,55,120,0.4)] ${errors.email ? 'shadow-[inset_0_0_0_2px_#ba1a1a]' : ''}`}
                    id="email" 
                    name="email" 
                    placeholder="jane.doe@university.edu" 
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-error font-medium">{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block font-label text-sm font-medium text-on-surface" htmlFor="password">Password</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within:text-primary transition-colors">lock</span>
                  <input 
                    className={`w-full bg-surface-container-low border-none rounded-md px-4 py-3 pl-12 pr-12 font-body text-on-surface placeholder-on-surface-variant/50 focus:ring-0 focus:bg-surface-container-lowest transition-all shadow-[inset_0_0_0_1px_transparent] focus:shadow-[inset_0_0_0_2px_rgba(0,55,120,0.4)] ${errors.password ? 'shadow-[inset_0_0_0_2px_#ba1a1a]' : ''}`}
                    id="password" 
                    name="password" 
                    placeholder="••••••••" 
                    type={showPassword ? "text" : "password"}
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
                {errors.password && <p className="mt-1 text-xs text-error font-medium">{errors.password}</p>}
                
                {/* Strength Meter */}
                <div className="mt-1.5 h-1 w-full bg-surface-variant rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${passwordStrength.color}`} style={{ width: `${passwordStrength.strength}%` }}></div>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="block font-label text-sm font-medium text-on-surface" htmlFor="confirmPassword">Confirm Password</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within:text-primary transition-colors">lock</span>
                  <input 
                    className={`w-full bg-surface-container-low border-none rounded-md px-4 py-3 pl-12 pr-12 font-body text-on-surface placeholder-on-surface-variant/50 focus:ring-0 focus:bg-surface-container-lowest transition-all shadow-[inset_0_0_0_1px_transparent] focus:shadow-[inset_0_0_0_2px_rgba(0,55,120,0.4)] ${errors.confirmPassword ? 'shadow-[inset_0_0_0_2px_#ba1a1a]' : ''}`}
                    id="confirmPassword" 
                    name="confirmPassword" 
                    placeholder="Confirm your password" 
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                  <button 
                    className="absolute right-10 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors" 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <span className="material-symbols-outlined text-[20px]">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                  {!errors.confirmPassword && passwordsMatch && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-4 text-[#16a34a] flex items-center">
                      <span className="material-symbols-outlined text-[20px] fill-icon">check_circle</span>
                    </div>
                  )}
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-error font-medium">{errors.confirmPassword}</p>}
              </div>

              <div className="flex items-start gap-3 pt-2">
                <div className="flex items-center h-5">
                  <input className="w-4 h-4 rounded border-outline text-primary focus:ring-primary focus:ring-offset-0 bg-surface-container-lowest" id="terms" name="terms" type="checkbox" required />
                </div>
                <div className="text-sm">
                  <label className="font-body text-on-surface-variant" htmlFor="terms">
                    I agree to the <button type="button" className="font-medium text-primary hover:text-primary-container transition-colors">Terms of Research</button> and <button type="button" className="font-medium text-primary hover:text-primary-container transition-colors">Privacy Policy</button>.
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button disabled={isLoading} className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-md shadow-sm text-sm font-medium text-on-primary bg-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-70" type="submit">
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : "Create Account"}
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
          ) : (
            <form className="space-y-6" onSubmit={handleVerifyOtpAndRegister}>
              <div className="space-y-1">
                <label className="block font-label text-sm font-medium text-on-surface" htmlFor="otp">Verification Code</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within:text-primary transition-colors">key</span>
                  <input 
                    className={`w-full bg-surface-container-low border-none rounded-md px-4 py-3 pl-12 font-body text-on-surface placeholder-on-surface-variant/50 focus:ring-0 focus:bg-surface-container-lowest transition-all shadow-[inset_0_0_0_1px_transparent] focus:shadow-[inset_0_0_0_2px_rgba(0,55,120,0.4)] ${errors.otp ? 'shadow-[inset_0_0_0_2px_#ba1a1a]' : ''}`}
                    id="otp" 
                    name="otp" 
                    placeholder="123456" 
                    type="text"
                    maxLength="6"
                    value={formData.otp}
                    onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                  />
                </div>
                {errors.otp && <p className="mt-1 text-xs text-error font-medium">{errors.otp}</p>}
              </div>

              <div className="pt-2">
                <button disabled={isLoading} className="w-full flex justify-center items-center py-3.5 px-4 rounded-md shadow-sm text-sm font-medium text-on-primary bg-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-70" type="submit">
                  {isLoading ? (
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : "Verify & Register"}
                </button>
              </div>
            </form>
          )}




          <p className="text-center text-sm font-body text-on-surface-variant mt-8">
            Already have an account? 
            <button type="button" onClick={() => navigate('/login')} className="font-medium text-primary hover:text-primary-container transition-colors ml-1">Sign In</button>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
