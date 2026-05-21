import {
  collection, getDocs, doc, updateDoc, deleteDoc,
  query, getDoc, setDoc, onSnapshot, writeBatch, where
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, signInAnonymously } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from '../firebase';
import { User, Exam, StudentSession, Violation, UserRole, Program, Module } from '../types';
import { getServerTime, updateCachedServerTime } from './serverTime';

const convertSnapshot = <T>(snapshot: any) => {
  return snapshot.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() })) as T[];
};

interface StudentExamContext {
  user?: User;
  exam: Exam;
  session: StudentSession;
  activeExamId: string;
  serverNowMs: number;
}

interface StudentSubmissionContext {
  exam: Exam;
  session: StudentSession;
  serverNowMs: number;
}

const callFunction = async <Request, Response>(name: string, data?: Request): Promise<Response> => {
  const callable = httpsCallable<Request, Response>(functions, name);
  const result = await callable((data || {}) as Request);
  return result.data;
};

const isAnonymousStudent = () => Boolean(auth.currentUser?.isAnonymous);

export const api = {
  auth: {
    login: async (role: string, idOrEmail: string, code?: string) => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (role === 'STAFF') {
            const userCredential = await signInWithEmailAndPassword(auth, idOrEmail, code || '');
            const claimResult = await callFunction<void, { role: UserRole; serverNowMs: number }>('syncStaffClaims');
            updateCachedServerTime(claimResult.serverNowMs);
            await userCredential.user.getIdToken(true);

            const userDocRef = doc(db, 'users', userCredential.user.uid);

            try {
              const userDoc = await getDoc(userDocRef);

              if (!userDoc.exists()) {
                throw new Error('This account is not registered as staff.');
              }

              const profile = userDoc.data() as User;
              if (profile.role !== UserRole.ADMIN && profile.role !== UserRole.LECTURER) {
                throw new Error('This account is not authorized for staff access.');
              }

              return { user: profile, activeExamId: '' };
            } catch (firestoreError: any) {
              if (firestoreError.code === 'unavailable' || firestoreError.message?.includes('offline')) {
                throw new Error('Firestore Database is not enabled. Please enable Firestore in Firebase Console.');
              }
              if (firestoreError.code === 'permission-denied') {
                throw new Error('This account is not authorized for staff access.');
              }
              throw firestoreError;
            }
          }

          if (role === 'STUDENT' && auth.currentUser && !auth.currentUser.isAnonymous) {
            await signOut(auth);
          }

          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }

          const result = await callFunction<{ email: string; accessCode: string }, StudentExamContext>('validateStudentAccess', {
            email: idOrEmail.trim(),
            accessCode: (code || '').replace(/\s+/g, '').toUpperCase(),
          });

          updateCachedServerTime(result.serverNowMs);

          return {
            user: result.user,
            activeExamId: result.activeExamId,
            bootstrapData: {
              users: result.user ? [result.user] : [],
              programs: [],
              exams: [result.exam],
              sessions: [result.session],
            },
          };
        } catch (error: any) {
          const shouldRetry =
            error.code === 'auth/network-request-failed' ||
            error.code === 'auth/too-many-requests' ||
            error.message?.includes('503') ||
            error.message?.includes('visibility-check-was-unavailable');

          if (shouldRetry && attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            continue;
          }

          if (error.code === 'auth/user-not-found') {
            throw new Error('User not found. Please check your email address.');
          }
          if (error.code === 'auth/wrong-password') {
            throw new Error('Incorrect password. Please try again.');
          }
          if (error.code === 'auth/invalid-email') {
            throw new Error('Invalid email address format.');
          }
          if (error.code === 'auth/network-request-failed') {
            throw new Error('Network error. Please check your internet connection and try again.');
          }
          if (error.code === 'auth/too-many-requests') {
            throw new Error('Too many failed login attempts. Please wait a few minutes and try again.');
          }
          if (error.code === 'auth/invalid-credential') {
            throw new Error('Invalid credentials. Please check your email and password.');
          }
          if (error.code === 'functions/permission-denied' || error.code === 'permission-denied') {
            throw new Error(role === 'STAFF'
              ? 'This account is not registered or authorized as staff.'
              : (error.message || 'Invalid email or exam access code. Please check the details and try again.'));
          }
          if (role === 'STUDENT' && (error.code === 'functions/not-found' || error.code === 'not-found')) {
            throw new Error(error.message || 'Student not found. Please check the email address.');
          }
          if (role === 'STUDENT' && (error.code === 'functions/failed-precondition' || error.code === 'failed-precondition')) {
            throw new Error(error.message || 'This exam is not available yet.');
          }
          if (role === 'STUDENT' && (error.code === 'functions/invalid-argument' || error.code === 'invalid-argument')) {
            throw new Error(error.message || 'Please enter a valid student email and access code.');
          }

          throw new Error(error.message || 'Login failed. Please try again.');
        }
      }

      throw new Error('Login failed after multiple attempts. Please try again later.');
    },
    register: async (email: string, pass: string, name: string, role: UserRole) => {
      if (role !== UserRole.STUDENT) {
        throw new Error('Staff accounts must be provisioned by an administrator.');
      }

      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser: User = {
        id: userCredential.user.uid,
        name,
        email,
        role: UserRole.STUDENT,
        studentId: `ST_${Date.now()}`,
        programId: 'prog_001'
      };
      await setDoc(doc(db, 'users', newUser.id), newUser);
      return newUser;
    },
    logout: async () => {
      await signOut(auth);
    },
    syncStaffClaims: async () => {
      if (!auth.currentUser || auth.currentUser.isAnonymous) return null;
      const claimResult = await callFunction<void, { role: UserRole; serverNowMs: number }>('syncStaffClaims');
      updateCachedServerTime(claimResult.serverNowMs);
      await auth.currentUser.getIdToken(true);
      return claimResult;
    }
  },

  data: {
    fetchAll: async () => {
      const [usersSnap, programsSnap, examsSnap, sessionsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'programs')),
        getDocs(collection(db, 'exams')),
        getDocs(collection(db, 'sessions'))
      ]);

      return {
        users: convertSnapshot<User>(usersSnap),
        programs: convertSnapshot<Program>(programsSnap),
        exams: convertSnapshot<Exam>(examsSnap),
        sessions: convertSnapshot<StudentSession>(sessionsSnap)
      };
    }
  },

  student: {
    getActiveExamContext: async (examId?: string) => {
      const result = await callFunction<{ examId?: string }, StudentExamContext>('getStudentExamContext', { examId });
      updateCachedServerTime(result.serverNowMs);
      return result;
    },
    getLatestSubmission: async () => {
      const result = await callFunction<void, StudentSubmissionContext | null>('getLatestStudentSubmission');
      if (result?.serverNowMs) updateCachedServerTime(result.serverNowMs);
      return result;
    },
    getTrustedTime: async () => {
      const result = await callFunction<void, { serverNowMs: number }>('getTrustedTime');
      updateCachedServerTime(result.serverNowMs);
      return result.serverNowMs;
    },
    getReferenceDocumentUrl: async (examId: string) => {
      const result = await callFunction<{ examId: string }, { url: string; serverNowMs: number }>('getExamReferenceDocumentUrl', { examId });
      updateCachedServerTime(result.serverNowMs);
      return result.url;
    }
  },

  exams: {
    create: async (exam: Exam) => {
      const batch = writeBatch(db);
      const examRef = doc(db, 'exams', exam.id);
      batch.set(examRef, exam);

      const existingCodes = await getDocs(query(collection(db, 'accessCodes'), where('examId', '==', exam.id)));
      existingCodes.docs.forEach((codeDoc) => batch.delete(codeDoc.ref));

      Object.entries(exam.studentCredentials || {}).forEach(([studentId, code]) => {
        const normalizedCode = String(code || '').trim().toUpperCase();
        if (!normalizedCode) return;
        batch.set(doc(db, 'accessCodes', `${exam.id}_${studentId}`), {
          code: normalizedCode,
          examId: exam.id,
          studentId,
          examStatus: exam.status,
          updatedAt: Date.now(),
        });
      });

      await batch.commit();
    },
    delete: async (id: string) => {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'exams', id));
      const existingCodes = await getDocs(query(collection(db, 'accessCodes'), where('examId', '==', id)));
      existingCodes.docs.forEach((codeDoc) => batch.delete(codeDoc.ref));
      await batch.commit();
    }
  },

  programs: {
    create: async (program: Program) => {
      await setDoc(doc(db, 'programs', program.id), program);
    },
    addModule: async (programId: string, module: Module) => {
      const programRef = doc(db, 'programs', programId);
      const programSnap = await getDoc(programRef);
      if (programSnap.exists()) {
        const program = programSnap.data() as Program;
        await updateDoc(programRef, { modules: [...program.modules, module] });
      }
    },
    delete: async (id: string) => {
      await deleteDoc(doc(db, 'programs', id));
    },
    deleteModule: async (programId: string, moduleId: string) => {
      const programRef = doc(db, 'programs', programId);
      const programSnap = await getDoc(programRef);
      if (programSnap.exists()) {
        const program = programSnap.data() as Program;
        await updateDoc(programRef, { modules: program.modules.filter(m => m.id !== moduleId) });
      }
    }
  },

  students: {
    enroll: async (student: User) => {
      await setDoc(doc(db, 'users', student.id), student);
    },
    delete: async (id: string) => {
      await deleteDoc(doc(db, 'users', id));
    }
  },

  sessions: {
    init: async (studentId: string, examId: string) => {
      const sessionId = `${studentId}_${examId}`;
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        const newSession: StudentSession = {
          studentId,
          examId,
          status: 'WAITING',
          answers: {},
          violations: [],
          warnings: []
        };
        await setDoc(sessionRef, newSession);
      }
    },
    delete: async (sessionId: string) => {
      await deleteDoc(doc(db, 'sessions', sessionId));
    },
    start: async (studentId: string, examId: string) => {
      if (isAnonymousStudent()) {
        const result = await callFunction<{ studentId: string; examId: string }, StudentExamContext>('startStudentSession', { studentId, examId });
        updateCachedServerTime(result.serverNowMs);
        return result.session;
      }

      const sessionId = `${studentId}_${examId}`;
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'IN_PROGRESS',
        startTime: getServerTime()
      });
    },
    submit: async (studentId: string, examId: string, answers: Record<string, any>, uploadedFiles?: any[]) => {
      if (isAnonymousStudent()) {
        const result = await callFunction<
          { studentId: string; examId: string; answers: Record<string, any>; uploadedFiles?: any[] },
          { session: StudentSession; serverNowMs: number }
        >('submitStudentSession', { studentId, examId, answers, uploadedFiles: uploadedFiles || [] });
        updateCachedServerTime(result.serverNowMs);
        return result.session;
      }

      const sessionId = `${studentId}_${examId}`;
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'SUBMITTED',
        submitTime: getServerTime(),
        answers,
        uploadedFiles: uploadedFiles || []
      });
    },
    saveDraft: async (
      studentId: string,
      examId: string,
      answers: Record<string, any>,
      uploadedFiles?: any[],
      revision = 0,
    ) => {
      if (isAnonymousStudent()) {
        const result = await callFunction<
          { studentId: string; examId: string; answers: Record<string, any>; uploadedFiles?: any[]; revision?: number },
          { session: StudentSession; serverNowMs: number }
        >('saveStudentDraft', { studentId, examId, answers, uploadedFiles: uploadedFiles || [], revision });
        updateCachedServerTime(result.serverNowMs);
        return result.session;
      }

      const sessionId = `${studentId}_${examId}`;
      await updateDoc(doc(db, 'sessions', sessionId), {
        draftAnswers: answers,
        draftUploadedFiles: uploadedFiles || [],
        draftSavedAt: getServerTime(),
        draftRevision: revision,
      });
    },
    updateGrade: async (
      studentId: string,
      examId: string,
      questionId: string,
      questionScore: number,
      feedback?: string
    ) => {
      const sessionId = `${studentId}_${examId}`;
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error('Session not found');
      }

      const session = sessionSnap.data() as StudentSession;
      const questionScores = session.questionScores || {};
      const graderNotes = session.graderNotes || {};

      questionScores[questionId] = questionScore;
      if (feedback) graderNotes[questionId] = feedback;

      const totalScore = Object.values(questionScores).reduce((sum, score) => sum + score, 0);

      await updateDoc(sessionRef, {
        questionScores,
        graderNotes,
        score: totalScore,
        gradedAt: getServerTime()
      });
    },
    logViolation: async (studentId: string, examId: string, violation: Violation) => {
      if (isAnonymousStudent()) {
        const result = await callFunction<
          { studentId: string; examId: string; violation: Violation },
          { session: StudentSession; serverNowMs: number }
        >('logStudentViolation', { studentId, examId, violation });
        updateCachedServerTime(result.serverNowMs);
        return result.session;
      }

      const sessionId = `${studentId}_${examId}`;
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const session = sessionSnap.data() as StudentSession;
        await updateDoc(sessionRef, {
          violations: [...(session.violations || []), violation]
        });
      }
    },
    sendWarning: async (sessionId: string, message: string) => {
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const session = sessionSnap.data() as StudentSession;
        await updateDoc(sessionRef, {
          warnings: [...(session.warnings || []), message]
        });
      }
    },
    updateFrame: async (studentId: string, examId: string, frameData: string) => {
      const sessionId = `${studentId}_${examId}`;
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, { currentFrame: frameData });
    },
    subscribeToSession: (studentId: string, examId: string, callback: (session: StudentSession | null) => void) => {
      const sessionId = `${studentId}_${examId}`;
      return onSnapshot(doc(db, 'sessions', sessionId), (sessionSnap) => {
        callback(sessionSnap.exists() ? { id: sessionSnap.id, ...sessionSnap.data() } as StudentSession : null);
      });
    },
    terminate: async (sessionId: string) => {
      const sessionRef = doc(db, 'sessions', sessionId);
      await updateDoc(sessionRef, {
        status: 'SUBMITTED',
        submitTime: getServerTime(),
        score: 0,
        feedback: 'Session terminated by proctor.',
        isTerminated: true
      });
    },
    extendTime: async (sessionId: string, extraMinutes: number) => {
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        const session = sessionSnap.data() as StudentSession;
        const currentExtra = session.extraTimeMinutes || 0;
        await updateDoc(sessionRef, {
          extraTimeMinutes: currentExtra + extraMinutes
        });
      }
    },
    reopenSession: async (studentId: string, examId: string) => {
      if (isAnonymousStudent()) {
        const result = await callFunction<{ studentId: string; examId: string }, StudentExamContext>('reopenStudentSession', { studentId, examId });
        updateCachedServerTime(result.serverNowMs);
        return result.session;
      }

      const sessionId = `${studentId}_${examId}`;
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);

      if (sessionSnap.exists()) {
        const session = sessionSnap.data() as StudentSession;
        if (session.isTerminated) throw new Error('Cannot reopen: Session was terminated by administrator');
        if (session.status !== 'SUBMITTED') throw new Error('Cannot reopen: Session is not in SUBMITTED status');

        await updateDoc(sessionRef, {
          status: 'IN_PROGRESS',
          submitTime: null
        });
      }
    },
    subscribe: (callback: (sessions: StudentSession[]) => void) => {
      const q = query(collection(db, 'sessions'));
      return onSnapshot(q, (snapshot) => {
        callback(convertSnapshot<StudentSession>(snapshot));
      });
    }
  }
};
