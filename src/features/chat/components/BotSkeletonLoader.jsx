import React from 'react';
import { useTheme } from '../../../context/ThemeContext';

const BotSkeletonLoader = () => {
  const { theme } = useTheme();
  
  return (
    <div className="flex items-start gap-3 mb-6 animate-pulse">
      {/* Bot Avatar Skeleton */}
      <div className="flex-shrink-0 hidden md:block">
        <div className={`w-8 h-8 rounded-full ${theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-300'}`}></div>
      </div>

      {/* Message Bubble Skeleton */}
      <div className="relative w-full max-w-[80%] sm:max-w-2xl md:max-w-3xl">
        <div 
          className={`px-4 py-4 rounded-2xl rounded-bl-none ${theme === 'dark' 
            ? 'bg-zinc-800/50' 
            : 'bg-gray-100'}`}
        >
          {/* Text lines */}
          <div className="space-y-3">
            <div className={`h-4 rounded w-3/4 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300'}`}></div>
            <div className={`h-4 rounded w-1/2 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300'}`}></div>
            <div className={`h-4 rounded w-5/6 ${theme === 'dark' ? 'bg-zinc-700' : 'bg-gray-300'}`}></div>
          </div>
          
          {/* Animated "thinking" pulse at the bottom */}
          <div className="mt-4 flex gap-1">
             <div className={`w-2 h-2 rounded-full animate-bounce ${theme === 'dark' ? 'bg-emerald-500/50' : 'bg-emerald-500/50'}`} style={{ animationDelay: '0ms' }}></div>
             <div className={`w-2 h-2 rounded-full animate-bounce ${theme === 'dark' ? 'bg-emerald-500/50' : 'bg-emerald-500/50'}`} style={{ animationDelay: '150ms' }}></div>
             <div className={`w-2 h-2 rounded-full animate-bounce ${theme === 'dark' ? 'bg-emerald-500/50' : 'bg-emerald-500/50'}`} style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotSkeletonLoader;
