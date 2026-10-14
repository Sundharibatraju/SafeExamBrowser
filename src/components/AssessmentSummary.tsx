import React from 'react';
import { AssessmentSubmission } from '../types';
import { CheckCircle2, ShieldCheck, Clock, Check, LogOut } from 'lucide-react';

interface AssessmentSummaryProps {
  submission: AssessmentSubmission;
  onReturnHome: () => void;
  onOpenRecruiterPortal?: () => void;
}

export const AssessmentSummary: React.FC<AssessmentSummaryProps> = ({
  submission,
  onReturnHome
}) => {
  const mins = Math.floor(submission.durationSeconds / 60);
  const secs = submission.durationSeconds % 60;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Status Header */}
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto border shadow-lg bg-emerald-950 border-emerald-500 text-emerald-400 shadow-emerald-950/50">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider border bg-emerald-950 text-emerald-300 border-emerald-800">
              Completed Successfully
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mt-3">
              Assessment Submitted Successfully
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-2">
              Candidate: <strong className="text-slate-200">{submission.candidateName}</strong> ({submission.candidateId})
            </p>
          </div>
        </div>

        {/* Confirmation Message Card */}
        <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              <Check className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-slate-200 text-sm">Responses Safely Recorded</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                All aptitude question answers and compiled coding solutions have been finalized. The recruitment evaluation committee will review your submissions against role benchmarks and contact you with further updates.
              </p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-900/60 text-amber-300 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Note: Once submitted, return to the assessment is locked and re-attempts are disabled.</span>
          </div>
        </div>

        {/* Audit Details */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Duration:
            </span>
            <span className="font-mono text-slate-200">{mins}m {secs}s</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Proctoring Status:
            </span>
            <span className="font-semibold text-emerald-400">
              Session Integrity Verified
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Submission Status:</span>
            <span className="font-mono text-cyan-300 font-semibold">
              Finalized & Transmitted
            </span>
          </div>
        </div>

        {/* Exit Action Button */}
        <div className="pt-2">
          <button
            onClick={onReturnHome}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition shadow-md cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Close & Exit Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
