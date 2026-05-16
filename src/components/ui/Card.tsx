import React from 'react';

export const Card = ({ children, className = '', noPadding = false, ...props }: any) => (
  <div 
    className={`bg-white/90 dark:bg-gray-900/90 border border-gray-200/80 dark:border-gray-800/80 rounded-2xl shadow-lg shadow-gray-200/60 dark:shadow-black/10 backdrop-blur transition-all duration-300 overflow-hidden ${className} ${noPadding ? '' : 'p-6'}`}
    {...props}
  >
    {children}
  </div>
);
