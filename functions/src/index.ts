import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const app = getApps()[0] || initializeApp();
const db = getFirestore(app, 'exam-portal');

type SessionStatus = 'WAITING' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED';

interface User {
  id: string;
  studentId?: string;
  name: string;
  email: string;
  role: string;
  programId?: string;
  avatar?: string;
}

interface Exam {
  id: string;
  title: string;
  status: string;
  durationMinutes: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  scheduledStartMs?: number;
  scheduledEndMs?: number;
  assignedStudents?: string[];
  studentCredentials?: Record<string, string>;
  referenceDocumentUrl?: string;
  referenceDocumentPath?: string;
  allowsFileUpload?: boolean;
  allowedFileTypes?: string[];
  maxFileCount?: number;
}

interface AccessCodeLookup {
  code: string;
  examId: string;
  studentId: string;
}

interface StudentSession {
  id?: string;
  studentId: string;
  examId: string;
  authUid?: string;
  status: SessionStatus;
  startTime?: number;
  submitTime?: number;
  violations?: unknown[];
  answers?: Record<string, unknown>;
  draftAnswers?: Record<string, unknown>;
  draftUploadedFiles?: unknown[];
  draftSavedAt?: number;
  draftRevision?: number;
  warnings?: string[];
  uploadedFiles?: unknown[];
  extraTimeMinutes?: number;
  isTerminated?: boolean;
}

interface UploadedExamFile {
  name: string;
  url: string;
  storagePath: string;
  type: string;
  size: number;
  uploadedAt: number;
}

const normalizeCode = (value: unknown) => String(value || '').replace(/\s+/g, '').trim().toUpperCase();
const STAFF_ROLES = new Set(['ADMIN', 'LECTURER']);
const FINAL_SUBMISSION_GRACE_MS = 2 * 60 * 1000;
const MAX_SUBMISSION_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_SUBMISSION_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

const requireAuthUid = (auth: { uid?: string } | undefined) => {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Please sign in again.');
  return auth.uid;
};

const assertStaffProfile = async (uid: string) => {
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError('permission-denied', 'This account is not registered as staff.');
  }

  const user = withId<User>(userSnap);
  if (!STAFF_ROLES.has(user.role)) {
    throw new HttpsError('permission-denied', 'This account is not authorized for staff access.');
  }

  return user;
};

const sessionIdFor = (studentId: string, examId: string) => `${studentId}_${examId}`;

const withId = <T>(snap: FirebaseFirestore.DocumentSnapshot): T => {
  return { id: snap.id, ...snap.data() } as T;
};

