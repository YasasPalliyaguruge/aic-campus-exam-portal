import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, size = 'md', loading = false, type = "button" }: any) => {
  const baseStyle = "rounded-full font-semibold tracking-[-0.01em] transition-all duration-200 flex items-center gap-2 justify-center active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-950 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none";
  const sizes: any = {
    sm: "px-3.5 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base"
  };
  const variants: any = {
    primary: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/25 disabled:from-violet-400 disabled:to-indigo-400 disabled:shadow-none focus:ring-violet-500",
    secondary: "bg-white/85 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-700/80 hover:bg-white dark:hover:bg-gray-800 focus:ring-gray-400 shadow-sm shadow-gray-200/60 dark:shadow-black/10 backdrop-blur",
    danger: "bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-500 hover:to-red-600 shadow-lg shadow-red-500/20 focus:ring-red-500",
    ghost: "text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 focus:ring-gray-300",
    success: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-500 hover:to-teal-600 shadow-lg shadow-emerald-500/20 focus:ring-emerald-500"
  };
  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
};
