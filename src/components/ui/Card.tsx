import React from 'react';

export const Card = ({ children, className = '', noPadding = false, ...props }: any) => (
  <div 
    className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden ${className} ${noPadding ? '' : 'p-6'}`}
    {...props}
  >
    {children}
  </div>
);
