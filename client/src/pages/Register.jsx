import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, CheckCircle } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import InputField from '../components/auth/InputField';
import AuthButton from '../components/auth/AuthButton';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
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
      setPasswordStrength({ strength: 66, color: 'bg-amber-500' }); // fair (length > 9 but no special char)
    }
  }, [formData.password]);

  const validate = () => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setIsLoading(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password
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
      setApiError('Unable to connect to the server. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;

  return (
    <AuthLayout>
      <div className="w-full">
        <h2 className="text-2xl font-bold text-[#1A1A2E] mb-2 font-headline tracking-tight">Create your account</h2>
        <p className="text-sm text-[#6B7280] mb-8 font-medium">Start your medical research journey</p>

        {apiError && (
          <div className="mb-6 p-3 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-lg text-sm text-[#DC2626] font-medium text-center">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="Full Name"
            type="text"
            icon={User}
            placeholder="Dr. Jane Doe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
          />

          <InputField
            label="Email Address"
            type="email"
            icon={Mail}
            placeholder="doctor@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
          />

          <div className="mb-4">
            <InputField
              label="Password"
              type="password"
              icon={Lock}
              placeholder="Create a password"
              showToggle={true}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
            />
            {/* Strength indicator */}
            <div className="mt-1 h-1 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${passwordStrength.color}`} 
                style={{ width: `${passwordStrength.strength}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-[#6B7280] mt-1.5 float-right font-medium">
              {passwordStrength.strength === 33 && 'Weak'}
              {passwordStrength.strength === 66 && 'Fair'}
              {passwordStrength.strength === 100 && 'Strong'}
            </p>
          </div>

          <div className="relative mt-2">
            <InputField
              label="Confirm Password"
              type="password"
              icon={Lock}
              placeholder="Confirm your password"
              showToggle={true}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              error={errors.confirmPassword}
            />
            {passwordsMatch && (
              <div className="absolute top-8 right-10 text-[#16A34A] bg-white rounded-full">
                <CheckCircle size={18} className="fill-white" />
              </div>
            )}
          </div>

          <div className="pt-4">
            <AuthButton isLoading={isLoading}>
              Register
            </AuthButton>
          </div>
        </form>

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
