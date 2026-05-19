
export enum UserRole {
  ADMIN = 'ADMIN',
  LECTURER = 'LECTURER',
  STUDENT = 'STUDENT',
}

export interface User {
  id: string;
  studentId?: string; // Academic Matriculation ID (e.g., 2024-CS-001)
  name: string;
  email: string;
  role: UserRole;
  programId?: string; // For students/lecturers
  avatar?: string;
}

export enum QuestionType {
  MCQ = 'MCQ',
  MULTI_SELECT = 'MULTI_SELECT',
  TRUE_FALSE = 'TRUE_FALSE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  ESSAY = 'ESSAY',
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: string[]; // For MCQ / Multi-Select
  correctAnswer?: string | string[]; // String for single, Array for multi
  points: number;
}

export interface Exam {
  id: string;
  moduleId: string;
  title: string;
  durationMinutes: number;
  passThreshold: number;
  questions: Question[];
  status: 'DRAFT' | 'PUBLISHED';
  scheduledStart?: string;
  scheduledEnd?: string;
  scheduleTimeZone?: string;
  scheduledStartLocal?: string;
  scheduledEndLocal?: string;
  scheduledStartMs?: number;
  scheduledEndMs?: number;
  createdAt: string;
  // New fields for Assignment & Security
  assignedStudents: string[]; // List of User IDs allowed to take this exam
  studentCredentials: Record<string, string>; // Map of StudentID -> Unique Access Code
  referenceDocumentUrl?: string; // Optional PDF URL for Case Study
  referenceDocumentPath?: string; // Storage object path for secured reference document access
  // File Submission Config
  allowsFileUpload?: boolean;
  allowedFileTypes?: string[]; // e.g. ['.pdf', '.docx']
  maxFileCount?: number;
}

export interface Program {
  id: string;
  name: string;
  modules: Module[];
}

export interface Module {
  id: string;
  name: string;
  code: string;
}

export interface StudentSession {
  id?: string;
  studentId: string;
  examId: string;
  authUid?: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED';
  startTime?: number;
  submitTime?: number;
  violations: Violation[];
  answers: Record<string, any>; // Changed to any to support arrays for multi-select
  draftAnswers?: Record<string, any>;
  draftUploadedFiles?: { name: string; url: string; storagePath?: string; type: string; size: number; uploadedAt: number; }[];
  draftSavedAt?: number;
  draftRevision?: number;
  score?: number;
  feedback?: string;
  // Manual grading fields
  questionScores?: Record<string, number>; // Individual question scores
  gradedAt?: number; // Timestamp of grading
  graderNotes?: Record<string, string>; // Per-question feedback
  currentFrame?: string; // Current webcam frame for proctoring
  warnings?: string[]; // Warnings sent by proctor
  isFlagged?: boolean; // Marked for review by proctor
  uploadedFiles?: { name: string; url: string; storagePath?: string; type: string; size: number; uploadedAt: number; }[];
  extraTimeMinutes?: number; // Extra time granted to this student (admin can extend)
  isTerminated?: boolean; // True if session was terminated by admin - cannot be reopened
}

export interface Violation {
  timestamp: number;
  type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'NO_FACE_DETECTED' | 'PASTE_ATTEMPT';
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  activeExamId?: string; // Track which exam the student logged into
}
