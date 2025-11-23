import React from 'react';
import { ChevronRight } from 'lucide-react';

export const Select = (props: any) => (
  <div className="relative">
    <select 
      {...props}
      className={`w-full px-4 py-3 rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none appearance-none transition-all ${props.className || ''}`}
    />
    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
      <ChevronRight size={16} className="rotate-90" />
    </div>
  </div>
);
