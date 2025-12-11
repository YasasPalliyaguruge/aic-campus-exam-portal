import React, { useState } from 'react';
import { Download, FileText, ArrowLeft, File as FileIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Exam, StudentSession, User } from '../../types';

export const StudentReview = () => {
  const { exams, sessions, users, programs } = useApp();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Filter submitted/completed sessions
  const completedSessions = sessions.filter(s => s.status === 'SUBMITTED' || s.status === 'COMPLETED');

  // Get sessions for selected exam
  const examSessions = selectedExamId 
    ? completedSessions.filter(s => s.examId === selectedExamId)
    : [];

  // Find selected session from completedSessions (not all sessions)
  const selectedSession = selectedSessionId 
    ? completedSessions.find(s => `${s.studentId}_${s.examId}` === selectedSessionId)
    : null;

  // Find the exam - use selectedExamId first, fallback to session's examId
  const selectedExam = selectedExamId
    ? exams.find(e => e.id === selectedExamId)
    : selectedSession 
      ? exams.find(e => e.id === selectedSession.examId)
      : null;

  // Get student info - try multiple sources
  const getStudentInfo = () => {
    if (!selectedSession) return null;
    
    // 1. Try to find in users array
    const userFromList = users.find(u => u.id === selectedSession.studentId);
    if (userFromList) return userFromList;
    
    // 2. Try to find using studentId field that might be different
    const userByStudentId = users.find(u => u.studentId === selectedSession.studentId);
    if (userByStudentId) return userByStudentId;
    
    // 3. Look up from exam's assignedStudents and find matching user
    if (selectedExam) {
      for (const assignedId of selectedExam.assignedStudents || []) {
        const assignedUser = users.find(u => u.id === assignedId);
        if (assignedUser) {
          // Check if this user's credential matches the session
          const code = selectedExam.studentCredentials?.[assignedId];
          if (code) {
            // This could be the right student - return it
            return assignedUser;
          }
        }
      }
    }
    
    // 4. Create a minimal fallback from session ID
    // Extract student ID from session ID format: u_{studentId}_exam_{examId}
    const sessionIdParts = selectedSession.id?.split('_exam_');
    const extractedStudentId = sessionIdParts?.[0]?.replace('u_', '') || selectedSession.studentId;
    
    return {
      id: selectedSession.studentId,
      name: `Student ${extractedStudentId}`,
      email: 'N/A',
      studentId: extractedStudentId,
      role: 'STUDENT' as any
    };
  };

  const selectedStudent = getStudentInfo();

  // PDF Export Function - Professional Answer Script with Logo, Module, Program
  const handleExportPDF = async () => {
    // Debug logging to identify the issue
    console.log('PDF Export - Session:', selectedSession);
    console.log('PDF Export - Exam:', selectedExam);
    console.log('PDF Export - Student:', selectedStudent);
    
    if (!selectedSession || !selectedExam) {
      console.error('Missing data for PDF export:', { selectedSession, selectedExam, selectedStudent });
      alert('Unable to export PDF. Missing session or exam data. Please refresh the page and try again.');
      return;
    }

    // Simple HTML to PDF conversion
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups for PDF export and try again.');
      return;
    }

    // Find module and program info
    let moduleName = 'N/A';
    let moduleCode = 'N/A';
    let programName = 'N/A';
    
    if (selectedExam.moduleId && programs) {
      for (const program of programs) {
        const module = program.modules?.find(m => m.id === selectedExam.moduleId);
        if (module) {
          moduleName = module.name;
          moduleCode = module.code;
          programName = program.name;
          break;
        }
      }
    }

    const totalPoints = selectedExam.questions.reduce((sum, q) => sum + q.points, 0);
    const scorePercentage = selectedSession.score !== undefined 
      ? Math.round((selectedSession.score / totalPoints) * 100) 
      : null;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Answer Script - ${selectedStudent?.name || 'Unknown Student'} - ${selectedExam.title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          
          * { box-sizing: border-box; margin: 0; padding: 0; }
          
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            padding: 30px 40px; 
            max-width: 900px; 
            margin: 0 auto; 
            color: #1f2937;
            line-height: 1.6;
            background: white;
          }
          
          /* ========== HEADER SECTION ========== */
          .header {
            text-align: center;
            margin-bottom: 35px;
            padding-bottom: 25px;
            border-bottom: 4px solid #7c3aed;
            background: linear-gradient(135deg, #faf5ff 0%, #f0f9ff 100%);
            margin: -30px -40px 35px -40px;
            padding: 30px 40px 25px;
          }
          
          .logo-container {
            margin-bottom: 20px;
          }
          
          .logo-container img {
            height: 80px;
            width: auto;
            margin-bottom: 10px;
          }
          
          .institution-name {
            font-size: 32px;
            font-weight: 800;
            background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: 3px;
            margin-bottom: 5px;
          }
          
          .tagline {
            color: #6b7280;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 4px;
            font-weight: 600;
          }
          
          .document-title {
            font-size: 26px;
            font-weight: 700;
            color: #1f2937;
            margin: 25px 0 15px;
            letter-spacing: 1px;
          }
          
          .exam-info {
            margin-top: 15px;
          }
          
          .exam-title {
            font-size: 20px;
            color: #374151;
            font-weight: 600;
            margin-bottom: 8px;
          }
          
          .module-program {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
            margin-top: 12px;
          }
          
          .info-badge {
            background: white;
            padding: 8px 20px;
            border-radius: 25px;
            font-size: 12px;
            font-weight: 600;
            color: #4b5563;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border: 1px solid #e5e7eb;
          }
          
          .info-badge strong {
            color: #7c3aed;
          }
          
          /* ========== STUDENT INFO SECTION ========== */
          .student-section {
            background: linear-gradient(135deg, #faf5ff 0%, #fef3c7 50%, #dbeafe 100%);
            border-radius: 16px;
            padding: 25px 30px;
            margin-bottom: 30px;
            border: 2px solid #e5e7eb;
          }
          
          .student-main {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 20px;
          }
          
          .student-identity h2 {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 8px;
          }
          
          .student-id-box {
            display: inline-block;
            background: #1f2937;
            color: white;
            padding: 8px 20px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 1px;
          }
          
          .submission-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-top: 20px;
          }
          
          .stat-card {
            background: white;
            padding: 15px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            border: 1px solid #f3f4f6;
          }
          
          .stat-card label {
            display: block;
            font-size: 10px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 6px;
            font-weight: 600;
          }
          
          .stat-card .value {
            font-size: 18px;
            font-weight: 700;
            color: #1f2937;
          }
          
          .stat-card .value.pass { color: #059669; }
          .stat-card .value.fail { color: #dc2626; }
          .stat-card .value.pending { color: #d97706; }
          
          /* ========== ANSWERS SECTION ========== */
          .answers-header {
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
            margin: 35px 0 20px;
            padding-bottom: 12px;
            border-bottom: 3px solid #7c3aed;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .answers-header::before {
            content: '📝';
            font-size: 24px;
          }
          
          .question-card {
            margin-bottom: 25px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            border: 1px solid #e5e7eb;
            page-break-inside: avoid;
          }
          
          .question-header {
            background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .question-num {
            background: rgba(255,255,255,0.2);
            padding: 6px 14px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 14px;
          }
          
          .question-meta {
            display: flex;
            gap: 15px;
            align-items: center;
          }
          
          .question-type {
            font-size: 11px;
            text-transform: uppercase;
            opacity: 0.9;
            letter-spacing: 1px;
          }
          
          .question-points {
            background: rgba(255,255,255,0.25);
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 13px;
          }
          
          .question-body {
            padding: 20px;
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .question-text {
            font-size: 15px;
            font-weight: 500;
            color: #1f2937;
            line-height: 1.7;
          }
          
          .answer-box {
            padding: 20px;
            background: #fffbeb;
          }
          
          .answer-label {
            font-size: 11px;
            color: #92400e;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 10px;
            font-weight: 700;
          }
          
          .answer-text {
            font-size: 14px;
            color: #1f2937;
            line-height: 1.8;
            background: white;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
          }
          
          .answer-text p { margin-bottom: 10px; }
          .answer-text ul, .answer-text ol { margin-left: 20px; margin-bottom: 10px; }
          
          .no-answer {
            color: #9ca3af;
            font-style: italic;
            padding: 15px;
            background: #f3f4f6;
            border-radius: 8px;
            text-align: center;
          }
          
          /* ========== FILES SECTION ========== */
          .files-section {
            margin-top: 35px;
            background: #eff6ff;
            border-radius: 16px;
            padding: 25px;
            border: 2px solid #bfdbfe;
          }
          
          .files-header {
            font-size: 18px;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .files-header::before {
            content: '📎';
            font-size: 20px;
          }
          
          .file-item {
            background: white;
            padding: 12px 18px;
            border-radius: 10px;
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid #dbeafe;
          }
          
          .file-name {
            font-weight: 600;
            color: #1f2937;
          }
          
          .file-meta {
            font-size: 12px;
            color: #6b7280;
          }
          
          .files-note {
            margin-top: 15px;
            font-size: 12px;
            color: #6b7280;
            font-style: italic;
            text-align: center;
          }
          
          /* ========== FOOTER ========== */
          .footer {
            margin-top: 45px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
          }
          
          .footer p {
            color: #9ca3af;
            font-size: 11px;
            margin-bottom: 5px;
          }
          
          .footer .brand {
            font-weight: 700;
            color: #7c3aed;
          }
          
          /* ========== PRINT STYLES ========== */
          @media print {
            body { padding: 15px 25px; }
            .header { margin: -15px -25px 30px -25px; padding: 20px 25px; }
            .question-card { page-break-inside: avoid; }
            .student-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <!-- HEADER -->
        <div class="header">
          <div class="logo-container">
            <img src="/images/AIC_Campus_Logo.png" alt="AIC Campus Logo" onerror="this.style.display='none'" />
            <div class="institution-name">AIC CAMPUS</div>
          </div>
          
          <div class="document-title">📄 ANSWER SCRIPT</div>
          
          <div class="exam-info">
            <div class="exam-title">${selectedExam.title}</div>
            <div class="module-program">
              <span class="info-badge"><strong>Module:</strong> ${moduleCode} - ${moduleName}</span>
              <span class="info-badge"><strong>Program:</strong> ${programName}</span>
            </div>
          </div>
        </div>

        <!-- STUDENT INFORMATION -->
        <div class="student-section">
          <div class="student-main">
            <div class="student-identity">
              <h2>${selectedStudent?.name || 'Unknown Student'}</h2>
              <div class="student-id-box">ID: ${selectedStudent?.studentId || selectedStudent?.email || 'N/A'}</div>
            </div>
          </div>
          
          <div class="submission-stats">
            <div class="stat-card">
              <label>📅 Date Submitted</label>
              <div class="value">${selectedSession.submitTime ? new Date(selectedSession.submitTime).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div class="stat-card">
              <label>⏰ Time</label>
              <div class="value">${selectedSession.submitTime ? new Date(selectedSession.submitTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}</div>
            </div>
            <div class="stat-card">
              <label>📊 Score</label>
              <div class="value ${scorePercentage !== null ? (scorePercentage >= 50 ? 'pass' : 'fail') : 'pending'}">${selectedSession.score !== undefined ? selectedSession.score : '-'} / ${totalPoints}</div>
            </div>
            <div class="stat-card">
              <label>📈 Percentage</label>
              <div class="value ${scorePercentage !== null ? (scorePercentage >= 50 ? 'pass' : 'fail') : 'pending'}">${scorePercentage !== null ? scorePercentage + '%' : 'Pending'}</div>
            </div>
          </div>
        </div>

        <!-- ANSWERS -->
        <div class="answers-header">Student Answers</div>
        
        ${selectedExam.questions.map((q, idx) => {
          const answer = selectedSession.answers[q.id];
          const formattedAnswer = answer 
            ? (Array.isArray(answer) 
                ? answer.join(', ') 
                : String(answer))
            : null;
          
          return `
          <div class="question-card">
            <div class="question-header">
              <span class="question-num">Question ${idx + 1}</span>
              <div class="question-meta">
                <span class="question-type">${q.type.replace('_', ' ')}</span>
                <span class="question-points">${q.points} pts</span>
              </div>
            </div>
            <div class="question-body">
              <div class="question-text">${q.text}</div>
            </div>
            <div class="answer-box">
              <div class="answer-label">✍️ Student's Response</div>
              ${formattedAnswer 
                ? `<div class="answer-text">${formattedAnswer}</div>`
                : '<div class="no-answer">No answer provided</div>'}
            </div>
          </div>
        `}).join('')}

        ${selectedSession.uploadedFiles && selectedSession.uploadedFiles.length > 0 ? `
          <div class="files-section">
            <div class="files-header">Uploaded Files</div>
            ${selectedSession.uploadedFiles.map((file, idx) => `
              <div class="file-item">
                <span class="file-name">${idx + 1}. ${file.name}</span>
                <span class="file-meta">${file.type} • ${(file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            `).join('')}
            <p class="files-note">Note: Files cannot be embedded in PDF. Download separately from the web interface.</p>
          </div>
        ` : ''}

        <!-- FOOTER -->
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p><span class="brand">AIC Campus</span> Exam Portal • Official Answer Script</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 800);
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
                  const student = users.find(u => u.id === session.studentId) || 
                                  users.find(u => u.studentId === session.studentId);
                  
                  // Extract clean student ID from session ID if needed
                  const sessionIdParts = session.id?.split('_exam_');
                  const extractedStudentId = sessionIdParts?.[0]?.replace('u_', '') || session.studentId;
                  
                  const displayName = student?.name || `Student ${extractedStudentId}`;
                  const displayId = student?.studentId || student?.email || extractedStudentId;
                  
                  return (
                    <tr key={`${session.studentId}_${session.examId}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-4 font-medium text-gray-900 dark:text-white">
                        {displayName}
                      </td>
                      <td className="p-4 text-gray-500 font-mono text-xs">
                        {displayId}
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
                  <div 
                    className="font-semibold text-gray-900 dark:text-white mb-4 rich-text-content [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: question.text }}
                  />
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
                      className="prose dark:prose-invert max-w-none text-gray-900 dark:text-white [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>br]:block [&>div]:mb-2"
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
