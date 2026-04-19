import React from 'react';
import BrandPanel from './BrandPanel';

const AuthLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[#F8FAFB] font-body relative">
      <div className="hidden lg:flex lg:w-1/2 fixed inset-y-0 left-0 z-0">
        <BrandPanel />
      </div>
      <div className="w-full lg:w-1/2 lg:ml-[50%] flex items-center justify-center p-6 sm:p-8 py-12 relative z-10 min-h-screen">
        <div className="w-full max-w-md bg-[#FFFFFF] rounded-2xl shadow-xl border border-[#E5E7EB] p-8 relative">
           {/* Decorative subtle top accent */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0F6E56] to-[#1D9E75]" />
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