const sanitizeFileName = (value: unknown) => String(value || '')
  .replace(/[\\/:*?"<>|]/g, '')
  .trim()
  .slice(0, 180);

const extractStoragePathFromDownloadUrl = (value: unknown) => {
  try {
    const parsedUrl = new URL(String(value || ''));
    if (parsedUrl.hostname !== 'firebasestorage.googleapis.com') return null;
    const match = parsedUrl.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

const normalizeStoragePath = (file: Record<string, unknown>) => {
  const directPath = typeof file.storagePath === 'string' ? file.storagePath : '';
  return directPath || extractStoragePathFromDownloadUrl(file.url) || '';
};

const getDefaultStorageBucketName = () => {
  if (app.options.storageBucket) return app.options.storageBucket;
  try {
    const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}') as { storageBucket?: string };
    if (firebaseConfig.storageBucket) return firebaseConfig.storageBucket;
  } catch {
    // Fall through to explicit error below.
  }
  throw new HttpsError('failed-precondition', 'Firebase Storage bucket is not configured for upload validation.');
};

const validateUploadedFiles = async (
  filesInput: unknown,
  exam: Exam,
  session: StudentSession,
  ownerUid: string,
): Promise<UploadedExamFile[]> => {
  const files = Array.isArray(filesInput) ? filesInput : [];
  if (!files.length) return [];

  if (!exam.allowsFileUpload) {
    throw new HttpsError('failed-precondition', 'This exam does not allow file uploads.');
  }

  const maxFileCount = exam.maxFileCount || 1;
  if (files.length > maxFileCount) {
    throw new HttpsError('invalid-argument', `This exam allows a maximum of ${maxFileCount} uploaded file${maxFileCount === 1 ? '' : 's'}.`);
  }

  const allowedExtensions = new Set((exam.allowedFileTypes?.length ? exam.allowedFileTypes : ['.pdf', '.docx', '.pptx'])
    .map(ext => ext.trim().toLowerCase())
    .filter(Boolean));

  const validatedFiles = await Promise.all(files.map(async (rawFile) => {
    if (!rawFile || typeof rawFile !== 'object') {
      throw new HttpsError('invalid-argument', 'Invalid uploaded file metadata.');
    }

    const file = rawFile as Record<string, unknown>;
    const storagePath = normalizeStoragePath(file);
    const expectedPrefix = `exam-submissions/${exam.id}/${session.studentId}/`;
    if (!storagePath || !storagePath.startsWith(expectedPrefix)) {
      throw new HttpsError('permission-denied', 'Uploaded file does not belong to this exam session.');
    }

    const storageBucket = getStorage(app).bucket(getDefaultStorageBucketName());
    const [exists] = await storageBucket.file(storagePath).exists();
    if (!exists) {
      throw new HttpsError('not-found', 'Uploaded file was not found in Storage.');
    }

    const [metadata] = await storageBucket.file(storagePath).getMetadata();
    const contentType = String(metadata.contentType || file.type || '');
    const size = Number(metadata.size || file.size || 0);
    const customMetadata = metadata.metadata || {};

    if (!ALLOWED_SUBMISSION_CONTENT_TYPES.has(contentType) || size <= 0 || size > MAX_SUBMISSION_FILE_SIZE) {
      throw new HttpsError('invalid-argument', 'Uploaded file type or size is not allowed.');
    }

    if (
      customMetadata.ownerUid !== ownerUid ||
      customMetadata.examId !== exam.id ||
      customMetadata.studentId !== session.studentId
    ) {
      throw new HttpsError('permission-denied', 'Uploaded file ownership metadata is invalid.');
    }

    const safeName = sanitizeFileName(file.name || storagePath.split('/').pop());
    const extension = safeName.includes('.') ? `.${safeName.split('.').pop()}`.toLowerCase() : CONTENT_TYPE_EXTENSIONS[contentType];
    if (!allowedExtensions.has(extension) && !allowedExtensions.has(CONTENT_TYPE_EXTENSIONS[contentType])) {
      throw new HttpsError('invalid-argument', 'Uploaded file type is not allowed for this exam.');
    }

    return {
      name: safeName || storagePath.split('/').pop() || 'submission-file',
      url: String(file.url || ''),
      storagePath,
      type: contentType,
      size,
      uploadedAt: Number(file.uploadedAt || Date.now()),
    };
  }));

  return validatedFiles;
};

const getStartMs = (exam: Exam) => {
  if (typeof exam.scheduledStartMs === 'number') return exam.scheduledStartMs;
  return exam.scheduledStart ? new Date(exam.scheduledStart).getTime() : 0;
};

const getEndMs = (exam: Exam) => {
  if (typeof exam.scheduledEndMs === 'number') return exam.scheduledEndMs;
  return exam.scheduledEnd ? new Date(exam.scheduledEnd).getTime() : Number.MAX_SAFE_INTEGER;
};

const assertWindowOpen = (exam: Exam, now: number) => {
  const startMs = getStartMs(exam);
  const endMs = getEndMs(exam);

  if (now < startMs) {
    throw new HttpsError('failed-precondition', `Exam has not started yet. It opens at ${new Date(startMs).toLocaleString()}.`);
  }
  if (now > endMs) {
    throw new HttpsError('failed-precondition', `Exam has ended. It closed at ${new Date(endMs).toLocaleString()}.`);
  }
};

const assertSessionOwner = (session: StudentSession, uid: string) => {
  if (session.authUid !== uid) {
    throw new HttpsError('permission-denied', 'This session is not assigned to your current sign-in.');
  }
};

const loadExam = async (examId: string) => {
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) throw new HttpsError('not-found', 'Exam not found.');
  return withId<Exam>(examSnap);
};

const loadSession = async (studentId: string, examId: string) => {
  const sessionRef = db.collection('sessions').doc(sessionIdFor(studentId, examId));
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'Session not found.');
  return { ref: sessionRef, session: withId<StudentSession>(sessionSnap) };
};

const findExamByAccessCode = async (user: User, accessCode: string) => {
  const lookupSnap = await db.collection('accessCodes')
    .where('code', '==', accessCode)
    .where('studentId', '==', user.id)
    .limit(5)
    .get();

  for (const lookupDoc of lookupSnap.docs) {
    const lookup = lookupDoc.data() as AccessCodeLookup;
    const examSnap = await db.collection('exams').doc(lookup.examId).get();
    if (!examSnap.exists) continue;

    const exam = withId<Exam>(examSnap);
    const assigned = exam.assignedStudents || [];
    const storedCode = normalizeCode(exam.studentCredentials?.[user.id]);
    if (exam.status === 'PUBLISHED' && assigned.includes(user.id) && storedCode === accessCode) {
      return exam;
    }
  }

  // Compatibility fallback for exams published before accessCodes documents existed.
  const examsSnap = await db.collection('exams').where('status', '==', 'PUBLISHED').get();
  const matchedExamSnap = examsSnap.docs.find((examSnap) => {
    const exam = withId<Exam>(examSnap);
    const assigned = exam.assignedStudents || [];
    const storedCode = normalizeCode(exam.studentCredentials?.[user.id]);
    return assigned.includes(user.id) && storedCode && storedCode === accessCode;
  });

  if (!matchedExamSnap) return null;

  const exam = withId<Exam>(matchedExamSnap);
  await db.collection('accessCodes').doc(`${exam.id}_${user.id}`).set({
    code: accessCode,
    examId: exam.id,
    studentId: user.id,
    examStatus: exam.status,
    updatedAt: Date.now(),
  }, { merge: true });

  return exam;
};

const responseFor = (exam: Exam, session: StudentSession, user?: User) => {
  const serverNowMs = Date.now();
  return {
    user,
    exam,
    session,
    activeExamId: exam.id,
    serverNowMs,
  };
};

export const getTrustedTime = onCall(() => {
  return { serverNowMs: Date.now() };
});

export const syncStaffClaims = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const user = await assertStaffProfile(uid);
  const userRecord = await getAuth(app).getUser(uid);
  await getAuth(app).setCustomUserClaims(uid, {
    ...(userRecord.customClaims || {}),
    role: user.role,
  });

  return {
    role: user.role,
    serverNowMs: Date.now(),
  };
});

