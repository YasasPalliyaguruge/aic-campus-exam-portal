import React from 'react';

export const Badge = ({ children, color = 'violet' }: any) => {
  const colors: any = {
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    slate: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  };
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ring-1 ring-inset ring-black/5 dark:ring-white/10 ${colors[color] || colors.violet}`}>{children}</span>;
};
