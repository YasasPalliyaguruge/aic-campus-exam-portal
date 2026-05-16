import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, size = 'md', loading = false, type = "button" }: any) => {
  const baseStyle = "rounded-lg font-semibold tracking-[-0.01em] transition-all duration-200 flex items-center gap-2 justify-center active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-950 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none";
  const sizes: any = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base"
  };
  const variants: any = {
    primary: "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-500/20 hover:shadow-md hover:shadow-violet-500/25 disabled:bg-violet-400 disabled:shadow-none focus:ring-violet-500",
    secondary: "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-gray-400 shadow-sm",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/20 focus:ring-red-500",
    ghost: "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-300",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-500/20 focus:ring-emerald-500"
  };
  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
};
