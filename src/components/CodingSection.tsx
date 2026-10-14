import React, { useState } from 'react';
import { CodingQuestion, CodeExecutionResponse, SupportedLanguage } from '../types';
import { CodeEditor } from './CodeEditor';
import {
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Terminal,
  ArrowLeft,
  SlidersHorizontal,
  FileCode,
  Clock,
  Sparkles
} from 'lucide-react';

interface CustomRunResponse {
  status: string;
  stdout: string;
  stderr: string;
  compilerError?: string;
  executionTimeMs: number;
  exitCode: number | null;
}

interface CodingSectionProps {
  questions: CodingQuestion[];
  userCodes: Record<string, { code: string; language: SupportedLanguage }>;
  onUpdateCode: (questionId: string, code: string, language: SupportedLanguage) => void;
  executionResults: Record<string, CodeExecutionResponse>;
  onExecutionCompleted: (questionId: string, result: CodeExecutionResponse) => void;
  onNavigateToAptitude: () => void;
  aptitudeMarks?: number;
}

export const CodingSection: React.FC<CodingSectionProps> = ({
  questions,
  userCodes,
  onUpdateCode,
  executionResults,
  onExecutionCompleted,
  onNavigateToAptitude,
  aptitudeMarks = 90
}) => {
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'TEST_CASES' | 'CONSOLE' | 'CUSTOM_INPUT'>('TEST_CASES');
  const [customStdin, setCustomStdin] = useState('');
  const [customRunResult, setCustomRunResult] = useState<CustomRunResponse | null>(null);
  const [lastExecutionSource, setLastExecutionSource] = useState<'TEST_CASES' | 'CUSTOM_RUN'>('TEST_CASES');
  const [isRunning, setIsRunning] = useState(false);
  const [isCustomRunning, setIsCustomRunning] = useState(false);
  const editorRef = React.useRef<any>(null);

  const [languageBuffers, setLanguageBuffers] = useState<Record<string, Partial<Record<SupportedLanguage, string>>>>(() => {
    try {
      const saved = sessionStorage.getItem('proctor_language_code_buffers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  React.useEffect(() => {
    try {
      sessionStorage.setItem('proctor_language_code_buffers', JSON.stringify(languageBuffers));
    } catch (e) {
      // ignore
    }
  }, [languageBuffers]);

  if (!questions || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
          <FileCode className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white">No Coding Problems Found in Database</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          No coding assessment questions are currently configured in the database for this candidate.
        </p>
        <button
          type="button"
          onClick={onNavigateToAptitude}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Aptitude Section</span>
        </button>
      </div>
    );
  }

  const currentQ = questions[activeQuestionIdx] || questions[0];
  const questionId = currentQ?.id || '';
  const currentSubmission = userCodes[questionId] || {
    code: '',
    language: 'python' as SupportedLanguage
  };

  const currentLanguage: SupportedLanguage = currentSubmission.language;
  const currentCode = currentSubmission.code ?? '';
  const currentResult = executionResults[questionId];

  const getLanguageTemplate = (lang: SupportedLanguage): string => {
    if (currentQ?.starterCode && (currentQ.starterCode as any)[lang]) {
      return (currentQ.starterCode as any)[lang];
    }
    switch (lang) {
      case 'java':
        return `// Java (OpenJDK 17) Solution\nimport java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}`;
      case 'cpp':
        return `// C++ (G++) Solution\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}`;
      case 'c':
        return `// C (GCC) Solution\n#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}`;
      case 'python':
        return `# Python 3 Solution\nimport sys\n\n# Write your solution here\n`;
      case 'typescript':
        return `// TypeScript Solution\nimport * as fs from 'fs';\n\n// Write your solution here\n`;
      default:
        return '';
    }
  };

  React.useEffect(() => {
    if (!questionId) return;
    const existing = userCodes[questionId];
    if (!existing || !existing.code) {
      const defaultLang: SupportedLanguage = existing?.language || 'python';
      const initialCode = languageBuffers[questionId]?.[defaultLang] || getLanguageTemplate(defaultLang);
      onUpdateCode(questionId, initialCode, defaultLang);
      setLanguageBuffers(prev => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] || {}),
          [defaultLang]: initialCode
        }
      }));
    }
  }, [questionId]);

  const handleCodeChange = (newCode: string) => {
    setLanguageBuffers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [currentLanguage]: newCode
      }
    }));
    onUpdateCode(questionId, newCode, currentLanguage);
  };

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    if (newLang === currentLanguage) return;
    const currentQBuffers = languageBuffers[questionId] || {};
    const updatedQBuffers = {
      ...currentQBuffers,
      [currentLanguage]: currentCode
    };

    const savedCodeForNewLang = updatedQBuffers[newLang];
    const codeToShow = (savedCodeForNewLang !== undefined && savedCodeForNewLang !== null && savedCodeForNewLang !== '')
      ? savedCodeForNewLang
      : getLanguageTemplate(newLang);

    setLanguageBuffers(prev => ({
      ...prev,
      [questionId]: {
        ...updatedQBuffers,
        [newLang]: codeToShow
      }
    }));

    onUpdateCode(questionId, codeToShow, newLang);
  };

  const handleResetCode = () => {
    const template = getLanguageTemplate(currentLanguage);
    setLanguageBuffers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [currentLanguage]: template
      }
    }));
    onUpdateCode(questionId, template, currentLanguage);
  };

  const getActiveCode = (): string => {
    if (editorRef.current) {
      try {
        const monacoVal = editorRef.current.getValue();
        if (typeof monacoVal === 'string' && monacoVal.length > 0) {
          return monacoVal;
        }
      } catch (e) {
        // ignore
      }
    }
    return currentCode || (languageBuffers[questionId]?.[currentLanguage] ?? '');
  };

  const handleRunCompiler = async () => {
    setIsRunning(true);
    setLastExecutionSource('TEST_CASES');
    setCustomRunResult(null);
    try {
      const activeCode = getActiveCode();
      const res = await fetch('/api/compiler/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          code: activeCode,
          language: currentLanguage
        })
      });
      const data: CodeExecutionResponse = await res.json();
      onExecutionCompleted(questionId, data);
      if (data.status === 'COMPILE_ERROR' || data.status === 'RUNTIME_ERROR') {
        setActiveTab('CONSOLE');
      } else {
        setActiveTab('TEST_CASES');
      }
    } catch (err: any) {
      console.error('Compiler run error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunCustomInput = async () => {
    setIsCustomRunning(true);
    setLastExecutionSource('CUSTOM_RUN');
    try {
      const activeCode = getActiveCode();
      const res = await fetch('/api/compiler/custom-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeCode,
          language: currentLanguage,
          stdin: customStdin
        })
      });
      const data: CustomRunResponse = await res.json();
      setCustomRunResult(data);
      setActiveTab('CONSOLE');
    } catch (err: any) {
      console.error('Custom run error:', err);
    } finally {
      setIsCustomRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {/* Top Header & Question Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToAptitude}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Aptitude ({aptitudeMarks} Marks)
          </button>
          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />
          {/* Coding Questions Switcher */}
          <div className="flex items-center gap-2">
            {questions.map((q, idx) => {
              const res = executionResults[q.id];
              const score = res?.scoreAwarded ?? 0;
              const isSelected = idx === activeQuestionIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestionIdx(idx)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Problem {idx + 1}: {q.title.slice(0, 18)}...</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 font-mono">
                    {res ? `${score}/10 M` : '10 Marks'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Total Coding Marks Summary */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Coding Section:</span>
          <span className="text-xs font-bold font-mono px-3 py-1 rounded-lg bg-blue-950 text-blue-300 border border-blue-800">
            {questions.length * 10} Marks Total (Each Question: 10 Marks)
          </span>
        </div>
      </div>

      {/* Two-Pane Editor Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Problem Details & Constraints */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 max-h-[820px] overflow-y-auto">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                {currentQ.difficulty}
              </span>
              <span className="text-xs px-3 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 font-mono font-bold shadow-sm">
                10 Marks (Awarded Strictly on Passing All Hidden Test Cases)
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight mt-2">
              {currentQ.title}
            </h2>
          </div>

          <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line proctor-locked">
            {currentQ.description}
          </div>

          {/* Recruiter Provided Sample Test Cases */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Recruiter Provided Sample Test Cases
            </h4>
            {currentQ.examples.map((ex, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs font-mono">
                <div className="text-slate-400">
                  <strong className="text-slate-300">Input:</strong> {ex.input}
                </div>
                <div className="text-emerald-400">
                  <strong className="text-slate-300">Expected Output:</strong> {ex.output}
                </div>
              </div>
            ))}
          </div>

          {/* Constraints */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Constraints</h4>
            <ul className="space-y-1 text-xs text-slate-400 font-mono">
              {currentQ.constraints.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Code Editor & Multi-Language GDB Sandbox */}
        <div className="lg:col-span-7 space-y-4">
          {/* Editor Header Bar with All 5 Supported Real Compilers */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
            {/* 5-Language Selector Dropdown / Pills */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold pl-1">Compiler:</span>
              <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800 gap-1">
                {(['c', 'cpp', 'java', 'python', 'typescript'] as SupportedLanguage[]).map((lang) => {
                  const labels: Record<SupportedLanguage, string> = {
                    c: 'C (GCC)',
                    cpp: 'C++ (G++)',
                    java: 'Java',
                    python: 'Python 3',
                    typescript: 'TypeScript'
                  };
                  const isSelected = currentLanguage === lang;
                  const langCode = languageBuffers[questionId]?.[lang];
                  const defTemplate = getLanguageTemplate(lang);
                  const hasSavedWork = Boolean(
                    langCode && 
                    langCode.trim() !== '' && 
                    langCode.trim() !== defTemplate.trim()
                  );

                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleLanguageChange(lang)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{labels[lang]}</span>
                      {hasSavedWork && (
                        <span 
                          className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-cyan-200' : 'bg-emerald-400 animate-pulse'}`}
                          title="Custom code saved for this language"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions: Reset, Run Stdin & Run Test Cases */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetCode}
                title="Reset Starter Skeleton"
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CUSTOM_INPUT')}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'CUSTOM_INPUT'
                    ? 'bg-slate-800 text-cyan-300 border-cyan-800'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Configure standard input (stdin)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Stdin</span>
                {customStdin.trim() && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </button>

              <button
                type="button"
                disabled={isCustomRunning}
                onClick={handleRunCustomInput}
                title="Execute code with standard input (stdin)"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-950 hover:bg-sky-900 border border-sky-800 text-sky-200 hover:text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isCustomRunning ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-sky-300 text-sky-300" />
                )}
                <span>Run (Stdin)</span>
              </button>

              {currentResult && (
                <div
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
                    currentResult.status === 'ACCEPTED'
                      ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                      : currentResult.passedCases > 0
                      ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                      : 'bg-rose-950/80 border-rose-800 text-rose-300'
                  }`}
                  title="Recorded Test Case Score from Last Run"
                >
                  <span className={`w-2 h-2 rounded-full ${currentResult.status === 'ACCEPTED' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>
                    Last Run: {currentResult.passedCases}/{currentResult.totalCases} Passed ({currentResult.scoreAwarded !== undefined ? currentResult.scoreAwarded : (currentResult.status === 'ACCEPTED' ? 10 : 0)}/10 Marks)
                  </span>
                </div>
              )}

              <button
                type="button"
                disabled={isRunning}
                onClick={handleRunCompiler}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-900/30 transition cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Compiling & Running...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Run All Test Cases
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Upgraded Code Editor */}
          <CodeEditor
            value={currentCode}
            onChange={handleCodeChange}
            language={currentLanguage}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
          />

          {/* Test Case, Console, & Custom Input Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('TEST_CASES')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'TEST_CASES'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Test Cases Results {currentResult && `(${currentResult.passedCases}/${currentResult.totalCases})`}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('CONSOLE')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'CONSOLE'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-3 h-3" />
                  Compiler Diagnostics
                  {(currentResult?.status === 'COMPILE_ERROR' || customRunResult?.status === 'COMPILE_ERROR') && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('CUSTOM_INPUT')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'CUSTOM_INPUT'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Custom Stdin Test
                </button>
              </div>

              {currentResult && activeTab === 'TEST_CASES' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono border ${
                      currentResult.status === 'ACCEPTED'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : currentResult.status === 'TIME_LIMIT_EXCEEDED'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : 'bg-rose-950 text-rose-300 border-rose-800'
                    }`}
                  >
                    {currentResult.status}
                  </span>
                  <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Hidden Test Cases Passed: {currentResult.hiddenCasesPassed ?? currentResult.testResults.filter(r => r.isHidden && r.passed).length} / {currentResult.hiddenCasesTotal ?? currentResult.testResults.filter(r => r.isHidden).length}
                  </span>
                  <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Valid Score: {currentResult.scoreAwarded} / 10 Marks
                  </span>
                </div>
              )}
            </div>

            {/* Tab 1: Test Cases List */}
            {activeTab === 'TEST_CASES' && (
              <div className="space-y-3">
                {currentResult && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-900/60 text-[11px] font-mono text-cyan-300 flex items-center justify-between">
                    <span>
                      <strong>Scoring Policy:</strong> Marks are allocated <strong>strictly based on passing Hidden Test Cases</strong>. Passing {currentResult.hiddenCasesPassed ?? currentResult.testResults.filter(r => r.isHidden && r.passed).length}/{currentResult.hiddenCasesTotal ?? currentResult.testResults.filter(r => r.isHidden).length} hidden cases = <strong>{currentResult.scoreAwarded}/10 Marks</strong>.
                    </span>
                  </div>
                )}
                {currentResult ? (
                  currentResult.status === 'COMPILE_ERROR' ? (
                    <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs font-mono space-y-2">
                      <div className="flex items-center gap-2 font-bold text-rose-300">
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>Compilation Error (Exit Code 1)</span>
                      </div>
                      <pre className="whitespace-pre-wrap bg-slate-950 p-3 rounded-lg text-[11px] text-rose-300 border border-rose-900/60 overflow-x-auto max-h-60 leading-relaxed font-mono">
                        {currentResult.outputMessage}
                      </pre>
                    </div>
                  ) : (
                    <>
                      {currentResult.status !== 'ACCEPTED' && (
                        <div className={`p-3.5 rounded-xl border text-xs font-mono space-y-1.5 ${
                          currentResult.status === 'RUNTIME_ERROR'
                            ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                            : currentResult.status === 'TIME_LIMIT_EXCEEDED'
                            ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                            : 'bg-amber-950/20 border-amber-900/60 text-amber-200'
                        }`}>
                          <div className="flex items-center gap-2 font-bold">
                            <AlertCircle className="w-4 h-4" />
                            <span>
                              {currentResult.status === 'RUNTIME_ERROR' && 'Runtime Error (Exception / Non-zero Exit)'}
                              {currentResult.status === 'TIME_LIMIT_EXCEEDED' && 'Time Limit Exceeded (Execution Timeout)'}
                              {currentResult.status === 'WRONG_ANSWER' && 'Evaluation Notice (Output Mismatch)'}
                            </span>
                          </div>
                          <pre className="whitespace-pre-wrap bg-slate-950/90 p-2.5 rounded-lg text-[11px] border border-slate-800/80 overflow-x-auto max-h-48 leading-relaxed font-mono text-slate-200">
                            {currentResult.outputMessage}
                          </pre>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentResult.testResults.map((tr, idx) => (
                          <div
                            key={tr.testCaseId}
                            className={`p-3 rounded-xl border text-xs font-mono space-y-1.5 ${
                              tr.passed
                                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                                : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1.5">
                                {tr.passed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                )}
                                Test Case {idx + 1}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                    tr.isHidden
                                      ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                                      : 'bg-slate-900 text-slate-400 border-slate-700'
                                  }`}
                                >
                                  {tr.isHidden ? 'Hidden (Allocates Marks)' : 'Public Sample'}
                                </span>
                                {tr.executionTimeMs !== undefined && (
                                  <span className="text-[10px] text-slate-400">{tr.executionTimeMs}ms</span>
                                )}
                              </div>
                            </div>
                            {!tr.isHidden ? (
                              <>
                                <div className="text-[11px] text-slate-400 truncate">
                                  <strong>Input:</strong> {tr.input.replace(/\n/g, ' ')}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  <strong>Expected:</strong> {tr.expectedOutput}
                                </div>
                                <div className={`text-[11px] font-bold ${tr.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  <strong>Output:</strong> {tr.actualOutput}
                                </div>
                                {tr.error && !tr.passed && (
                                  <div className="text-[10px] text-rose-300 bg-rose-950/60 p-1.5 rounded border border-rose-900/60 font-mono whitespace-pre-wrap max-h-20 overflow-y-auto">
                                    <strong>Error:</strong> {tr.error}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-[11px] text-slate-400">
                                {tr.passed
                                  ? 'Hidden evaluation passed.'
                                  : `Edge test failed: ${tr.error || 'Output mismatch'}`}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500 space-y-1">
                    <p>Click "Run All Test Cases" to compile and execute your code in the real GDB environment.</p>
                    <p className="text-[11px] text-slate-600">Tests include both public sample cases and hidden verification test cases.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Real Compiler Diagnostics Console */}
            {activeTab === 'CONSOLE' && (
              <div className="space-y-2">
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xs min-h-[140px] text-slate-300 space-y-2">
                  {customRunResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Terminal className="w-3 h-3 text-cyan-400" />
                          Custom Run Execution
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {customRunResult.executionTimeMs}ms
                          <span className={`px-1.5 py-0.5 rounded font-bold ${customRunResult.status === 'ACCEPTED' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                            {customRunResult.status}
                          </span>
                        </span>
                      </div>
                      {customRunResult.compilerError && (
                        <div className="text-rose-400 whitespace-pre-wrap bg-rose-950/30 p-2 rounded border border-rose-900/60">
                          {customRunResult.compilerError}
                        </div>
                      )}
                      {customRunResult.stdout && (
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Standard Output:</div>
                          <pre className="text-emerald-300 whitespace-pre-wrap">{customRunResult.stdout}</pre>
                        </div>
                      )}
                      {customRunResult.stderr && !customRunResult.compilerError && (
                        <div>
                          <div className="text-[10px] text-rose-400 uppercase tracking-wider mb-0.5">Standard Error:</div>
                          <pre className="text-rose-300 whitespace-pre-wrap">{customRunResult.stderr}</pre>
                        </div>
                      )}
                    </div>
                  ) : currentResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Terminal className="w-3 h-3 text-cyan-400" />
                          Compiler Diagnostics & Test Run
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                          currentResult.status === 'ACCEPTED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : currentResult.status === 'COMPILE_ERROR'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : currentResult.status === 'RUNTIME_ERROR'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {currentResult.status}
                        </span>
                      </div>
                      <pre className={`whitespace-pre-wrap text-xs font-mono p-2.5 rounded-lg border leading-relaxed ${
                        currentResult.status === 'ACCEPTED'
                          ? 'bg-emerald-950/20 text-emerald-200 border-emerald-900/60'
                          : currentResult.status === 'COMPILE_ERROR'
                          ? 'bg-rose-950/30 text-rose-300 border-rose-900/60'
                          : currentResult.status === 'RUNTIME_ERROR'
                          ? 'bg-rose-950/30 text-rose-300 border-rose-900/60'
                          : 'bg-slate-900 text-slate-200 border-slate-800'
                      }`}>
                        {currentResult.outputMessage}
                      </pre>
                    </div>
                  ) : (
                    <span className="text-slate-600 italic">No compiler execution output yet. Run your code or test custom stdin.</span>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Custom Stdin Input (Online GDB Style) */}
            {activeTab === 'CUSTOM_INPUT' && (
              <div className="space-y-3 bg-slate-950 rounded-xl p-3 border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    Standard Input (stdin):
                  </label>
                  <button
                    type="button"
                    disabled={isCustomRunning}
                    onClick={handleRunCustomInput}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shadow"
                  >
                    {isCustomRunning ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-white" />
                        Execute with Custom Input
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={customStdin}
                  onChange={(e) => setCustomStdin(e.target.value)}
                  placeholder="Enter test input to be piped to stdin (e.g. 3 2\n1 1 1)"
                  className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded-lg p-2.5 font-mono text-xs outline-none focus:border-cyan-600"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
