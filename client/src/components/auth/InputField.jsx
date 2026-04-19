import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const InputField = ({ label, icon: Icon, type = 'text', showToggle = false, error, ...props }) => {
  const [show, setShow] = useState(false);
  const inputType = showToggle ? (show ? 'text' : 'password') : type;

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[#1A1A2E] mb-1.5">{label}</label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon size={18} className="text-[#6B7280] group-focus-within:text-[#0F6E56] transition-colors" />
        </div>
        <input
          type={inputType}
          className={`w-full pl-10 pr-10 py-2.5 bg-white border ${
            error ? 'border-[#DC2626] focus:ring-[#DC2626]' : 'border-[#E5E7EB] focus:ring-[#1D9E75]'
          } rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all text-[#1A1A2E] text-sm`}
          {...props}
        />
        {showToggle && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B7280] hover:text-[#1A1A2E] transition-colors"
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-[#DC2626] font-medium">{error}</p>}
    </div>
  );
};

export default InputField;
