import React from 'react';
import BrandPanel from './BrandPanel';

const AuthLayout = ({ children }) => {
  return (
    <div 
      className="flex min-h-screen font-body relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')" }}
    >
      {/* Mobile background overlay - beautiful medical blue gradient for better readability on phones, while desktop remains white */}
      <div className="absolute inset-0 bg-[#0F6E56]/85 sm:bg-[#0F6E56]/90 lg:bg-[#F8FAFB] z-0 mix-blend-multiply lg:mix-blend-normal"></div>
      {/* Additional blue tint for mobile */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A2540]/80 via-[#0F6E56]/60 to-transparent lg:hidden z-0"></div>

      <div className="hidden lg:flex lg:w-1/2 fixed inset-y-0 left-0 z-0">
        <BrandPanel />
      </div>
      <div className="w-full lg:w-1/2 lg:ml-[50%] flex items-center justify-center p-4 sm:p-8 py-12 relative z-10 min-h-screen">
        <div className="w-full max-w-md bg-[#FFFFFF] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] lg:shadow-xl border border-[#E5E7EB] p-6 sm:p-8 relative">
           {/* Decorative subtle top accent */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0F6E56] to-[#1D9E75]" />
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
