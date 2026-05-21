import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Video, X, ShieldAlert, Clock, User, Ban, Timer, Camera, MonitorUp } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { getServerTime } from '../../services/serverTime';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal, useModal } from '../ui/Modal';
import { Input } from '../ui/Input';

export const ProctorView = () => {
  const { users, exams, sessions } = useApp();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { modalState, showModal, hideModal } = useModal();
  const cleanupStartedRef = useRef(false);

  const activeSessions = sessions.filter(s => s.status === 'IN_PROGRESS');

  useEffect(() => {
    if (cleanupStartedRef.current) return;
    cleanupStartedRef.current = true;
    api.sessions.cleanupProctorMedia().catch(error => {
      console.warn('Proctor media cleanup failed:', error);
    });
  }, []);

  const showFollowUpModal = (options: Parameters<typeof showModal>[0]) => {
    setTimeout(() => showModal(options), 0);
  };

  const getScreenCaptureLabel = (status?: string) => {
    if (!status) return 'No screenshot requested';
    if (status === 'CAPTURED') return 'Screenshot captured';
    if (status === 'REQUESTED') return 'Waiting for student browser';
    if (status === 'CAPTURING') return 'Capturing screen';
    if (status === 'FAILED') return 'Capture failed';
    if (status === 'DENIED') return 'Permission denied';
    if (status === 'STOPPED') return 'Screen share stopped';
    return status.replace(/_/g, ' ');
  };

  const withCacheBust = (url?: string, timestamp?: number) => {
    if (!url) return '';
    if (!timestamp) return url;
    return `${url}${url.includes('?') ? '&' : '?'}t=${timestamp}`;
  };

  const handleRequestScreenCapture = async (sessionId: string) => {
    try {
      await api.sessions.requestScreenCapture(sessionId);
      showModal({
        title: 'Screenshot Requested',
        message: 'The request was sent to the student browser. If they have shared their entire screen, the image will appear here shortly.',
        type: 'success',
        showCancel: false,
        confirmText: 'OK',
      });
    } catch (error: any) {
      showModal({
        title: 'Request Failed',
        message: error?.message || 'Could not request a screenshot from this student.',
        type: 'error',
        showCancel: false,
        confirmText: 'OK',
      });
    }
  };

  const requestProctorInput = ({
    title,
    description,
    placeholder,
    inputType = 'text',
    confirmText,
    onSubmit,
  }: {
    title: string;
    description: string;
    placeholder: string;
    inputType?: 'text' | 'number';
    confirmText: string;
    onSubmit: (value: string) => void;
  }) => {
    const inputId = `proctor-input-${Date.now()}`;

    showModal({
      title,
      message: (
        <div className="space-y-4 text-left">
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
          <Input
            id={inputId}
            type={inputType}
            min={inputType === 'number' ? 1 : undefined}
            placeholder={placeholder}
            autoFocus
          />
        </div>
      ),
      type: 'confirm',
      confirmText,
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        const value = (document.getElementById(inputId) as HTMLInputElement | null)?.value.trim() || '';
        onSubmit(value);
      },
    });
  };

  const handleTerminate = async (sessionId: string) => {
    showModal({
      title: 'Terminate Session',
      message: (
        <div className="space-y-2">
          <p>Are you sure you want to <strong className="text-red-600">TERMINATE</strong> this exam session?</p>
          <p className="text-red-500 font-medium">The student will be disqualified and receive a score of 0.</p>
        </div>
      ),
      type: 'delete',
      confirmText: 'Terminate Session',
      cancelText: 'Cancel',
      showCancel: true,
      onConfirm: async () => {
        await api.sessions.terminate(sessionId);
        setSelectedSessionId(null);
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Live Proctoring</h2>
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-full text-sm font-bold border border-emerald-100 dark:border-emerald-800">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          {activeSessions.length} Active Candidates
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeSessions.map(session => {
          const student = users.find(u => u.id === session.studentId);
          // Safe check for violations array
          const violations = session.violations || [];
          const hasViolation = violations.length > 0;
          
          return (
            <Card 
              key={session.studentId} 
              noPadding 
              className="overflow-hidden group border-gray-300 dark:border-gray-700 shadow-lg cursor-pointer hover:ring-2 hover:ring-violet-500 transition-all" 
              onClick={() => {
                // Use unique session ID to ensure we select the exact session
                setSelectedSessionId(`${session.studentId}_${session.examId}`);
              }}
            >
              <div className="aspect-video bg-gray-900 relative">
                {/* Live Stream Frame */}
                {session.currentFrame ? (
                  <img src={withCacheBust(session.currentFrame, session.currentFrameUpdatedAt)} alt="Live Stream" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <Video size={32} className="animate-pulse" />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                
                <div className="absolute top-3 right-3 flex gap-2">
                   {hasViolation && (
                     <div className="bg-red-600 text-white text-xs px-2 py-1 rounded shadow-lg animate-pulse flex items-center gap-1 font-bold">
                       <AlertTriangle size={12} /> ALERT
                     </div>
                   )}
                   <div className="bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                     <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"/> Live
                   </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white font-bold truncate text-lg shadow-sm">{student?.name || session.studentId}</p>
                  <div className="flex justify-between text-gray-300 text-xs mt-1 font-medium">
                    <span>{session.examId}</span>
                    <span className="font-mono">{Math.floor((getServerTime() - (session.startTime || 0)) / 60000)}m elapsed</span>
                  </div>
                </div>
              </div>
              
              <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                 <div className="flex justify-between text-xs font-bold mb-3">
                    <span className={hasViolation ? "text-red-600 dark:text-red-400" : "text-gray-500"}>
                      {violations.length} Violations
                    </span>
                    <span className="text-violet-600 dark:text-violet-400">
                      Click for Details
                    </span>
                 </div>
                 <Button 
                   size="sm" 
                   variant={hasViolation ? "danger" : "secondary"}
                   className="w-full text-xs py-1 h-auto"
                   onClick={(e) => {
                     e.stopPropagation();
                     requestProctorInput({
                       title: 'Send Warning',
                       description: 'Enter the warning message that should appear for this student.',
                       placeholder: 'Warning message',
                       confirmText: 'Send Warning',
                       onSubmit: (msg) => {
                         if (!msg) return;
                         const sessionId = `${session.studentId}_${session.examId}`;
                         api.sessions.sendWarning(sessionId, msg);
                         showFollowUpModal({
                           title: 'Warning Sent',
                           message: 'The warning has been sent to the student.',
                           type: 'success',
                           showCancel: false,
                           confirmText: 'OK',
                         });
                       },
                     });
                   }}
                 >
                   Send Warning
                 </Button>
                 <Button
                   size="sm"
                   variant="primary"
                   className="w-full text-xs py-1 h-auto mt-2"
                   onClick={(e) => {
                     e.stopPropagation();
                     handleRequestScreenCapture(`${session.studentId}_${session.examId}`);
                   }}
                 >
                   <Camera size={14} /> Capture Screen
                 </Button>
              </div>
            </Card>
          );
        })}
        
        {activeSessions.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl bg-gray-50/50 dark:bg-gray-900/50">
             <div className="p-4 bg-white dark:bg-gray-800 rounded-full mb-4 shadow-sm">
               <Video size={40} className="opacity-50" />
             </div>
             <p className="font-medium">No active exams in progress.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {(() => {
        // Find session by unique ID (studentId_examId)
        const selectedSession = sessions.find(s => `${s.studentId}_${s.examId}` === selectedSessionId);
        return selectedSession && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white/95 dark:bg-gray-900/95 rounded-3xl shadow-2xl shadow-black/20 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-white/80 dark:border-gray-800/80 backdrop-blur-xl animate-in zoom-in-95 fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 font-bold text-xl">
                    {users.find(u => u.id === selectedSession.studentId)?.avatar || <User />}
                 </div>
                 <div>
                   <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                     {users.find(u => u.id === selectedSession.studentId)?.name || selectedSession.studentId}
                   </h3>
                   <p className="text-sm text-gray-500 flex items-center gap-2">
                     <span className="font-mono">{selectedSession.studentId}</span> • {exams.find(e => e.id === selectedSession.examId)?.title}
                   </p>
                 </div>
              </div>
              <button onClick={() => setSelectedSessionId(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Left Col: Live Feed & Stats */}
               <div className="space-y-6">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden border-2 border-gray-800 relative shadow-lg">
                    {selectedSession.currentFrame ? (
                      <img src={withCacheBust(selectedSession.currentFrame, selectedSession.currentFrameUpdatedAt)} alt="Live Stream" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <Video size={48} className="animate-pulse" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 bg-red-600 text-white text-xs px-2 py-1 rounded animate-pulse font-bold">
                      LIVE
                    </div>
                  </div>

                  <Card noPadding className="overflow-hidden border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 p-4">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <MonitorUp size={18} className="text-violet-500" /> On-Demand Screen Capture
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {getScreenCaptureLabel(selectedSession.screenCapture?.status)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRequestScreenCapture(`${selectedSession.studentId}_${selectedSession.examId}`)}
                        loading={selectedSession.screenCapture?.status === 'REQUESTED' || selectedSession.screenCapture?.status === 'CAPTURING'}
                      >
                        <Camera size={16} />
                        Capture Now
                      </Button>
                    </div>
                    <div className="bg-gray-950">
                      {selectedSession.screenCapture?.imageUrl ? (
                        <a href={selectedSession.screenCapture.imageUrl} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={withCacheBust(selectedSession.screenCapture.imageUrl, selectedSession.screenCapture.capturedAt)}
                            alt="Latest student screen capture"
                            className="w-full aspect-video object-contain bg-black"
                          />
                        </a>
                      ) : (
                        <div className="aspect-video flex flex-col items-center justify-center text-gray-500 text-sm">
                          <MonitorUp size={36} className="mb-3 opacity-70" />
                          <span>No screen screenshot captured yet.</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/70">
                      {selectedSession.screenCapture?.capturedAt
                        ? `Captured ${new Date(selectedSession.screenCapture.capturedAt).toLocaleString()}`
                        : selectedSession.screenCapture?.error || 'Ask the student to share their Entire Screen before requesting a capture.'}
                    </div>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                     <Card noPadding className="p-4 bg-gray-50 dark:bg-gray-800/50 border-0">
                        <div className="flex items-center gap-3 mb-2 text-gray-500">
                           <Clock size={18} /> <span className="text-xs font-bold uppercase">Elapsed Time</span>
                        </div>
                        <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                          {Math.floor((getServerTime() - (selectedSession.startTime || 0)) / 60000)}m
                        </p>
                     </Card>
                     <Card noPadding className="p-4 bg-red-50 dark:bg-red-900/10 border-0">
                        <div className="flex items-center gap-3 mb-2 text-red-500">
                           <ShieldAlert size={18} /> <span className="text-xs font-bold uppercase">Violations</span>
                        </div>
                        <p className="text-2xl font-mono font-bold text-red-600 dark:text-red-400">
                          {(selectedSession.violations || []).length}
                        </p>
                     </Card>
                  </div>
                  
                  <div className="space-y-2">
                    {/* Show current extra time if any */}
                    {(selectedSession.extraTimeMinutes || 0) > 0 && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center text-sm text-blue-700 dark:text-blue-300 font-medium">
                        <Timer size={14} className="inline mr-1" />
                        +{selectedSession.extraTimeMinutes} min extra time granted
                      </div>
                    )}
                    
                    <Button 
                       className="w-full" 
                       variant="secondary"
                       onClick={() => {
                         requestProctorInput({
                           title: 'Send Warning',
                           description: 'Enter the warning message that should appear for this student.',
                           placeholder: 'Warning message',
                           confirmText: 'Send Warning',
                           onSubmit: (msg) => {
                             if (!msg) return;
                             const sessionId = `${selectedSession.studentId}_${selectedSession.examId}`;
                             api.sessions.sendWarning(sessionId, msg);
                             showFollowUpModal({
                               title: 'Warning Sent',
                               message: 'The warning has been sent to the student.',
                               type: 'success',
                               showCancel: false,
                               confirmText: 'OK',
                             });
                           },
                         });
                       }}
                    >
                      Send Warning Message
                    </Button>
                    
                    <Button 
                       className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                       onClick={() => {
                         requestProctorInput({
                           title: 'Extend Time',
                           description: 'Enter the number of extra minutes to grant to this student.',
                           placeholder: 'e.g. 5, 10, 15',
                           inputType: 'number',
                           confirmText: 'Grant Time',
                           onSubmit: (minutes) => {
                             if (minutes && !isNaN(Number(minutes)) && Number(minutes) > 0) {
                               const sessionId = `${selectedSession.studentId}_${selectedSession.examId}`;
                               api.sessions.extendTime(sessionId, Number(minutes));
                               showFollowUpModal({
                                 title: 'Time Extended',
                                 message: `Granted ${minutes} extra minutes to this student.`,
                                 type: 'success',
                                 showCancel: false,
                                 confirmText: 'OK',
                               });
                              } else if (minutes) {
                                showFollowUpModal({
                                  title: 'Invalid Input',
                                  message: 'Please enter a valid number of minutes.',
                                  type: 'error',
                                  showCancel: false,
                                  confirmText: 'OK',
                                });
                              }
                            },
                          });
                        }}
                    >
                      <Timer size={18} /> Extend Time
                    </Button>
                    
                    <Button 
                       className="w-full" 
                       variant="danger"
                       onClick={() => {
                         const sessionId = `${selectedSession.studentId}_${selectedSession.examId}`;
                         handleTerminate(sessionId);
                       }}
                    >
                      <Ban size={18} /> Terminate Exam Session
                    </Button>
                  </div>
               </div>

               {/* Right Col: Logs */}
               <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <AlertTriangle size={18} className="text-amber-500"/> Violation Log
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[300px] overflow-y-auto">
                       {((selectedSession.violations || []).length === 0) ? (
                         <div className="p-8 text-center text-gray-400 text-sm">No violations recorded.</div>
                       ) : (
                         <table className="w-full text-sm">
                           <thead className="bg-gray-100 dark:bg-gray-800 text-xs uppercase text-gray-500 font-bold sticky top-0">
                             <tr>
                               <th className="p-3 text-left">Time</th>
                               <th className="p-3 text-left">Type</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                             {(selectedSession.violations || []).map((v, i) => (
                               <tr key={i} className="hover:bg-white dark:hover:bg-gray-700/50">
                                 <td className="p-3 font-mono text-gray-500">
                                   {new Date(v.timestamp).toLocaleTimeString()}
                                 </td>
                                 <td className="p-3">
                                   <Badge color={v.type === 'TAB_SWITCH' ? 'amber' : 'red'}>
                                     {v.type.replace(/_/g, ' ')}
                                   </Badge>
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <ShieldAlert size={18} className="text-blue-500"/> Warning History
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[200px] overflow-y-auto">
                       {(!(selectedSession.warnings) || selectedSession.warnings.length === 0) ? (
                         <div className="p-8 text-center text-gray-400 text-sm">No warnings sent.</div>
                       ) : (
                         <div className="divide-y divide-gray-200 dark:divide-gray-700">
                           {selectedSession.warnings.map((w, i) => (
                             <div key={i} className="p-3 text-sm text-gray-700 dark:text-gray-300 flex gap-3">
                               <span className="font-mono text-xs text-gray-400 select-none">#{i+1}</span>
                               <span>{w}</span>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
        );
      })()}
      
      {/* Modal for dialogs */}
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
