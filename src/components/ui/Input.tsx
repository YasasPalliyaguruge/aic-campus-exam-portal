import React from 'react';

export const Input = (props: any) => (
  <input 
    {...props}
    className={`w-full px-4 py-3 rounded-2xl border bg-white/90 dark:bg-gray-900/90 border-gray-200/80 dark:border-gray-700/80 text-gray-900 dark:text-white placeholder-gray-400 hover:border-gray-300 dark:hover:border-gray-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15 outline-none transition-all shadow-sm shadow-gray-200/50 dark:shadow-black/10 backdrop-blur ${props.className || ''}`}
  />
);
