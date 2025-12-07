import React, { useState } from 'react';
import { Download, FileText, ArrowLeft, File as FileIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Exam, StudentSession, User } from '../../types';

export const StudentReview = () => {
  const { exams, sessions, users } = useApp();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Filter submitted/completed sessions
  const completedSessions = sessions.filter(s => s.status === 'SUBMITTED' || s.status === 'COMPLETED');

  // Get sessions for selected exam
  const examSessions = selectedExamId 
    ? completedSessions.filter(s => s.examId === selectedExamId)
    : [];

  const selectedSession = selectedSessionId 
    ? sessions.find(s => `${s.studentId}_${s.examId}` === selectedSessionId)
    : null;

  const selectedExam = selectedSession 
    ? exams.find(e => e.id === selectedSession.examId)
    : null;

  const selectedStudent = selectedSession
    ? users.find(u => u.id === selectedSession.studentId)
    : null;

  // PDF Export Function
  const handleExportPDF = async () => {
    if (!selectedSession || !selectedExam || !selectedStudent) return;

    // Simple HTML to PDF conversion
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Exam Submission - ${selectedStudent.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #333; border-bottom: 3px solid #8b5cf6; padding-bottom: 10px; }
          h2 { color: #555; margin-top: 30px; }
          .header { margin-bottom: 30px; }
          .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 10px; margin-bottom: 20px; }
          .info-label { font-weight: bold; }
          .question { margin: 30px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
          .question-header { background: #f3f4f6; padding: 10px; margin: -20px -20px 15px -20px; border-radius: 8px 8px 0 0; }
          .answer { margin-top: 10px; padding: 15px; background: #fafafa; border-left: 4px solid #8b5cf6; }
          .file-list { margin-top: 20px; padding: 15px; background: #eff6ff; border-radius: 8px; }
          .file-item { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Exam Submission Report</h1>
          <div class="info-grid">
            <div class="info-label">Student:</div>
            <div>${selectedStudent.name} (${selectedStudent.studentId || selectedStudent.email})</div>
            <div class="info-label">Exam:</div>
            <div>${selectedExam.title}</div>
            <div class="info-label">Submitted:</div>
            <div>${selectedSession.submitTime ? new Date(selectedSession.submitTime).toLocaleString() : 'N/A'}</div>
            <div class="info-label">Score:</div>
            <div>${selectedSession.score || 0} points</div>
          </div>
        </div>

        <h2>Answers</h2>
        ${selectedExam.questions.map((q, idx) => `
          <div class="question">
            <div class="question-header">
              <strong>Question ${idx + 1}</strong> (${q.points} points)
            </div>
            <p><strong>${q.text}</strong></p>
            <div class="answer">
              <strong>Student Answer:</strong><br>
              ${selectedSession.answers[q.id] 
                ? (Array.isArray(selectedSession.answers[q.id]) 
                    ? selectedSession.answers[q.id].join(', ') 
                    : selectedSession.answers[q.id])
                : '<em>No answer provided</em>'}
            </div>
          </div>
        `).join('')}

        ${selectedSession.uploadedFiles && selectedSession.uploadedFiles.length > 0 ? `
          <h2>Uploaded Files</h2>
          <div class="file-list">
            <p><strong>The student submitted the following files:</strong></p>
            ${selectedSession.uploadedFiles.map((file, idx) => `
              <div class="file-item">
                ${idx + 1}. <strong>${file.name}</strong> (${file.type}, ${(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            `).join('')}
            <p style="margin-top: 15px; font-style: italic; color: #666;">
              Note: Files cannot be embedded in PDF. Please download them separately from the web interface.
            </p>
          </div>
        ` : ''}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Exam Selection View
  if (!selectedExamId) {
    const examsWithSubmissions = exams.filter(e => 
      completedSessions.some(s => s.examId === e.id)
    );

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Review Submissions</h2>
          <p className="text-gray-500">Select an exam to review student submissions</p>
        </div>

        {examsWithSubmissions.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No completed submissions yet</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {examsWithSubmissions.map(exam => {
              const count = completedSessions.filter(s => s.examId === exam.id).length;
              return (
                <Card 
                  key={exam.id}
                  className="p-6 cursor-pointer hover:ring-2 hover:ring-violet-500 transition-all"
                  onClick={() => setSelectedExamId(exam.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <FileText size={24} className="text-violet-500" />
                    <Badge>{count} Submissions</Badge>
                  </div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{exam.title}</h3>
                  <p className="text-sm text-gray-500">Click to review</p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Student List View
  if (!selectedSessionId) {
    const exam = exams.find(e => e.id === selectedExamId);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedExamId(null)}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{exam?.title}</h2>
            <p className="text-gray-500">{examSessions.length} submissions</p>
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="p-4 text-left font-semibold">Student</th>
                  <th className="p-4 text-left font-semibold">Student ID</th>
                  <th className="p-4 text-left font-semibold">Status</th>
                  <th className="p-4 text-left font-semibold">Score</th>
                  <th className="p-4 text-left font-semibold">Submitted</th>
                  <th className="p-4 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {examSessions.map(session => {
                  const student = users.find(u => u.id === session.studentId);
                  return (
                    <tr key={`${session.studentId}_${session.examId}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-4 font-medium text-gray-900 dark:text-white">
                        {student?.name || session.studentId}
                      </td>
                      <td className="p-4 text-gray-500 font-mono text-xs">
                        {student?.studentId || student?.email}
                      </td>
                      <td className="p-4">
                        <Badge color={session.status === 'COMPLETED' ? 'emerald' : 'blue'}>
                          {session.status}
                        </Badge>
                      </td>
                      <td className="p-4 font-mono">
                        {session.score !== undefined ? `${session.score} pts` : 'Pending'}
                      </td>
                      <td className="p-4 text-gray-500 text-xs">
                        {session.submitTime ? new Date(session.submitTime).toLocaleString() : '-'}
                      </td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedSessionId(`${session.studentId}_${session.examId}`)}
                        >
                          View Submission
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // Detailed Submission View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setSelectedSessionId(null)}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {selectedStudent?.name}
            </h2>
            <p className="text-gray-500">
              {selectedStudent?.studentId || selectedStudent?.email} • {selectedExam?.title}
            </p>
          </div>
        </div>
        <Button onClick={handleExportPDF} className="gap-2">
          <Download size={18} /> Export PDF
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Submitted</p>
            <p className="font-bold text-gray-900 dark:text-white">
              {selectedSession.submitTime ? new Date(selectedSession.submitTime).toLocaleString() : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Score</p>
            <p className="font-bold text-gray-900 dark:text-white">
              {selectedSession.score !== undefined ? `${selectedSession.score} points` : 'Not graded'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Violations</p>
            <p className="font-bold text-gray-900 dark:text-white">
              {selectedSession.violations?.length || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Files Uploaded</p>
            <p className="font-bold text-gray-900 dark:text-white">
              {selectedSession.uploadedFiles?.length || 0}
            </p>
          </div>
        </div>
      </Card>

      {/* Answers */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Answers</h3>
        {selectedExam?.questions.map((question, idx) => {
          const answer = selectedSession.answers[question.id];
          const score = selectedSession.questionScores?.[question.id];
          
          return (
            <Card key={question.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge>Question {idx + 1}</Badge>
                    <span className="text-sm text-gray-500">{question.points} points</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{question.text}</h4>
                </div>
                {score !== undefined && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Score</p>
                    <p className="text-2xl font-bold text-violet-600">{score}/{question.points}</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border-l-4 border-violet-500">
                <p className="text-sm text-gray-500 mb-2 font-semibold">Student Answer:</p>
                {answer ? (
                  Array.isArray(answer) ? (
                    <div className="space-y-1">
                      {answer.map((a, i) => (
                        <div key={i} className="text-gray-900 dark:text-white">• {a}</div>
                      ))}
                    </div>
                  ) : (
                    <div 
                      className="prose dark:prose-invert max-w-none text-gray-900 dark:text-white"
                      dangerouslySetInnerHTML={{ __html: answer }}
                    />
                  )
                ) : (
                  <p className="text-gray-400 italic">No answer provided</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Uploaded Files */}
      {selectedSession.uploadedFiles && selectedSession.uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Uploaded Files</h3>
          <Card className="p-6">
            <div className="space-y-3">
              {selectedSession.uploadedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center text-violet-600">
                      <FileIcon size={24}/>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {file.type} • {(file.size / 1024 / 1024).toFixed(2)} MB • 
                        Uploaded {new Date(file.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => window.open(file.url, '_blank')}
                    className="gap-2"
                  >
                    <Download size={16} /> Download
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
