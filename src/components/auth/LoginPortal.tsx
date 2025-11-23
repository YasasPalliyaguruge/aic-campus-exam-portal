import React, { useState } from 'react';
import { Moon, Sun, BookOpen, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../../services/api';

export const LoginPortal = () => {
  const { login, isLoading } = useApp();
  const [mode, setMode] = useState<'STAFF' | 'STUDENT'>('STAFF');
  const [staffEmail, setStaffEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { toggleTheme, theme } = useTheme();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setError('');
      if (mode === 'STAFF') {
        if (!staffEmail || !password) throw new Error("Please enter email and password");
        await login('STAFF', staffEmail, password);
      } else {
        if (!studentEmail || !accessCode) throw new Error("Please enter email and access code");
        await login('STUDENT', studentEmail, accessCode);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-500/20 rounded-full blur-3xl dark:bg-violet-900/20" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-3xl dark:bg-blue-900/20" />
      </div>

      <div className="absolute top-6 right-6">
        <button onClick={toggleTheme} className="p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:scale-110 transition-transform text-violet-600 dark:text-violet-400">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>

      <div className="max-w-5xl w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-800 overflow-hidden flex flex-col md:flex-row relative z-10">
        
        {/* Left Side - Brand */}
        <div className="md:w-5/12 bg-gradient-to-br from-violet-800 to-indigo-900 p-8 md:p-12 flex flex-col justify-between text-white relative overflow-hidden min-h-[200px] md:min-h-auto">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 text-center md:text-left">
            <div className="inline-block bg-white/10 p-4 rounded-2xl backdrop-blur-sm mb-6 md:mb-8 border border-white/10 shadow-xl">
               <BookOpen size={32} className="text-white md:w-12 md:h-12" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-1">AIC</h1>
            <h2 className="text-xl md:text-2xl font-bold tracking-[0.2em] text-blue-300 mb-4">CAMPUS</h2>
            <p className="text-violet-100 text-base md:text-lg font-medium italic opacity-90 hidden md:block">
              Experience The Difference
            </p>
          </div>
          <div className="text-xs text-violet-200/60 relative z-10 mt-4 md:mt-10 hidden md:block">
            AIC Campus Exam Portal • Secure Access
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="md:w-7/12 p-6 md:p-12 flex flex-col justify-center">
          <div className="flex gap-6 mb-10 border-b border-gray-100 dark:border-gray-800 pb-2 overflow-x-auto">
            <button 
              onClick={() => { setMode('STAFF'); setError(''); }}
              className={`pb-4 font-semibold text-lg transition-all relative whitespace-nowrap ${mode === 'STAFF' ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              Admin & Staff
              {mode === 'STAFF' && <span className="absolute bottom-0 left-0 w-full h-1 bg-violet-600 rounded-t-full" />}
            </button>
            <button 
              onClick={() => { setMode('STUDENT'); setError(''); }}
              className={`pb-4 font-semibold text-lg transition-all relative whitespace-nowrap ${mode === 'STUDENT' ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              Student Exam
              {mode === 'STUDENT' && <span className="absolute bottom-0 left-0 w-full h-1 bg-violet-600 rounded-t-full" />}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm font-medium animate-shake border-l-4 border-red-500">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1 whitespace-pre-line">{error}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin}>
            {mode === 'STAFF' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">Staff Login</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">Secure access for Academic Staff and Administrators.</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                    <Input 
                      type="email"
                      value={staffEmail}
                      onChange={(e: any) => setStaffEmail(e.target.value)}
                      placeholder="staff@aic.edu"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e: any) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
                
                <Button type="submit" loading={isLoading} className="w-full justify-center py-3 md:py-4 text-lg shadow-violet-500/25">
                  Access Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-500">
                 <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">Student Login</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">Enter your student email and the unique exam access code.</p>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Student Email</label>
                    <Input 
                      type="email" 
                      value={studentEmail}
                      onChange={(e: any) => setStudentEmail(e.target.value)}
                      placeholder="name@student.aic.edu"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exam Access Code</label>
                    <Input 
                      type="text" 
                      className="font-mono uppercase tracking-widest text-center text-lg"
                      value={accessCode}
                      onChange={(e: any) => setAccessCode(e.target.value)}
                      placeholder="XXXXXX"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" loading={isLoading} className="w-full justify-center py-3 md:py-4 text-lg shadow-violet-500/25">
                  Verify & Enter Lobby
                </Button>
              </div>
            )}
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Secure Examination Environment v2.0
            </p>

          </div>
        </div>
      </div>
    </div>
  );
};
