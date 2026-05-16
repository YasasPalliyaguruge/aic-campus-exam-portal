import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Library, FileText, Video, GraduationCap, Moon, Sun, LogOut, Menu, X, FileCheck } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useTheme } from '../../contexts/ThemeContext';

export const DashboardLayout = ({ children }: { children?: React.ReactNode }) => {
  const { auth, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const NavItem = ({ to, icon: Icon, label }: any) => {
    const isActive = location.pathname === to;
    return (
      <button 
        onClick={() => {
          navigate(to);
          setIsSidebarOpen(false);
        }} 
        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${isActive ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-950' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}
      >
        <Icon size={20} /> {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <img src="/images/AIC_Campus_Logo.png" alt="AIC" className="h-8 w-auto object-contain" />
          <img src="/images/IPAC_Logo.png" alt="IPAC" className="h-8 w-auto object-contain" />
          <span className="font-extrabold tracking-tight text-gray-900 dark:text-white">AIC CAMPUS</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 h-screen w-72 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 z-50 flex flex-col shadow-xl shadow-gray-200/50 dark:shadow-none transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-5 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <img src="/images/AIC_Campus_Logo.png" alt="AIC Campus" className="h-10 w-auto object-contain bg-white rounded-md p-1 shadow-sm" />
            <img src="/images/IPAC_Logo.png" alt="IPAC" className="h-10 w-auto object-contain bg-white/10 rounded-md p-1 shadow-sm border border-white/10" />
            <div className="leading-none">
               <span className="block text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">AIC CAMPUS</span>
               <span className="block text-[10px] font-bold text-violet-500 tracking-widest">EXAM PORTAL</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <nav className="px-4 space-y-1 flex-1 overflow-y-auto">
          <div className="px-3 mb-3 text-[11px] font-extrabold text-gray-400 uppercase tracking-widest">Management</div>
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Overview" />
          <NavItem to="/dashboard/students" icon={Users} label="Students" />
          <NavItem to="/dashboard/academic" icon={Library} label="Academics" />
          <NavItem to="/dashboard/exams" icon={FileText} label="Exams" />
          <div className="mt-8 px-3 mb-3 text-[11px] font-extrabold text-gray-400 uppercase tracking-widest">Execution</div>
          <NavItem to="/dashboard/proctor" icon={Video} label="Live Proctoring" />
          <NavItem to="/dashboard/review" icon={FileCheck} label="Review Submissions" />
          <NavItem to="/dashboard/grading" icon={GraduationCap} label="Grading Center" />
        </nav>
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60">
          <div className="flex items-center gap-4 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold shadow-sm text-sm">
              {auth.user?.avatar}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{auth.user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{auth.user?.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="flex-1 flex items-center justify-center p-2.5 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 transition-all shadow-sm">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={logout} className="flex-1 flex items-center justify-center p-2.5 text-red-600 dark:text-red-400 bg-white dark:bg-gray-950 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg border border-gray-200 dark:border-gray-800 transition-all">
               <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 p-4 md:p-8 lg:p-10 animate-in fade-in duration-500 overflow-x-hidden w-full">
        {children}
      </main>
    </div>
  );
};
