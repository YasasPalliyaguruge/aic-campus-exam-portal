import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bold, Italic, Underline, Strikethrough, 
  List, ListOrdered, 
  AlignLeft, AlignCenter, AlignRight,
  Table, Minus, Link, Quote,
  Undo, Redo, X, Plus, Trash2
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disablePaste?: boolean;
  onBlockedPaste?: () => void;
}

export const RichTextEditor = ({ value, onChange, className = '', disablePaste = false, onBlockedPaste }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const savedSelectionRef = useRef<Range | null>(null);
  const lastBlockedPasteRef = useRef(0);
  
  // Active formatting state
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
  });

  // Check active formatting
  const updateActiveFormats = useCallback(() => {
    if (!editorRef.current) return;
    
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
    });
  }, []);

  // Update active formats on selection change
  useEffect(() => {
    const handleSelectionChange = () => {
      if (isFocused) {
        updateActiveFormats();
      }
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [isFocused, updateActiveFormats]);

  // Sync value to editor when it changes externally
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      if (!isFocused) {
        editorRef.current.innerHTML = value || '';
      } else if (value === '') {
        editorRef.current.innerHTML = '';
      }
    }
  }, [value, isFocused]);

  // Save current selection
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  // Restore saved selection
  const restoreSelection = () => {
    if (savedSelectionRef.current && editorRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
  };

  const exec = (command: string, val: string | undefined = undefined) => {
    // Ensure editor is focused
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, val);
    handleInput();
    updateActiveFormats();
  };

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html === '<br>' ? '' : html);
    }
  };

  const blockPasteLikeInput = (event: React.SyntheticEvent) => {
    if (!disablePaste) return;
    event.preventDefault();
    const now = Date.now();
    if (now - lastBlockedPasteRef.current > 500) {
      lastBlockedPasteRef.current = now;
      onBlockedPaste?.();
    }
  };

  const handleBeforeInput = (event: React.FormEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (disablePaste && nativeEvent.inputType?.startsWith('insertFromPaste')) {
      blockPasteLikeInput(event);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!disablePaste) return;
    const hasText = event.dataTransfer.types.some(type => type === 'text/plain' || type === 'text/html');
    if (hasText) blockPasteLikeInput(event);
  };

  // Insert HTML at cursor position
  const insertHtmlAtCursor = (html: string) => {
    editorRef.current?.focus();
    
    // Try to restore selection if we have one
    if (savedSelectionRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
    
    const success = document.execCommand('insertHTML', false, html);
    
    // Fallback: append to editor if insertHTML fails
    if (!success && editorRef.current) {
      editorRef.current.innerHTML += html;
    }
    
    handleInput();
  };

  // Generate table HTML
  const generateTableHtml = (rows: number, cols: number) => {
    let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 12px 0;">`;
    for (let i = 0; i < rows; i++) {
      tableHtml += '<tr>';
      for (let j = 0; j < cols; j++) {
        if (i === 0) {
          tableHtml += `<th style="border: 1px solid #4f46e5; padding: 10px 12px; background-color: #312e81; color: #ffffff; font-weight: 600; text-align: left; min-width: 60px;">Header</th>`;
        } else {
          tableHtml += `<td style="border: 1px solid #6366f1; padding: 8px 12px; background-color: #fafafa; color: #1f2937; min-width: 60px;">Cell</td>`;
        }
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table><p><br></p>';
    return tableHtml;
  };

  // Open table modal
  const openTableModal = () => {
    saveSelection();
    setTableRows(3);
    setTableCols(3);
    setShowTableModal(true);
  };

  // Insert table from modal
  const insertTable = () => {
    const tableHtml = generateTableHtml(tableRows, tableCols);
    setShowTableModal(false);
    
    setTimeout(() => {
      insertHtmlAtCursor(tableHtml);
    }, 50);
  };

  // Open link modal
  const openLinkModal = () => {
    saveSelection();
    setLinkUrl('https://');
    setShowLinkModal(true);
  };

  // Insert link from modal
  const insertLink = () => {
    setShowLinkModal(false);
    
    setTimeout(() => {
      restoreSelection();
      document.execCommand('createLink', false, linkUrl);
      handleInput();
    }, 50);
  };

  // Insert horizontal line
  const insertHorizontalRule = () => {
    saveSelection();
    setTimeout(() => {
      insertHtmlAtCursor('<hr style="border: none; border-top: 2px solid #e5e7eb; margin: 16px 0;"><p><br></p>');
    }, 10);
  };

  // Insert blockquote
  const insertBlockquote = () => {
    saveSelection();
    setTimeout(() => {
      insertHtmlAtCursor('<blockquote style="border-left: 4px solid #6366f1; padding-left: 16px; margin: 12px 0; color: #6b7280; font-style: italic;">Quote text...</blockquote><p><br></p>');
    }, 10);
  };

  const ToolbarButton = ({ icon: Icon, onAction, title, active = false }: { icon: any; onAction: () => void; title: string; active?: boolean }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent focus loss
        onAction();
      }}
      className={`p-1.5 sm:p-2 rounded transition-colors ${
        active 
          ? 'bg-violet-500 text-white shadow-md' 
          : 'hover:bg-violet-100 dark:hover:bg-violet-900/30 text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400'
      }`}
      title={title}
    >
      <Icon size={16} />
    </button>
  );

  const Divider = () => (
    <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5 sm:mx-1" />
  );

  // Modal component that renders as a portal for better visibility
  const ModalPortal = ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => {
    if (!isOpen) return null;
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        {children}
      </div>,
      document.body
    );
  };

  return (
    <div className={`relative flex flex-col border rounded-xl overflow-hidden transition-all bg-white dark:bg-gray-900 ${
      isFocused 
        ? 'border-violet-500/50 ring-2 ring-violet-500/20 shadow-lg shadow-violet-500/5' 
        : 'border-gray-200 dark:border-gray-800'
    } ${className}`}>
      
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 sm:p-2 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/80 dark:to-gray-800/50 flex-wrap">
        {/* Undo/Redo */}
        <ToolbarButton icon={Undo} onAction={() => exec('undo')} title="Undo" />
        <ToolbarButton icon={Redo} onAction={() => exec('redo')} title="Redo" />
        <Divider />
        
        {/* Text Formatting */}
        <ToolbarButton icon={Bold} onAction={() => exec('bold')} title="Bold (Ctrl+B)" active={activeFormats.bold} />
        <ToolbarButton icon={Italic} onAction={() => exec('italic')} title="Italic (Ctrl+I)" active={activeFormats.italic} />
        <ToolbarButton icon={Underline} onAction={() => exec('underline')} title="Underline (Ctrl+U)" active={activeFormats.underline} />
        <ToolbarButton icon={Strikethrough} onAction={() => exec('strikeThrough')} title="Strikethrough" active={activeFormats.strikeThrough} />
        <Divider />
        
        {/* Lists */}
        <ToolbarButton icon={List} onAction={() => exec('insertUnorderedList')} title="Bullet List" active={activeFormats.insertUnorderedList} />
        <ToolbarButton icon={ListOrdered} onAction={() => exec('insertOrderedList')} title="Numbered List" active={activeFormats.insertOrderedList} />
        <Divider />
        
        {/* Alignment */}
        <ToolbarButton icon={AlignLeft} onAction={() => exec('justifyLeft')} title="Align Left" active={activeFormats.justifyLeft} />
        <ToolbarButton icon={AlignCenter} onAction={() => exec('justifyCenter')} title="Center" active={activeFormats.justifyCenter} />
        <ToolbarButton icon={AlignRight} onAction={() => exec('justifyRight')} title="Align Right" active={activeFormats.justifyRight} />
        <Divider />
        
        {/* Special Elements */}
        <ToolbarButton icon={Table} onAction={openTableModal} title="Insert Table" />
        <ToolbarButton icon={Minus} onAction={insertHorizontalRule} title="Horizontal Line" />
        <ToolbarButton icon={Link} onAction={openLinkModal} title="Insert Link" />
        <ToolbarButton icon={Quote} onAction={insertBlockquote} title="Blockquote" />
        <ToolbarButton icon={Quote} onAction={insertBlockquote} title="Blockquote" />
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={blockPasteLikeInput}
        onBeforeInput={handleBeforeInput}
        onDrop={handleDrop}
        onFocus={() => {
          setIsFocused(true);
          updateActiveFormats();
        }}
        onBlur={() => setIsFocused(false)}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        className="flex-1 p-4 min-h-[180px] outline-none overflow-y-auto text-gray-900 dark:text-gray-100 leading-relaxed
          [&>p]:mb-2
          [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-3 [&>ul]:ml-2
          [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-3 [&>ol]:ml-2
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-2
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-2
          [&_li]:mb-1
          [&>blockquote]:border-l-4 [&>blockquote]:border-violet-500 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-gray-600
          [&>table]:w-full [&>table]:border-collapse [&>table]:my-3
          [&_table]:w-full [&_table]:border-collapse
          [&_td]:border [&_td]:border-violet-200 [&_td]:dark:border-violet-800 [&_td]:p-2 [&_td]:bg-gray-50 [&_td]:dark:bg-gray-800/50
          [&_th]:border [&_th]:border-violet-500 [&_th]:p-2 [&_th]:bg-violet-900 [&_th]:text-white [&_th]:font-semibold
        "
        style={{ minHeight: '180px' }}
      />
      
      {/* Footer */}
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 flex justify-between">
        <span>Use toolbar to format</span>
        <span>{value?.replace(/<[^>]*>/g, '').length || 0} chars</span>
      </div>

      {/* Table Size Modal - Portal to body */}
      <ModalPortal isOpen={showTableModal}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-80 border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 fade-in duration-200">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Table size={20} className="text-violet-500" /> Insert Table
            </h3>
            <button 
              onClick={() => setShowTableModal(false)} 
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rows</label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setTableRows(Math.max(1, tableRows - 1))}
                  className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
                <input 
                  type="number" 
                  min="1" 
                  max="20" 
                  value={tableRows}
                  onChange={(e) => setTableRows(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-lg font-bold bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <button 
                  onClick={() => setTableRows(Math.min(20, tableRows + 1))}
                  className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Columns</label>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setTableCols(Math.max(1, tableCols - 1))}
                  className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={tableCols}
                  onChange={(e) => setTableCols(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-lg font-bold bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <button 
                  onClick={() => setTableCols(Math.min(10, tableCols + 1))}
                  className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            
            {/* Preview Grid */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <p className="text-sm text-gray-500 mb-3 text-center font-medium">Preview: {tableRows} × {tableCols}</p>
              <div className="flex justify-center">
                <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(tableCols, 6)}, 1fr)` }}>
                  {Array.from({ length: Math.min(tableRows, 5) * Math.min(tableCols, 6) }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-5 h-4 rounded ${i < Math.min(tableCols, 6) ? 'bg-violet-500' : 'bg-violet-200 dark:bg-violet-800'}`}
                    />
                  ))}
                </div>
              </div>
              {(tableRows > 5 || tableCols > 6) && (
                <p className="text-xs text-gray-400 text-center mt-2">Showing partial preview...</p>
              )}
            </div>
            
            <button 
              onClick={insertTable}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-500/25"
            >
              Insert Table
            </button>
          </div>
        </div>
      </ModalPortal>

      {/* Link Modal - Portal to body */}
      <ModalPortal isOpen={showLinkModal}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-96 border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 fade-in duration-200">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Link size={20} className="text-violet-500" /> Insert Link
            </h3>
            <button 
              onClick={() => setShowLinkModal(false)} 
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">URL</label>
              <input 
                type="url" 
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                autoFocus
              />
            </div>
            
            <p className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
              💡 Tip: Select text first, then add a link to make it clickable.
            </p>
            
            <button 
              onClick={insertLink}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-500/25"
            >
              Insert Link
            </button>
          </div>
        </div>
      </ModalPortal>
    </div>
  );
};

export default RichTextEditor;
