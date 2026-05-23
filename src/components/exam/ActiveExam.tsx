import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, ArrowRight, CheckCircle, CheckSquare, Circle, AlertTriangle, Loader2, Menu, X, Grid, FileText, Maximize2, Minimize2, Upload, File, Trash2, Sun, Moon, Laptop, Cloud, CloudOff, Save, Flag } from 'lucide-react';
import { Exam, StudentSession, UserRole, QuestionType, ScreenCaptureState } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { getServerTime } from '../../services/serverTime';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { RichTextEditor } from '../ui/RichTextEditor';
import { SafeHtml } from '../ui/SafeHtml';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth as firebaseAuth, storage } from '../../firebase';
import { Modal, useModal } from '../ui/Modal';

type UploadedExamFile = { name: string; url: string; storagePath?: string; type: string; size: number; uploadedAt: number; };

type LocalExamDraft = {
  answers: Record<string, any>;
  uploadedFiles: UploadedExamFile[];
  savedAt: number;
  revision: number;
};

type DraftSavePhase = 'idle' | 'local' | 'queued' | 'saving' | 'cloud' | 'offline' | 'error';

const CLOUD_AUTOSAVE_THRESHOLD_DELAY_MS = 3000;
const CLOUD_AUTOSAVE_MAX_WAIT_MS = 10 * 60 * 1000;
const CLOUD_AUTOSAVE_TEXT_CHAR_THRESHOLD = 300;
const CLOUD_AUTOSAVE_ANSWER_CHANGE_THRESHOLD = 20;

const sanitizeStorageFileName = (fileName: string) =>
  fileName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 120) || 'submission-file';

const getSubmissionContentType = (file: File) => {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return 'application/octet-stream';
};

