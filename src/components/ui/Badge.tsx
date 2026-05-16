import React from 'react';

export const Badge = ({ children, color = 'violet' }: any) => {
  const colors: any = {
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    slate: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  };
  return <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${colors[color] || colors.violet}`}>{children}</span>;
};
