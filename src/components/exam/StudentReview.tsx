import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { CheckCircle, LogOut } from 'lucide-react';
import { UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const StudentReview = () => {
  const { auth, sessions, exams, logout } = useApp();
  const navigate = useNavigate();

  // Find the submitted session for the active user
  const session = sessions.find(s => 
    s.studentId === auth.user?.id && 
    (s.status === 'SUBMITTED' || s.status === 'COMPLETED')
  );
  
  const exam = exams.find(e => e.id === session?.examId);

  if (!auth.isAuthenticated || auth.user?.role !== UserRole.STUDENT) {
    return <Navigate to="/" />;
  }

  // If no session, fallback to home
  if (!session || !exam) {
     return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shadow-sm mb-2">
            <CheckCircle size={48} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Submission Received</h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
            Your answers for <span className="font-bold text-gray-900 dark:text-white">{exam.title}</span> have been securely recorded.
            Please review your submission below before logging out.
          </p>
        </div>

        {/* Review Card */}
        <Card className="border-t-4 border-violet-600">
           <div className="space-y-8">
             {exam.questions.map((q, idx) => {
               const answer = session.answers[q.id];
               return (
                 <div key={q.id} className="border-b border-gray-100 dark:border-gray-800 pb-6 last:border-0 last:pb-0">
                   <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                        <span className="text-gray-400 mr-2">{idx + 1}.</span>
                        {q.text}
                      </h3>
                      <Badge color="slate">{q.points} pts</Badge>
                   </div>

                   <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Your Answer</p>
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {Array.isArray(answer) ? (
                           <div className="flex flex-wrap gap-2">
                             {answer.length > 0 ? answer.map((a, i) => (
                               <span key={i} className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm">{a}</span>
                             )) : <span className="italic text-gray-400">No answer provided</span>}
                           </div>
                        ) : (
                           <div className="rich-text-content">
                             {typeof answer === 'string' && (answer.includes('<p>') || answer.includes('<ul>') || answer.includes('<b>')) ? (
                               <div dangerouslySetInnerHTML={{ __html: answer }} />
                             ) : (
                               <p className="whitespace-pre-wrap">{answer ? answer.toString() : <span className="italic text-gray-400">No answer provided</span>}</p>
                             )}
                           </div>
                        )}
                      </div>
                   </div>
                 </div>
               )
             })}
           </div>
        </Card>

        {/* Logout Action */}
        <div className="text-center pt-8">
           <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm font-medium">Please sign out to complete the process.</p>
           <Button onClick={() => { logout(); navigate('/'); }} variant="danger" size="lg" className="w-full md:w-auto min-w-[200px]">
             <LogOut size={20}/> Secure Logout
           </Button>
        </div>

      </div>
    </div>
  );
};
