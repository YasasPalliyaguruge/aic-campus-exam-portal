import React from 'react';
import { ChevronRight } from 'lucide-react';

export const Select = (props: any) => (
  <div className="relative">
    <select 
      {...props}
      className={`w-full px-4 py-3 rounded-2xl border bg-white/90 dark:bg-gray-900/90 border-gray-200/80 dark:border-gray-700/80 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15 outline-none appearance-none transition-all shadow-sm shadow-gray-200/50 dark:shadow-black/10 backdrop-blur ${props.className || ''}`}
    />
    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
      <ChevronRight size={16} className="rotate-90" />
    </div>
  </div>
);
