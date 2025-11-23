import React, { useState } from 'react';
import { Trash2, Edit2, Check, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';

export const AcademicManager = () => {
  const { programs, addProgram, deleteProgram, addModule, deleteModule, refreshData, isLoading } = useApp();
  const [activeTab, setActiveTab] = useState<'PROGRAMS' | 'MODULES'>('PROGRAMS');
  
  const [newProgramName, setNewProgramName] = useState('');
  const [newModule, setNewModule] = useState({ name: '', code: '', programId: '' });
  
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [editProgramName, setEditProgramName] = useState('');
  
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editModuleData, setEditModuleData] = useState({ name: '', code: '' });

  const handleAddProgram = async () => {
    if (!newProgramName.trim()) return;
    await addProgram({ id: `prog_${Date.now()}`, name: newProgramName, modules: [] });
    setNewProgramName('');
  };

  const handleAddModule = async () => {
    if (!newModule.name || !newModule.code || !newModule.programId) return;
    await addModule(newModule.programId, { id: `mod_${Date.now()}`, name: newModule.name, code: newModule.code });
    setNewModule({ name: '', code: '', programId: '' });
  };

  const handleStartEditProgram = (program: any) => {
    setEditingProgramId(program.id);
    setEditProgramName(program.name);
  };

  const handleSaveEditProgram = async (programId: string) => {
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../../firebase');
    
    await updateDoc(doc(db, 'programs', programId), {
      name: editProgramName
    });
    
    setEditingProgramId(null);
    await refreshData(); // Use refreshData instead of reload
  };

  const handleCancelEditProgram = () => {
    setEditingProgramId(null);
    setEditProgramName('');
  };

  const handleStartEditModule = (module: any) => {
    setEditingModuleId(module.id);
    setEditModuleData({ name: module.name, code: module.code });
  };

  const handleSaveEditModule = async (programId: string, moduleId: string) => {
    const { doc, updateDoc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../../firebase');
    
    const programRef = doc(db, 'programs', programId);
    const programSnap = await getDoc(programRef);
    
    if (programSnap.exists()) {
      const program = programSnap.data();
      const updatedModules = program.modules.map((m: any) => 
        m.id === moduleId ? { ...m, name: editModuleData.name, code: editModuleData.code } : m
      );
      
      await updateDoc(programRef, { modules: updatedModules });
      setEditingModuleId(null);
      await refreshData(); // Use refreshData instead of reload
    }
  };

  const handleCancelEditModule = () => {
    setEditingModuleId(null);
    setEditModuleData({ name: '', code: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Academic Management</h2>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('PROGRAMS')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'PROGRAMS' ? 'bg-white dark:bg-gray-700 shadow text-violet-600 dark:text-white' : 'text-gray-500'}`}
          >
            Programs
          </button>
          <button 
            onClick={() => setActiveTab('MODULES')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'MODULES' ? 'bg-white dark:bg-gray-700 shadow text-violet-600 dark:text-white' : 'text-gray-500'}`}
          >
            Modules
          </button>
        </div>
      </div>

      {activeTab === 'PROGRAMS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Create Card */}
          <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700 bg-transparent hover:shadow-none">
             <h3 className="font-bold text-gray-500 mb-4">Create New Program</h3>
             <Input placeholder="Program Name (e.g., B.Sc Physics)" value={newProgramName} onChange={(e:any) => setNewProgramName(e.target.value)} className="mb-4" />
             <Button onClick={handleAddProgram} loading={isLoading} disabled={!newProgramName} className="w-full">Create Program</Button>
          </Card>

          {/* List */}
          {programs.map(prog => {
            const isEditing = editingProgramId === prog.id;
            
            return (
              <Card key={prog.id} className="flex flex-col justify-between">
                <div>
                  {isEditing ? (
                    <Input 
                      value={editProgramName} 
                      onChange={(e:any) => setEditProgramName(e.target.value)}
                      className="mb-2"
                    />
                  ) : (
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{prog.name}</h3>
                  )}
                  <p className="text-gray-500 text-sm">{prog.modules.length} Modules</p>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <div className="flex gap-2 flex-wrap">
                    {prog.modules.slice(0, 3).map(m => <Badge key={m.id} color="slate">{m.code}</Badge>)}
                    {prog.modules.length > 3 && <span className="text-xs text-gray-400 self-center">+{prog.modules.length - 3}</span>}
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                        onClick={() => handleSaveEditProgram(prog.id)}
                      >
                        <Check size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={handleCancelEditProgram}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => handleStartEditProgram(prog)}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this program? All associated modules will also be deleted.')) {
                            deleteProgram(prog.id);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'MODULES' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Create Card */}
           <Card className="border-dashed border-2 border-gray-200 dark:border-gray-700 bg-transparent hover:shadow-none">
             <h3 className="font-bold text-gray-500 mb-4">Create New Module</h3>
             <div className="space-y-3 mb-4">
                <Select value={newModule.programId} onChange={(e:any) => setNewModule({...newModule, programId: e.target.value})}>
                   <option value="">Select Parent Program</option>
                   {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input placeholder="Module Name" value={newModule.name} onChange={(e:any) => setNewModule({...newModule, name: e.target.value})} />
                <Input placeholder="Module Code (e.g., CS101)" value={newModule.code} onChange={(e:any) => setNewModule({...newModule, code: e.target.value})} />
             </div>
             <Button onClick={handleAddModule} loading={isLoading} disabled={!newModule.name || !newModule.code || !newModule.programId} className="w-full">Add Module</Button>
          </Card>

          {/* List */}
          {programs.flatMap(p => p.modules.map(m => ({...m, programName: p.name, programId: p.id}))).map(mod => {
            const isEditing = editingModuleId === mod.id;
            
            return (
              <Card key={mod.id}>
                <div className="flex justify-between items-start mb-2">
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <Input 
                        value={editModuleData.name} 
                        onChange={(e:any) => setEditModuleData({...editModuleData, name: e.target.value})}
                        placeholder="Module Name"
                      />
                      <Input 
                        value={editModuleData.code} 
                        onChange={(e:any) => setEditModuleData({...editModuleData, code: e.target.value})}
                        placeholder="Module Code"
                      />
                    </div>
                  ) : (
                    <>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">{mod.name}</h3>
                      <Badge>{mod.code}</Badge>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-3">{mod.programName}</p>
                {isEditing ? (
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                      onClick={() => handleSaveEditModule(mod.programId, mod.id)}
                    >
                      <Check size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={handleCancelEditModule}
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
                      onClick={() => handleStartEditModule(mod)}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this module?')) {
                          deleteModule(mod.programId, mod.id);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
