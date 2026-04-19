import React from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFB] text-[#1A1A2E] font-body p-6 text-center">
      <div className="w-20 h-20 rounded-full bg-[#0F6E56]/10 flex items-center justify-center text-[#0F6E56] mb-6 shadow-sm">
        <Stethoscope size={40} />
      </div>
      <h1 className="text-5xl font-extrabold font-headline tracking-tight mb-4">404</h1>
      <p className="text-[#6B7280] text-lg max-w-md mx-auto mb-8">
        We couldn't find the medical page you're looking for. It might have been moved or deleted.
      </p>
      <Link 
        to="/chat" 
        className="px-6 py-3 rounded-lg bg-[#0F6E56] text-white font-semibold hover:bg-[#1D9E75] transition-colors shadow-md"
      >
        Return to Research
      </Link>
    </div>
  );
};

export default NotFound;