export const validateStudentAccess = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const emailInput = String(request.data?.email || '').trim();
  const email = emailInput.toLowerCase();
  const accessCode = normalizeCode(request.data?.accessCode);
  if (!email || !accessCode) throw new HttpsError('invalid-argument', 'Student email and access code are required.');

  let usersSnap = await db.collection('users').where('email', '==', emailInput).limit(5).get();
  if (usersSnap.empty && email !== emailInput) {
    usersSnap = await db.collection('users').where('email', '==', email).limit(5).get();
  }
  const userSnap = usersSnap.docs.find(snap => snap.data().role === 'STUDENT' && String(snap.data().email || '').toLowerCase() === email);
  if (!userSnap) throw new HttpsError('not-found', 'Student not found.');

  const user = withId<User>(userSnap);
  const exam = await findExamByAccessCode(user, accessCode);
  if (!exam) throw new HttpsError('permission-denied', 'Invalid access code.');
  const now = Date.now();
  assertWindowOpen(exam, now);

  const sessionRef = db.collection('sessions').doc(sessionIdFor(user.id, exam.id));
  const sessionSnap = await sessionRef.get();
  let session: StudentSession;

  if (sessionSnap.exists) {
    session = withId<StudentSession>(sessionSnap);
    await sessionRef.set({ authUid: uid }, { merge: true });
    session = { ...session, authUid: uid };
  } else {
    session = {
      id: sessionRef.id,
      studentId: user.id,
      examId: exam.id,
      authUid: uid,
      status: 'WAITING',
      answers: {},
      violations: [],
      warnings: [],
    };
    await sessionRef.set(session);
  }

  return responseFor(exam, session, user);
});

