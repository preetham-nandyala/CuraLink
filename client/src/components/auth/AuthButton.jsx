import React from 'react';

const AuthButton = ({ children, isLoading, ...props }) => {
  return (
    <button
      {...props}
      disabled={isLoading || props.disabled}
      className="w-full bg-[#0F6E56] hover:bg-[#085041] disabled:bg-[#0F6E56]/70 text-white font-medium h-[44px] rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 tracking-wide"
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        children
      )}
    </button>
  );
};

export default AuthButton;
