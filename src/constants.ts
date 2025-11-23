
import { User, UserRole, Program, Exam, QuestionType, StudentSession } from './types';

export const MOCK_PROGRAMS: Program[] = [
  {
    id: 'prog_1',
    name: 'Computer Science B.Sc',
    modules: [
      { id: 'mod_cs101', name: 'Intro to Algorithms', code: 'CS101' },
      { id: 'mod_cs202', name: 'Data Structures', code: 'CS202' },
      { id: 'mod_ai301', name: 'Artificial Intelligence', code: 'AI301' },
    ]
  },
  {
    id: 'prog_2',
    name: 'Business Administration',
    modules: [
      { id: 'mod_bus101', name: 'Microeconomics', code: 'BUS101' },
      { id: 'mod_bus202', name: 'Marketing Strategy', code: 'BUS202' },
    ]
  }
];

export const MOCK_USERS: User[] = [
  { id: 'u_admin', name: 'Sarah Connor', email: 'admin@aic.edu', role: UserRole.ADMIN, avatar: 'SC' },
  { id: 'u_lec1', name: 'Dr. Alan Grant', email: 'grant@aic.edu', role: UserRole.LECTURER, programId: 'prog_1', avatar: 'AG' },
  { id: 'u_lec2', name: 'Dr. Ellie Sattler', email: 'sattler@aic.edu', role: UserRole.LECTURER, programId: 'prog_2', avatar: 'ES' },
  { id: 'u_stu1', studentId: '2024-CS-101', name: 'John Doe', email: 'john@student.aic.edu', role: UserRole.STUDENT, programId: 'prog_1', avatar: 'JD' },
  { id: 'u_stu2', studentId: '2024-CS-102', name: 'Jane Smith', email: 'jane@student.aic.edu', role: UserRole.STUDENT, programId: 'prog_1', avatar: 'JS' },
  { id: 'u_stu3', studentId: '2024-CS-103', name: 'Bob Wilson', email: 'bob@student.aic.edu', role: UserRole.STUDENT, programId: 'prog_1', avatar: 'BW' },
  { id: 'u_stu4', studentId: '2024-CS-104', name: 'Alice Cooper', email: 'alice@student.aic.edu', role: UserRole.STUDENT, programId: 'prog_1', avatar: 'AC' },
];

export const MOCK_EXAMS: Exam[] = [
  {
    id: 'exam_1',
    moduleId: 'mod_cs101',
    title: 'Midterm Assessment: Sorting Algorithms',
    durationMinutes: 45,
    passThreshold: 60,
    status: 'PUBLISHED',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    scheduledStart: new Date(Date.now() - 86400000).toISOString(),
    scheduledEnd: new Date(Date.now() + 86400000 * 7).toISOString(),
    assignedStudents: ['u_stu2', 'u_stu3', 'u_stu4'],
    studentCredentials: {
      'u_stu2': 'KEY-1234',
      'u_stu3': 'KEY-5678',
      'u_stu4': 'KEY-9012'
    },
    questions: [
      {
        id: 'q1',
        type: QuestionType.MCQ,
        text: 'What is the time complexity of Merge Sort in the worst case?',
        options: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(log n)'],
        correctAnswer: 'O(n log n)',
        points: 5
      },
      {
        id: 'q2',
        type: QuestionType.TRUE_FALSE,
        text: 'Quick Sort is a stable sorting algorithm.',
        options: ['True', 'False'],
        correctAnswer: 'False',
        points: 5
      },
      {
        id: 'q3',
        type: QuestionType.MULTI_SELECT,
        text: 'Which of the following are stable sorting algorithms? (Select all that apply)',
        options: ['Merge Sort', 'Quick Sort', 'Bubble Sort', 'Heap Sort'],
        correctAnswer: ['Merge Sort', 'Bubble Sort'],
        points: 10
      },
      {
        id: 'q4',
        type: QuestionType.ESSAY,
        text: 'Explain the concept of a divide-and-conquer algorithm strategy. Provide a real-world example outside of computing.',
        points: 20
      }
    ]
  },
  {
    id: 'exam_2',
    moduleId: 'mod_bus101',
    title: 'Principles of Microeconomics Final',
    durationMinutes: 90,
    passThreshold: 50,
    status: 'DRAFT',
    createdAt: new Date(Date.now()).toISOString(),
    questions: [],
    assignedStudents: [],
    studentCredentials: {}
  }
];

// Clean slate for sessions to avoid timer issues during testing
export const MOCK_SESSIONS: StudentSession[] = [
  // All sessions start as waiting or clean state for testing
  {
    studentId: 'u_stu2',
    examId: 'exam_1',
    status: 'WAITING', 
    violations: [],
    answers: {}
  },
  {
    studentId: 'u_stu3',
    examId: 'exam_1',
    status: 'WAITING',
    violations: [],
    answers: {}
  },
  {
    studentId: 'u_stu4',
    examId: 'exam_1',
    status: 'WAITING',
    violations: [],
    answers: {}
  }
];
