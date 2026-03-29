import React from 'react';

const LoadingSpinner = ({ size = 'default', message = 'Loading...', showMessage = true }) => {
  const sizeClass = {
    small: 'text-[10px]',
    default: 'text-[11px]',
    large: 'text-xs'
  };

  const textSize = sizeClass[size] || sizeClass.default;

  return (
    <div className="flex flex-col items-center justify-center gap-3 w-full h-full min-h-[200px]">
      {showMessage && message && (
        <div className={`text-zinc-500 font-mono uppercase tracking-[0.2em] animate-pulse ${textSize}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
