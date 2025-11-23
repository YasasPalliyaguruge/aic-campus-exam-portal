import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { TextArea } from '../ui/TextArea';

export const GradingCenter = () => {
  const { sessions, exams, users, isLoading, refreshData } = useApp();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, number>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submittedSessions = sessions.filter(s => s.status === 'SUBMITTED' || s.status === 'COMPLETED');

  const handleGradeUpdate = (qId: string, score: number) => {
    setScoreInputs(prev => ({ ...prev, [qId]: score }));
  };

  const handleFeedbackUpdate = (qId: string, feedback: string) => {
    setFeedbackInputs(prev => ({ ...prev, [qId]: feedback }));
  };

  const handleSaveGrade = async (examId: string, questionId: string) => {
    if (!selectedSessionId || saving) return;
    
    const score = scoreInputs[questionId] ?? 0;
    const feedback = feedbackInputs[questionId];
    
    setSaving(true);
    try {
      await api.sessions.updateGrade(
        selectedSessionId,
        examId,
        questionId,
        score,
        feedback
      );
      
      // Refresh data to show updated scores
      await refreshData();
      
      alert('Grade saved successfully!');
    } catch (error: any) {
      console.error('Error saving grade:', error);
      alert(`Error saving grade: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Detail view for grading a specific submission
  if (selectedSessionId) {
    const session = sessions.find(s => s.studentId === selectedSessionId);
    const exam = exams.find(e => e.id === session?.examId);
    const student = users.find(u => u.id === session?.studentId);
    if (!session || !exam) return null;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
         <button onClick={() => setSelectedSessionId(null)} className="text-gray-500 hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400 flex items-center gap-2 text-sm font-medium transition-colors">
           <ChevronRight size={16} className="rotate-180" /> Back to Submissions
         </button>
         
         <div className="flex flex-col md:flex-row justify-between items-start gap-4">
           <div>
             <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{exam.title}</h2>
             <p className="text-gray-500 dark:text-gray-400 text-lg">Student: {student?.name} <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded ml-2">{student?.studentId}</span></p>
           </div>
           <div className="text-right bg-violet-50 dark:bg-violet-900/20 px-6 py-3 rounded-xl border border-violet-100 dark:border-violet-800 w-full md:w-auto">
             <p className="text-sm text-gray-500 dark:text-gray-400 uppercase font-bold">Current Score</p>
             <p className="text-4xl font-bold text-violet-600 dark:text-violet-400">{session.score || 0} <span className="text-lg text-gray-400">/ {exam.questions.reduce((a,b)=>a+b.points,0)}</span></p>
           </div>
         </div>

         <div className="space-y-6">
           {exam.questions.map((q, idx) => {
             const answer = session.answers[q.id];
             const currentScore = session.questionScores?.[q.id] ?? 0;
             
             // Helper to render answer
             const renderAnswer = (ans: any) => {
               if (Array.isArray(ans)) return <div className="flex flex-wrap gap-2">{ans.map((a, i) => <Badge key={i} color="slate">{a}</Badge>)}</div>;
               
               // Check if it looks like HTML (basic check)
               if (typeof ans === 'string' && (ans.includes('<p>') || ans.includes('<ul>') || ans.includes('<b>'))) {
                  return <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: ans }} />;
               }
               
               return <p className="whitespace-pre-wrap">{ans || "(No Answer)"}</p>;
             };
             
             return (
               <Card key={q.id} className="p-4 md:p-8">
                 <div className="flex justify-between mb-6">
                   <Badge color="slate">Question {idx + 1} ({q.type})</Badge>
                   <span className="font-bold text-gray-500 dark:text-gray-400">{q.points} pts</span>
                 </div>
                 <p className="font-medium text-xl mb-6 text-gray-900 dark:text-gray-100">{q.text}</p>
                 
                 <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
                   <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-2">Student Answer</p>
                   <div className="text-gray-800 dark:text-gray-200 text-lg leading-relaxed font-medium">
                      {renderAnswer(answer)}
                   </div>
                 </div>

                 {q.correctAnswer && (
                   <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 mb-6">
                     <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold mb-2">Expected Answer (Reference):</p>
                     <p className="text-gray-800 dark:text-gray-200">{renderAnswer(q.correctAnswer)}</p>
                   </div>
                 )}

                 <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                         Score (0 - {q.points})
                       </label>
                       <Input 
                         type="number" 
                         min={0}
                         max={q.points}
                         value={scoreInputs[q.id] ?? currentScore}
                         onChange={(e: any) => handleGradeUpdate(q.id, parseInt(e.target.value) || 0)}
                         className="font-bold text-lg"
                       />
                     </div>
                     <div className="flex items-end">
                       <Button 
                         loading={saving || isLoading} 
                         disabled={saving || isLoading}
                         onClick={() => handleSaveGrade(session.examId, q.id)}
                         className="w-full"
                       >
                         Save Grade
                       </Button>
                     </div>
                   </div>
                   <div>
                     <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                       Feedback (Optional)
                     </label>
                     <TextArea
                       rows={3}
                       value={feedbackInputs[q.id] ?? session.graderNotes?.[q.id] ?? ''}
                       onChange={(e: any) => handleFeedbackUpdate(q.id, e.target.value)}
                       placeholder="Add feedback for the student..."
                       className="text-sm"
                     />
                   </div>
                 </div>
               </Card>
             );
           })}
         </div>
      </div>
    );
  }

  // List view of all submissions
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Grading Center</h2>
      <Card noPadding>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Exam</th>
              <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
              <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
              <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Violations</th>
              <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="p-3 md:p-5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {submittedSessions.map(s => {
              const exam = exams.find(e => e.id === s.examId);
              const student = users.find(u => u.id === s.studentId);
              return (
                <tr key={`${s.studentId}_${s.examId}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-3 md:p-5 font-medium text-gray-900 dark:text-white">{exam?.title}</td>
                  <td className="p-3 md:p-5 text-gray-600 dark:text-gray-300">{student?.name} <span className="text-xs text-gray-400 block">{student?.studentId}</span></td>
                  <td className="p-3 md:p-5 text-gray-500 dark:text-gray-400">{new Date(s.submitTime || 0).toLocaleDateString()}</td>
                  <td className="p-3 md:p-5">
                    {s.violations.length > 0 ? <Badge color="red">{s.violations.length} Detected</Badge> : <Badge color="green">Clean</Badge>}
                  </td>
                  <td className="p-3 md:p-5">
                    {s.score !== undefined ? <span className="font-bold text-emerald-600 dark:text-emerald-400">{s.score} pts</span> : <Badge color="amber">Pending Grading</Badge>}
                  </td>
                  <td className="p-3 md:p-5 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedSessionId(s.studentId)}>Grade <ChevronRight size={14}/></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {submittedSessions.length === 0 && <div className="p-12 text-center text-gray-400">No submissions pending.</div>}
      </Card>
    </div>
  );
};