export const getStudentExamContext = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const requestedExamId = request.data?.examId ? String(request.data.examId) : undefined;

  const sessionsSnap = await db.collection('sessions').where('authUid', '==', uid).get();
  if (sessionsSnap.empty) throw new HttpsError('not-found', 'No exam session found for this sign-in.');

  const sessions = sessionsSnap.docs
    .map(snap => withId<StudentSession>(snap))
    .filter(session => !requestedExamId || session.examId === requestedExamId)
    .sort((a, b) => {
      const rank = (status: SessionStatus) => status === 'IN_PROGRESS' ? 3 : status === 'WAITING' ? 2 : status === 'SUBMITTED' ? 1 : 0;
      return rank(b.status) - rank(a.status) || (b.startTime || b.submitTime || 0) - (a.startTime || a.submitTime || 0);
    });
  if (!sessions.length) throw new HttpsError('not-found', 'No exam session found for this sign-in.');

  const session = sessions[0];
  assertSessionOwner(session, uid);
  const exam = await loadExam(session.examId);

  return responseFor(exam, session);
});

export const getExamReferenceDocumentUrl = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const examId = String(request.data?.examId || '');
  if (!examId) throw new HttpsError('invalid-argument', 'examId is required.');

  const sessionsSnap = await db.collection('sessions')
    .where('authUid', '==', uid)
    .where('examId', '==', examId)
    .limit(1)
    .get();
  if (sessionsSnap.empty) throw new HttpsError('permission-denied', 'No active session was found for this reference document.');

  const session = withId<StudentSession>(sessionsSnap.docs[0]);
  assertSessionOwner(session, uid);
  if (session.isTerminated || session.status === 'COMPLETED') {
    throw new HttpsError('failed-precondition', 'This reference document is no longer available.');
  }

  const exam = await loadExam(examId);
  assertWindowOpen(exam, Date.now());

  const storagePath = exam.referenceDocumentPath || extractStoragePathFromDownloadUrl(exam.referenceDocumentUrl);
  if (!storagePath || !storagePath.startsWith('exam-resources/')) {
    throw new HttpsError('not-found', 'No reference document is attached to this exam.');
  }

  const storageBucket = getStorage(app).bucket(getDefaultStorageBucketName());
  const file = storageBucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError('not-found', 'Reference document was not found in Storage.');

  const [metadata] = await file.getMetadata();
  if (metadata.contentType !== 'application/pdf') {
    throw new HttpsError('failed-precondition', 'Reference document is not a valid PDF.');
  }

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000,
  });

  return {
    url,
    serverNowMs: Date.now(),
  };
});

export const startStudentSession = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const studentId = String(request.data?.studentId || '');
  const examId = String(request.data?.examId || '');
  if (!studentId || !examId) throw new HttpsError('invalid-argument', 'studentId and examId are required.');

  const exam = await loadExam(examId);
  const { ref, session } = await loadSession(studentId, examId);
  assertSessionOwner(session, uid);

  if (session.isTerminated) throw new HttpsError('failed-precondition', 'This session was terminated.');
  if (session.status === 'SUBMITTED' || session.status === 'COMPLETED') return responseFor(exam, session);

  const now = Date.now();
  assertWindowOpen(exam, now);

  const updates: Partial<StudentSession> = {
    status: 'IN_PROGRESS',
    startTime: session.startTime || now,
  };
  await ref.set(updates, { merge: true });
  return responseFor(exam, { ...session, ...updates });
});

export const submitStudentSession = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const studentId = String(request.data?.studentId || '');
  const examId = String(request.data?.examId || '');
  if (!studentId || !examId) throw new HttpsError('invalid-argument', 'studentId and examId are required.');

  const exam = await loadExam(examId);
  const { ref, session } = await loadSession(studentId, examId);
  assertSessionOwner(session, uid);

  if (session.status === 'COMPLETED') throw new HttpsError('failed-precondition', 'This exam has already been graded.');
  if (session.isTerminated) throw new HttpsError('failed-precondition', 'This session was terminated by the proctor.');

  const now = Date.now();
  const windowEnd = getEndMs(exam);
  const individualEnd = session.startTime
    ? session.startTime + ((exam.durationMinutes * 60) + ((session.extraTimeMinutes || 0) * 60)) * 1000
    : windowEnd;
  const effectiveEnd = Math.min(windowEnd, individualEnd);

  if (now > effectiveEnd + FINAL_SUBMISSION_GRACE_MS) {
    throw new HttpsError('failed-precondition', 'The submission window has closed.');
  }
  const wasReceivedAfterDeadline = now > effectiveEnd;
  const uploadedFiles = await validateUploadedFiles(request.data?.uploadedFiles, exam, session, uid);

  const updates: Partial<StudentSession> = {
    status: 'SUBMITTED',
    submitTime: wasReceivedAfterDeadline ? effectiveEnd : now,
    answers: request.data?.answers || {},
    uploadedFiles,
  };
  const persistedUpdates = {
    ...updates,
    ...(wasReceivedAfterDeadline ? {
      submissionReceivedAt: now,
      submissionDeadlineMs: effectiveEnd,
      submittedInGraceWindow: true,
    } : {}),
  };
  await ref.set(persistedUpdates, { merge: true });
  return { session: { ...session, ...persistedUpdates }, serverNowMs: now };
});

