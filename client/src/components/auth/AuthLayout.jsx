import React from 'react';
import BrandPanel from './BrandPanel';

const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFB] font-body relative overflow-hidden">
      <div className="w-full h-full min-h-screen flex flex-col lg:flex-row shadow-2xl">
        <BrandPanel />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-[#F8FAFB]">
          <div className="w-full max-w-md bg-[#FFFFFF] rounded-2xl shadow-xl border border-[#E5E7EB] p-8 relative overflow-hidden">
             {/* Decorative subtle top accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0F6E56] to-[#1D9E75]" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
