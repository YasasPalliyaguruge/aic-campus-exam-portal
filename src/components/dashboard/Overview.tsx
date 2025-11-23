import React from 'react';
import { Users, BookOpen, Video, ClipboardCheck, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const Overview = () => {
  const { exams, sessions, users } = useApp();
  
  // --- Metrics Calculation ---
  const totalStudents = users.filter(u => u.role === UserRole.STUDENT).length;
  const activeExams = exams.filter(e => e.status === 'PUBLISHED').length;
  const ongoingSessions = sessions.filter(s => s.status === 'IN_PROGRESS').length;
  const needsGrading = sessions.filter(s => s.status === 'SUBMITTED' && s.score === undefined).length;

  // --- Recent Submissions (Real Data) ---
  const recentSubmissions = sessions
    .filter(s => s.status === 'SUBMITTED' || s.status === 'COMPLETED')
    .sort((a, b) => (b.submitTime || 0) - (a.submitTime || 0))
    .slice(0, 5);

  // --- Live Activity (Real Data) ---
  const liveSessions = sessions
    .filter(s => s.status === 'IN_PROGRESS')
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
    .slice(0, 5);

  const StatCard = ({ icon: Icon, label, value, color, bg }: any) => (
    <Card className="flex items-center gap-5 hover:scale-105 transition-transform cursor-default">
      <div className={`p-4 rounded-2xl ${bg} ${color}`}>
        <Icon size={28} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
      </div>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h2>
          <p className="text-gray-500 dark:text-gray-400">Real-time insights and activity monitoring.</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Users} label="Total Students" value={totalStudents} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-900/20" />
        <StatCard icon={BookOpen} label="Active Exams" value={activeExams} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
        <StatCard icon={Video} label="Live Proctoring" value={ongoingSessions} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-900/20" />
        <StatCard icon={ClipboardCheck} label="Pending Grading" value={needsGrading} color="text-rose-600" bg="bg-rose-50 dark:bg-rose-900/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Submissions Table */}
        <Card className="col-span-1 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
               <CheckCircle size={20} className="text-emerald-500"/> Recent Submissions
             </h3>
          </div>
          
          <div className="overflow-x-auto">
            {recentSubmissions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No submissions yet.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-medium uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Student</th>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recentSubmissions.map((session) => {
                    const student = users.find(u => u.id === session.studentId);
                    const exam = exams.find(e => e.id === session.examId);
                    return (
                      <tr key={session.id || session.studentId + session.examId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 font-bold text-xs">
                              {student?.name?.charAt(0) || 'S'}
                            </div>
                            {student?.name || session.studentId}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {exam?.title || session.examId}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {session.submitTime ? new Date(session.submitTime).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {session.score !== undefined ? (
                            <Badge color={session.score >= (exam?.passThreshold || 50) ? 'green' : 'red'}>
                              {session.score} pts
                            </Badge>
                          ) : (
                            <Badge color="slate">Pending</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
        
        {/* Live Activity Feed */}
        <Card className="flex flex-col h-full">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Video size={20} className="text-amber-500"/> Live Proctoring
          </h3>
          
          <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-2">
             {liveSessions.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center p-8 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
                 <Video size={32} className="mb-2 opacity-20"/>
                 <p>No active exams right now.</p>
               </div>
             ) : (
               liveSessions.map((s, i) => {
                 const student = users.find(u => u.id === s.studentId);
                 const exam = exams.find(e => e.id === s.examId);
                 return (
                   <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                     <div className="flex items-center gap-3">
                       <div className="relative">
                         <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            {s.currentFrame ? (
                              <img src={s.currentFrame} alt="Live" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400"><Users size={16}/></div>
                            )}
                         </div>
                         <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
                       </div>
                       <div>
                         <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[120px]">
                           {student?.name || s.studentId}
                         </p>
                         <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                           {exam?.title || s.examId}
                         </p>
                       </div>
                     </div>
                     <div className="text-right">
                        <span className="text-xs font-mono text-gray-400 block">
                          {Math.floor((Date.now() - (s.startTime || 0)) / 60000)}m
                        </span>
                        {(s.violations || []).length > 0 && (
                          <span className="text-[10px] font-bold text-red-500 flex items-center justify-end gap-1">
                            <AlertCircle size={10} /> {s.violations.length}
                          </span>
                        )}
                     </div>
                   </div>
                 );
               })
             )}
          </div>
        </Card>
      </div>
    </div>
  );
};
