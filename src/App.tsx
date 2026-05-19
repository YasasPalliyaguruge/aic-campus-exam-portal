import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, CheckCircle } from 'lucide-react';
import { AuthState, User, Program, Exam, StudentSession, UserRole, Violation, Module } from './types';
import { AppContext } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { api } from './services/api';
import { initServerTimeSync } from './services/serverTime';
import { Button } from './components/ui/Button';

// Components
import { LoginPortal } from './components/auth/LoginPortal';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Overview } from './components/dashboard/Overview';
import { StudentRegistry } from './components/dashboard/StudentRegistry';
import { AcademicManager } from './components/academic/AcademicManager';
import { ExamManager } from './components/exam/ExamManager';
import { ProctorView } from './components/dashboard/ProctorView';
import { GradingCenter } from './components/dashboard/GradingCenter';
import { ActiveExam } from './components/exam/ActiveExam';
import { StudentReview } from './components/exam/StudentReview';
import { StudentReview as AdminStudentReview } from './components/dashboard/StudentReview';
import { DatabaseDebugger } from './components/DatabaseDebugger';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from './firebase';

// Storage key for persisting auth state
const AUTH_STORAGE_KEY = 'exam_portal_auth';

const App = () => {
  const [auth, setAuth] = useState<AuthState>({ user: null, isAuthenticated: false });
  const [users, setUsers] = useState<User[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // --- Data Sync ---
  const refreshData = async () => {
    try {
      const data = await api.data.fetchAll();
      setUsers(data.users);
      setPrograms(data.programs);
      setExams(data.exams);
      setSessions(data.sessions);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      // Don't throw - allow app to continue
    }
  };

  // --- Server Time Synchronization ---
  // Initialize server time sync early to prevent timezone issues
  // This runs once when the app first loads
  useEffect(() => {
    initServerTimeSync().then(() => {
      console.log('⏰ Server time synchronized for exam scheduling');
    }).catch((err) => {
      console.error('Server time sync failed:', err);
    });
  }, []);

  // --- Session Persistence: Restore auth on page load ---
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Check if there's a saved auth state
        const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
        
        if (savedAuth) {
          const parsedAuth = JSON.parse(savedAuth) as AuthState;
          console.log('🔄 Found saved session, restoring...');
          
          // Wait for Firebase to initialize and check if session is still valid
          const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
            if (firebaseUser) {
              // Firebase session is still active
              console.log('✅ Firebase session is valid, restoring app state');
              setAuth(parsedAuth);
              if (parsedAuth.user?.role !== UserRole.STUDENT) {
                await refreshData();
              }
            } else {
              // Firebase session expired, clear saved state
              console.log('⚠️ Firebase session expired, clearing saved state');
              localStorage.removeItem(AUTH_STORAGE_KEY);
            }
            setIsInitialLoad(false);
            unsubscribe(); // Only run once
          });
        } else {
          // No saved session
          setIsInitialLoad(false);
        }
      } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setIsInitialLoad(false);
      }
    };

    restoreSession();
  }, []);

  // Real-time session subscription
  useEffect(() => {
    if (!auth.isAuthenticated || auth.user?.role === UserRole.STUDENT) return;
    const isRealtimeSessionRoute =
      location.pathname === '/dashboard' ||
      location.pathname.startsWith('/dashboard/proctor') ||
      location.pathname.startsWith('/dashboard/review') ||
      location.pathname.startsWith('/dashboard/grading');

    if (!isRealtimeSessionRoute) return;

    console.log('🔄 Setting up real-time session subscription...');
    const unsubscribe = api.sessions.subscribe((updatedSessions) => {
      console.log('📡 Session update received:', updatedSessions.length, 'sessions');
      setSessions(updatedSessions);
    });

    return () => {
      console.log('🔌 Cleaning up session subscription');
      unsubscribe();
    };
  }, [auth.isAuthenticated, auth.user?.role, location.pathname]);

  // --- Actions ---

  const login = async (role: 'STAFF' | 'STUDENT', emailOrId: string, code?: string) => {
    setIsLoading(true);
    try {
      const result = await api.auth.login(role, emailOrId, code);
      if (result && result.user) {
        const newAuthState = { user: result.user, isAuthenticated: true, activeExamId: result.activeExamId };
        setAuth(newAuthState);
        if ((result as any).bootstrapData) {
          const bootstrapData = (result as any).bootstrapData;
          setUsers(bootstrapData.users || []);
          setPrograms(bootstrapData.programs || []);
          setExams(bootstrapData.exams || []);
          setSessions(bootstrapData.sessions || []);
        }
        
        // Save to localStorage for persistence
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));
        console.log('💾 Session saved to localStorage');
        
        if (result.user.role !== UserRole.STUDENT) {
          await refreshData(); // Sync management data on staff login
        }
      } else {
        throw new Error("Login failed: Invalid response from server");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      throw error; // Re-throw to be caught by LoginPortal
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // Clear localStorage first
    localStorage.removeItem(AUTH_STORAGE_KEY);
    console.log('🗑️ Session cleared from localStorage');
    
    await api.auth.logout();
    setAuth({ user: null, isAuthenticated: false });
  };

  const addExam = async (exam: Exam) => {
    setIsLoading(true);
    await api.exams.create(exam);
    await refreshData();
    setIsLoading(false);
  };
  
  const deleteExam = async (id: string) => {
    setIsLoading(true);
    await api.exams.delete(id);
    await refreshData();
    setIsLoading(false);
  };

  const addStudent = async (student: User) => {
    setIsLoading(true);
    await api.students.enroll(student);
    await refreshData();
    setIsLoading(false);
  };

  const addProgram = async (program: Program) => {
    setIsLoading(true);
    await api.programs.create(program);
    await refreshData();
    setIsLoading(false);
  };

  const addModule = async (programId: string, module: Module) => {
    setIsLoading(true);
    await api.programs.addModule(programId, module);
    await refreshData();
    setIsLoading(false);
  };

  const deleteModule = async (programId: string, moduleId: string) => {
    setIsLoading(true);
    await api.programs.deleteModule(programId, moduleId);
    await refreshData();
    setIsLoading(false);
  };

  const deleteUser = async (id: string) => {
    setIsLoading(true);
    await api.students.delete(id);
    await refreshData();
    setIsLoading(false);
  };

  const deleteProgram = async (id: string) => {
    setIsLoading(true);
    await api.programs.delete(id);
    await refreshData();
    setIsLoading(false);
  };

  const startExamSession = async (studentId: string, examId: string) => {
    return await api.sessions.start(studentId, examId);
    // refreshData is called inside ActiveExam's init logic
  };

  const deleteSession = async (sessionId: string) => {
    setIsLoading(true);
    await api.sessions.delete(sessionId);
    await refreshData();
    setIsLoading(false);
  };

  const submitExamSession = async (studentId: string, examId: string, answers: Record<string, any>, uploadedFiles?: any[]) => {
    setIsLoading(true);
    await api.sessions.submit(studentId, examId, answers, uploadedFiles);
    await refreshData();
    setIsLoading(false);
  };

  const updateSessionGrade = async (studentId: string, examId: string, questionId: string, score: number, feedback?: string) => {
    setIsLoading(true);
    await api.sessions.updateGrade(studentId, examId, questionId, score, feedback);
    await refreshData();
    setIsLoading(false);
  };

  const logViolation = (studentId: string, violation: Violation) => {
    // Find the active exam for this student
    const activeSession = sessions.find(s => s.studentId === studentId && s.status === 'IN_PROGRESS');
    if (activeSession) {
      api.sessions.logViolation(studentId, activeSession.examId, violation);
    }
    // Optimistic update for UI
    setSessions(prev => prev.map(s => 
      (s.studentId === studentId && s.status === 'IN_PROGRESS') 
        ? { ...s, violations: [...s.violations, violation] } 
        : s
    ));
  };

  if (isInitialLoad) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-violet-600">
        <ShieldCheck size={64} className="animate-bounce mb-4" />
        <Loader2 size={32} className="animate-spin text-gray-400" />
        <p className="mt-4 font-medium text-gray-500">Initializing Secure Environment...</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <AppContext.Provider value={{ 
        auth, login, logout, exams, programs, sessions, users, 
        addExam, deleteExam, addStudent, deleteUser, addProgram, deleteProgram, addModule, deleteModule,
        startExamSession, deleteSession, submitExamSession, 
        updateSessionGrade, logViolation, refreshData, isLoading 
      }}>
          <Routes>
            <Route path="/" element={
              !auth.isAuthenticated ? <LoginPortal /> : 
              (auth.user?.role === UserRole.STUDENT ? <Navigate to="/student/active" /> : <Navigate to="/dashboard" />)
            } />

            {/* Management Routes */}
            <Route path="/dashboard/*" element={
              auth.isAuthenticated && auth.user?.role !== UserRole.STUDENT ? (
                <DashboardLayout>
                  <Routes>
                    <Route path="/" element={<Overview />} />
                    <Route path="/students" element={<StudentRegistry />} />
                    <Route path="/academic" element={<AcademicManager />} />
                    <Route path="/exams" element={<ExamManager />} />
                    <Route path="/proctor" element={<ProctorView />} />
                    <Route path="/review" element={<AdminStudentReview />} />
                    <Route path="/grading" element={<GradingCenter />} />
                    <Route path="/debug" element={<DatabaseDebugger />} />
                  </Routes>
                </DashboardLayout>
              ) : <Navigate to="/" />
            } />

            {/* Student Routes */}
            <Route path="/student/active" element={
              auth.isAuthenticated && auth.user?.role === UserRole.STUDENT ? 
                <ActiveExam /> : <Navigate to="/" />
            } />
            
            <Route path="/student/review" element={<StudentReview />} />

            <Route path="/student/completed" element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 flex-col p-4 text-center">
                <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col items-center max-w-lg animate-in fade-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-8 text-emerald-600 dark:text-emerald-400 shadow-sm">
                    <CheckCircle size={48} />
                  </div>
                  <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Submitted!</h1>
                  <p className="text-gray-500 dark:text-gray-400 mb-10 leading-relaxed text-lg">
                    Your responses have been securely encrypted and recorded. You may now close this window.
                  </p>
                  <Button onClick={() => navigate('/student/review')} variant="primary" size="lg" className="w-full">
                    Return to Home
                  </Button>
                </div>
              </div>
            } />
          </Routes>
      </AppContext.Provider>
    </ThemeProvider>
  );
};

export default App;