export const ActiveExam = () => {
  const { auth, submitExamSession, startExamSession, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  // --- Local State ---
  const [initStatus, setInitStatus] = useState<'LOADING' | 'READY' | 'SUBMITTING' | 'ERROR'>('LOADING');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const answersRef = useRef<Record<string, any>>({}); // Ref to track latest answers for async access
  const activeExamDataRef = useRef<{ exam: Exam, session: StudentSession } | null>(null);
  const uploadedFilesRef = useRef<UploadedExamFile[]>([]);
  const frameUploadInFlightRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveTimerModeRef = useRef<'threshold' | 'backstop' | null>(null);
  const lastCloudSaveAtRef = useRef(0);
  const draftRevisionRef = useRef(0);
  const pendingCloudSaveRef = useRef(false);
  const pendingCloudSaveStartedAtRef = useRef(0);
  const cloudSaveInFlightRef = useRef(false);
  const dirtyTextCharCountRef = useRef(0);
  const dirtyAnswerChangeCountRef = useRef(0);
  const lastScreenCaptureRequestRef = useRef<string | null>(null);
  const screenCaptureInFlightRef = useRef(false);
  const screenSharePromptedRef = useRef(false);
  const screenShareStopLoggedRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // Remaining seconds
  const [activeExamData, setActiveExamData] = useState<{ exam: Exam, session: StudentSession } | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false); // Split Screen State
  const [referenceDocumentUrl, setReferenceDocumentUrl] = useState<string | null>(null);
  const [isReferenceDocumentLoading, setIsReferenceDocumentLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedExamFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<string[]>([]);
  const [draftSaveState, setDraftSaveState] = useState<{
    phase: DraftSavePhase;
    localSavedAt: number | null;
    cloudSavedAt: number | null;
  }>({ phase: 'idle', localSavedAt: null, cloudSavedAt: null });
  const [screenShareStatus, setScreenShareStatus] = useState<'idle' | 'active' | 'stopped' | 'denied' | 'unsupported'>('idle');
  
  // Modal state for beautiful dialogs
  const { modalState, showModal, hideModal } = useModal();

  useEffect(() => {
    activeExamDataRef.current = activeExamData;
  }, [activeExamData]);

  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  useEffect(() => {
    const handleOnline = () => {
      setDraftSaveState(prev => ({
        ...prev,
        phase: pendingCloudSaveRef.current ? 'queued' : (prev.cloudSavedAt ? 'cloud' : prev.phase),
      }));
      if (activeExamDataRef.current && pendingCloudSaveRef.current) {
        scheduleCloudDraftSave();
    }
    };
    const handleOffline = () => {
      setDraftSaveState(prev => ({ ...prev, phase: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getDraftStorageKey = (studentId: string, examId: string) => `exam_draft_${studentId}_${examId}`;
  const getFlagStorageKey = (studentId: string, examId: string) => `exam_flags_${studentId}_${examId}`;

  const readQuestionFlags = (studentId: string, examId: string): string[] => {
    try {
      const raw = localStorage.getItem(getFlagStorageKey(studentId, examId));
      if (!raw) return [];
      const flags = JSON.parse(raw);
      return Array.isArray(flags) ? flags.filter(flag => typeof flag === 'string') : [];
    } catch (error) {
      console.warn('Failed to read question flags:', error);
      return [];
    }
  };

  const persistQuestionFlags = (studentId: string, examId: string, flags: string[]) => {
    try {
      localStorage.setItem(getFlagStorageKey(studentId, examId), JSON.stringify(flags));
    } catch (error) {
      console.warn('Failed to save question flags:', error);
    }
  };

  const clearQuestionFlags = (studentId: string, examId: string) => {
    try {
      localStorage.removeItem(getFlagStorageKey(studentId, examId));
    } catch (error) {
      console.warn('Failed to clear question flags:', error);
    }
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
  };

  const hasLiveScreenShare = () =>
    Boolean(screenStreamRef.current?.getVideoTracks().some(track => track.readyState === 'live'));

  const markScreenCapture = async (capture: ScreenCaptureState) => {
    const examData = activeExamDataRef.current;
    if (!examData) return;
    await api.sessions.updateScreenCapture(examData.session.studentId, examData.exam.id, capture);
  };

  const requestScreenSharePermission = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenShareStatus('unsupported');
      showModal({
        title: 'Screen Capture Unsupported',
        message: 'This browser does not support secure screen sharing. Please use a current version of Chrome, Edge, or Firefox.',
        type: 'error',
        showCancel: false,
        confirmText: 'OK',
      });
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 5, max: 10 },
        } as MediaTrackConstraints,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error('No screen video track was shared.');
      }
      const displaySurface = (track.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;

      if (displaySurface && displaySurface !== 'monitor') {
        stream.getTracks().forEach(t => t.stop());
        setScreenShareStatus('denied');
        showModal({
          title: 'Share Entire Screen',
          message: 'Please choose Entire Screen when sharing. Browser tabs or single windows do not satisfy this exam proctoring requirement.',
          type: 'warning',
          showCancel: false,
          confirmText: 'OK',
        });
        return false;
      }

      stopScreenShare();
      screenStreamRef.current = stream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        await screenVideoRef.current.play();
      }
      track.onended = () => {
        screenStreamRef.current = null;
        setScreenShareStatus('stopped');
        const examData = activeExamDataRef.current;
        if (examData && !screenShareStopLoggedRef.current) {
          screenShareStopLoggedRef.current = true;
          api.sessions.logViolation(examData.session.studentId, examData.exam.id, {
            timestamp: getServerTime(),
            type: 'SCREEN_SHARE_STOPPED',
          });
        }
      };
      screenShareStopLoggedRef.current = false;
      setScreenShareStatus('active');
      return true;
    } catch (error) {
      setScreenShareStatus('denied');
      showModal({
        title: 'Screen Share Needed',
        message: 'Full-screen sharing was not started. Proctors will not be able to capture your screen until you grant permission.',
        type: 'warning',
        showCancel: false,
        confirmText: 'OK',
      });
      return false;
    }
  };

  const captureScreenBlob = async () => {
    const video = screenVideoRef.current;
    if (!video) {
      throw new Error('The shared screen is not ready yet.');
    }

    const ready = await new Promise<boolean>((resolve) => {
      if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        resolve(true);
        return;
      }

      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
          window.clearInterval(timer);
          resolve(true);
          return;
        }
        if (Date.now() - startedAt > 3000) {
          window.clearInterval(timer);
          resolve(false);
        }
      }, 100);
    });

    if (!ready) {
      throw new Error('The shared screen is not ready yet.');
    }

    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare the screenshot canvas.');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the screenshot.'));
      }, 'image/jpeg', 0.72);
    });
  };

  const handleScreenCaptureRequest = async (request: ScreenCaptureState) => {
    const examData = activeExamDataRef.current;
    const requestId = request.requestId;
    if (!examData || !requestId || screenCaptureInFlightRef.current) return;

    screenCaptureInFlightRef.current = true;
    const baseCapture = {
      requestId,
      requestedAt: request.requestedAt,
      requestedBy: request.requestedBy,
    };

    try {
      if (!hasLiveScreenShare()) {
        await markScreenCapture({
          ...baseCapture,
          status: 'FAILED',
          updatedAt: getServerTime(),
          error: 'Student has not granted full-screen sharing permission.',
        });
        showModal({
          title: 'Proctor Requested Screen Capture',
          message: 'A proctor requested your screen. Please share your Entire Screen now so future requests can be captured instantly.',
          type: 'warning',
          confirmText: 'Share Entire Screen',
          cancelText: 'Later',
          showCancel: true,
          onConfirm: async () => {
            const granted = await requestScreenSharePermission();
            if (granted) {
              handleScreenCaptureRequest(request);
            }
          },
        });
        return;
      }

      await markScreenCapture({
        ...baseCapture,
        status: 'CAPTURING',
        updatedAt: getServerTime(),
      });

      const blob = await captureScreenBlob();
      if (blob.size > 2 * 1024 * 1024) {
        throw new Error('Screenshot was too large to upload.');
      }

      const storagePath = `proctor-screenshots/${examData.exam.id}/${examData.session.studentId}/latest.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
        customMetadata: {
          ownerUid: firebaseAuth.currentUser?.uid || '',
          examId: examData.exam.id,
          studentId: examData.session.studentId,
          requestId,
        },
      });

      const imageUrl = await getDownloadURL(storageRef);
      const displaySurface = (screenStreamRef.current?.getVideoTracks()[0]?.getSettings() as MediaTrackSettings & { displaySurface?: string } | undefined)?.displaySurface;
      await markScreenCapture({
        ...baseCapture,
        status: 'CAPTURED',
        imageUrl,
        storagePath,
        capturedAt: getServerTime(),
        updatedAt: getServerTime(),
        displaySurface: displaySurface || 'monitor',
      });
    } catch (error: any) {
      await markScreenCapture({
        ...baseCapture,
        status: 'FAILED',
        updatedAt: getServerTime(),
        error: error?.message || 'Screen capture failed.',
      });
    } finally {
      screenCaptureInFlightRef.current = false;
    }
  };

  const readLocalDraft = (studentId: string, examId: string): LocalExamDraft | null => {
    try {
      const raw = localStorage.getItem(getDraftStorageKey(studentId, examId));
      if (!raw) return null;
      const draft = JSON.parse(raw) as LocalExamDraft;
      if (!draft || typeof draft.savedAt !== 'number') return null;
      return {
        answers: draft.answers || {},
        uploadedFiles: draft.uploadedFiles || [],
        savedAt: draft.savedAt,
        revision: draft.revision || 0,
      };
    } catch (error) {
      console.warn('Failed to read local exam draft:', error);
      return null;
    }
  };

  const persistLocalDraft = (studentId: string, examId: string, nextAnswers: Record<string, any>, nextFiles: UploadedExamFile[]) => {
    try {
      draftRevisionRef.current += 1;
      const draft: LocalExamDraft = {
        answers: nextAnswers,
        uploadedFiles: nextFiles,
        savedAt: Date.now(),
        revision: draftRevisionRef.current,
      };
      localStorage.setItem(getDraftStorageKey(studentId, examId), JSON.stringify(draft));
      const currentlyOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      setDraftSaveState(prev => ({
        ...prev,
        phase: currentlyOnline ? 'local' : 'offline',
        localSavedAt: draft.savedAt,
      }));
    } catch (error) {
      setDraftSaveState(prev => ({ ...prev, phase: 'error' }));
      console.warn('Failed to save local exam draft:', error);
    }
  };

  const clearLocalDraft = (studentId: string, examId: string) => {
    try {
      localStorage.removeItem(getDraftStorageKey(studentId, examId));
    } catch (error) {
      console.warn('Failed to clear local exam draft:', error);
    }
  };

  const getAnswerTextLength = (value: any): number => {
    if (typeof value !== 'string') return 0;
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim()
      .length;
  };

  const trackDraftChange = (previousValue: any, nextValue: any) => {
    const previousLength = getAnswerTextLength(previousValue);
    const nextLength = getAnswerTextLength(nextValue);
    dirtyTextCharCountRef.current += Math.max(0, nextLength - previousLength);
    dirtyAnswerChangeCountRef.current += 1;
  };

  const resetCloudSaveThresholds = () => {
    dirtyTextCharCountRef.current = 0;
    dirtyAnswerChangeCountRef.current = 0;
    pendingCloudSaveStartedAtRef.current = 0;
    autosaveTimerModeRef.current = null;
  };

  const saveDraftToCloud = async (reason = 'autosave') => {
    const current = activeExamDataRef.current;
    if (!current || current.session.status === 'SUBMITTED' || current.session.status === 'COMPLETED') return;
    const currentlyOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!currentlyOnline) {
      pendingCloudSaveRef.current = true;
      setDraftSaveState(prev => ({ ...prev, phase: 'offline' }));
      return;
    }
    if (cloudSaveInFlightRef.current) {
      pendingCloudSaveRef.current = true;
      setDraftSaveState(prev => ({ ...prev, phase: 'queued' }));
      return;
    }

    cloudSaveInFlightRef.current = true;
    pendingCloudSaveRef.current = false;
    setDraftSaveState(prev => ({ ...prev, phase: 'saving' }));
    try {
      const updatedSession = await api.sessions.saveDraft(
        current.session.studentId,
        current.exam.id,
        answersRef.current,
        uploadedFilesRef.current,
        draftRevisionRef.current,
      );
      lastCloudSaveAtRef.current = Date.now();
      resetCloudSaveThresholds();
      setDraftSaveState(prev => ({
        ...prev,
        phase: 'cloud',
        cloudSavedAt: lastCloudSaveAtRef.current,
      }));
      if (updatedSession) {
        setActiveExamData(prev => prev ? ({ ...prev, session: { ...prev.session, ...updatedSession } }) : null);
      }
      console.log(`Draft saved to cloud (${reason}).`);
    } catch (error) {
      pendingCloudSaveRef.current = true;
      lastCloudSaveAtRef.current = Date.now();
      const currentlyOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      setDraftSaveState(prev => ({ ...prev, phase: currentlyOnline ? 'error' : 'offline' }));
      console.warn(`Draft cloud save failed (${reason}); local draft is still preserved.`, error);
    } finally {
      cloudSaveInFlightRef.current = false;
      if (pendingCloudSaveRef.current) {
        scheduleCloudDraftSave();
      }
    }
  };

  const scheduleCloudDraftSave = (reason = 'autosave') => {
    if (!activeExamDataRef.current) return;
    pendingCloudSaveRef.current = true;
    if (!pendingCloudSaveStartedAtRef.current) {
      pendingCloudSaveStartedAtRef.current = Date.now();
    }
    const currentlyOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!currentlyOnline) {
      setDraftSaveState(prev => ({ ...prev, phase: 'offline' }));
      return;
    }
    setDraftSaveState(prev => ({ ...prev, phase: 'queued' }));
    const lastCloudBaseline = lastCloudSaveAtRef.current || pendingCloudSaveStartedAtRef.current || Date.now();
    const elapsed = Date.now() - lastCloudBaseline;
    const reachedChangeThreshold =
      dirtyTextCharCountRef.current >= CLOUD_AUTOSAVE_TEXT_CHAR_THRESHOLD ||
      dirtyAnswerChangeCountRef.current >= CLOUD_AUTOSAVE_ANSWER_CHANGE_THRESHOLD;

    if (autosaveTimerRef.current) {
      if (autosaveTimerModeRef.current === 'threshold') return;
      if (!reachedChangeThreshold) return;
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
      autosaveTimerModeRef.current = null;
    }

    const delay = reachedChangeThreshold
      ? CLOUD_AUTOSAVE_THRESHOLD_DELAY_MS
      : Math.max(CLOUD_AUTOSAVE_MAX_WAIT_MS - elapsed, CLOUD_AUTOSAVE_THRESHOLD_DELAY_MS);
    autosaveTimerModeRef.current = reachedChangeThreshold ? 'threshold' : 'backstop';
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      autosaveTimerModeRef.current = null;
      saveDraftToCloud(reachedChangeThreshold ? 'change-threshold' : reason);
    }, delay);
  };

  const persistDraft = (nextAnswers = answersRef.current, nextFiles = uploadedFilesRef.current, forceCloud = false) => {
    const current = activeExamDataRef.current;
    if (!current) return;
    persistLocalDraft(current.session.studentId, current.exam.id, nextAnswers, nextFiles);
    if (forceCloud) {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
        autosaveTimerModeRef.current = null;
      }
      saveDraftToCloud('forced');
    } else {
      scheduleCloudDraftSave();
    }
  };

  // --- 1. Initialization Logic ---
  useEffect(() => {
    const initializeExam = async () => {
      try {
        // Verify User
        if (!auth.user || auth.user.role !== UserRole.STUDENT) {
          navigate('/');
          return;
        }

        const context = await api.student.getActiveExamContext(auth.activeExamId);
        const activeSession = context.session;
        const exam = context.exam;

        if (activeSession.status === 'SUBMITTED' || activeSession.status === 'COMPLETED') {
           navigate('/student/completed');
           return;
        }

        if (!activeSession) {
           console.error("No active session found for user", auth.user.id);
           setInitStatus('ERROR');
           return;
        }

        // Start Session if needed (Idempotent call)
        let freshSession = activeSession;
        if (activeSession.status === 'WAITING') {
           freshSession = await startExamSession(auth.user.id, exam.id) as StudentSession;
        }

        if (!freshSession || !freshSession.startTime) {
           console.error("Session failed to initialize start time");
           setInitStatus('ERROR'); 
           return;
        }

        // Calculate time left from the trusted server-time baseline.
        console.log('🔄 Calculating time remaining...');
        const serverNow = getServerTime();
        
        // 1. Individual time based on when student started + duration + extra time
        const elapsedSeconds = Math.floor((serverNow - freshSession.startTime) / 1000);
        const extraTimeSeconds = (freshSession.extraTimeMinutes || 0) * 60;
        const individualTotalSeconds = (exam.durationMinutes * 60) + extraTimeSeconds;
        const individualRemaining = individualTotalSeconds - elapsedSeconds;
        
        // 2. Time until scheduled end (if exam has a scheduled end)
        let scheduledRemaining = Infinity;
        const scheduledEndTime = exam.scheduledEndMs || (exam.scheduledEnd ? new Date(exam.scheduledEnd).getTime() : null);
        if (scheduledEndTime) {
          scheduledRemaining = Math.floor((scheduledEndTime - serverNow) / 1000);
        }
        
        // Use the MINIMUM - if student is late, they only get time until scheduled end
        const remaining = Math.min(individualRemaining, scheduledRemaining);
        
        console.log(`⏱️ Timer calculation (ACTUAL SERVER TIME):
          - Server time: ${new Date(serverNow).toISOString()}
          - Client time: ${new Date().toISOString()}
          - Offset: ${serverNow - Date.now()}ms
          - Individual remaining: ${Math.floor(individualRemaining / 60)} min
          - Until scheduled end: ${scheduledRemaining === Infinity ? 'N/A' : Math.floor(scheduledRemaining / 60) + ' min'}
          - Final timer: ${Math.floor(remaining / 60)} min`);

        if (remaining <= 0) {
           // Expired on load
           handleSubmit(freshSession.studentId, exam.id, freshSession.answers || {}, freshSession.uploadedFiles || [], true);
           return;
        }

        const localDraft = readLocalDraft(freshSession.studentId, exam.id);
        const serverDraftSavedAt = freshSession.draftSavedAt || 0;
        const useLocalDraft = Boolean(localDraft && localDraft.savedAt > serverDraftSavedAt);
        const restoredAnswers = useLocalDraft
          ? localDraft!.answers
          : (freshSession.draftAnswers || freshSession.answers || {});
        const restoredFiles = useLocalDraft
          ? localDraft!.uploadedFiles
          : (freshSession.draftUploadedFiles || freshSession.uploadedFiles || []);

        draftRevisionRef.current = Math.max(localDraft?.revision || 0, freshSession.draftRevision || 0);
        lastCloudSaveAtRef.current = serverDraftSavedAt;

        // Set State
        const initialExamData = { exam, session: freshSession };
        activeExamDataRef.current = initialExamData;
        setTimeLeft(remaining);
        setActiveExamData(initialExamData);
        setAnswers(restoredAnswers);
        answersRef.current = restoredAnswers; // Init ref
        uploadedFilesRef.current = restoredFiles;
        setUploadedFiles(restoredFiles);
        setFlaggedQuestionIds(readQuestionFlags(freshSession.studentId, exam.id));
        setDraftSaveState({
          phase: serverDraftSavedAt ? 'cloud' : 'idle',
          localSavedAt: localDraft?.savedAt || null,
          cloudSavedAt: serverDraftSavedAt || null,
        });
        setInitStatus('READY');

        if (useLocalDraft) {
          window.setTimeout(() => saveDraftToCloud('local-recovery'), 0);
        }

      } catch (e) {
        console.error(e);
        setInitStatus('ERROR');
      }
    };

    // Only run on mount or if status is LOADING
    if (initStatus === 'LOADING') {
      initializeExam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 2. Timer Logic ---
  useEffect(() => {
    if (initStatus !== 'READY' || timeLeft === null) return;

    if (timeLeft <= 0) {
      // Time is up!
      if (activeExamData) {
        handleSubmit(activeExamData.session.studentId, activeExamData.exam.id, answersRef.current, uploadedFilesRef.current, true);
      }
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [initStatus, timeLeft]);

  useEffect(() => {
    if (initStatus !== 'READY' || !activeExamData) return;

    const flushDraft = () => persistDraft(answersRef.current, uploadedFilesRef.current, true);
    const handleBeforeUnload = () => {
      persistLocalDraft(activeExamData.session.studentId, activeExamData.exam.id, answersRef.current, uploadedFilesRef.current);
    };
    const handlePageHidden = () => {
      if (document.hidden) flushDraft();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handlePageHidden);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handlePageHidden);
    };
  }, [initStatus, activeExamData?.session.studentId, activeExamData?.exam.id]);

  // --- 3. Security: Fullscreen & Tab Switch ---
  useEffect(() => {
    if (initStatus !== 'READY') return;

    const handleVisibility = () => {
      if (document.hidden && auth.user) {
        console.log('🚨 TAB SWITCH DETECTED - Logging violation');
        if (activeExamData) {
          api.sessions.logViolation(activeExamData.session.studentId, activeExamData.exam.id, { timestamp: getServerTime(), type: 'TAB_SWITCH' });
        }
        showModal({
          title: '⚠️ Tab Switch Detected',
          message: 'Switching tabs during an exam is not allowed. This violation has been recorded and will be reviewed by the proctor.',
          type: 'warning',
          showCancel: false,
          confirmText: 'I Understand',
        });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && auth.user) {
        console.log('🚨 FULLSCREEN EXIT DETECTED - Logging violation');
        if (activeExamData) {
          api.sessions.logViolation(activeExamData.session.studentId, activeExamData.exam.id, { timestamp: getServerTime(), type: 'FULLSCREEN_EXIT' });
        }
        showModal({
          title: '⚠️ Fullscreen Exit Detected',
          message: 'Exiting fullscreen mode during an exam is not allowed. This violation has been recorded. Please return to fullscreen mode.',
          type: 'warning',
          showCancel: false,
          confirmText: 'I Understand',
        });
      }
    };

    const enforceFullscreen = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
           await document.documentElement.requestFullscreen();
        }
      } catch (e) { /* ignore */ }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("click", enforceFullscreen); // Retry FS on interaction

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("click", enforceFullscreen);
    };
  }, [initStatus, activeExamData?.exam.id, activeExamData?.session.studentId]);

  // --- 4. Webcam ---
  useEffect(() => {
    if (initStatus !== 'READY') return;
    
    let streamInterval: ReturnType<typeof setInterval> | null = null;
    let startupTimer: ReturnType<typeof setTimeout> | null = null;
    
    const startCam = async () => {
      try {
        console.log('🎥 Requesting webcam access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error('Video play failed:', e));
          console.log('✅ Webcam stream started successfully');
          
          // Wait 2 seconds for video to fully initialize before starting frame capture
          startupTimer = setTimeout(() => {
            console.log('📸 Starting frame capture...');
            
            streamInterval = setInterval(async () => {
              try {
                if (frameUploadInFlightRef.current) return;
                const examData = activeExamDataRef.current;
                if (!videoRef.current || !examData) {
                  console.warn('⚠️ Video ref or exam data missing');
                  return;
                }
                
                const video = videoRef.current;
                
                // Check if video is actually playing
                if (video.readyState < 2) {
                  console.warn('⚠️ Video not ready, readyState:', video.readyState);
                  return;
                }
                
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                  console.warn('⚠️ Video dimensions invalid:', video.videoWidth, video.videoHeight);
                  return;
                }
                
                // Create canvas and capture frame
                const canvas = document.createElement('canvas');
                canvas.width = 240;
                canvas.height = 180;
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                  console.error('❌ Could not get canvas context');
                  return;
                }
                
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frameBlob = await new Promise<Blob | null>((resolve) => {
                  canvas.toBlob(resolve, 'image/jpeg', 0.55);
                });
                
                // Verify we have actual image data
                if (!frameBlob || frameBlob.size < 500) {
                  console.warn('⚠️ Frame data too small, likely blank');
                  return;
                }
                
                console.log('📤 Uploading frame... (size:', Math.round(frameBlob.size / 1024), 'KB)');
                if (frameBlob.size > 120000) {
                  console.warn('Frame data too large, skipping upload');
                  return;
                }
                
                frameUploadInFlightRef.current = true;
                const framePath = `proctor-live-frames/${examData.exam.id}/${examData.session.studentId}/current.jpg`;
                const frameRef = ref(storage, framePath);
                await uploadBytes(frameRef, frameBlob, {
                  contentType: 'image/jpeg',
                  customMetadata: {
                    ownerUid: firebaseAuth.currentUser?.uid || '',
                    examId: examData.exam.id,
                    studentId: examData.session.studentId,
                    requestId: 'live-frame',
                    purpose: 'live-frame',
                  },
                });
                const frameUrl = await getDownloadURL(frameRef);
                await api.sessions.updateFrame(
                  examData.session.studentId,
                  examData.exam.id,
                  frameUrl,
                  framePath
                );
                
                console.log('✅ Frame uploaded successfully!');
                
              } catch (error) {
                console.error('❌ Frame capture/upload failed:', error);
              }
                frameUploadInFlightRef.current = false;
            }, 15000); // Every 15 seconds
            
          }, 2000); // Wait 2 seconds before starting
        }
      } catch (e) {
        console.error('❌ Camera access denied or failed:', e);
        showModal({
          title: '📹 Camera Access Required',
          message: 'Camera access is required for this proctored exam. Please grant camera permission in your browser settings and refresh the page.',
          type: 'error',
          showCancel: false,
          confirmText: 'I Understand',
        });
      }
    };
    
    startCam();

    // Cleanup
    return () => {
      if (startupTimer) {
        clearTimeout(startupTimer);
      }
      if (streamInterval) {
        clearInterval(streamInterval);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        console.log('🛑 Webcam stream stopped');
      }
    };
  }, [initStatus, activeExamData?.exam.id]);

  // --- 4b. Full-screen share availability for on-demand proctor screenshots ---
  useEffect(() => {
    if (initStatus !== 'READY' || screenSharePromptedRef.current) return;
    screenSharePromptedRef.current = true;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenShareStatus('unsupported');
    }
  }, [initStatus]);

  useEffect(() => () => stopScreenShare(), []);

  // --- 5. Warnings Listener + Schedule/Time Extension Checker ---
  useEffect(() => {
    if (initStatus !== 'READY' || !activeExamData) return;

    // Light trusted refresh for schedule changes and server-time resync. Session changes arrive via direct listener below.
    const warningInterval = setInterval(async () => {
      try {
        const examData = activeExamDataRef.current;
        if (!examData) return;
        // Fetch the latest trusted student-scoped session and exam data
        const context = await api.student.getActiveExamContext(examData.exam.id);
        const currentSession = context.session;
        const currentExam = context.exam;
        
        // ===== CHECK SCHEDULED END TIME =====
        const scheduledEndTime = currentExam?.scheduledEndMs || (currentExam?.scheduledEnd ? new Date(currentExam.scheduledEnd).getTime() : null);
        if (scheduledEndTime) {
          const serverNow = getServerTime();
          if (serverNow > scheduledEndTime) {
            // Exam window has closed - auto-submit
            console.log("⏰ Exam window has closed (server time). Auto-submitting...");
            try {
              await api.sessions.submit(examData.session.studentId, examData.exam.id, answersRef.current, uploadedFilesRef.current);
            } catch (err) {
              console.error("Failed to auto-submit:", err);
            }
            showModal({
              title: '⏰ Time\'s Up!',
              message: 'The exam window has ended. Your answers have been automatically submitted.',
              type: 'info',
              showCancel: false,
              confirmText: 'OK',
              onConfirm: () => navigate('/student/completed'),
            });
            return;
          }
        }
        
        if (currentSession) {
           // Check for Termination / Status Change
           if (currentSession.status === 'SUBMITTED' || currentSession.status === 'COMPLETED') {
              // If the session was terminated externally (by proctor) and we haven't submitted locally yet,
              // we MUST save the current answers before leaving.
              if (examData.session.status !== 'SUBMITTED' && examData.session.status !== 'COMPLETED') {
                  console.log("⚠️ Session terminated externally. Saving final answers...");
                  try {
                    // Use the REF to get the latest answers since state might be stale in this closure
                    await api.sessions.submit(examData.session.studentId, examData.exam.id, answersRef.current, uploadedFilesRef.current);
                  } catch (err) {
                    console.error("Failed to save final answers on termination:", err);
                  }
              }

              showModal({
                title: 'Session Ended',
                message: 'Your exam has been submitted or terminated by the proctor.',
                type: 'info',
                showCancel: false,
                confirmText: 'OK',
                onConfirm: () => navigate('/student/completed'),
              });
              return;
           }

           // ===== CHECK FOR EXTRA TIME GRANTED =====
           const currentExtra = currentSession.extraTimeMinutes || 0;
            const previousExtra = examData.session.extraTimeMinutes || 0;
           if (currentExtra > previousExtra) {
              const addedMinutes = currentExtra - previousExtra;
              console.log(`🎁 Extra time granted: +${addedMinutes} minutes`);
              showModal({
                title: '🎁 Extra Time Granted!',
                message: `Great news! You have been granted ${addedMinutes} extra minute${addedMinutes > 1 ? 's' : ''} for this exam.`,
                type: 'success',
                showCancel: false,
                confirmText: 'Continue',
              });
              
              // Update the timer with new extra time
              setTimeLeft(prev => {
                if (prev === null) return null;
                return prev + (addedMinutes * 60);
              });
           }

           // Check for Warnings
            if (currentSession.warnings && currentSession.warnings.length > (examData.session.warnings?.length || 0)) {
              // New warning found!
              const newWarnings = currentSession.warnings.slice(examData.session.warnings?.length || 0);
              newWarnings.forEach(w => {
                showModal({
                  title: '⚠️ Proctor Warning',
                  message: w,
                  type: 'warning',
                  showCancel: false,
                  confirmText: 'I Understand',
                });
              });
           }
           
           // Update local state to keep in sync
           setActiveExamData(prev => prev ? ({...prev, session: currentSession}) : null);
        }
      } catch (e) {
        // silent fail
      }
    }, 60000);

    return () => clearInterval(warningInterval);
  }, [initStatus]);

  useEffect(() => {
    if (initStatus !== 'READY' || !activeExamData) return;

    const studentId = activeExamData.session.studentId;
    const examId = activeExamData.exam.id;

    return api.sessions.subscribeToSession(studentId, examId, async (currentSession) => {
      if (!currentSession) return;

      const previousSession = activeExamDataRef.current?.session || activeExamData.session;

      if (currentSession.status === 'SUBMITTED' || currentSession.status === 'COMPLETED') {
        if (previousSession.status !== 'SUBMITTED' && previousSession.status !== 'COMPLETED') {
          try {
            await api.sessions.submit(studentId, examId, answersRef.current, uploadedFilesRef.current);
          } catch (err) {
            console.error("Failed to save final answers on termination:", err);
          }
        }

        showModal({
          title: 'Session Ended',
          message: 'Your exam has been submitted or terminated by the proctor.',
          type: 'info',
          showCancel: false,
          confirmText: 'OK',
          onConfirm: () => navigate('/student/completed'),
        });
        return;
      }

      const currentExtra = currentSession.extraTimeMinutes || 0;
      const previousExtra = previousSession.extraTimeMinutes || 0;
      if (currentExtra > previousExtra) {
        const addedMinutes = currentExtra - previousExtra;
        showModal({
          title: 'Extra Time Granted!',
          message: `Great news! You have been granted ${addedMinutes} extra minute${addedMinutes > 1 ? 's' : ''} for this exam.`,
          type: 'success',
          showCancel: false,
          confirmText: 'Continue',
        });

        setTimeLeft(prev => prev === null ? null : prev + (addedMinutes * 60));
      }

      if (currentSession.warnings && currentSession.warnings.length > (previousSession.warnings?.length || 0)) {
        const newWarnings = currentSession.warnings.slice(previousSession.warnings?.length || 0);
        newWarnings.forEach(w => {
          showModal({
            title: 'Proctor Warning',
            message: w,
            type: 'warning',
            showCancel: false,
            confirmText: 'I Understand',
          });
        });
      }

      const screenCapture = currentSession.screenCapture;
      if (
        screenCapture?.status === 'REQUESTED' &&
        screenCapture.requestId &&
        screenCapture.requestId !== lastScreenCaptureRequestRef.current
      ) {
        lastScreenCaptureRequestRef.current = screenCapture.requestId;
        handleScreenCaptureRequest(screenCapture);
      }

      const shouldSyncSession =
        currentSession.status !== previousSession.status ||
        currentSession.submitTime !== previousSession.submitTime ||
        currentSession.extraTimeMinutes !== previousSession.extraTimeMinutes ||
        currentSession.isTerminated !== previousSession.isTerminated ||
        currentSession.screenCapture?.requestId !== previousSession.screenCapture?.requestId ||
        currentSession.screenCapture?.status !== previousSession.screenCapture?.status ||
        currentSession.screenCapture?.capturedAt !== previousSession.screenCapture?.capturedAt ||
        (currentSession.warnings?.length || 0) !== (previousSession.warnings?.length || 0) ||
        (currentSession.violations?.length || 0) !== (previousSession.violations?.length || 0);

      if (shouldSyncSession) {
        setActiveExamData(prev => prev ? ({ ...prev, session: currentSession }) : null);
      }
    });
  }, [initStatus, activeExamData?.session.studentId, activeExamData?.exam.id]);


  // --- Handlers ---
  const goToQuestion = (nextIndex: number) => {
    persistDraft(answersRef.current, uploadedFilesRef.current, true);
    setCurrentQuestionIndex(nextIndex);
    setIsNavOpen(false);
  };

  const handleAnswer = (val: any) => {
    if (!activeExamData) return;
    const qId = activeExamData.exam.questions[currentQuestionIndex].id;
    const qType = activeExamData.exam.questions[currentQuestionIndex].type;

    if (qType === QuestionType.MULTI_SELECT) {
       const current = (answersRef.current[qId] as string[]) || [];
       let newVal;
       if (current.includes(val)) {
         newVal = current.filter(v => v !== val);
       } else {
         newVal = [...current, val];
       }
       const newAnswers = {...answersRef.current, [qId]: newVal};
       trackDraftChange(answersRef.current[qId], newVal);
       answersRef.current = newAnswers;
       setAnswers(newAnswers);
       persistDraft(newAnswers, uploadedFilesRef.current);
    } else {
       const newAnswers = {...answersRef.current, [qId]: val};
       trackDraftChange(answersRef.current[qId], val);
       answersRef.current = newAnswers;
       setAnswers(newAnswers);
       persistDraft(newAnswers, uploadedFilesRef.current);
     }
  };

  const handleManualSave = async () => {
    if (!activeExamDataRef.current || draftSaveState.phase === 'saving') return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
      autosaveTimerModeRef.current = null;
    }
    persistLocalDraft(
      activeExamDataRef.current.session.studentId,
      activeExamDataRef.current.exam.id,
      answersRef.current,
      uploadedFilesRef.current,
    );
    await saveDraftToCloud('manual');
  };

  const toggleFlagCurrentQuestion = () => {
    if (!activeExamData) return;
    const qId = activeExamData.exam.questions[currentQuestionIndex].id;
    setFlaggedQuestionIds(prev => {
      const next = prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId];
      persistQuestionFlags(activeExamData.session.studentId, activeExamData.exam.id, next);
      return next;
    });
  };

  const handleBlockedPaste = () => {
    if (!activeExamData) return;
    api.sessions.logViolation(activeExamData.session.studentId, activeExamData.exam.id, {
      timestamp: getServerTime(),
      type: 'PASTE_ATTEMPT',
    });
    showModal({
      title: 'Paste Blocked',
      message: 'Copying or pasting answers from outside the exam portal is not allowed. This attempt has been recorded.',
      type: 'warning',
      showCancel: false,
      confirmText: 'I Understand',
    });
  };

  const toggleReferenceDocument = async () => {
    if (!activeExamData) return;
    if (isSplitView) {
      setIsSplitView(false);
      return;
    }

    setIsReferenceDocumentLoading(true);
    try {
      const url = await api.student.getReferenceDocumentUrl(activeExamData.exam.id);
      setReferenceDocumentUrl(url);
      setIsSplitView(true);
    } catch (error) {
      if (activeExamData.exam.referenceDocumentUrl) {
        setReferenceDocumentUrl(activeExamData.exam.referenceDocumentUrl);
        setIsSplitView(true);
      } else {
        showModal({
          title: 'Document Unavailable',
          message: 'The case study document could not be opened. Please contact your proctor.',
          type: 'error',
          showCancel: false,
          confirmText: 'OK',
        });
      }
    } finally {
      setIsReferenceDocumentLoading(false);
    }
  };

  // Actual submission logic (separated for modal callback)
  const doSubmit = async (stuId: string, exId: string, finalAnswers: Record<string, any>, finalFiles: any[]) => {
    setInitStatus('SUBMITTING');
    try {
      persistLocalDraft(stuId, exId, finalAnswers, finalFiles);
      await saveDraftToCloud('pre-submit');
      await submitExamSession(stuId, exId, finalAnswers, finalFiles);
      clearLocalDraft(stuId, exId);
      clearQuestionFlags(stuId, exId);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      navigate('/student/completed');
    } catch(e) {
      showModal({
        title: 'Submission Failed',
        message: 'Failed to submit your exam. Please check your internet connection and try again.',
        type: 'error',
        showCancel: false,
        confirmText: 'OK',
      });
      setInitStatus('READY');
    }
  };

  const handleSubmit = async (stuId = activeExamData?.session.studentId, exId = activeExamData?.exam.id, finalAnswers = answers, finalFiles = uploadedFiles, skipState = false) => {
     if (!stuId || !exId) return;
     
     // Only show confirmation for manual submissions (not auto-submit)
     if (!skipState && activeExamData) {
       const totalQuestions = activeExamData.exam.questions.length;
       const answeredQuestions = activeExamData.exam.questions.filter(q => {
         const ans = finalAnswers[q.id];
         return ans !== undefined && ans !== '' && (Array.isArray(ans) ? ans.length > 0 : true);
        }).length;
        const unansweredQuestions = totalQuestions - answeredQuestions;
        const flaggedCount = activeExamData.exam.questions.filter(q => flaggedQuestionIds.includes(q.id)).length;
       
       // Show beautiful modal instead of native confirm
       showModal({
         title: 'Submit Exam',
         message: (
           <div className="space-y-3">
             <p>You have answered <span className="font-bold text-violet-600">{answeredQuestions}</span> out of <span className="font-bold">{totalQuestions}</span> questions.</p>
              {unansweredQuestions > 0 && (
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ {unansweredQuestions} unanswered {unansweredQuestions === 1 ? 'question is' : 'questions are'} still remaining.
                </p>
              )}
              {flaggedCount > 0 && (
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  {flaggedCount} flagged {flaggedCount === 1 ? 'question is' : 'questions are'} marked for review.
                </p>
              )}
              <p className="mt-4 font-medium">Are you sure you want to submit?</p>
            </div>
          ),
          type: unansweredQuestions > 0 || flaggedCount > 0 ? 'warning' : 'confirm',
         confirmText: 'Submit Exam',
         cancelText: 'Continue Editing',
         showCancel: true,
         onConfirm: () => doSubmit(stuId, exId, finalAnswers, finalFiles),
       });
       return;
     }
     
     // Auto-submit (skipState = true) - no confirmation needed
     if (!skipState) setInitStatus('SUBMITTING'); 
     
     try {
       persistLocalDraft(stuId, exId, finalAnswers, finalFiles);
       await saveDraftToCloud('pre-submit');
       await submitExamSession(stuId, exId, finalAnswers, finalFiles);
       clearLocalDraft(stuId, exId);
       clearQuestionFlags(stuId, exId);
       if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
       navigate('/student/completed');
     } catch(e) {
       if (!skipState) {
        showModal({
          title: 'Submission Failed',
          message: 'Failed to submit your exam. Please try again.',
          type: 'error',
          showCancel: false,
          confirmText: 'OK',
        });
        setInitStatus('READY');
       }
     }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeExamData || !e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    const { exam, session } = activeExamData;

    // Validation
    if (exam.maxFileCount && uploadedFiles.length >= exam.maxFileCount) {
      showModal({
        title: 'File Limit Reached',
        message: `Maximum ${exam.maxFileCount} files allowed. Please delete an existing file to upload a new one.`,
        type: 'warning',
        showCancel: false,
        confirmText: 'OK',
      });
      return;
    }

    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (exam.allowedFileTypes && !exam.allowedFileTypes.includes(fileExt)) {
      showModal({
        title: 'Invalid File Type',
        message: `This file type is not allowed. Accepted formats: ${exam.allowedFileTypes.join(', ')}`,
        type: 'error',
        showCancel: false,
        confirmText: 'OK',
      });
      return;
    }

    setIsUploading(true);
    try {
      const ownerUid = firebaseAuth.currentUser?.uid;
      if (!ownerUid) {
        throw new Error('You must be signed in before uploading files.');
      }

      const safeFileName = sanitizeStorageFileName(file.name);
      const storageRef = ref(storage, `exam-submissions/${exam.id}/${session.studentId}/${Date.now()}_${safeFileName}`);
      const contentType = getSubmissionContentType(file);
      const snapshot = await uploadBytes(storageRef, file, {
        contentType,
        customMetadata: {
          ownerUid,
          examId: exam.id,
          studentId: session.studentId,
        },
      });
      const url = await getDownloadURL(snapshot.ref);
      
      const newFile = {
        name: file.name,
        url,
        storagePath: snapshot.ref.fullPath,
        type: contentType,
        size: file.size,
        uploadedAt: Date.now()
      };
      
      setUploadedFiles(prev => {
        const nextFiles = [...prev, newFile];
        uploadedFilesRef.current = nextFiles;
        persistDraft(answersRef.current, nextFiles, true);
        return nextFiles;
      });
    } catch (error: any) {
      console.error("Upload failed:", error);
      const isPermissionError = error?.code === 'storage/unauthorized';
      showModal({
        title: 'Upload Failed',
        message: isPermissionError
          ? 'Firebase Storage rejected the upload. Please make sure the file type is allowed and try again.'
          : (error?.message || 'Failed to upload your file. Please check your internet connection and try again.'),
        type: 'error',
        showCancel: false,
        confirmText: 'OK',
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeFile = async (index: number) => {
    showModal({
      title: 'Remove File',
      message: 'Are you sure you want to remove this uploaded file?',
      type: 'delete',
      confirmText: 'Remove File',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        setUploadedFiles(prev => {
          const nextFiles = prev.filter((_, i) => i !== index);
          uploadedFilesRef.current = nextFiles;
          persistDraft(answersRef.current, nextFiles, true);
          return nextFiles;
        });
      },
    });
  };

  // --- RENDER ---

  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );

  if (initStatus === 'LOADING' || initStatus === 'SUBMITTING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-violet-600">
        <Loader2 size={48} className="animate-spin mb-4"/>
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300">
          {initStatus === 'LOADING' ? 'Preparing Secure Environment...' : 'Encrypting & Submitting Responses...'}
        </h2>
      </div>
    );
  }

  if (initStatus === 'ERROR' || !activeExamData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-600 p-4 text-center">
         <AlertTriangle size={48} className="mb-4"/>
         <h2 className="text-2xl font-bold mb-2">Session Error</h2>
         <p>Could not load exam session. Please contact your proctor.</p>
         <Button className="mt-6" onClick={() => { logout(); navigate('/'); }}>Return Home</Button>
      </div>
    );
  }

  const { exam } = activeExamData;
  const currentQ = exam.questions[currentQuestionIndex];
  const currentA = answers[currentQ.id];
  const isCurrentQuestionFlagged = flaggedQuestionIds.includes(currentQ.id);
  const hasReferenceDocument = Boolean(exam.referenceDocumentPath || exam.referenceDocumentUrl);
  const cloudSaveTimeLabel = draftSaveState.cloudSavedAt
    ? new Date(draftSaveState.cloudSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';
  const isScreenShareBlocking = screenShareStatus !== 'active';

  const SaveStatusPill = () => {
    const commonClass = 'flex items-center gap-2 px-2.5 md:px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap';
    const cloudTimeText = cloudSaveTimeLabel ? `Cloud ${cloudSaveTimeLabel}` : 'not yet synced';
    if (draftSaveState.phase === 'saving') {
      return (
        <div className={`${commonClass} bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-300`} title={cloudTimeText}>
          <Loader2 size={14} className="animate-spin" />
          <span>Saving...</span>
          <span className="text-violet-500 dark:text-violet-300/80">· {cloudTimeText}</span>
        </div>
      );
    }
    if (draftSaveState.phase === 'offline') {
      return (
        <div className={`${commonClass} bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300`} title="Answers are saved locally and will sync when connection returns.">
          <CloudOff size={14} />
          <span>Offline</span>
          <span className="text-amber-600 dark:text-amber-300/80">· {cloudTimeText}</span>
        </div>
      );
    }
    if (draftSaveState.phase === 'error') {
      return (
        <div className={`${commonClass} bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300`} title="Local draft is preserved. Cloud sync will retry automatically.">
          <AlertTriangle size={14} />
          <span>Sync retrying</span>
          <span className="text-red-600 dark:text-red-300/80">· {cloudTimeText}</span>
        </div>
      );
    }
    if (draftSaveState.phase === 'queued' || draftSaveState.phase === 'local') {
      return (
        <div className={`${commonClass} bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300`} title="Your answer is saved on this device and queued for cloud sync.">
          <Save size={14} />
          <span>Locally saved, cloud pending</span>
          <span className="text-blue-600 dark:text-blue-300/80">· {cloudTimeText}</span>
        </div>
      );
    }

    return (
      <div className={`${commonClass} bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300`}>
        <Cloud size={14} />
        <span>{cloudSaveTimeLabel ? `Cloud saved ${cloudSaveTimeLabel}` : 'Cloud ready'}</span>
      </div>
    );
  };

  const ScreenShareNotice = () => {
    const isActive = screenShareStatus === 'active';
    if (isActive) {
      return (
        <div className="mx-4 mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200 md:mx-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-100 p-2 dark:bg-emerald-900/40">
              <Laptop size={20} />
            </div>
            <div>
              <p className="font-bold">Entire screen sharing is active</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Proctors can request a one-time screenshot when needed.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-4 mt-4 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100 md:mx-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-100 p-2 dark:bg-amber-900/40">
              <Laptop size={20} />
            </div>
            <div>
              <p className="font-bold">Screen sharing required for proctor screenshots</p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Click the button and choose <strong>Entire Screen</strong>. Screenshots are only taken when a proctor requests one.
              </p>
              {screenShareStatus === 'unsupported' && (
                <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">
                  This browser does not support secure screen sharing. Please use Chrome, Edge, or Firefox.
                </p>
              )}
              {screenShareStatus === 'stopped' && (
                <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-300">
                  Screen sharing was stopped. Start it again before continuing.
                </p>
              )}
            </div>
          </div>
          <Button size="sm" onClick={requestScreenSharePermission} className="shrink-0">
            <Laptop size={16} /> Share Entire Screen
          </Button>
        </div>
      </div>
    );
  };

  const ScreenShareBlocker = () => {
    if (screenShareStatus === 'active') return null;

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/75 p-4 backdrop-blur-md">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Laptop size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Share Your Entire Screen</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            This proctored exam requires screen sharing until submission. If sharing is stopped, the exam is paused and the event is recorded.
          </p>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
            When the browser prompt opens, choose <strong>Entire Screen</strong>, not a tab or a single window.
          </div>
          <Button className="mt-6 w-full" onClick={requestScreenSharePermission}>
            <Laptop size={18} /> Share Entire Screen
          </Button>
          {screenShareStatus === 'unsupported' && (
            <p className="mt-3 text-xs font-semibold text-red-600 dark:text-red-300">
              This browser does not support screen sharing. Please use Chrome, Edge, or Firefox.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black flex flex-col font-sans select-none">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-auto md:h-20 px-4 py-3 md:py-0 md:px-8 flex flex-wrap md:flex-nowrap justify-between items-center z-50 gap-4">
         <div className="flex items-center gap-4 flex-1">
            <div className="bg-violet-100 dark:bg-violet-900/30 p-2 rounded-lg hidden md:block">
              <ShieldCheck className="text-violet-600 dark:text-violet-400" size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 dark:text-white leading-tight truncate text-sm md:text-base">{exam.title}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">ID: {exam.id}</p>
            </div>
         </div>

         <div className="flex items-center gap-3 md:gap-6">
            <SaveStatusPill />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleManualSave}
              loading={draftSaveState.phase === 'saving'}
              className="gap-2"
            >
              <Save size={16} />
              <span className="hidden sm:inline">Save Now</span>
            </Button>

            {screenShareStatus === 'active' ? (
              <div
                className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                title="Entire screen sharing is active"
              >
                <Laptop size={14} />
                Screen Ready
              </div>
            ) : (
              <button
                type="button"
                onClick={requestScreenSharePermission}
                className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition-all hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                title="Share your entire screen for proctor screenshots"
              >
                <Laptop size={14} />
                Share Screen
              </button>
            )}

            <div className={`flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-4 md:py-2 rounded-full border ${
              (timeLeft || 0) < 300 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
            }`}>
               <Clock size={16} className="md:w-[18px] md:h-[18px]" />
               <span className="font-mono font-bold text-sm md:text-lg">
                 {Math.floor((timeLeft || 0) / 60)}:{(timeLeft || 0) % 60 < 10 ? '0' : ''}{(timeLeft || 0) % 60}
               </span>
            </div>
            
            {hasReferenceDocument && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={toggleReferenceDocument}
                loading={isReferenceDocumentLoading}
                className="gap-2 hidden md:flex"
              >
                {isSplitView ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {isSplitView ? 'Close' : '📄 View'} Case Study
              </Button>
            )}

            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
            <ThemeToggle />

            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsNavOpen(true)}
              className="lg:hidden"
            >
              <Menu size={20} />
            </Button>
         </div>
      </header>

      {/* Webcam (Hidden) */}
      <video ref={videoRef} autoPlay muted className="hidden" />
      <video ref={screenVideoRef} autoPlay muted playsInline className="hidden" />

      <ScreenShareNotice />
      <ScreenShareBlocker />

      <main className={`flex flex-1 gap-6 overflow-hidden h-full transition-all duration-300 ${isScreenShareBlocking ? 'pointer-events-none select-none blur-[2px] opacity-50' : ''}`}>
        {/* PDF Panel */}
        {isSplitView && referenceDocumentUrl && (
          <div className="w-[45%] overflow-hidden">
            <iframe 
              src={referenceDocumentUrl}
              className="w-full h-full border-0 rounded-lg"
              title="Reference Document"
            />
          </div>
        )}

        {/* Question Area */}
        <div className={`${isSplitView ? 'w-[55%]' : 'w-full'} overflow-hidden flex flex-col lg:flex-row gap-6 md:gap-8 w-full max-w-[98%] ml-auto mr-2 md:mr-6 p-4 md:p-6`}>
           <div className="flex-1 space-y-6 overflow-y-auto">
            <Card>
               <div className="flex items-center justify-between mb-6">
                 <Badge className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm px-3 py-1">
                   Question {currentQuestionIndex + 1} of {exam.questions.length}
                 </Badge>
                 <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                   <button
                     type="button"
                     onClick={toggleFlagCurrentQuestion}
                     className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                       isCurrentQuestionFlagged
                         ? 'border-amber-300 bg-amber-50 text-amber-700 shadow-sm shadow-amber-500/10 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                         : 'border-gray-200 bg-white text-gray-500 hover:border-amber-300 hover:text-amber-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-amber-700 dark:hover:text-amber-300'
                     }`}
                   >
                     <Flag size={14} className={isCurrentQuestionFlagged ? 'fill-current' : ''} />
                     {isCurrentQuestionFlagged ? 'Flagged' : 'Flag'}
                   </button>
                   <span className="font-mono">{currentQ.points} pts</span>
                 </div>
               </div>

               {/* Render question text with HTML formatting support */}
               <SafeHtml
                 html={currentQ.text}
                 className="text-base md:text-lg font-medium text-gray-800 dark:text-gray-100 mb-6 leading-relaxed rich-text-content
                   [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-3 
                   [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-3 
                   [&>p]:mb-3 
                   [&>table]:w-full [&>table]:border-collapse [&>table]:my-4 [&>table]:shadow-sm
                   [&_td]:border [&_td]:border-gray-300 [&_td]:dark:border-gray-600 [&_td]:p-3 [&_td]:bg-gray-50 [&_td]:dark:bg-gray-800/50 
                   [&_th]:border [&_th]:border-gray-400 [&_th]:dark:border-gray-500 [&_th]:p-3 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-800 [&_th]:font-bold [&_th]:text-gray-900 [&_th]:dark:text-white"
               />

               <div className="flex-1 space-y-4">
                  {currentQ.type === QuestionType.MCQ && currentQ.options?.map((opt, idx) => (
                    <div 
                      key={idx}
                      onClick={() => handleAnswer(opt)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                        currentA === opt 
                          ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-500' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        currentA === opt ? 'border-violet-600 bg-violet-600 text-white' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {currentA === opt && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className="text-gray-700 dark:text-gray-200 text-sm md:text-base">{opt}</span>
                    </div>
                  ))}

                  {currentQ.type === QuestionType.MULTI_SELECT && currentQ.options?.map((opt, idx) => {
                    const isSelected = (currentA as string[])?.includes(opt);
                    return (
                      <div 
                        key={idx}
                        onClick={() => handleAnswer(opt)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                          isSelected
                            ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-500' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-violet-600 bg-violet-600 text-white' : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <CheckSquare size={14} />}
                        </div>
                        <span className="text-gray-700 dark:text-gray-200 text-sm md:text-base">{opt}</span>
                      </div>
                    );
                  })}

                  {currentQ.type === QuestionType.TRUE_FALSE && ['True', 'False'].map((opt) => (
                    <div 
                      key={opt}
                      onClick={() => handleAnswer(opt)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                        currentA === opt 
                          ? 'border-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-500' 
                          : 'border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        currentA === opt ? 'border-violet-600 bg-violet-600 text-white' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {currentA === opt && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className="text-gray-700 dark:text-gray-200 text-sm md:text-base">{opt}</span>
                    </div>
                  ))}

                  {(currentQ.type === QuestionType.SHORT_ANSWER || currentQ.type === QuestionType.ESSAY) && (
                    <RichTextEditor 
                      key={currentQ.id}
                      value={currentA || ''}
                      onChange={(val) => handleAnswer(val)}
                      disablePaste
                      onBlockedPaste={handleBlockedPaste}
                      className="min-h-[300px]"
                    />
                  )}
               </div>
            </Card>

            {/* File Submission Section */}
            {exam.allowsFileUpload && (
              <Card className="border-violet-200 dark:border-violet-900/50">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Upload size={20} className="text-violet-500"/> File Submission
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Please upload your files here. Allowed types: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{exam.allowedFileTypes?.join(', ')}</span>. 
                  Max files: {exam.maxFileCount}.
                </p>

                <div className="space-y-4">
                   {/* Upload Area */}
                   {(uploadedFiles.length < (exam.maxFileCount || 1)) && (
                     <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative">
                        <input 
                          type="file" 
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={isUploading}
                        />
                        <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                          {isUploading ? (
                            <>
                              <Loader2 size={32} className="animate-spin text-violet-600"/>
                              <p>Uploading...</p>
                            </>
                          ) : (
                            <>
                              <Upload size={32} className="text-violet-400"/>
                              <p className="font-medium">Click to upload file</p>
                            </>
                          )}
                        </div>
                     </div>
                   )}

                   {/* File List */}
                   <div className="space-y-2">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                           <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                                <File size={20}/>
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate text-gray-900 dark:text-white">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                           </div>
                           <button 
                             onClick={() => removeFile(idx)}
                             className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                           >
                             <Trash2 size={18}/>
                           </button>
                        </div>
                      ))}
                   </div>
                </div>
              </Card>
            )}

            <div className="flex justify-between items-center pb-20 md:pb-0">
               <Button 
                 variant="ghost" 
                 disabled={currentQuestionIndex === 0}
                 onClick={() => goToQuestion(currentQuestionIndex - 1)}
               >
                 Previous
               </Button>
               
               {currentQuestionIndex < exam.questions.length - 1 ? (
                 <Button 
                   onClick={() => goToQuestion(currentQuestionIndex + 1)}
                   className="gap-2"
                 >
                   Next Question <ArrowRight size={18} />
                 </Button>
               ) : (
                 <Button 
                   variant="primary"
                   className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8"
                   onClick={() => handleSubmit()}
                 >
                   Submit Exam <CheckCircle size={18} />
                 </Button>
               )}
            </div>
            </div>

          {/* Sidebar Navigation - Responsive Drawer */}
         <>
           {/* Overlay */}
           {isNavOpen && (
             <div 
               className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
               onClick={() => setIsNavOpen(false)}
             />
           )}
           
           <div className={`
             fixed lg:sticky lg:self-start top-0 lg:top-4 right-0 h-screen lg:h-auto w-72 lg:w-64 bg-white dark:bg-gray-900 lg:bg-transparent lg:dark:bg-transparent z-50 lg:z-0 p-6 lg:p-0 shadow-2xl lg:shadow-none transition-transform duration-300 ease-in-out overflow-y-auto
             ${isNavOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
           `}>
              <div className="flex justify-between items-center mb-6 lg:hidden">
                <h3 className="font-bold text-lg">Question Map</h3>
                <button onClick={() => setIsNavOpen(false)}><X size={24}/></button>
              </div>

              <div className="space-y-6">
                <Card className="p-4">
                   <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider hidden lg:block">Question Navigator</h3>
                   <div className="grid grid-cols-4 gap-2">
                      {exam.questions.map((q, idx) => {
                        const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true);
                        const isCurrent = idx === currentQuestionIndex;
                        const isFlagged = flaggedQuestionIds.includes(q.id);
                        
                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              goToQuestion(idx);
                            }}
                            className={`relative aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                              isCurrent 
                                ? 'bg-violet-600 text-white ring-2 ring-violet-300 dark:ring-violet-800' 
                                : isFlagged
                                  ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800'
                                : isAnswered
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                            title={isFlagged ? `Question ${idx + 1} flagged for review` : `Question ${idx + 1}`}
                          >
                            <span>{idx + 1}</span>
                            {isFlagged && !isCurrent && <Flag size={10} className="absolute mt-6 fill-current" />}
                          </button>
                        );
                      })}
                   </div>
                </Card>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                   <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2 flex items-center gap-2">
                     <ShieldCheck size={16}/> Proctor Active
                   </h4>
                   <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                     Your session is being monitored. Please keep your face visible and do not switch tabs.
                   </p>
                </div>
              </div>
           </div>
         </>
        </div>
      </main>
      
      {/* Beautiful Modal Dialog */}
      <Modal
        isOpen={modalState.isOpen}
        onClose={hideModal}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        showCancel={modalState.showCancel}
      />
    </div>
  );
};
