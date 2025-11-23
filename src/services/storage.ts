
import { MOCK_USERS, MOCK_PROGRAMS, MOCK_EXAMS, MOCK_SESSIONS } from '../constants';
import { User, Program, Exam, StudentSession } from '../types';

const DB_KEY = 'proctorai_db_v1';

export interface DatabaseSchema {
  users: User[];
  programs: Program[];
  exams: Exam[];
  sessions: StudentSession[];
}

const INITIAL_DB: DatabaseSchema = {
  users: MOCK_USERS,
  programs: MOCK_PROGRAMS,
  exams: MOCK_EXAMS,
  sessions: MOCK_SESSIONS,
};

// Initialize DB if empty
if (!localStorage.getItem(DB_KEY)) {
  localStorage.setItem(DB_KEY, JSON.stringify(INITIAL_DB));
}

export const db = {
  read: (): DatabaseSchema => {
    try {
      return JSON.parse(localStorage.getItem(DB_KEY) || '') || INITIAL_DB;
    } catch {
      return INITIAL_DB;
    }
  },
  write: (data: DatabaseSchema) => {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  },
  update: (callback: (data: DatabaseSchema) => void) => {
    const current = db.read();
    callback(current);
    db.write(current);
    return current;
  }
};
