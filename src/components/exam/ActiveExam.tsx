import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, ArrowRight, CheckCircle, CheckSquare, Circle, AlertTriangle, Loader2, Menu, X, Grid, FileText, Maximize2, Minimize2, Upload, File, Trash2, Sun, Moon, Laptop } from 'lucide-react';
import { Exam, StudentSession, UserRole, QuestionType } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { getServerTime } from '../../services/serverTime';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { RichTextEditor } from '../ui/RichTextEditor';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import { Modal, useModal } from '../ui/Modal';

export const ActiveExam = () => {
  const { auth, submitExamSession, startExamSession, logout } = useApp();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // --- Local State ---
  const [initStatus, setInitStatus] = useState<'LOADING' | 'READY' | 'SUBMITTING' | 'ERROR'>('LOADING');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const answersRef = useRef<Record<string, any>>({}); // Ref to track latest answers for async access
  const activeExamDataRef = useRef<{ exam: Exam, session: StudentSession } | null>(null);
  const uploadedFilesRef = useRef<{ name: string; url: string; type: string; size: number; uploadedAt: number; }[]>([]);
  const frameUploadInFlightRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // Remaining seconds
  const [activeExamData, setActiveExamData] = useState<{ exam: Exam, session: StudentSession } | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false); // Split Screen State
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; type: string; size: number; uploadedAt: number; }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Modal state for beautiful dialogs
  const { modalState, showModal, hideModal } = useModal();

  useEffect(() => {
    activeExamDataRef.current = activeExamData;
  }, [activeExamData]);

  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);
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

        // Set State
        setTimeLeft(remaining);
        setActiveExamData({ exam, session: freshSession });
        setAnswers(freshSession.answers || {});
        answersRef.current = freshSession.answers || {}; // Init ref
        if (freshSession.uploadedFiles) setUploadedFiles(freshSession.uploadedFiles);
        setInitStatus('READY');

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
        handleSubmit(activeExamData.session.studentId, activeExamData.exam.id, answersRef.current, uploadedFiles, true);
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
  }, [initStatus, activeExamData]);

  // --- 4. Webcam ---
  useEffect(() => {
    if (initStatus !== 'READY') return;
    
    let streamInterval: NodeJS.Timeout | null = null;
    
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
          setTimeout(() => {
            console.log('📸 Starting frame capture...');
            
            streamInterval = setInterval(async () => {
              try {
                if (frameUploadInFlightRef.current) return;
                if (!videoRef.current || !activeExamData) {
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
                canvas.width = 320;
                canvas.height = 240;
                const ctx = canvas.getContext('2d');
                
                if (!ctx) {
                  console.error('❌ Could not get canvas context');
                  return;
                }
                
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frameData = canvas.toDataURL('image/jpeg', 0.7);
                
                // Verify we have actual image data
                if (frameData.length < 1000) {
                  console.warn('⚠️ Frame data too small, likely blank');
                  return;
                }
                
                console.log('📤 Uploading frame... (size:', Math.round(frameData.length / 1024), 'KB)');
                
                frameUploadInFlightRef.current = true;
                await api.sessions.updateFrame(
                  activeExamData.session.studentId, 
                  activeExamData.exam.id, 
                  frameData
                );
                
                console.log('✅ Frame uploaded successfully!');
                
              } catch (error) {
                console.error('❌ Frame capture/upload failed:', error);
              }
                frameUploadInFlightRef.current = false;
            }, 5000); // Every 5 seconds
            
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
      if (streamInterval) {
        clearInterval(streamInterval);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        console.log('🛑 Webcam stream stopped');
      }
    };
  }, [initStatus, activeExamData]);

  // --- 5. Warnings Listener + Schedule/Time Extension Checker ---
  useEffect(() => {
    if (initStatus !== 'READY' || !activeExamData) return;

    // Light trusted refresh for schedule changes and server-time resync. Session changes arrive via direct listener below.
    const warningInterval = setInterval(async () => {
      try {
        // Fetch the latest trusted student-scoped session and exam data
        const context = await api.student.getActiveExamContext(activeExamData.exam.id);
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
              await api.sessions.submit(activeExamData.session.studentId, activeExamData.exam.id, answersRef.current, uploadedFilesRef.current);
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
              if (activeExamData.session.status !== 'SUBMITTED' && activeExamData.session.status !== 'COMPLETED') {
                  console.log("⚠️ Session terminated externally. Saving final answers...");
                  try {
                    // Use the REF to get the latest answers since state might be stale in this closure
                    await api.sessions.submit(activeExamData.session.studentId, activeExamData.exam.id, answersRef.current, uploadedFilesRef.current);
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
           const previousExtra = activeExamData.session.extraTimeMinutes || 0;
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
           if (currentSession.warnings && currentSession.warnings.length > (activeExamData.session.warnings?.length || 0)) {
              // New warning found!
              const newWarnings = currentSession.warnings.slice(activeExamData.session.warnings?.length || 0);
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
  }, [initStatus, activeExamData]);

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

      const shouldSyncSession =
        currentSession.status !== previousSession.status ||
        currentSession.submitTime !== previousSession.submitTime ||
        currentSession.extraTimeMinutes !== previousSession.extraTimeMinutes ||
        currentSession.isTerminated !== previousSession.isTerminated ||
        (currentSession.warnings?.length || 0) !== (previousSession.warnings?.length || 0) ||
        (currentSession.violations?.length || 0) !== (previousSession.violations?.length || 0);

      if (shouldSyncSession) {
        setActiveExamData(prev => prev ? ({ ...prev, session: currentSession }) : null);
      }
    });
  }, [initStatus, activeExamData?.session.studentId, activeExamData?.exam.id]);


  // --- Handlers ---
  const handleAnswer = (val: any) => {
    if (!activeExamData) return;
    const qId = activeExamData.exam.questions[currentQuestionIndex].id;
    const qType = activeExamData.exam.questions[currentQuestionIndex].type;

    if (qType === QuestionType.MULTI_SELECT) {
       const current = (answers[qId] as string[]) || [];
       let newVal;
       if (current.includes(val)) {
         newVal = current.filter(v => v !== val);
       } else {
         newVal = [...current, val];
       }
       setAnswers(prev => {
         const newAnswers = {...prev, [qId]: newVal};
         answersRef.current = newAnswers; // Sync ref
         return newAnswers;
       });
    } else {
       setAnswers(prev => {
         const newAnswers = {...prev, [qId]: val};
         answersRef.current = newAnswers; // Sync ref
         return newAnswers;
       });
    }
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

  // Actual submission logic (separated for modal callback)
  const doSubmit = async (stuId: string, exId: string, finalAnswers: Record<string, any>, finalFiles: any[]) => {
    setInitStatus('SUBMITTING');
    try {
      await submitExamSession(stuId, exId, finalAnswers, finalFiles);
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
       
       // Show beautiful modal instead of native confirm
       showModal({
         title: 'Submit Exam',
         message: (
           <div className="space-y-3">
             <p>You have answered <span className="font-bold text-violet-600">{answeredQuestions}</span> out of <span className="font-bold">{totalQuestions}</span> questions.</p>
             {unansweredQuestions > 0 && (
               <p className="text-amber-600 dark:text-amber-400 font-medium">
                 ⚠️ {unansweredQuestions} question(s) are still unanswered!
               </p>
             )}
             <p className="mt-4 font-medium">Are you sure you want to submit?</p>
           </div>
         ),
         type: unansweredQuestions > 0 ? 'warning' : 'confirm',
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
       await submitExamSession(stuId, exId, finalAnswers, finalFiles);
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
      const storageRef = ref(storage, `exam-submissions/${exam.id}/${session.studentId}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      const newFile = {
        name: file.name,
        url,
        type: file.type,
        size: file.size,
        uploadedAt: Date.now()
      };
      
      setUploadedFiles(prev => [...prev, newFile]);
    } catch (error) {
      console.error("Upload failed:", error);
      showModal({
        title: 'Upload Failed',
        message: 'Failed to upload your file. Please check your internet connection and try again.',
        type: 'error',
        showCancel: false,
        confirmText: 'OK',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = async (index: number) => {
    if (!confirm("Are you sure you want to remove this file?")) return;
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
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
            <div className={`flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-4 md:py-2 rounded-full border ${
              (timeLeft || 0) < 300 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
            }`}>
               <Clock size={16} className="md:w-[18px] md:h-[18px]" />
               <span className="font-mono font-bold text-sm md:text-lg">
                 {Math.floor((timeLeft || 0) / 60)}:{(timeLeft || 0) % 60 < 10 ? '0' : ''}{(timeLeft || 0) % 60}
               </span>
            </div>
            
            {exam.referenceDocumentUrl && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setIsSplitView(!isSplitView)}
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

      <main className="flex flex-1 gap-6 overflow-hidden h-full">
        {/* PDF Panel */}
        {isSplitView && exam.referenceDocumentUrl && (
          <div className="w-[45%] overflow-hidden">
            <iframe 
              src={exam.referenceDocumentUrl} 
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
                   <span className="font-mono">{currentQ.points} pts</span>
                 </div>
               </div>

               {/* Render question text with HTML formatting support */}
               <div 
                 className="text-base md:text-lg font-medium text-gray-800 dark:text-gray-100 mb-6 leading-relaxed rich-text-content
                   [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-3 
                   [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-3 
                   [&>p]:mb-3 
                   [&>table]:w-full [&>table]:border-collapse [&>table]:my-4 [&>table]:shadow-sm
                   [&_td]:border [&_td]:border-gray-300 [&_td]:dark:border-gray-600 [&_td]:p-3 [&_td]:bg-gray-50 [&_td]:dark:bg-gray-800/50 
                   [&_th]:border [&_th]:border-gray-400 [&_th]:dark:border-gray-500 [&_th]:p-3 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-800 [&_th]:font-bold [&_th]:text-gray-900 [&_th]:dark:text-white"
                 dangerouslySetInnerHTML={{ __html: currentQ.text }}
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
                 onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
               >
                 Previous
               </Button>
               
               {currentQuestionIndex < exam.questions.length - 1 ? (
                 <Button 
                   onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
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
                        
                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              setCurrentQuestionIndex(idx);
                              setIsNavOpen(false);
                            }}
                            className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                              isCurrent 
                                ? 'bg-violet-600 text-white ring-2 ring-violet-300 dark:ring-violet-800' 
                                : isAnswered
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                          >
                            {idx + 1}
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
