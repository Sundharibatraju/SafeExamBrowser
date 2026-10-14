import React, { useState } from 'react';
import { AptitudeQuestion } from '../types';
import { CheckCircle, HelpCircle, Bookmark, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

interface AptitudeSectionProps {
  questions: AptitudeQuestion[];
  answers: Record<string, number>;
  onSelectAnswer: (questionId: string, optionIndex: number) => void;
  onNavigateToCoding: () => void;
  codingMarks?: number;
}

export const AptitudeSection: React.FC<AptitudeSectionProps> = ({
  questions,
  answers,
  onSelectAnswer,
  onNavigateToCoding,
  codingMarks = 10
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});

  if (!questions || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-16 p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white">No Aptitude Questions Found in Database</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          No aptitude questions are currently configured in the recruiter database for this assessment.
        </p>
        <button
          type="button"
          onClick={onNavigateToCoding}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
        >
          <span>Switch to Coding Section</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex] || questions[0];
  const toggleBookmark = (id: string) => {
    setBookmarked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isAnswered = answers[currentQ.id] !== undefined;
  const answeredCount = Object.keys(answers).length;
  const totalAptitudeMarks = questions.reduce((sum, q) => sum + (q.marks || 10), 0);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Question Palette / Index Sidebar */}
      <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Section A: Aptitude</span>
          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
            {totalAptitudeMarks} Marks Total
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Completed Questions</span>
            <span className="font-mono text-slate-200">{answeredCount} of {questions.length}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Numbers Grid */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400">Question Matrix:</div>
          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, idx) => {
              const selected = answers[q.id] !== undefined;
              const isCurrent = idx === currentIndex;
              const isMarked = bookmarked[q.id];

              let bgClass = 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700';
              if (selected) {
                bgClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-700 font-bold';
              }
              if (isMarked) {
                bgClass = 'bg-amber-950/80 text-amber-300 border-amber-700 font-bold';
              }
              if (isCurrent) {
                bgClass += ' ring-2 ring-cyan-400';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 rounded-xl text-xs font-mono border transition flex flex-col items-center justify-center relative cursor-pointer ${bgClass}`}
                >
                  <span>Q{idx + 1}</span>
                  {selected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute bottom-1" />
                  )}
                  {isMarked && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="pt-3 border-t border-slate-800 space-y-1.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded bg-emerald-900 border border-emerald-600" />
            <span>Answered</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded bg-slate-950 border border-slate-800" />
            <span>Unanswered</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded bg-amber-950 border border-amber-600" />
            <span>Marked for Review</span>
          </div>
        </div>

        {/* Shortcut to Coding */}
        <div className="pt-2">
          <button
            onClick={onNavigateToCoding}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-xs font-semibold text-blue-400 hover:text-blue-300 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Switch to Coding Section ({codingMarks} Marks)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Question View */}
      <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
        {/* Question Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="h-7 px-2.5 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 text-xs font-mono font-bold flex items-center">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-medium">
              Topic: {currentQ.topic}
            </span>
            <span className="text-xs px-3 py-1 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-700 font-bold font-mono flex items-center gap-1 shadow-sm">
              Marks: {currentQ.marks || 10} Marks
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-emerald-300 bg-emerald-950/90 px-3 py-1 rounded-lg border border-emerald-700 shadow-sm font-mono">
              +{currentQ.marks || 10} Marks
            </span>
            <button
              onClick={() => toggleBookmark(currentQ.id)}
              className={`p-2 rounded-lg border text-xs transition cursor-pointer flex items-center gap-1 ${
                bookmarked[currentQ.id]
                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="text-[11px]">{bookmarked[currentQ.id] ? 'Marked' : 'Review Later'}</span>
            </button>
          </div>
        </div>

        {/* Question Body */}
        <div className="space-y-4">
          <h3 className="text-base md:text-lg font-medium text-slate-100 leading-relaxed proctor-locked">
            {currentQ.question}
          </h3>

          {/* Options */}
          <div className="space-y-2.5 pt-2">
            {currentQ.options.map((opt, optIdx) => {
              const isSelected = answers[currentQ.id] === optIdx;
              return (
                <label
                  key={optIdx}
                  onClick={() => onSelectAnswer(currentQ.id, optIdx)}
                  className={`flex items-start gap-3.5 p-4 rounded-xl border transition cursor-pointer proctor-locked ${
                    isSelected
                      ? 'bg-cyan-950/50 border-cyan-500/80 text-white shadow-md'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    <span
                      className={`h-5 w-5 rounded-full border flex items-center justify-center text-xs font-bold font-mono transition ${
                        isSelected
                          ? 'bg-cyan-500 border-cyan-400 text-black'
                          : 'border-slate-700 text-slate-400'
                      }`}
                    >
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed">{opt}</div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Navigation Bottom Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 text-xs font-semibold transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shadow-cyan-900/30 cursor-pointer"
            >
              Next Question
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onNavigateToCoding}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-900/30 cursor-pointer"
            >
              Proceed to Coding Section ({codingMarks}M)
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
