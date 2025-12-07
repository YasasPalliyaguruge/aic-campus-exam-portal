import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, PlusCircle, Edit2, Trash2, Save, CheckSquare, Circle, X, BookOpen, Clock, FileText, CheckCircle, Users, Calendar, ClipboardCheck, Key, GripVertical, Upload, File } from 'lucide-react';
import { Exam, Question, QuestionType, UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { Badge } from '../ui/Badge';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

export const ExamWizard = ({ exam, onCancel, onSuccess }: { exam?: Exam | null, onCancel: () => void, onSuccess: () => void }) => {
  const { addExam, programs, users, isLoading } = useApp();
  
  // Wizard State
  const [step, setStep] = useState(1); // 1: Draft, 2: Review, 3: Schedule & Assign, 4: Success
  
  // Step 1: Question State
  const [manualQText, setManualQText] = useState('');
  const [manualQType, setManualQType] = useState<QuestionType>(QuestionType.MCQ);
  const [manualQPoints, setManualQPoints] = useState(10);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Exam Data State
  const [newExam, setNewExam] = useState<Partial<Exam>>(exam || {
    title: '', moduleId: '', durationMinutes: 60, questions: [], status: 'DRAFT', assignedStudents: [], studentCredentials: {},
    allowsFileUpload: false, allowedFileTypes: ['.pdf', '.docx', '.pptx'], maxFileCount: 1
  });
  
  const [createdExam, setCreatedExam] = useState<Exam | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file.');
        return;
      }
      
      setIsUploading(true);
      try {
        const storageRef = ref(storage, `exam-resources/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        setNewExam(prev => ({ ...prev, referenceDocumentUrl: url }));
        console.log('✅ File uploaded:', url);
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload file. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Reset question form when type changes
  useEffect(() => {
    if (manualQType === QuestionType.TRUE_FALSE) {
      setCurrentOptions(['True', 'False']);
      setCorrectAnswers(['True']);
    } else if (manualQType !== QuestionType.MCQ && manualQType !== QuestionType.MULTI_SELECT) {
      setCurrentOptions([]);
      setCorrectAnswers([]);
    } else {
       setCorrectAnswers([]);
    }
    setNewOptionInput('');
  }, [manualQType]);

  const addOption = () => {
    if (newOptionInput.trim()) {
      setCurrentOptions([...currentOptions, newOptionInput.trim()]);
      setNewOptionInput('');
    }
  };

  const removeOption = (idx: number) => {
    const optToRemove = currentOptions[idx];
    setCurrentOptions(currentOptions.filter((_, i) => i !== idx));
    setCorrectAnswers(correctAnswers.filter(a => a !== optToRemove));
  };

  const toggleCorrectAnswer = (opt: string) => {
    if (manualQType === QuestionType.MULTI_SELECT) {
      if (correctAnswers.includes(opt)) {
        setCorrectAnswers(correctAnswers.filter(a => a !== opt));
      } else {
        setCorrectAnswers([...correctAnswers, opt]);
      }
    } else {
      setCorrectAnswers([opt]);
    }
  };

  const handleAddManual = () => {
    if (!manualQText.trim()) {
      alert("Please enter the question text.");
      return;
    }
    if ((manualQType === QuestionType.MCQ || manualQType === QuestionType.MULTI_SELECT) && currentOptions.length < 2) {
      alert("Please add at least 2 options.");
      return;
    }
    if ((manualQType !== QuestionType.ESSAY && manualQType !== QuestionType.SHORT_ANSWER) && correctAnswers.length === 0) {
      alert("Please select a correct answer.");
      return;
    }

    const q: Question = {
      id: `q_${Date.now()}`,
      text: manualQText,
      type: manualQType,
      points: manualQPoints,
      options: (manualQType === QuestionType.ESSAY || manualQType === QuestionType.SHORT_ANSWER) ? undefined : currentOptions,
      correctAnswer: manualQType === QuestionType.MULTI_SELECT ? correctAnswers : correctAnswers[0]
    };

    setNewExam(prev => ({ ...prev, questions: [...(prev.questions || []), q] }));
    
    // Reset Form
    setManualQText('');
    setCurrentOptions([]);
    setCorrectAnswers([]);
    if (manualQType === QuestionType.MCQ) setManualQType(QuestionType.MCQ);
  };

  const handleDeleteQuestion = (qId: string) => {
    setNewExam(prev => ({...prev, questions: prev.questions?.filter(q => q.id !== qId)}));
  };

  const handleEditQuestion = (q: Question) => {
    // Populate form
    setManualQText(q.text);
    setManualQType(q.type);
    setManualQPoints(q.points);
    setCurrentOptions(q.options || []);
    setCorrectAnswers(Array.isArray(q.correctAnswer) ? q.correctAnswer : (q.correctAnswer ? [q.correctAnswer] : []));
    
    // Remove from list (simulates edit by remove + re-add)
    handleDeleteQuestion(q.id);
    setStep(1); // Go back to editor
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === index) return;
    
    const questions = [...(newExam.questions || [])];
    const draggedItem = questions[draggedIndex];
    
    // Remove from old position
    questions.splice(draggedIndex, 1);
    // Insert at new position
    questions.splice(index, 0, draggedItem);
    
    setNewExam(prev => ({ ...prev, questions }));
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const generateAccessCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  // Helper to recursively remove undefined values
  const removeUndefined = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefined(item));
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, removeUndefined(value)])
      );
    }
    return obj;
  };

  const handlePublish = async () => {
    if (!newExam.scheduledStart || !newExam.scheduledEnd || newExam.assignedStudents?.length === 0) {
      alert("Please schedule the exam and assign at least one student.");
      return;
    }

    // Generate credentials
    const credentials: Record<string, string> = {};
    newExam.assignedStudents?.forEach(sid => {
      credentials[sid] = generateAccessCode();
    });

    // Build exam object with proper defaults
    const examData = {
      id: exam?.id || `exam_${Date.now()}`,
      title: newExam.title || '',
      moduleId: newExam.moduleId || '',
      durationMinutes: newExam.durationMinutes || 60,
      passThreshold: newExam.passThreshold || 50,
      questions: newExam.questions || [],
      status: 'PUBLISHED' as const,
      assignedStudents: newExam.assignedStudents || [],
      studentCredentials: credentials,
      scheduledStart: newExam.scheduledStart || '',
      scheduledEnd: newExam.scheduledEnd || '',
      createdAt: newExam.createdAt || new Date().toISOString()
    };

    // Remove ALL undefined values recursively (including in questions)
    const cleanExamData = removeUndefined({
        ...examData,
        referenceDocumentUrl: newExam.referenceDocumentUrl, // Ensure this is included
        allowsFileUpload: newExam.allowsFileUpload,
        allowedFileTypes: newExam.allowsFileUpload ? newExam.allowedFileTypes : undefined,
        maxFileCount: newExam.allowsFileUpload ? newExam.maxFileCount : undefined
    }) as Exam;

    console.log('📤 Publishing exam:', cleanExamData);

    await addExam(cleanExamData);
    setCreatedExam(cleanExamData);
    setStep(4);
  };

  const allStudents = users.filter(u => u.role === UserRole.STUDENT);
  const selectedModule = programs.flatMap(p => p.modules).find(m => m.id === newExam.moduleId);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{exam ? 'Edit Exam' : 'Create New Exam'}</h2>
          <p className="text-gray-500 dark:text-gray-400">Step {step} of 4</p>
        </div>
        {step < 4 && (
          <div className="flex items-center gap-4">
             <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-2 w-12 rounded-full transition-colors ${step >= s ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STEP 1: DRAFTING */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
             <Card>
               <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">1. Basic Details</h3>
               <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Exam Title</label>
                    <Input 
                      value={newExam.title} 
                      onChange={(e: any) => setNewExam({...newExam, title: e.target.value})} 
                      placeholder="e.g. Midterm Calculus" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Module</label>
                    <Select value={newExam.moduleId} onChange={(e: any) => setNewExam({...newExam, moduleId: e.target.value})}>
                      <option value="">Select Module</option>
                      {programs.flatMap(p => p.modules).map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Duration (Minutes)</label>
                    <Input type="number" value={newExam.durationMinutes} onChange={(e: any) => setNewExam({...newExam, durationMinutes: Number(e.target.value)})} />
                  </div>
               </div>
             </Card>

             <Card>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Upload size={20} className="text-violet-500"/> Submission Settings
                </h3>
                <div className="space-y-4">
                   <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <input 
                        type="checkbox" 
                        id="allowUpload"
                        checked={newExam.allowsFileUpload || false}
                        onChange={(e) => setNewExam({...newExam, allowsFileUpload: e.target.checked})}
                        className="w-5 h-5 text-violet-600 rounded focus:ring-violet-500"
                      />
                      <label htmlFor="allowUpload" className="font-medium text-gray-900 dark:text-white cursor-pointer select-none">
                        Enable File Uploads (e.g. Presentations, Reports)
                      </label>
                   </div>

                   {newExam.allowsFileUpload && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Allowed File Types</label>
                          <Input 
                            placeholder=".pdf, .docx, .pptx" 
                            value={newExam.allowedFileTypes?.join(', ')}
                            onChange={(e: any) => setNewExam({...newExam, allowedFileTypes: e.target.value.split(',').map((t:string)=>t.trim())})}
                          />
                          <p className="text-xs text-gray-500 mt-1">Comma separated (e.g. .pdf, .docx)</p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Max Files per Student</label>
                          <Input 
                            type="number" 
                            min={1} 
                            max={5}
                            value={newExam.maxFileCount || 1}
                            onChange={(e: any) => setNewExam({...newExam, maxFileCount: Number(e.target.value)})}
                          />
                        </div>
                     </div>
                   )}
                </div>
             </Card>

             <Card>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <FileText size={20} className="text-violet-500"/> Case Study / Reference Document
                </h3>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative">
                    <input 
                      type="file" 
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={isUploading}
                    />
                    <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                      {isUploading ? (
                        <>
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                          <p>Uploading...</p>
                        </>
                      ) : newExam.referenceDocumentUrl ? (
                        <>
                          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={24} />
                          </div>
                          <p className="font-medium text-emerald-600 dark:text-emerald-400">Document Attached</p>
                          <p className="text-xs break-all">{newExam.referenceDocumentUrl}</p>
                          <p className="text-xs mt-2 text-gray-400">Click to replace</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center text-violet-600 dark:text-violet-400">
                            <Upload size={24} />
                          </div>
                          <p className="font-medium">Click to upload PDF</p>
                          <p className="text-xs">Max size: 10MB</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
             </Card>
          </div>
          
          <div className="space-y-6">
            <Card className="sticky top-6 border-violet-200 dark:border-violet-900/50 shadow-lg shadow-violet-500/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Questions Added ({newExam.questions?.length})</h3>
                <Button variant="secondary" size="sm" onClick={() => setStep(2)} disabled={!newExam.questions?.length}>
                  Next: Review & Edit <ArrowRight size={16} />
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">💡 Drag and drop to reorder questions</p>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {newExam.questions?.map((q, idx) => (
                  <div 
                    key={q.id} 
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg flex justify-between items-center cursor-move hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ${draggedIndex === idx ? 'opacity-50 scale-95' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical size={16} className="text-gray-400" />
                      <span className="w-6 h-6 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400">{idx + 1}</span>
                      <Badge>{q.type}</Badge>
                      <span className="text-sm font-medium truncate max-w-md dark:text-gray-300">{q.text}</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <span className="text-xs font-bold text-gray-500">{q.points} pts</span>
                       <button onClick={() => handleEditQuestion(q)} className="text-violet-500 hover:text-violet-700"><Edit2 size={14}/></button>
                       <button onClick={() => handleDeleteQuestion(q.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
                {!newExam.questions?.length && <p className="text-sm text-gray-400 text-center py-4">No questions added yet.</p>}
              </div>
             </Card>
          </div>
          
          <div className="space-y-6">
            <Card className="sticky top-6 border-violet-200 dark:border-violet-900/50 shadow-lg shadow-violet-500/10">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <PlusCircle size={20} className="text-violet-500"/> Add Question
              </h3>
              <div className="space-y-4">
                <Select value={manualQType} onChange={(e: any) => setManualQType(e.target.value as QuestionType)}>
                    <option value={QuestionType.MCQ}>Multiple Choice (Single)</option>
                    <option value={QuestionType.MULTI_SELECT}>Multiple Choice (Multiple)</option>
                    <option value={QuestionType.TRUE_FALSE}>True / False</option>
                    <option value={QuestionType.SHORT_ANSWER}>Short Answer</option>
                    <option value={QuestionType.ESSAY}>Essay</option>
                 </Select>
                 
                 <TextArea className="h-24 text-sm" placeholder="Question text..." value={manualQText} onChange={(e: any) => setManualQText(e.target.value)} />
                 
                 {(manualQType === QuestionType.MCQ || manualQType === QuestionType.MULTI_SELECT) && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="space-y-2 mb-2">
                        {currentOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <button onClick={() => toggleCorrectAnswer(opt)} className={`p-1 ${correctAnswers.includes(opt) ? 'text-emerald-500' : 'text-gray-300'}`}>
                              {manualQType === QuestionType.MULTI_SELECT ? <CheckSquare size={16}/> : <Circle size={16} fill={correctAnswers.includes(opt) ? "currentColor" : "none"}/>}
                            </button>
                            <span className="flex-1 truncate dark:text-gray-300">{opt}</span>
                            <button onClick={() => removeOption(idx)} className="text-gray-400 hover:text-red-500"><X size={14}/></button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input className="py-1 text-sm" placeholder="Option..." value={newOptionInput} onChange={(e:any) => setNewOptionInput(e.target.value)} onKeyDown={(e:any) => e.key === 'Enter' && addOption()} />
                        <Button size="sm" onClick={addOption}>Add</Button>
                      </div>
                    </div>
                 )}

                 {manualQType === QuestionType.TRUE_FALSE && (
                    <div className="flex gap-2">
                      {['True', 'False'].map(opt => (
                        <button key={opt} onClick={() => setCorrectAnswers([opt])} className={`flex-1 py-2 rounded-lg border text-sm font-bold ${correctAnswers.includes(opt) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>{opt}</button>
                      ))}
                    </div>
                 )}

                 <div className="flex items-center gap-2">
                   <span className="text-xs font-bold uppercase text-gray-500">Points:</span>
                   <Input type="number" className="py-1 w-20" value={manualQPoints} onChange={(e: any) => setManualQPoints(Number(e.target.value))} />
                 </div>

                 <Button className="w-full" onClick={handleAddManual}>Add to Exam</Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW */}
      {step === 2 && (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4">
          <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back to Edit</Button>
            <h2 className="text-xl font-bold dark:text-white">2. Review Exam Content</h2>
            <Button onClick={() => setStep(3)}>Next: Schedule <ArrowRight size={16}/></Button>
          </div>
          
          <Card className="mb-6 bg-violet-50 dark:bg-violet-900/10 border-violet-200 dark:border-violet-800">
             <h3 className="font-bold text-violet-900 dark:text-violet-100 text-2xl mb-2">{newExam.title}</h3>
             <div className="flex gap-6 text-violet-700 dark:text-violet-300 text-sm font-medium">
                <span className="flex items-center gap-2"><BookOpen size={16}/> {selectedModule?.code}</span>
                <span className="flex items-center gap-2"><Clock size={16}/> {newExam.durationMinutes} Minutes</span>
                <span className="flex items-center gap-2"><FileText size={16}/> {newExam.questions?.length} Questions</span>
                <span className="flex items-center gap-2"><CheckCircle size={16}/> {newExam.questions?.reduce((a,b)=>a+b.points,0)} Total Points</span>
             </div>
          </Card>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">💡 Drag and drop to reorder questions</p>

          <div className="space-y-6">
            {newExam.questions?.map((q, idx) => (
              <Card 
                key={q.id} 
                className="relative group"
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
              >
                <div className={`transition-all ${draggedIndex === idx ? 'opacity-50 scale-95' : ''}`}>
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button size="sm" variant="secondary" onClick={() => handleEditQuestion(q)}><Edit2 size={14}/> Edit</Button>
                     <Button size="sm" variant="danger" onClick={() => handleDeleteQuestion(q.id)}><Trash2 size={14}/></Button>
                  </div>
                  <div className="flex gap-4">
                     <div className="flex flex-col items-center gap-2">
                       <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center font-bold text-gray-500">{idx + 1}</div>
                       <GripVertical size={16} className="text-gray-400 cursor-move" />
                     </div>
                     <div className="flex-1">
                        <div className="flex justify-between mb-2">
                           <Badge>{q.type}</Badge>
                           <span className="font-bold text-gray-400">{q.points} pts</span>
                        </div>
                        <p className="text-lg font-medium text-gray-900 dark:text-white mb-4">{q.text}</p>
                        {q.options && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {q.options.map((opt, i) => {
                              const isCorrect = Array.isArray(q.correctAnswer) ? q.correctAnswer.includes(opt) : q.correctAnswer === opt;
                              return (
                                <div key={i} className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                                   {isCorrect ? <CheckCircle size={14}/> : <Circle size={14}/>} {opt}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.ESSAY) && (
                           <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-sm italic">
                             Student will type their answer here...
                           </div>
                        )}
                     </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: SCHEDULE & ASSIGN */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-right-4">
          <div className="lg:col-span-2 space-y-6">
             <Card>
               <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Users size={20} className="text-violet-500"/> Student Assignment</h3>
               <p className="text-sm text-gray-500 mb-4">Select the students eligible to take this exam. Access codes will be generated for them.</p>
               
               <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-semibold sticky top-0">
                     <tr>
                       <th className="p-3"><input type="checkbox" onChange={(e) => setNewExam({...newExam, assignedStudents: e.target.checked ? allStudents.map(s=>s.id) : []})} checked={newExam.assignedStudents?.length === allStudents.length}/></th>
                       <th className="p-3">Student</th>
                       <th className="p-3">Program</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                     {allStudents.map(student => (
                       <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                         <td className="p-3">
                           <input 
                              type="checkbox" 
                              checked={newExam.assignedStudents?.includes(student.id)}
                              onChange={(e) => {
                                const current = newExam.assignedStudents || [];
                                setNewExam({
                                  ...newExam,
                                  assignedStudents: e.target.checked ? [...current, student.id] : current.filter(id => id !== student.id)
                                });
                              }}
                           />
                         </td>
                         <td className="p-3 font-medium text-gray-900 dark:text-gray-200">{student.name} <span className="text-gray-400 block text-xs">{student.studentId}</span></td>
                         <td className="p-3 text-gray-500">{programs.find(p => p.id === student.programId)?.name}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
               <div className="mt-4 text-right text-sm font-bold text-violet-600 dark:text-violet-400">
                  {newExam.assignedStudents?.length} Students Selected
               </div>
             </Card>
          </div>

          <div className="space-y-6">
            <Card>
               <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Calendar size={20} className="text-violet-500"/> Schedule</h3>
               <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Start Date & Time</label>
                    <Input 
                      type="datetime-local" 
                      value={newExam.scheduledStart || ''} 
                      onChange={(e:any) => setNewExam({...newExam, scheduledStart: e.target.value})}
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">Select both date and time when exam begins</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">End Date & Time</label>
                    <Input 
                      type="datetime-local" 
                      value={newExam.scheduledEnd || ''} 
                      onChange={(e:any) => setNewExam({...newExam, scheduledEnd: e.target.value})}
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">Select both date and time when exam ends</p>
                  </div>
               </div>
            </Card>
            
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" loading={isLoading} onClick={handlePublish}>
                <Save size={18} /> Publish & Generate Keys
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: SUCCESS & CREDENTIALS */}
      {step === 4 && createdExam && (
        <div className="max-w-3xl mx-auto text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 dark:text-emerald-400">
            <Key size={40} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Exam Published Successfully!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Secure access codes have been generated for {createdExam.assignedStudents.length} students.</p>

          <Card className="text-left mb-8">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-lg">Student Credentials</h3>
              <Button size="sm" variant="secondary"><ClipboardCheck size={16}/> Copy List</Button>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
               <table className="w-full text-sm">
                 <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 uppercase font-bold text-xs">
                    <tr>
                      <th className="p-3 text-left">Student Name</th>
                      <th className="p-3 text-left">ID</th>
                      <th className="p-3 text-right">Access Code</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                   {createdExam.assignedStudents.map(sid => {
                     const student = users.find(u => u.id === sid);
                     return (
                       <tr key={sid}>
                         <td className="p-3 font-medium text-gray-900 dark:text-white">{student?.name}</td>
                         <td className="p-3 text-gray-500">{student?.studentId}</td>
                         <td className="p-3 text-right font-mono text-lg font-bold tracking-widest text-violet-600 dark:text-violet-400 select-all">
                           {createdExam.studentCredentials[sid]}
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
            </div>
          </Card>

          <Button size="lg" onClick={onSuccess}>Back to Exam List</Button>
        </div>
      )}
    </div>
  );
};
