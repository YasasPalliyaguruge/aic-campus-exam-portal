import { 
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, 
  query, where, getDoc, setDoc, onSnapshot 
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { User, Exam, StudentSession, Violation, UserRole, Program, Module } from '../types';

// Helper to convert Firestore snapshot to typed array
const convertSnapshot = <T>(snapshot: any) => {
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as T[];
};

export const api = {
  auth: {
    login: async (role: string, idOrEmail: string, code?: string) => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000; // 1 second
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Staff Login (Firebase Auth)
          if (role === 'STAFF') {
              console.log(`🔐 Attempting login (attempt ${attempt}/${MAX_RETRIES})...`);
              
              const userCredential = await signInWithEmailAndPassword(auth, idOrEmail, code || ''); 
              const userDocRef = doc(db, 'users', userCredential.user.uid);
              
              try {
                const userDoc = await getDoc(userDocRef);
                
                if (!userDoc.exists()) {
                    // Auto-create profile if missing (Self-healing)
                    const newProfile: User = {
                        id: userCredential.user.uid,
                        name: "Admin User",
                        email: idOrEmail,
                        role: UserRole.ADMIN,
                        programId: 'admin_prog'
                    };
                    await setDoc(userDocRef, newProfile);
                    console.log('✅ Auto-created user profile in Firestore');
                    return { user: newProfile, activeExamId: '' };
                }
                console.log('✅ Login successful!');
                return { user: userDoc.data() as User, activeExamId: '' };
              } catch (firestoreError: any) {
                // Enhanced error messages for Firestore issues
                console.error('Firestore error:', firestoreError);
                if (firestoreError.code === 'unavailable' || firestoreError.message?.includes('offline')) {
                  throw new Error('❌ Firestore Database is not enabled!\n\n📋 Please follow these steps:\n1. Go to Firebase Console\n2. Click "Firestore Database"\n3. Click "Create Database"\n4. Choose a location and click "Enable"\n\n📖 See FIRESTORE_SETUP.md for details');
                } else if (firestoreError.code === 'permission-denied') {
                  throw new Error('❌ Permission denied. Please update Firestore Security Rules.\n\n📖 See FIRESTORE_SETUP.md for instructions');
                } else {
                  throw new Error(`Firestore Error: ${firestoreError.message}`);
                }
              }
          } 
          // Student Login (Access Code)
          else {
              const q = query(collection(db, 'users'), where('email', '==', idOrEmail), where('role', '==', 'STUDENT'));
              const snapshot = await getDocs(q);
              if (snapshot.empty) throw new Error("Student not found.");
              
              const student = snapshot.docs[0].data() as User;
              
              // Check Exam Access Code
              const examQ = query(collection(db, 'exams'), where('status', '==', 'PUBLISHED'));
              const examSnapshot = await getDocs(examQ);
              
              let activeExamId = '';
              let isValid = false;

              examSnapshot.forEach(doc => {
                  const exam = doc.data() as Exam;
                  if (exam.studentCredentials?.[student.id] === code) {
                      isValid = true;
                      activeExamId = exam.id;
                  }
              });

              if (!isValid) throw new Error("Invalid Access Code");
              
              // Initialize session if it doesn't exist
              await api.sessions.init(student.id, activeExamId);
              
              return { user: student, activeExamId };
          }
        } catch (error: any) {
          // Re-throw with original message if already formatted
          if (error.message?.startsWith('❌')) {
            throw error;
          }
          
          // Handle Firebase Auth errors with retry logic
          const shouldRetry = 
            error.code === 'auth/network-request-failed' ||
            error.code === 'auth/too-many-requests' ||
            error.message?.includes('503') ||
            error.message?.includes('visibility-check-was-unavailable');
          
          if (shouldRetry && attempt < MAX_RETRIES) {
            console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${RETRY_DELAY * attempt}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
            continue; // Retry
          }
          
          // Format specific error messages
          if (error.code === 'auth/user-not-found') {
            throw new Error('❌ User not found. Please check your email address.');
          } else if (error.code === 'auth/wrong-password') {
            throw new Error('❌ Incorrect password. Please try again.');
          } else if (error.code === 'auth/invalid-email') {
            throw new Error('❌ Invalid email address format.');
          } else if (error.code === 'auth/network-request-failed') {
            throw new Error('❌ Network error. Please check your internet connection and try again.');
          } else if (error.code === 'auth/too-many-requests') {
            throw new Error('❌ Too many failed login attempts. Please wait a few minutes and try again.');
          } else if (error.message?.includes('visibility-check-was-unavailable') || error.message?.includes('503')) {
            throw new Error('❌ Firebase Authentication service is temporarily unavailable.\n\n🔄 Please try these solutions:\n\n1. Disable ad blockers or browser extensions\n2. Try in an incognito/private window\n3. Check your Firebase Console:\n   - Authentication > Settings > Authorized domains\n   - Make sure "localhost" is listed\n4. Wait a few minutes (Firebase may be experiencing issues)\n5. Check Firebase Status: status.firebase.google.com\n\n💡 If using an ad blocker, whitelist:\n   - *.googleapis.com\n   - *.google.com\n   - localhost');
          } else if (error.code === 'auth/popup-blocked') {
            throw new Error('❌ Popup was blocked. Please allow popups for this site.');
          } else if (error.code === 'auth/invalid-credential') {
            throw new Error('❌ Invalid credentials. Please check your email and password.');
          }
          
          // Generic error
          throw new Error(`Login failed: ${error.message || 'Unknown error'}`);
        }
      }
      
      // If all retries failed
      throw new Error('❌ Login failed after multiple attempts. Please try again later.');
    },
    register: async (email: string, pass: string, name: string, role: UserRole) => {
        const { createUserWithEmailAndPassword } = await import("firebase/auth");
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const newUser: User = {
            id: userCredential.user.uid,
            name,
            email,
            role,
            studentId: role === UserRole.STUDENT ? `ST_${Date.now()}` : undefined,
            programId: 'prog_001' // Default program
        };
        await setDoc(doc(db, 'users', newUser.id), newUser);
        return newUser;
    },
    logout: async () => {
        await signOut(auth);
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

  exams: {
    create: async (exam: Exam) => {
        await setDoc(doc(db, 'exams', exam.id), exam);
    },
    delete: async (id: string) => {
        await deleteDoc(doc(db, 'exams', id));
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
            const updatedModules = [...program.modules, module];
            await updateDoc(programRef, { modules: updatedModules });
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
            const updatedModules = program.modules.filter(m => m.id !== moduleId);
            await updateDoc(programRef, { modules: updatedModules });
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
                warnings: [] // Initialize warnings array for proctor messages
            };
            await setDoc(sessionRef, newSession);
        }
    },
    delete: async (sessionId: string) => {
        await deleteDoc(doc(db, 'sessions', sessionId));
    },
    start: async (studentId: string, examId: string) => {
        const sessionId = `${studentId}_${examId}`;
        await updateDoc(doc(db, 'sessions', sessionId), {
            status: 'IN_PROGRESS',
            startTime: Date.now()
        });
    },
    submit: async (studentId: string, examId: string, answers: Record<string, any>) => {
        const sessionId = `${studentId}_${examId}`;
        
        // Update session with answers only - no auto grading
        await updateDoc(doc(db, 'sessions', sessionId), {
            status: 'SUBMITTED',
            submitTime: Date.now(),
            answers
        });
        
        console.log(`✅ Exam submitted. Manual grading required.`);
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

        // Update question score
        questionScores[questionId] = questionScore;
        
        // Update feedback if provided
        if (feedback) {
            graderNotes[questionId] = feedback;
        }
        
        // Recalculate total score
        const totalScore = Object.values(questionScores).reduce((sum, score) => sum + score, 0);
        
        // Update session
        await updateDoc(sessionRef, {
            questionScores,
            graderNotes,
            score: totalScore,
            gradedAt: Date.now()
        });
        
        console.log(`✅ Manual grade updated: ${questionScore} pts for question ${questionId}. New Total: ${totalScore}`);
    },
    logViolation: async (studentId: string, examId: string, violation: Violation) => {
        const sessionId = `${studentId}_${examId}`;
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (sessionSnap.exists()) {
            const session = sessionSnap.data() as StudentSession;
            await updateDoc(sessionRef, {
                violations: [...session.violations, violation]
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
        const q = query(collection(db, 'sessions'), 
            where('studentId', '==', studentId), 
            where('examId', '==', examId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            await updateDoc(snapshot.docs[0].ref, { currentFrame: frameData });
        }
    },
    terminate: async (sessionId: string) => {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
            status: 'SUBMITTED',
            submitTime: Date.now(),
            score: 0, // Disqualified or ended without submission
            feedback: 'Session terminated by proctor.'
        });
    },
    subscribe: (callback: (sessions: StudentSession[]) => void) => {
        const q = query(collection(db, 'sessions'));
        return onSnapshot(q, (snapshot) => {
            callback(convertSnapshot<StudentSession>(snapshot));
        });
    }
  }
};
