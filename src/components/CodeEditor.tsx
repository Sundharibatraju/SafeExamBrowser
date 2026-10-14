import React from 'react';
import Editor from '@monaco-editor/react';
import { SupportedLanguage } from '../types';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: SupportedLanguage;
  disabled?: boolean;
  onMount?: (editor: any) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  disabled = false,
  onMount
}) => {
  const getMonacoLanguage = (lang: SupportedLanguage): string => {
    switch (lang) {
      case 'c': return 'c';
      case 'cpp': return 'cpp';
      case 'java': return 'java';
      case 'python': return 'python';
      case 'typescript': return 'typescript';
      default: return 'python';
    }
  };

  const getFileExtension = (lang: SupportedLanguage): string => {
    switch (lang) {
      case 'c': return 'c';
      case 'cpp': return 'cpp';
      case 'java': return 'java';
      case 'python': return 'py';
      case 'typescript': return 'ts';
      default: return 'py';
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-[#1e1e1e]">
      {/* Editor Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#333333] text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block" />
            <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block" />
          </div>
          <div className="flex items-center gap-2 ml-3 bg-[#1e1e1e] px-3 py-1 rounded-t-lg border-t border-l border-r border-[#333333] text-slate-200 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>solution.{getFileExtension(language)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
          <span className="text-cyan-400 font-semibold flex items-center gap-1">
            <span>Online Compiler</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="uppercase text-slate-300 font-bold">{language}</span>
          <span className="text-slate-600">|</span>
          <span>Tab Size: 4</span>
          <span className="text-slate-600">|</span>
          <span>UTF-8</span>
        </div>
      </div>

      {/* Editor */}
      <div className="min-h-[460px] h-[480px] w-full">
        <Editor
          height="100%"
          language={getMonacoLanguage(language)}
          theme="vs-dark"
          value={value}
          onChange={(val) => onChange(val ?? '')}
          onMount={onMount}
          options={{
            readOnly: disabled,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
            fontLigatures: true,
            tabSize: 4,
            insertSpaces: true,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            acceptSuggestionOnEnter: 'on',
            formatOnPaste: false,
            bracketPairColorization: { enabled: true },
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            contextmenu: false, // Security: prevent right-click in proctoring environment
          }}
          loading={
            <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] text-slate-400 text-xs font-mono gap-2">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>Loading editor environment...</span>
            </div>
          }
        />
      </div>
    </div>
  );
};
