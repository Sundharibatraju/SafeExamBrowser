import React, { useState, useEffect } from 'react';
import { Plus, Trash2, HelpCircle, Code2, Database, CheckCircle2, AlertCircle, RefreshCw, Layers, ShieldCheck, Terminal } from 'lucide-react';
import { AptitudeQuestion, CodingQuestion } from '../types';

export const RecruiterQuestionManager: React.FC = () => {
  const [aptitudeQuestions, setAptitudeQuestions] = useState<AptitudeQuestion[]>([]);
  const [codingQuestions, setCodingQuestions] = useState<CodingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'MCQ' | 'CODING'>('CODING');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showAddMcqModal, setShowAddMcqModal] = useState(false);
  const [showAddCodingModal, setShowAddCodingModal] = useState(false);

  const [mcqForm, setMcqForm] = useState({
    topic: 'Algorithms & Data Structures',
    question: '',
    option0: '',
    option1: '',
    option2: '',
    option3: '',
    correctAnswerIndex: 0,
    explanation: '',
    marks: 10
  });

  const [codingForm, setCodingForm] = useState({
    title: '',
    difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
    marks: 10,
    description: '',
    constraints: '1 <= N <= 10^5\nTime Limit: 2.0s\nMemory Limit: 256MB',
    testCases: [
      { input: '4\n1 2 3 4', expectedOutput: '10', isHidden: false },
      { input: '5\n-1 -2 -3 -4 -5', expectedOutput: '-15', isHidden: true }
    ]
  });

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruiter/questions');
      if (res.ok) {
        const data = await res.json();
        setAptitudeQuestions(data.aptitudeQuestions || []);
        setCodingQuestions(data.codingQuestions || []);
      }
    } catch (e) {
      console.error('Failed to load questions from database:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleAddMcq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        topic: mcqForm.topic,
        question: mcqForm.question,
        options: [mcqForm.option0, mcqForm.option1, mcqForm.option2, mcqForm.option3],
        correctAnswerIndex: Number(mcqForm.correctAnswerIndex),
        explanation: mcqForm.explanation,
        marks: Number(mcqForm.marks)
      };
      const res = await fetch('/api/recruiter/questions/aptitude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'MCQ successfully posted and stored in database!' });
        setShowAddMcqModal(false);
        setMcqForm({
          topic: 'Algorithms & Data Structures',
          question: '',
          option0: '',
          option1: '',
          option2: '',
          option3: '',
          correctAnswerIndex: 0,
          explanation: '',
          marks: 10
        });
        loadQuestions();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save MCQ' });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Error saving question' });
    }
  };

  const handleDeleteMcq = async (id: string) => {
    if (!confirm('Are you sure you want to delete this MCQ from the database?')) return;
    try {
      const res = await fetch(`/api/recruiter/questions/aptitude/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'MCQ question deleted from database.' });
        loadQuestions();
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Failed to delete question' });
    }
  };

  const handleAddCodingQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const constraintsArray = codingForm.constraints
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0);
      const payload = {
        title: codingForm.title,
        difficulty: codingForm.difficulty,
        marks: Number(codingForm.marks),
        description: codingForm.description,
        constraints: constraintsArray,
        testCases: codingForm.testCases
      };
      const res = await fetch('/api/recruiter/questions/coding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Coding question & test cases posted and stored in database!' });
        setShowAddCodingModal(false);
        setCodingForm({
          title: '',
          difficulty: 'Medium',
          marks: 10,
          description: '',
          constraints: '1 <= N <= 10^5\nTime Limit: 2.0s\nMemory Limit: 256MB',
          testCases: [
            { input: '4\n1 2 3 4', expectedOutput: '10', isHidden: false },
            { input: '5\n-1 -2 -3 -4 -5', expectedOutput: '-15', isHidden: true }
          ]
        });
        loadQuestions();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Failed to save coding question' });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'Error saving coding question' });
    }
  };

  const handleDeleteCoding = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coding problem from the database?')) return;
    try {
      const res = await fetch(`/api/recruiter/questions/coding/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Coding problem deleted from database.' });
        loadQuestions();
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Failed to delete coding question' });
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Reset all questions to default curated pool? Any custom questions will be replaced.')) return;
    try {
      const res = await fetch('/api/recruiter/questions/reset-defaults', { method: 'POST' });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Questions successfully reset to default assessment bank.' });
        loadQuestions();
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Failed to reset questions' });
    }
  };

  const addTestCaseRow = () => {
    setCodingForm(prev => ({
      ...prev,
      testCases: [...prev.testCases, { input: '', expectedOutput: '', isHidden: false }]
    }));
  };

  const removeTestCaseRow = (index: number) => {
    if (codingForm.testCases.length <= 1) return;
    setCodingForm(prev => ({
      ...prev,
      testCases: prev.testCases.filter((_, idx) => idx !== index)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Alert message */}
      {statusMsg && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
          statusMsg.type === 'success'
            ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
            : 'bg-rose-950/70 border-rose-800 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header with Sub-tabs and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Recruiter Question Bank &bull; Stored in Database
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Post questions here. Candidate test instances extract and execute from this active database.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Sub-tab pills */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setActiveSubTab('CODING')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'CODING'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Coding Problems ({codingQuestions.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('MCQ')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'MCQ'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Aptitude MCQs ({aptitudeQuestions.length})</span>
            </button>
          </div>

          {/* Post Action Button */}
          {activeSubTab === 'CODING' ? (
            <button
              onClick={() => setShowAddCodingModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-900/30 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post Coding Question</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddMcqModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-900/30 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post MCQ Question</span>
            </button>
          )}

          <button
            onClick={handleResetDefaults}
            title="Reset to default questions"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Question Bank Notice */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>
            <strong className="text-slate-200">Anti-Cheating & No-Hint Mandate:</strong> Candidate starter code contains zero algorithmic hints. The multi-language compiler runs solutions directly against the test cases defined below.
          </span>
        </div>
        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-md border border-cyan-800">
          Sync: Realtime Active
        </span>
      </div>

      {/* CODING QUESTIONS TAB */}
      {activeSubTab === 'CODING' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
              Loading coding problems from database...
            </div>
          ) : codingQuestions.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <Code2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No Coding Questions in Database</p>
              <p className="text-xs text-slate-500 mt-1">Post a new coding problem with test cases to evaluate candidates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {codingQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-7 w-7 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-mono text-xs font-bold">
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          {q.title}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold ${
                            q.difficulty === 'Easy'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : q.difficulty === 'Medium'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {q.difficulty}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {q.marks || 10} Marks
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {q.id}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCoding(q.id)}
                      title="Delete from Database"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    {q.description}
                  </p>
                  {/* Test Cases Summary */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        Compiler Test Cases ({q.testCases.length}):
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {q.testCases.filter(tc => !tc.isHidden).length} Public &bull; {q.testCases.filter(tc => tc.isHidden).length} Hidden
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.testCases.map((tc, tcIdx) => (
                        <div
                          key={tc.id || tcIdx}
                          className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 text-xs font-mono space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400 font-bold">Case #{tcIdx + 1}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                              tc.isHidden
                                ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                                : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                            }`}>
                              {tc.isHidden ? 'Hidden (Proctored)' : 'Public Sample'}
                            </span>
                          </div>
                          <div className="text-slate-300 text-[11px] truncate">
                            <span className="text-slate-500">In: </span>
                            {tc.input.replace(/\n/g, ' ')}
                          </div>
                          <div className="text-cyan-300 text-[11px] truncate">
                            <span className="text-slate-500">Expected: </span>
                            {tc.expectedOutput.replace(/\n/g, ' ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* APTITUDE MCQS TAB */}
      {activeSubTab === 'MCQ' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
              Loading aptitude MCQs from database...
            </div>
          ) : aptitudeQuestions.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <HelpCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No MCQs in Database</p>
              <p className="text-xs text-slate-500 mt-1">Post aptitude questions to test candidate technical reasoning.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {aptitudeQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="h-6 w-6 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-mono text-xs font-bold mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {q.topic}
                        </span>
                        <h4 className="text-xs md:text-sm font-semibold text-white mt-1 leading-snug">
                          {q.question}
                        </h4>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteMcq(q.id)}
                      title="Delete from Database"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between border ${
                          optIdx === q.correctAnswerIndex
                            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 font-semibold'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-500">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <span>{opt}</span>
                        </div>
                        {optIdx === q.correctAnswerIndex && (
                          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                            Correct
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <p className="text-[11px] text-slate-400 italic bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50">
                      <strong>Rationale:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* POST CODING QUESTION MODAL */}
      {showAddCodingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Post Coding Problem to Database</h3>
              </div>
              <button
                onClick={() => setShowAddCodingModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddCodingQuestion} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-7">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Problem Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Reverse Linked List or Subarray Product"
                    value={codingForm.title}
                    onChange={(e) => setCodingForm({ ...codingForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Difficulty</label>
                  <select
                    value={codingForm.difficulty}
                    onChange={(e) => setCodingForm({ ...codingForm, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Marks</label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={codingForm.marks}
                    onChange={(e) => setCodingForm({ ...codingForm, marks: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Problem Description & Specifications</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe the problem, input format, and output format requirements..."
                  value={codingForm.description}
                  onChange={(e) => setCodingForm({ ...codingForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Constraints (one per line)</label>
                <textarea
                  rows={2}
                  placeholder="1 <= N <= 10^5\nTime Limit: 2.0s"
                  value={codingForm.constraints}
                  onChange={(e) => setCodingForm({ ...codingForm, constraints: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Test Cases List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">
                    Test Cases for Automated Compiler Evaluation:
                  </label>
                  <button
                    type="button"
                    onClick={addTestCaseRow}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium transition cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Test Case</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {codingForm.testCases.map((tc, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300 font-mono">Test Case #{idx + 1}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-400">
                            <input
                              type="checkbox"
                              checked={tc.isHidden}
                              onChange={(e) => {
                                const copy = [...codingForm.testCases];
                                copy[idx].isHidden = e.target.checked;
                                setCodingForm({ ...codingForm, testCases: copy });
                              }}
                              className="rounded bg-slate-800 border-slate-700 text-cyan-600 focus:ring-0"
                            />
                            <span>Hidden Test Case (Anti-Cheating)</span>
                          </label>
                          {codingForm.testCases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTestCaseRow(idx)}
                              className="text-slate-500 hover:text-rose-400 text-xs p-1"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5 font-mono">Standard Input (stdin):</span>
                          <textarea
                            rows={2}
                            required
                            placeholder="Input values separated by space or newline"
                            value={tc.input}
                            onChange={(e) => {
                              const copy = [...codingForm.testCases];
                              copy[idx].input = e.target.value;
                              setCodingForm({ ...codingForm, testCases: copy });
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-0.5 font-mono">Expected Output (stdout):</span>
                          <textarea
                            rows={2}
                            required
                            placeholder="Expected program output"
                            value={tc.expectedOutput}
                            onChange={(e) => {
                              const copy = [...codingForm.testCases];
                              copy[idx].expectedOutput = e.target.value;
                              setCodingForm({ ...codingForm, testCases: copy });
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800 text-[11px] text-cyan-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                <span>
                  <strong>Strict No-Hint Enforcement:</strong> The starter code boilerplate will be generated without algorithmic hints or pseudo-code. Candidates must craft the full logic independently.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCodingModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition shadow-md shadow-cyan-900/30 cursor-pointer"
                >
                  Save Problem to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POST MCQ QUESTION MODAL */}
      {showAddMcqModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Post MCQ Question to Database</h3>
              </div>
              <button
                onClick={() => setShowAddMcqModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddMcq} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Topic / Domain</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operating Systems or SQL"
                    value={mcqForm.topic}
                    onChange={(e) => setMcqForm({ ...mcqForm, topic: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Marks</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={mcqForm.marks}
                    onChange={(e) => setMcqForm({ ...mcqForm, marks: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Question Statement</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter the MCQ question text..."
                  value={mcqForm.question}
                  onChange={(e) => setMcqForm({ ...mcqForm, question: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* 4 Options */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">Options (Select the correct option below):</label>
                {[0, 1, 2, 3].map((optNum) => {
                  const key = `option${optNum}` as 'option0' | 'option1' | 'option2' | 'option3';
                  const label = String.fromCharCode(65 + optNum);
                  return (
                    <div key={optNum} className="flex items-center gap-2">
                      <span className="w-6 text-center font-mono text-xs text-slate-400 font-bold">{label}</span>
                      <input
                        type="text"
                        required
                        placeholder={`Option ${label}`}
                        value={mcqForm[key]}
                        onChange={(e) => setMcqForm({ ...mcqForm, [key]: e.target.value })}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={mcqForm.correctAnswerIndex === optNum}
                        onChange={() => setMcqForm({ ...mcqForm, correctAnswerIndex: optNum })}
                        title={`Mark ${label} as correct answer`}
                        className="h-4 w-4 text-cyan-600 bg-slate-950 border-slate-700 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Explanation / Solution Rationale</label>
                <input
                  type="text"
                  placeholder="Brief justification for the correct answer"
                  value={mcqForm.explanation}
                  onChange={(e) => setMcqForm({ ...mcqForm, explanation: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMcqModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition shadow-md shadow-cyan-900/30 cursor-pointer"
                >
                  Save MCQ to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
