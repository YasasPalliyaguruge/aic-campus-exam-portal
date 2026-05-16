import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { CheckCircle, LogOut, BookOpen, Clock, Award, AlertTriangle, File, FileText, Calendar, Edit2 } from 'lucide-react';
import { UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { getServerTime } from '../../services/serverTime';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const StudentReview = () => {
  const { auth, sessions, exams, logout } = useApp();
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState<{ session: any; exam: any } | null>(null);
  const [isReviewLoading, setIsReviewLoading] = useState(true);
  const [isReopening, setIsReopening] = useState(false);

  useEffect(() => {
    if (!auth.isAuthenticated || auth.user?.role !== UserRole.STUDENT) return;

    let isMounted = true;
    api.student.getLatestSubmission()
      .then((result) => {
        if (isMounted && result) setReviewData({ session: result.session, exam: result.exam });
      })
      .catch((error) => console.error('Failed to load student review:', error))
      .finally(() => {
        if (isMounted) setIsReviewLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [auth.isAuthenticated, auth.user?.role]);

  // Find the most recently submitted session for this student
  const studentSessions = sessions
    .filter(s => 
      s.studentId === auth.user?.id && 
      (s.status === 'SUBMITTED' || s.status === 'COMPLETED')
    )
    .sort((a, b) => (b.submitTime || 0) - (a.submitTime || 0));
  
  const session = reviewData?.session || studentSessions[0]; // Most recent submission
  const exam = reviewData?.exam || exams.find(e => e.id === session?.examId);

  // Redirect if not authenticated as student
  if (!auth.isAuthenticated || auth.user?.role !== UserRole.STUDENT) {
    return <Navigate to="/" />;
  }

  if (isReviewLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 text-violet-600">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
      </div>
    );
  }

  // If no session found, show message and logout option
  if (!session || !exam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
        <Card className="p-12 text-center max-w-md">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText size={40} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Exam Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Could not find your exam submission. Please contact your instructor.
          </p>
          <Button 
            variant="danger" 
            size="lg" 
            onClick={() => { logout(); navigate('/'); }}
            className="gap-2 w-full"
          >
            <LogOut size={20} /> Logout
          </Button>
        </Card>
      </div>
    );
  }

  // Calculate scores
  const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
  const scorePercentage = session.score !== undefined 
    ? Math.round((session.score / totalPoints) * 100) 
    : null;

  // Check if student can still edit (exam window still open and not graded)
  // SECURITY: Use server time to prevent clock manipulation
  const serverNow = getServerTime(); // Server timestamp in milliseconds
  const canStillEdit = (() => {
    // Check if session was terminated by admin
    if (session.isTerminated) return false;
    
    // Must be SUBMITTED (not COMPLETED which means graded)
    if (session.status !== 'SUBMITTED') return false;
    
    // Check if exam window is still open (using server time)
    const scheduledEndTime = exam.scheduledEndMs || (exam.scheduledEnd ? new Date(exam.scheduledEnd).getTime() : null);
    if (scheduledEndTime) {
      const endTime = scheduledEndTime;
      if (serverNow > endTime) return false; // Exam window closed
    }
    
    // Check if there's still individual time remaining (using server time)
    if (session.startTime) {
      const extraSeconds = (session.extraTimeMinutes || 0) * 60;
      const totalSeconds = (exam.durationMinutes * 60) + extraSeconds;
      const elapsedSeconds = Math.floor((serverNow - session.startTime) / 1000);
      if (elapsedSeconds >= totalSeconds) return false; // Individual time expired
    }
    
    return true;
  })();

  // Calculate remaining time for display (using server time)
  const getRemainingTime = () => {
    const scheduledEndTime = exam.scheduledEndMs || (exam.scheduledEnd ? new Date(exam.scheduledEnd).getTime() : null);
    if (!session.startTime || !scheduledEndTime) return null;
    
    const endTime = scheduledEndTime;
    const extraSeconds = (session.extraTimeMinutes || 0) * 60;
    const individualEnd = session.startTime + ((exam.durationMinutes * 60) + extraSeconds) * 1000;
    
    const effectiveEnd = Math.min(endTime, individualEnd);
    const remaining = Math.floor((effectiveEnd - serverNow) / 1000 / 60);
    
    return remaining > 0 ? remaining : 0;
  };

  const remainingMinutes = getRemainingTime();

  const handleContinueEditing = async () => {
    if (!confirm('Are you sure you want to continue editing? You will be taken back to the exam.')) {
      return;
    }
    
    setIsReopening(true);
    try {
      await api.sessions.reopenSession(session.studentId, exam.id);
      // Navigate back to active exam
      navigate('/student/active');
    } catch (error) {
      console.error('Failed to reopen session:', error);
      alert('Failed to reopen session. The exam window may have closed.');
    } finally {
      setIsReopening(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/20 mb-4">
            <CheckCircle size={48} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Exam Submitted Successfully!
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Your answers have been recorded. Review your submission below.
          </p>
        </div>

        {/* Exam Info Card */}
        <Card className="p-8 bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0 shadow-xl shadow-violet-500/20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <BookOpen size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{exam.title}</h2>
              <p className="text-violet-200 flex items-center gap-2">
                <Calendar size={16} />
                Submitted on {session.submitTime 
                  ? new Date(session.submitTime).toLocaleDateString('en-US', { 
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })
                  : 'N/A'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-violet-200 text-sm mb-1">Score</p>
              <p className="text-2xl font-bold">
                {session.score !== undefined ? `${session.score}/${totalPoints}` : 'Pending'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-violet-200 text-sm mb-1">Percentage</p>
              <p className="text-2xl font-bold">
                {scorePercentage !== null ? `${scorePercentage}%` : '—'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-violet-200 text-sm mb-1">Questions</p>
              <p className="text-2xl font-bold">{exam.questions.length}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-violet-200 text-sm mb-1">Duration</p>
              <p className="text-2xl font-bold">{exam.durationMinutes} min</p>
            </div>
          </div>
        </Card>

        {/* Violations Warning */}
        {(session.violations?.length || 0) > 0 && (
          <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 border">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <AlertTriangle size={20} />
              <span className="font-medium">
                {session.violations.length} violation(s) were recorded during your exam
              </span>
            </div>
          </Card>
        )}

        {/* Your Answers */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen size={20} className="text-violet-500" />
            Your Answers
          </h2>
          
          {exam.questions.map((question, idx) => {
            const answer = session.answers[question.id];
            const questionScore = session.questionScores?.[question.id];
            const graderNote = session.graderNotes?.[question.id];
            
            return (
              <Card key={question.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <Badge>{question.type.replace('_', ' ')}</Badge>
                      <span className="text-gray-400 text-sm ml-2">{question.points} pts</span>
                    </div>
                  </div>
                  {questionScore !== undefined && (
                    <div className={`text-lg font-bold px-3 py-1 rounded-lg ${
                      questionScore >= question.points * 0.7 
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                        : questionScore >= question.points * 0.4
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    }`}>
                      {questionScore}/{question.points}
                    </div>
                  )}
                </div>

                <div 
                  className="font-semibold text-gray-900 dark:text-white text-lg mb-4 rich-text-content [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>p]:mb-2"
                  dangerouslySetInnerHTML={{ __html: question.text }}
                />

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border-l-4 border-violet-500">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Your Answer
                  </p>
                  {answer ? (
                    Array.isArray(answer) ? (
                      <div className="flex flex-wrap gap-2">
                        {answer.length > 0 ? answer.map((a, i) => (
                          <span key={i} className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white text-sm font-medium border border-gray-200 dark:border-gray-600">
                            {a}
                          </span>
                        )) : <span className="text-gray-400 italic">No options selected</span>}
                      </div>
                    ) : (
                      <div className="prose prose-violet dark:prose-invert max-w-none">
                        {typeof answer === 'string' && /<[a-z][\s\S]*>/i.test(answer) ? (
                          <div 
                            dangerouslySetInnerHTML={{ __html: answer }} 
                            className="text-gray-900 dark:text-white [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>br]:block [&>div]:mb-2"
                          />
                        ) : (
                          <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{answer}</p>
                        )}
                      </div>
                    )
                  ) : (
                    <p className="text-gray-400 italic">No answer provided</p>
                  )}
                </div>

                {/* Instructor Feedback */}
                {graderNote && (
                  <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-l-4 border-blue-500">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                      Instructor Feedback
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">{graderNote}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Uploaded Files */}
        {session.uploadedFiles && session.uploadedFiles.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <File size={20} className="text-violet-500" />
              Uploaded Files
            </h2>
            <Card className="p-6">
              <div className="space-y-3">
                {session.uploadedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400">
                        <File size={24} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Action Section */}
        {canStillEdit ? (
          <Card className="p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800">
            <div className="inline-flex p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4">
              <Clock size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Time Remaining: {remainingMinutes} minutes
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You can still edit your answers. Click below to continue working on your exam.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={handleContinueEditing}
                disabled={isReopening}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Edit2 size={20} /> {isReopening ? 'Reopening...' : 'Continue Editing'}
              </Button>
              <Button 
                variant="secondary" 
                size="lg" 
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut size={20} /> Finish & Logout
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">
              {session.isTerminated 
                ? '⚠️ Your session was terminated by the administrator. You may now log out.'
                : session.status === 'COMPLETED' 
                  ? 'Your exam has been graded. You may now safely log out.'
                  : 'The exam window has closed. You may now safely log out.'}
            </p>
            <Button 
              variant="danger" 
              size="lg" 
              onClick={handleLogout}
              className="gap-2 min-w-[200px]"
            >
              <LogOut size={20} /> Secure Logout
            </Button>
          </Card>
        )}

      </div>
    </div>
  );
};
