import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Lock, ArrowLeft } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import InputField from '../components/auth/InputField';
import AuthButton from '../components/auth/AuthButton';

const ForgotPassword = () => {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ email: '', otp: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!formData.email) {
      setErrors({ email: 'Email is required' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await response.json();
      
      if (response.ok) {
        setStep(2);
        setErrors({});
      } else {
        setApiError(data.message || 'Failed to send OTP');
      }
    } catch (err) {
      setApiError('Server error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setApiError('');
    setSuccessMsg('');
    const newErrors = {};
    if (!formData.otp || formData.otp.length !== 6) newErrors.otp = 'Enter 6-digit OTP';
    if (!formData.newPassword || formData.newPassword.length < 6) newErrors.newPassword = 'Password must be at least 6 characters';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMsg('Password reset successfully! You can now log in.');
        setStep(3);
      } else {
        setApiError(data.message || 'Failed to reset password');
      }
    } catch (err) {
      setApiError('Server error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full">
        {step < 3 && (
          <button onClick={() => step === 2 ? setStep(1) : navigate('/login')} className="mb-4 text-[#6B7280] hover:text-[#0F6E56] transition-colors flex items-center gap-1 text-sm font-medium">
             <ArrowLeft size={16} /> Back
          </button>
        )}
        
        <h2 className="text-2xl font-bold text-[#1A1A2E] mb-2 font-headline tracking-tight">
          {step === 1 ? 'Reset Password' : step === 2 ? 'Verify email code' : 'Password Reset Complete'}
        </h2>
        <p className="text-sm text-[#6B7280] mb-8 font-medium">
          {step === 1 
            ? 'Enter your email to receive a secure reset code.' 
            : step === 2 ? `We sent a 6-digit code to ${formData.email}`
            : 'Your account is secured.'}
        </p>

        {apiError && (
          <div className="mb-6 p-3 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-lg text-sm text-[#DC2626] font-medium text-center">
            {apiError}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-3 bg-[#16A34A]/10 border border-[#16A34A]/20 rounded-lg text-sm text-[#16A34A] font-medium text-center">
            {successMsg}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <InputField label="Email Address" type="email" icon={Mail} placeholder="doctor@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} error={errors.email} />
            <div className="pt-4">
              <AuthButton isLoading={isLoading}>Send Code</AuthButton>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <InputField label="Verification Code" type="text" icon={KeyRound} placeholder="123456" value={formData.otp} onChange={(e) => setFormData({ ...formData, otp: e.target.value })} error={errors.otp} />
            <InputField label="New Password" type="password" icon={Lock} placeholder="New password" showToggle={true} value={formData.newPassword} onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })} error={errors.newPassword} />
            <div className="pt-4">
              <AuthButton isLoading={isLoading}>Reset Password</AuthButton>
            </div>
          </form>
        )}
        
        {step === 3 && (
          <div className="pt-4">
             <AuthButton type="button" onClick={() => navigate('/login')}>Back to Log In</AuthButton>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
