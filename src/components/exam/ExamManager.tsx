import React, { useState } from 'react';
import { PlusCircle, Key, Edit2, Trash2, X, Download, ClipboardCheck, CheckCircle } from 'lucide-react';
import { Exam } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ExamWizard } from './ExamWizard';

export const ExamManager = () => {
  const { exams, programs, deleteExam, users } = useApp();
  const [view, setView] = useState<'LIST' | 'CREATE' | 'EDIT'>('LIST');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [viewKeysExam, setViewKeysExam] = useState<Exam | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyList = () => {
    if (!viewKeysExam) return;

    const lines = ["Student Name\tID\tEmail\tAccess Code"];
    viewKeysExam.assignedStudents.forEach(sid => {
      const student = users.find(u => u.id === sid);
      const code = viewKeysExam.studentCredentials[sid];
      
      // Sanitize fields to remove tabs or newlines that would break formatting
      const clean = (str: string) => str.replace(/[\t\n\r]+/g, " ").trim();
      
      const name = clean(student?.name || 'Unknown');
      const id = clean(student?.studentId || 'N/A');
      const email = clean(student?.email || 'N/A');
      const accessCode = clean(code || 'N/A');
      
      lines.push(`${name}\t${id}\t${email}\t${accessCode}`);
    });

    const textToCopy = lines.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownloadExcel = () => {
    if (!viewKeysExam) return;
    
    // CSV Header
    let csvContent = "Student Name,ID,Email,Access Code\n";
    
    viewKeysExam.assignedStudents.forEach(sid => {
      const student = users.find(u => u.id === sid);
      const code = viewKeysExam.studentCredentials[sid];
      
      // Robust CSV Escaping
      const escape = (str: string) => {
        if (!str) return "N/A";
        // If contains comma, quote, or newline, wrap in quotes and escape inner quotes
        if (str.search(/[, "\n]/g) >= 0) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const name = escape(student?.name || "Unknown");
      const id = escape(student?.studentId || "N/A");
      const email = escape(student?.email || "N/A");
      const accessCode = escape(code || "N/A");
      
      csvContent += `${name},${id},${email},${accessCode}\n`;
    });
    
    // Add BOM for Excel UTF-8 compatibility
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${viewKeysExam.title.replace(/[\s\W]+/g, '_')}_credentials.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure? This cannot be undone.')) {
      await deleteExam(id);
    }
  }

  if (view === 'LIST') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Exam Management</h2>
          <Button onClick={() => { setSelectedExam(null); setView('CREATE'); }}>
            <PlusCircle size={18}/> Create New Exam
          </Button>
        </div>

        <Card noPadding>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 uppercase">Title</th>
                <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 uppercase">Module</th>
                <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 uppercase">Scheduled</th>
                <th className="p-3 md:p-5 text-left text-xs font-bold text-gray-500 uppercase">Candidates</th>
                <th className="p-3 md:p-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {exams.map(exam => {
                const module = programs.flatMap(p => p.modules).find(m => m.id === exam.moduleId);
                return (
                  <tr key={exam.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="p-3 md:p-5 font-medium text-gray-900 dark:text-white">{exam.title}</td>
                    <td className="p-3 md:p-5 text-gray-600 dark:text-gray-400"><Badge color="slate">{module?.code}</Badge></td>
                    <td className="p-3 md:p-5">
                      {exam.status === 'PUBLISHED' ? <Badge color="green">Active</Badge> : <Badge color="amber">Draft</Badge>}
                    </td>
                    <td className="p-3 md:p-5 text-sm text-gray-500">
                      {exam.scheduledStart ? new Date(exam.scheduledStart).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-3 md:p-5 text-sm font-bold">{exam.assignedStudents.length}</td>
                    <td className="p-3 md:p-5 flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setViewKeysExam(exam)} title="View Access Keys"><Key size={14}/></Button>
                      <Button size="sm" variant="secondary" onClick={() => { setSelectedExam(exam); setView('EDIT'); }}><Edit2 size={14}/></Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(exam.id)}><Trash2 size={14}/></Button>
                    </td>
                  </tr>
                );
              })}
              {exams.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400">No exams created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </Card>

        {viewKeysExam && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Access Credentials</h3>
                <button onClick={() => setViewKeysExam(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"><X size={24} /></button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="mb-4 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl text-sm text-violet-800 dark:text-violet-300">
                   <strong>Exam:</strong> {viewKeysExam.title} <br/>
                   <strong>Total Candidates:</strong> {viewKeysExam.assignedStudents.length}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 uppercase font-bold text-xs">
                    <tr>
                      <th className="p-3 text-left">Student Name</th>
                      <th className="p-3 text-left">ID</th>
                      <th className="p-3 text-left">Email</th>
                      <th className="p-3 text-right">Access Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {viewKeysExam.assignedStudents.map(sid => {
                      const student = users.find(u => u.id === sid);
                      const code = viewKeysExam.studentCredentials[sid];
                      return (
                        <tr key={sid}>
                          <td className="p-3 font-medium text-gray-900 dark:text-white">{student?.name}</td>
                          <td className="p-3 text-gray-500">{student?.studentId}</td>
                          <td className="p-3 text-gray-500">{student?.email}</td>
                          <td className="p-3 text-right font-mono text-lg font-bold tracking-widest text-violet-600 dark:text-violet-400 select-all">
                            {code || "N/A"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={handleCopyList}>
                    {isCopied ? <CheckCircle size={16} className="text-emerald-500" /> : <ClipboardCheck size={16}/>} 
                    {isCopied ? 'Copied!' : 'Copy List'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleDownloadExcel}>
                    <Download size={16}/> Download CSV
                  </Button>
                </div>
                <Button onClick={() => setViewKeysExam(null)}>Close</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <ExamWizard 
      exam={selectedExam} 
      onCancel={() => setView('LIST')} 
      onSuccess={() => setView('LIST')} 
    />
  );
};
