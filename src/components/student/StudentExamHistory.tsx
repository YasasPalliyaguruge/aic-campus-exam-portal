import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { CheckCircle, Clock, Award, FileText, ChevronRight, ArrowLeft, LogOut, BookOpen, Calendar, AlertTriangle, File } from 'lucide-react';
import { UserRole, QuestionType } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const StudentExamHistory = () => {
  const { auth, sessions, exams, logout } = useApp();
  const navigate = useNavigate();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  // Find all sessions for the current student
  const studentSessions = sessions.filter(s => 
    s.studentId === auth.user?.id && 
    (s.status === 'SUBMITTED' || s.status === 'COMPLETED')
  );

  if (!auth.isAuthenticated || auth.user?.role !== UserRole.STUDENT) {
    return <Navigate to="/" />;
  }

  // If no sessions, show empty state
  if (studentSessions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
                <BookOpen size={24} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Exams</h1>
                <p className="text-gray-500 dark:text-gray-400">Welcome, {auth.user?.name}</p>
              </div>
            </div>
            <Button variant="danger" onClick={() => { logout(); navigate('/'); }} className="gap-2">
              <LogOut size={18} /> Logout
            </Button>
          </div>

          <Card className="p-16 text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText size={40} className="text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Completed Exams</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              You haven't completed any exams yet. Once you finish an exam, it will appear here for review.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Get the selected session and exam for detail view
  const selectedSession = selectedExamId 
    ? studentSessions.find(s => s.examId === selectedExamId)
    : null;
  const selectedExam = selectedSession 
    ? exams.find(e => e.id === selectedSession.examId)
    : null;

  // Detail View - Show specific exam submission
  if (selectedSession && selectedExam) {
    const totalPoints = selectedExam.questions.reduce((sum, q) => sum + q.points, 0);
    const scorePercentage = selectedSession.score !== undefined 
      ? Math.round((selectedSession.score / totalPoints) * 100) 
      : null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => setSelectedExamId(null)} 
            className="gap-2 mb-4"
          >
            <ArrowLeft size={18} /> Back to All Exams
          </Button>

          {/* Exam Header */}
          <Card className="p-8 bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <FileText size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{selectedExam.title}</h1>
                <p className="text-violet-200">
                  Submitted on {selectedSession.submitTime 
                    ? new Date(selectedSession.submitTime).toLocaleDateString('en-US', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                      })
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-violet-200 text-sm mb-1">Total Score</p>
                <p className="text-3xl font-bold">
                  {selectedSession.score !== undefined ? selectedSession.score : '—'}/{totalPoints}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-violet-200 text-sm mb-1">Percentage</p>
                <p className="text-3xl font-bold">
                  {scorePercentage !== null ? `${scorePercentage}%` : 'Pending'}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                <p className="text-violet-200 text-sm mb-1">Status</p>
                <p className="text-2xl font-bold capitalize">{selectedSession.status.toLowerCase()}</p>
              </div>
            </div>
          </Card>

          {/* Violation Warning */}
          {(selectedSession.violations?.length || 0) > 0 && (
            <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
                <AlertTriangle size={20} />
                <span className="font-medium">
                  {selectedSession.violations.length} violation(s) recorded during this exam
                </span>
              </div>
            </Card>
          )}

          {/* Questions and Answers */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BookOpen size={20} className="text-violet-500" />
              Your Answers
            </h2>
            
            {selectedExam.questions.map((question, idx) => {
              const answer = selectedSession.answers[question.id];
              const questionScore = selectedSession.questionScores?.[question.id];
              const graderNote = selectedSession.graderNotes?.[question.id];
              
              return (
                <Card key={question.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-sm">
                        {idx + 1}
                      </div>
                      <Badge>{question.type.replace('_', ' ')}</Badge>
                    </div>
                    <div className="text-right">
                      {questionScore !== undefined ? (
                        <span className={`text-lg font-bold ${
                          questionScore >= question.points * 0.7 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : questionScore >= question.points * 0.4
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                        }`}>
                          {questionScore}/{question.points} pts
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">
                          {question.points} pts · Pending
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-4">
                    {question.text}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border-l-4 border-violet-500">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Your Answer
                    </p>
                    {answer ? (
                      Array.isArray(answer) ? (
                        <div className="flex flex-wrap gap-2">
                          {answer.map((a, i) => (
                            <span key={i} className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white text-sm font-medium border border-gray-200 dark:border-gray-600">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="prose prose-violet dark:prose-invert max-w-none">
                          {typeof answer === 'string' && (answer.includes('<p>') || answer.includes('<ul>') || answer.includes('<b>')) ? (
                            <div dangerouslySetInnerHTML={{ __html: answer }} className="text-gray-900 dark:text-white" />
                          ) : (
                            <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{answer}</p>
                          )}
                        </div>
                      )
                    ) : (
                      <p className="text-gray-400 italic">No answer provided</p>
                    )}
                  </div>

                  {/* Grader Feedback */}
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
          {selectedSession.uploadedFiles && selectedSession.uploadedFiles.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <File size={20} className="text-violet-500" />
                Uploaded Files
              </h2>
              <Card className="p-6">
                <div className="space-y-3">
                  {selectedSession.uploadedFiles.map((file, idx) => (
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

          {/* Logout Button */}
          <div className="pt-8 text-center">
            <Button 
              variant="danger" 
              size="lg" 
              onClick={() => { logout(); navigate('/'); }}
              className="gap-2"
            >
              <LogOut size={20} /> Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // List View - Show all completed exams
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30">
              <BookOpen size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Exams</h1>
              <p className="text-gray-500 dark:text-gray-400">Welcome back, {auth.user?.name}</p>
            </div>
          </div>
          <Button variant="danger" onClick={() => { logout(); navigate('/'); }} className="gap-2">
            <LogOut size={18} /> Logout
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-violet-200 text-sm">Completed</p>
                <p className="text-3xl font-bold">{studentSessions.length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Award size={24} />
              </div>
              <div>
                <p className="text-emerald-200 text-sm">Average Score</p>
                <p className="text-3xl font-bold">
                  {(() => {
                    const gradedSessions = studentSessions.filter(s => s.score !== undefined);
                    if (gradedSessions.length === 0) return '—';
                    const avg = gradedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSessions.length;
                    return Math.round(avg);
                  })()}
                </p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-blue-200 text-sm">Last Exam</p>
                <p className="text-lg font-bold">
                  {studentSessions[0]?.submitTime 
                    ? new Date(studentSessions[0].submitTime).toLocaleDateString() 
                    : '—'}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Exam List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Completed Exams</h2>
          
          {studentSessions.map(session => {
            const exam = exams.find(e => e.id === session.examId);
            if (!exam) return null;
            
            const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
            const scorePercentage = session.score !== undefined 
              ? Math.round((session.score / totalPoints) * 100) 
              : null;

            return (
              <Card 
                key={`${session.studentId}_${session.examId}`}
                className="p-6 cursor-pointer hover:ring-2 hover:ring-violet-500 hover:shadow-xl transition-all group"
                onClick={() => setSelectedExamId(session.examId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
                      <FileText size={28} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {exam.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {session.submitTime ? new Date(session.submitTime).toLocaleDateString() : 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {exam.durationMinutes} min
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      {scorePercentage !== null ? (
                        <>
                          <p className={`text-2xl font-bold ${
                            scorePercentage >= 70 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : scorePercentage >= 40
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}>
                            {scorePercentage}%
                          </p>
                          <p className="text-sm text-gray-500">{session.score}/{totalPoints} pts</p>
                        </>
                      ) : (
                        <Badge color="blue">Grading Pending</Badge>
                      )}
                    </div>
                    <ChevronRight size={24} className="text-gray-400 group-hover:text-violet-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
