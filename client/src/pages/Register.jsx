import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, CheckCircle, KeyRound, ArrowLeft } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import InputField from '../components/auth/InputField';
import AuthButton from '../components/auth/AuthButton';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', otp: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ strength: 0, color: 'bg-gray-200' });

  // Evaluate password strength
  useEffect(() => {
    const pw = formData.password;
    if (!pw) {
      setPasswordStrength({ strength: 0, color: 'bg-[#E5E7EB]' });
      return;
    }
    
    if (pw.length < 6) {
      setPasswordStrength({ strength: 33, color: 'bg-[#DC2626]' }); // weak
    } else if (pw.length >= 6 && pw.length <= 9) {
      setPasswordStrength({ strength: 66, color: 'bg-amber-500' }); // fair
    } else if (pw.length >= 10 && /[^A-Za-z0-9]/.test(pw)) {
      setPasswordStrength({ strength: 100, color: 'bg-[#16A34A]' }); // strong
    } else {
      setPasswordStrength({ strength: 66, color: 'bg-amber-500' }); // fair
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register/send-otp`, {
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

      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        login(data.token, data.user);
        navigate('/'); // go to main app
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

  return (
    <AuthLayout>
      <div className="w-full">
        {step === 2 && (
          <button onClick={() => setStep(1)} className="mb-4 text-[#6B7280] hover:text-[#0F6E56] transition-colors flex items-center gap-1 text-sm font-medium">
             <ArrowLeft size={16} /> Back
          </button>
        )}
        
        <h2 className="text-2xl font-bold text-[#1A1A2E] mb-2 font-headline tracking-tight">
          {step === 1 ? 'Create your account' : 'Verify Email'}
        </h2>
        <p className="text-sm text-[#6B7280] mb-8 font-medium">
          {step === 1 ? 'Start your medical research journey' : `We sent a 6-digit code to ${formData.email}`}
        </p>

        {apiError && (
          <div className="mb-6 p-3 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-lg text-sm text-[#DC2626] font-medium text-center">
            {apiError}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <InputField label="Full Name" type="text" icon={User} placeholder="Dr. Jane Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} error={errors.name} />
            <InputField label="Email Address" type="email" icon={Mail} placeholder="doctor@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} error={errors.email} />
            <div className="mb-4">
              <InputField label="Password" type="password" icon={Lock} placeholder="Create a password" showToggle={true} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} error={errors.password} />
              <div className="mt-1 h-1 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-300 ${passwordStrength.color}`} style={{ width: `${passwordStrength.strength}%` }}></div>
              </div>
              <p className="text-[10px] text-[#6B7280] mt-1.5 float-right font-medium">
                {passwordStrength.strength === 33 && 'Weak'}{passwordStrength.strength === 66 && 'Fair'}{passwordStrength.strength === 100 && 'Strong'}
              </p>
            </div>
            <div className="relative mt-2">
              <InputField label="Confirm Password" type="password" icon={Lock} placeholder="Confirm your password" showToggle={true} value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} error={errors.confirmPassword} />
              {passwordsMatch && (
                <div className="absolute top-8 right-10 text-[#16A34A] bg-white rounded-full">
                  <CheckCircle size={18} className="fill-white" />
                </div>
              )}
            </div>
            <div className="pt-4">
              <AuthButton isLoading={isLoading}>Continue</AuthButton>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtpAndRegister} className="space-y-4">
             <InputField label="Verification Code" type="text" icon={KeyRound} placeholder="123456" value={formData.otp} onChange={(e) => setFormData({ ...formData, otp: e.target.value })} error={errors.otp} />
             <div className="pt-4">
              <AuthButton isLoading={isLoading}>Verify & Register</AuthButton>
            </div>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-[#6B7280]">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="font-semibold text-[#0F6E56] hover:text-[#1D9E75] transition-colors">
            Sign in
          </button>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Register;
