import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import InputField from '../components/auth/InputField';
import AuthButton from '../components/auth/AuthButton';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

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

  return (
    <AuthLayout>
      <div className="w-full">
        <h2 className="text-2xl font-bold text-[#1A1A2E] mb-2 font-headline tracking-tight">Welcome back</h2>
        <p className="text-sm text-[#6B7280] mb-8 font-medium">Sign in to your research session</p>

        {apiError && (
          <div className="mb-6 p-3 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-lg text-sm text-[#DC2626] font-medium text-center">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="Email Address"
            type="email"
            icon={Mail}
            placeholder="doctor@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={errors.email}
          />

          <div className="relative">
             <InputField
               label="Password"
               type="password"
               icon={Lock}
               placeholder="Enter your password"
               showToggle={true}
               value={formData.password}
               onChange={(e) => setFormData({ ...formData, password: e.target.value })}
               error={errors.password}
             />
             <a href="#" className="absolute top-0 right-0 text-xs font-semibold text-[#0F6E56] hover:text-[#1D9E75] transition-colors mt-0.5">
               Forgot password?
             </a>
          </div>

          <div className="pt-2">
            <AuthButton isLoading={isLoading}>
              Sign In
            </AuthButton>
          </div>
        </form>

        <div className="mt-8 relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E5E7EB]"></div>
          </div>
          <div className="relative z-10 bg-white px-4 text-xs font-medium text-[#6B7280] uppercase tracking-wider">
            or continue
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-[#6B7280]">
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="font-semibold text-[#0F6E56] hover:text-[#1D9E75] transition-colors">
            Register
          </button>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;
