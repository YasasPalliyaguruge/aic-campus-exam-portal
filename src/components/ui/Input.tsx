import React from 'react';

export const Input = (props: any) => (
  <input 
    {...props}
    className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 hover:border-gray-300 dark:hover:border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all shadow-sm ${props.className || ''}`}
  />
);