export const saveStudentDraft = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const studentId = String(request.data?.studentId || '');
  const examId = String(request.data?.examId || '');
  if (!studentId || !examId) throw new HttpsError('invalid-argument', 'studentId and examId are required.');

  const exam = await loadExam(examId);
  const { ref, session } = await loadSession(studentId, examId);
  assertSessionOwner(session, uid);

  if (session.status !== 'WAITING' && session.status !== 'IN_PROGRESS') {
    throw new HttpsError('failed-precondition', 'Drafts can only be saved while the exam is in progress.');
  }
  if (session.isTerminated) throw new HttpsError('failed-precondition', 'This session was terminated by the proctor.');

  const now = Date.now();
  assertWindowOpen(exam, now);
  const uploadedFiles = await validateUploadedFiles(request.data?.uploadedFiles, exam, session, uid);

  const updates: Partial<StudentSession> = {
    draftAnswers: request.data?.answers || {},
    draftUploadedFiles: uploadedFiles,
    draftSavedAt: now,
    draftRevision: Number(request.data?.revision || 0),
  };

  await ref.set(updates, { merge: true });
  return { session: { ...session, ...updates }, serverNowMs: now };
});

export const reopenStudentSession = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const studentId = String(request.data?.studentId || '');
  const examId = String(request.data?.examId || '');
  if (!studentId || !examId) throw new HttpsError('invalid-argument', 'studentId and examId are required.');

  const exam = await loadExam(examId);
  const { ref, session } = await loadSession(studentId, examId);
  assertSessionOwner(session, uid);

  if (session.isTerminated) throw new HttpsError('failed-precondition', 'Cannot reopen a terminated session.');
  if (session.status !== 'SUBMITTED') throw new HttpsError('failed-precondition', 'Only submitted sessions can be reopened.');

  const now = Date.now();
  assertWindowOpen(exam, now);

  const individualEnd = session.startTime
    ? session.startTime + ((exam.durationMinutes * 60) + ((session.extraTimeMinutes || 0) * 60)) * 1000
    : getEndMs(exam);
  if (now > individualEnd) throw new HttpsError('failed-precondition', 'Your individual exam time has expired.');

  const updates: Partial<StudentSession> = {
    status: 'IN_PROGRESS',
    submitTime: undefined,
  };
  await ref.update({ status: 'IN_PROGRESS', submitTime: FieldValue.delete() });
  return responseFor(exam, { ...session, ...updates });
});

export const logStudentViolation = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const studentId = String(request.data?.studentId || '');
  const examId = String(request.data?.examId || '');
  const violation = request.data?.violation;
  if (!studentId || !examId || !violation?.type) throw new HttpsError('invalid-argument', 'A valid violation is required.');

  const { ref, session } = await loadSession(studentId, examId);
  assertSessionOwner(session, uid);

  const safeViolation = {
    type: String(violation.type),
    timestamp: Date.now(),
  };

  await ref.update({
    violations: FieldValue.arrayUnion(safeViolation),
  });

  return {
    session: { ...session, violations: [...(session.violations || []), safeViolation] },
    serverNowMs: safeViolation.timestamp,
  };
});

export const getLatestStudentSubmission = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);
  const sessionsSnap = await db.collection('sessions').where('authUid', '==', uid).get();
  const submitted = sessionsSnap.docs
    .map(snap => withId<StudentSession>(snap))
    .filter(session => session.status === 'SUBMITTED' || session.status === 'COMPLETED')
    .sort((a, b) => (b.submitTime || 0) - (a.submitTime || 0));

  if (!submitted.length) return null;

  const session = submitted[0];
  const exam = await loadExam(session.examId);
  return {
    exam,
    session,
    serverNowMs: Date.now(),
  };
});
