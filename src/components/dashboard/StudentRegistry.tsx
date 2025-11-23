import React, { useState } from 'react';
import { PlusCircle, Trash2, Edit2, Check, X } from 'lucide-react';
import { UserRole } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';

export const StudentRegistry = () => {
  const { users, programs, addStudent, deleteUser, refreshData, isLoading } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', programId: '', studentId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', email: '', programId: '', studentId: '' });
  
  const students = users.filter(u => u.role === UserRole.STUDENT);

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.email || !newStudent.programId || !newStudent.studentId) return;
    await addStudent({
      id: `u_stu${Date.now()}`,
      studentId: newStudent.studentId,
      name: newStudent.name,
      email: newStudent.email,
      programId: newStudent.programId,
      role: UserRole.STUDENT,
      avatar: newStudent.name.substring(0, 2).toUpperCase()
    });
    setShowAdd(false);
    setNewStudent({ name: '', email: '', programId: '', studentId: '' });
  };

  const handleStartEdit = (student: any) => {
    setEditingId(student.id);
    setEditData({
      name: student.name,
      email: student.email,
      programId: student.programId || '',
      studentId: student.studentId || ''
    });
  };

  const handleSaveEdit = async (studentId: string) => {
    // Update using Firestore directly since we don't have an updateStudent function yet
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../../firebase');
    
    await updateDoc(doc(db, 'users', studentId), {
      name: editData.name,
      email: editData.email,
      programId: editData.programId,
      studentId: editData.studentId,
      avatar: editData.name.substring(0, 2).toUpperCase()
    });
    
    setEditingId(null);
    await refreshData(); // Use refreshData instead of reload to maintain auth state
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({ name: '', email: '', programId: '', studentId: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Student Registry</h2>
        <Button onClick={() => setShowAdd(!showAdd)}> <PlusCircle size={18} /> Enroll Student</Button>
      </div>

      {showAdd && (
        <Card className="animate-in fade-in slide-in-from-top-4 mb-6">
          <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">New Enrollment</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Student ID (Matriculation)" value={newStudent.studentId} onChange={(e:any) => setNewStudent({...newStudent, studentId: e.target.value})} />
            <Input placeholder="Full Name" value={newStudent.name} onChange={(e:any) => setNewStudent({...newStudent, name: e.target.value})} />
            <Input placeholder="Email Address" value={newStudent.email} onChange={(e:any) => setNewStudent({...newStudent, email: e.target.value})} />
            <Select value={newStudent.programId} onChange={(e:any) => setNewStudent({...newStudent, programId: e.target.value})}>
              <option value="">Select Program</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddStudent} loading={isLoading}>Register Student</Button>
          </div>
        </Card>
      )}
      
      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-left">
              <tr>
                <th className="p-3 md:p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student ID</th>
                <th className="p-3 md:p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="p-3 md:p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                <th className="p-3 md:p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Program</th>
                <th className="p-3 md:p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="p-3 md:p-5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {students.map(student => {
                const program = programs.find(p => p.id === student.programId);
                const isEditing = editingId === student.id;
                
                return (
                  <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="p-3 md:p-5 font-mono text-sm text-gray-600 dark:text-gray-400">
                      {isEditing ? (
                        <Input 
                          value={editData.studentId} 
                          onChange={(e:any) => setEditData({...editData, studentId: e.target.value})}
                          className="text-sm"
                        />
                      ) : (
                        student.studentId || 'N/A'
                      )}
                    </td>
                    <td className="p-3 md:p-5">
                      {isEditing ? (
                        <Input 
                          value={editData.name} 
                          onChange={(e:any) => setEditData({...editData, name: e.target.value})}
                          className="text-sm"
                        />
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 flex items-center justify-center font-bold text-sm shadow-sm">
                            {student.avatar}
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-white">{student.name}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 md:p-5 text-gray-600 dark:text-gray-300">
                      {isEditing ? (
                        <Input 
                          value={editData.email} 
                          onChange={(e:any) => setEditData({...editData, email: e.target.value})}
                          className="text-sm"
                        />
                      ) : (
                        student.email
                      )}
                    </td>
                    <td className="p-3 md:p-5 text-gray-600 dark:text-gray-300">
                      {isEditing ? (
                        <Select 
                          value={editData.programId} 
                          onChange={(e:any) => setEditData({...editData, programId: e.target.value})}
                          className="text-sm"
                        >
                          <option value="">Select Program</option>
                          {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                      ) : (
                        program?.name || 'Unassigned'
                      )}
                    </td>
                    <td className="p-3 md:p-5"><Badge color="green">Active</Badge></td>
                    <td className="p-3 md:p-5 text-right">
                      {isEditing ? (
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                            onClick={() => handleSaveEdit(student.id)}
                          >
                            <Check size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={handleCancelEdit}
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            onClick={() => handleStartEdit(student)}
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this student?')) {
                                deleteUser(student.id);
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      )}
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
};
