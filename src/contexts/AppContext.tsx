import React, { createContext, useContext } from 'react';
import { AuthState, Exam, Program, StudentSession, User, Module, Violation } from '../types';

export interface AppContextType {
  auth: AuthState;
  isLoading: boolean;
  login: (role: 'STAFF' | 'STUDENT', emailOrId: string, code?: string) => Promise<void>;
  logout: () => void;
  exams: Exam[];
  programs: Program[];
  sessions: StudentSession[];
  users: User[];
  addExam: (exam: Exam) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  addStudent: (student: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addProgram: (program: Program) => Promise<void>;
  deleteProgram: (id: string) => Promise<void>;
  addModule: (programId: string, module: Module) => Promise<void>;
  deleteModule: (programId: string, moduleId: string) => Promise<void>;
  startExamSession: (studentId: string, examId: string) => Promise<StudentSession | void>;
  deleteSession: (sessionId: string) => Promise<void>;
  submitExamSession: (studentId: string, examId: string, answers: Record<string, any>, uploadedFiles?: any[]) => Promise<void>;
  updateSessionGrade: (studentId: string, examId: string, questionId: string, score: number, feedback?: string) => Promise<void>;
  logViolation: (studentId: string, violation: Violation) => void;
  refreshData: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
