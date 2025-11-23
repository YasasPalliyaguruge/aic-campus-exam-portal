import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor = ({ value, onChange, placeholder, className = '' }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync value to editor when it changes externally
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      // Only update if we are NOT focused, OR if the content is drastically different (like switching questions)
      // To detect switching questions, we might need a key prop on the component instance in the parent, 
      // but here we can just check if the difference is not just a cursor change. 
      // Simplest approach: If focused, assume DOM is source of truth. If not focused, assume Prop is source of truth.
      if (!isFocused) {
        editorRef.current.innerHTML = value || '';
      } else if (value === '') {
         // Handle reset while focused
         editorRef.current.innerHTML = '';
      }
    }
  }, [value, isFocused]);

  const exec = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html === '<br>' ? '' : html);
    }
  };

  const ToolbarButton = ({ icon: Icon, command, arg, active = false }: any) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent losing focus
        exec(command, arg);
      }}
      className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
        active ? 'bg-gray-200 dark:bg-gray-700 text-violet-600' : 'text-gray-600 dark:text-gray-400'
      }`}
      title={command}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div className={`relative flex flex-col border-2 rounded-xl overflow-hidden transition-all bg-white dark:bg-gray-900 ${
      isFocused 
        ? 'border-violet-600 ring-4 ring-violet-100 dark:ring-violet-900/30' 
        : 'border-gray-200 dark:border-gray-700'
    } ${className}`}>
      
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <ToolbarButton icon={Bold} command="bold" />
        <ToolbarButton icon={Italic} command="italic" />
        <ToolbarButton icon={Underline} command="underline" />
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarButton icon={List} command="insertUnorderedList" />
        <ToolbarButton icon={ListOrdered} command="insertOrderedList" />
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarButton icon={AlignLeft} command="justifyLeft" />
        <ToolbarButton icon={AlignCenter} command="justifyCenter" />
        <ToolbarButton icon={AlignRight} command="justifyRight" />
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="flex-1 p-4 min-h-[200px] outline-none rich-text-content max-w-none overflow-y-auto"
        style={{ minHeight: '200px' }}
      />
      
      {(!value || value === '<br>') && !isFocused && (
        <div 
          className="absolute top-[60px] left-4 text-gray-400 pointer-events-none select-none"
        >
          {placeholder}
        </div>
      )}
    </div>
  );
};
