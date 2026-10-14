import React from 'react';
import { Shield, Eye, Clock, AlertTriangle, Code, BookOpen, Send, Maximize2 } from 'lucide-react';
import { Candidate } from '../types';

interface ProctoringHUDProps {
  candidate: Candidate;
  timeRemainingSeconds: number;
  activeSection: 'APTITUDE' | 'CODING';
  onSelectSection: (section: 'APTITUDE' | 'CODING') => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  faceDetected: boolean;
  faceAbsenceSeconds: number;
  isTabFocused: boolean;
  aptitudeProgress: { answered: number; total: number; totalMarks?: number };
  codingProgress: { solved: number; total: number; totalMarks?: number };
  onSubmitClick: () => void;
  tabSwitchCount?: number;
  maxTabAttempts?: number;
  cameraFaceWarningCount?: number;
  maxCameraFaceAttempts?: number;
  fullscreenWarningCount?: number;
  maxFullscreenAttempts?: number;
}

export const ProctoringHUD: React.FC<ProctoringHUDProps> = ({
  candidate,
  timeRemainingSeconds,
  activeSection,
  onSelectSection,
  faceDetected,
  faceAbsenceSeconds,
  isTabFocused,
  aptitudeProgress,
  codingProgress,
  onSubmitClick,
  tabSwitchCount = 0,
  maxTabAttempts = 3,
  cameraFaceWarningCount = 0,
  maxCameraFaceAttempts = 3,
  fullscreenWarningCount = 0,
  maxFullscreenAttempts = 3
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isTimeCritical = timeRemainingSeconds < 300; // Under 5 mins

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-xl px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Candidate Info & Section Switcher */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center font-bold text-cyan-400 text-xs">
              PRO
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                {candidate.name}
                <span className="text-[10px] text-slate-400 font-mono">({candidate.id})</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{candidate.role}</div>
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              onClick={() => onSelectSection('APTITUDE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSection === 'APTITUDE'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Aptitude ({aptitudeProgress.totalMarks ?? 80}M)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {aptitudeProgress.answered}/{aptitudeProgress.total}
              </span>
            </button>
            <button
              onClick={() => onSelectSection('CODING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeSection === 'CODING'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Coding ({codingProgress.totalMarks ?? 20}M)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 font-mono">
                {codingProgress.solved}/{codingProgress.total}
              </span>
            </button>
          </div>
        </div>

        {/* Center: Proctoring Status & Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${faceDetected ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`} />
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI PROCTOR</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                faceDetected
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
              }`}
            >
              <Eye className="w-3 h-3" />
              {faceDetected ? 'Face Verified' : 'Face Alert (1s)'}
            </span>

            {/* Camera / Face Warnings Counter Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-lg border ${
                cameraFaceWarningCount > 0
                  ? 'bg-rose-950/90 text-rose-300 border-rose-700 font-bold'
                  : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
              title="Camera closed or face absent warnings (Max 3 before block)"
            >
              <Eye className="w-3 h-3 text-rose-400" />
              Cam/Face Warnings: {cameraFaceWarningCount}/{maxCameraFaceAttempts}
            </span>

            {/* Fullscreen Warnings Counter Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-lg border ${
                fullscreenWarningCount > 0
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700 font-bold'
                  : 'bg-slate-900 text-indigo-400 border-slate-800'
              }`}
              title="Full-screen exit warnings allowed before disqualification"
            >
              <Maximize2 className="w-3 h-3 text-indigo-400" />
              FS Warnings: {fullscreenWarningCount}/{maxFullscreenAttempts}
            </span>

            {/* Tab Switch Warnings Counter Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-lg border ${
                tabSwitchCount > 0
                  ? 'bg-amber-950/80 text-amber-300 border-amber-700 font-bold'
                  : 'bg-slate-900 text-cyan-400 border-slate-800'
              }`}
              title="Tab switch attempts allowed before disqualification"
            >
              <Shield className="w-3 h-3 text-cyan-400" />
              Tab Warnings: {tabSwitchCount}/{maxTabAttempts}
            </span>
          </div>
        </div>

        {/* Right: Timer & Submit Button */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
              isTimeCritical
                ? 'bg-rose-950/90 text-rose-300 border-rose-700 animate-pulse'
                : 'bg-slate-900 text-slate-200 border-slate-800'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${isTimeCritical ? 'text-rose-400' : 'text-cyan-400'}`} />
            <span>{formatTime(timeRemainingSeconds)}</span>
          </div>

          <button
            onClick={onSubmitClick}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Submit Final Assessment
          </button>
        </div>
      </div>

      {/* Warning Banner if Face Absent / Camera Closed */}
      {!faceDetected && (
        <div className="mt-2 py-1 px-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-200 text-xs font-semibold flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>WARNING: Camera closed or face not visible! Keep face directly in camera viewport (1 second rule).</span>
          </div>
          <span className="font-mono bg-rose-900 px-2 py-0.5 rounded text-[11px]">
            Warning triggers at 1s absence
          </span>
        </div>
      )}
    </header>
  );
};
