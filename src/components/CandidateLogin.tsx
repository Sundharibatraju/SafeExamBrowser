import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertTriangle, UserCheck, Database, Ban, Cpu, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { Candidate } from '../types';

interface CandidateLoginProps {
  onLoginSuccess: (candidate: Candidate) => void;
  onOpenRecruiterPortal?: () => void;
}

function cleanText(str?: string): string {
  if (!str) return '';
  let cleaned = str.replace(/<[^>]*>?/gm, ' ');
  cleaned = cleaned
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  if (cleaned.toLowerCase().includes('403 forbidden')) {
    return 'This assessment code has already been used and submitted to the database. Only 1 attempt is permitted per candidate key.';
  }
  return cleaned;
}

export const CandidateLogin: React.FC<CandidateLoginProps> = ({
  onLoginSuccess,
  onOpenRecruiterPortal
}) => {
  const [candidateIdOrEmail, setCandidateIdOrEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [blockedModal, setBlockedModal] = useState<{ isOpen: boolean; title: string; detail: string } | null>(null);

  // Recruiter Master Passcode Gate state
  const [showRecruiterModal, setShowRecruiterModal] = useState(false);
  const [recruiterPasscode, setRecruiterPasscode] = useState('');
  const [recruiterError, setRecruiterError] = useState<string | null>(null);
  const [recruiterVerifying, setRecruiterVerifying] = useState(false);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanCode = accessCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (cleanCode.length < 4 || cleanCode.length > 32) {
      setErrorMsg('Please enter a valid assessment access code (4 to 32 characters).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/candidate/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          candidateIdOrEmail: candidateIdOrEmail.trim(),
          accessCode: cleanCode
        })
      });

      let data: any = {};
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        const cleaned = cleanText(rawText);
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          setErrorMsg('The verification service is initializing. Please click Verify & Enter Assessment again.');
          return;
        }
        data = {
          authorized: false,
          isBlocked: true,
          error: 'Assessment Code Already Used',
          message: cleaned || 'This assessment code has already been used. Only one attempt is permitted per candidate access key.'
        };
      }

      if (!res.ok || !data.authorized) {
        if (data.isBlocked || data.reason === 'MAX_ATTEMPTS_EXCEEDED' || data.error?.includes('Already Used')) {
          const rawTitle = data.error || 'Assessment Code Already Used';
          const rawDetail = data.message || 'This assessment code has already been used. Only one attempt is permitted per candidate access key. The assessment has already been completed and submitted.';
          let title = cleanText(rawTitle);
          let detail = cleanText(rawDetail);
          if (title.toLowerCase().includes('server error') || title.toLowerCase().includes('forbidden')) {
            title = 'Assessment Code Already Used';
          }
          if (detail.toLowerCase().includes('forbidden')) {
            detail = 'This assessment code has already been used. Only one attempt is permitted per candidate access key.';
          }
          setErrorMsg(`${title}: ${detail}`);
          setBlockedModal({
            isOpen: true,
            title,
            detail
          });
        } else {
          setErrorMsg(cleanText(data.message || data.error || 'Validation failed. Please verify your credentials.'));
        }
        return;
      }

      if (data.authorized && data.candidate) {
        onLoginSuccess(data.candidate);
      }
    } catch (err: any) {
      console.error('Candidate validation error:', err);
      setErrorMsg(cleanText(err.message) || 'Unable to connect to assessment verification service. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecruiterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecruiterError(null);
    setRecruiterVerifying(true);
    try {
      const res = await fetch('/api/recruiter/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: recruiterPasscode })
      });
      const data = await res.json();
      if (res.ok && data.authorized) {
        setShowRecruiterModal(false);
        setRecruiterPasscode('');
        if (onOpenRecruiterPortal) onOpenRecruiterPortal();
      } else {
        setRecruiterError(data.message || 'Unauthorized: Invalid recruiter passcode. Access is restricted.');
      }
    } catch (err) {
      setRecruiterError('Error verifying recruiter credentials.');
    } finally {
      setRecruiterVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8">
      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Technical Assessment Engine
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                SECURE v2.0
              </span>
            </h1>
            <p className="text-xs text-slate-400">Strict Anti-Cheating & Dynamic Compiler Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>Proctored Session ID: #SEC-{Math.floor(Date.now() / 100000)}</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Assessment Architecture & Strict Protocols */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Pre-Screened Candidate Verification
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
              Pre-Screened Candidate Verification & Technical Evaluation
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              This environment is strictly linked to your job application records. Only shortlisted candidates who passed the initial resume screening stage are authenticated.
            </p>
          </div>

          {/* Strict Protocols Warning Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-rose-950/40 to-slate-900/90 border border-rose-900/60 space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-rose-500" />
              MANDATORY PROCTORING PROTOCOLS (AUTOMATIC MALPRACTICE BLOCK)
            </div>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <strong className="text-rose-200">Protocol 1: Zero Tab Switching & Window Blurring.</strong> Navigating away from the assessment tab, minimizing the window, or switching apps triggers instant disqualification and permanently flags the attempt as malpractice in the database.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <strong className="text-rose-200">Protocol 2: Browser Extensions & DevTools Prohibited.</strong> Browser extensions, inspect element, F12, and third-party DOM injectors are actively detected in real time and cause immediate session termination.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-rose-200">Protocol 3: Continuous Camera Stream Required.</strong> Turning off your webcam, muting video hardware, or revoking camera permission during the exam immediately terminates the session and logs a permanent malpractice record.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  4
                </span>
                <div>
                  <strong className="text-rose-200">Protocol 4: Zero Screenshots & Copy Commands.</strong> PrintScreen, screen capture tools, copy (Ctrl+C), cut (Ctrl+X), paste (Ctrl+V), and right-click menus are locked. Attempts will be intercepted and penalized.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  5
                </span>
                <div>
                  <strong className="text-rose-200">Protocol 5: Face Presence Verification.</strong> Your face must stay within the camera frame. An absence exceeding 1 second triggers a warning (maximum 3 warnings before automatic malpractice lock).
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="lg:col-span-5 bg-slate-900/95 border border-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl relative">
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Lock className="w-3.5 h-3.5" />
              CANDIDATE AUTHENTICATION
            </div>
            <h3 className="text-xl font-bold text-white">Enter Assessment Session</h3>
            <p className="text-xs text-slate-400">
              Enter your Candidate ID (or registered application email) and your secure access key.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleValidate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Application Email or Candidate ID
              </label>
              <input
                type="text"
                required
                value={candidateIdOrEmail}
                onChange={(e) => setCandidateIdOrEmail(e.target.value)}
                placeholder="e.g. dhanushprojects123@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Assessment Access Code / Key
                </label>
                <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                  {accessCode.length}/32 chars
                </span>
              </div>
              <input
                type="text"
                autoCapitalize="characters"
                maxLength={32}
                required
                value={accessCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
                  setAccessCode(val);
                }}
                placeholder="e.g. TECH-8023 or XDC2UF6694EM"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 text-sm font-mono tracking-wider"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Enter your pre-screened assessment access code (e.g. TECH-8023, XDC2UF6694EM).
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-900/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Verify Credentials & Enter
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Single-Use Assessment Policy Notice */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Strict Single-Use Assessment Policy</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed space-y-1.5">
              <p>
                <strong className="text-slate-200">1. One-Time Attempt Permitted:</strong> Your unique candidate access key is single-use. Once the assessment commences or is submitted, the code expires immediately.
              </p>
              <p>
                <strong className="text-slate-200">2. Active Proctoring Protocol:</strong> Full-screen container, continuous camera/face presence, and tab focus are strictly enforced with a maximum of 3 warnings each before automatic malpractice disqualification.
              </p>
              <p>
                <strong className="text-slate-200">3. Zero-Tolerance Browser Extension Policy:</strong> All browser extensions must be turned OFF. Continuous real-time verification detects any active extension or sudden mid-exam activation.
              </p>
              <p>
                <strong className="text-slate-200">4. Direct Database Synchronized:</strong> Assessment questions and test cases are synchronized with the PostgreSQL database.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer with Restricted Recruiter Console Entry */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>&copy; 2026 Autonomous Technical Assessment System &bull; ISO/IEC Anti-Cheating Standard</span>
        
        <div className="flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            Sandbox Compiler Active
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
            Proctor AI Active
          </span>
          <button
            type="button"
            onClick={() => {
              setRecruiterError(null);
              setRecruiterPasscode('');
              setShowRecruiterModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-400 hover:text-cyan-300 transition text-xs font-medium cursor-pointer"
            title="Restricted: Recruiter Authorization Required"
          >
            <Lock className="w-3 h-3 text-cyan-400" />
            Recruiter Console
          </button>
        </div>
      </footer>

      {/* Restricted Recruiter Access Gate Modal */}
      {showRecruiterModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white tracking-tight">Recruiter Console Authorization</h4>
                  <p className="text-xs text-slate-400">Restricted Admin & Evaluator Portal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecruiterModal(false)}
                className="text-slate-500 hover:text-slate-300 text-sm p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Candidates Not Permitted:</strong> Candidates are strictly not permitted to view this screen. Authorization requires valid recruiter credentials.
              </span>
            </div>
            <form onSubmit={handleRecruiterLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Master Recruiter Passcode</label>
                <input
                  type="password"
                  required
                  value={recruiterPasscode}
                  onChange={(e) => setRecruiterPasscode(e.target.value)}
                  placeholder="Enter recruiter passcode"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 text-sm font-mono"
                  autoFocus
                />
              </div>
              {recruiterError && (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{recruiterError}</span>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRecruiterModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recruiterVerifying}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {recruiterVerifying ? 'Verifying...' : 'Authenticate & Enter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unregistered Candidate Rejection / Block Modal */}
      {blockedModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border-2 border-rose-600 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="h-12 w-12 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-500 mx-auto">
              <Ban className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h4 className="text-lg font-extrabold text-white tracking-tight">{blockedModal.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {blockedModal.detail}
              </p>
            </div>
            {blockedModal.title.includes('Already Used') ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                    <ShieldCheck className="w-4 h-4 text-rose-400" />
                    <span>Single-Attempt Examination Protocol</span>
                  </div>
                  <p className="leading-relaxed">
                    This assessment access key has already been completed and submitted to the evaluation database.
                    Under strict examination integrity regulations, <strong>only one attempt is permitted</strong> per candidate access code. Re-attempts are strictly disabled.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBlockedModal(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer"
                >
                  Acknowledge & Close
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900 text-xs text-rose-200">
                  <strong>Database Protocol Enforced:</strong> Candidates must be screened and shortlisted through the recruiter's primary screening website first. Uninvited registrations are rejected and logged.
                </div>
                <button
                  onClick={() => setBlockedModal(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer"
                >
                  Acknowledge & Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
