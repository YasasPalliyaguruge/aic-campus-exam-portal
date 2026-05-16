import React from 'react';

export const Card = ({ children, className = '', noPadding = false, ...props }: any) => (
  <div 
    className={`bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-lg shadow-sm shadow-gray-200/50 dark:shadow-none transition-shadow duration-300 overflow-hidden ${className} ${noPadding ? '' : 'p-6'}`}
    {...props}
  >
    {children}
  </div>
);
