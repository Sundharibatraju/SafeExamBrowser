import React from 'react';
import { ShieldAlert, Ban, Clock, Database, AlertOctagon } from 'lucide-react';
import { ProctoringViolation } from '../types';

interface MalpracticeBlockedProps {
  candidateName: string;
  candidateId: string;
  role: string;
  reason: string;
  violation?: ProctoringViolation;
  onReturnHome: () => void;
}

export const MalpracticeBlocked: React.FC<MalpracticeBlockedProps> = ({
  candidateName,
  candidateId,
  role,
  reason,
  violation,
  onReturnHome
}) => {
  return (
    <div className="min-h-screen bg-black text-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="max-w-xl w-full bg-slate-950 border-2 border-rose-600 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-center">
        {/* Warning Icon Badge */}
        <div className="h-16 w-16 rounded-2xl bg-rose-950 border-2 border-rose-600 flex items-center justify-center text-rose-500 mx-auto shadow-lg shadow-rose-900/50 animate-pulse">
          <AlertOctagon className="w-9 h-9" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold tracking-widest text-rose-400 uppercase bg-rose-950/80 px-3 py-1 rounded-full border border-rose-800">
            DISQUALIFIED &bull; MALPRACTICE PROTOCOL TRIGGERED
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Assessment Session Terminated
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            A critical proctoring violation was detected during your live evaluation session.
          </p>
        </div>

        {/* Audit Details Card */}
        <div className="bg-slate-900/90 border border-rose-900/70 rounded-2xl p-5 text-left space-y-3">
          <div className="text-xs font-semibold text-rose-300 flex items-center gap-2 border-b border-slate-800 pb-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Official Malpractice Incident Record
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Candidate Name:</span>
              <span className="font-bold text-slate-200">{candidateName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Candidate ID:</span>
              <span className="font-mono font-bold text-cyan-400">{candidateId}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Target Role:</span>
              <span className="text-slate-200 truncate">{role}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Status In Database:</span>
              <span className="font-bold font-mono text-rose-400">TERMINATED_MALPRACTICE</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-mono font-semibold">Incident Cause:</span>
              {violation?.type && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-800">
                  {violation.type}
                </span>
              )}
            </div>
            <div className="text-xs text-rose-200 bg-rose-950/60 p-3 rounded-xl border border-rose-800 font-mono leading-relaxed">
              <div className="font-bold text-rose-300 mb-1">{reason}</div>
              {violation?.details && violation.details !== reason && (
                <div className="text-[11px] text-rose-400/90 pt-1 border-t border-rose-900/50">
                  Detail: {violation.details}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Timestamp: {new Date(violation?.timestamp || Date.now()).toLocaleTimeString()} ({new Date(violation?.timestamp || Date.now()).toLocaleDateString()})</span>
            </div>
            <span className="text-rose-400 font-mono font-bold">Severity: CRITICAL</span>
          </div>
        </div>

        {/* Recruiter Notice */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2">
          <Database className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Incident and candidate disqualification status have been logged to the database.</span>
        </div>

        {/* Action Button */}
        <button
          onClick={onReturnHome}
          className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
        >
          Return to Portal Overview
        </button>
      </div>
    </div>
  );
};
