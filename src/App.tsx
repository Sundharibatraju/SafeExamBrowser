import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Candidate, AptitudeQuestion, CodingQuestion, CodeExecutionResponse, AssessmentSubmission, ProctoringViolation, SupportedLanguage } from './types';
import { CandidateLogin } from './components/CandidateLogin';
import { DeviceSetup } from './components/DeviceSetup';
import { ProctoringHUD } from './components/ProctoringHUD';
import { AptitudeSection } from './components/AptitudeSection';
import { CodingSection } from './components/CodingSection';
import { MalpracticeBlocked } from './components/MalpracticeBlocked';
import { AssessmentSummary } from './components/AssessmentSummary';
import { RecruiterPortal } from './components/RecruiterPortal';
import { FloatingProctorCamera } from './components/FloatingProctorCamera';
import { useProctoring } from './hooks/useProctoring';
import { AlertTriangle, Send, VideoOff, Maximize2 } from 'lucide-react';

type AppScreen =
  | 'LOGIN'
  | 'DEVICE_SETUP'
  | 'EXAM'
  | 'MALPRACTICE_BLOCKED'
  | 'SUMMARY'
  | 'RECRUITER_PORTAL';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('LOGIN');
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  // Active test state
  const [activeSection, setActiveSection] = useState<'APTITUDE' | 'CODING'>('APTITUDE');
  const [aptitudeQuestions, setAptitudeQuestions] = useState<AptitudeQuestion[]>([]);
  const [codingQuestions, setCodingQuestions] = useState<CodingQuestion[]>([]);
  const [aptitudeAnswers, setAptitudeAnswers] = useState<Record<string, number>>({});
  const [userCodes, setUserCodes] = useState<Record<string, { code: string; language: SupportedLanguage }>>({});
  const [executionResults, setExecutionResults] = useState<Record<string, CodeExecutionResponse>>({});
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(45 * 60); // 45 mins
  const [testStartTime, setTestStartTime] = useState<number>(0);

  const [tabSwitchWarning, setTabSwitchWarning] = useState<{ current: number; max: number; remaining: number } | null>(null);
  const [cameraFaceWarning, setCameraFaceWarning] = useState<{
    current: number;
    max: number;
    remaining: number;
    reason: string;
  } | null>(null);
  const [fullscreenWarning, setFullscreenWarning] = useState<{
    current: number;
    max: number;
    remaining: number;
  } | null>(null);

  // Final Results & Violations
  const [finalSubmission, setFinalSubmission] = useState<AssessmentSubmission | null>(null);
  const [malpracticeNotice, setMalpracticeNotice] = useState<{ reason: string; violation?: ProctoringViolation } | null>(null);

  // Confirmation modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMalpracticeTriggered = useCallback(async (reason: string, violation: ProctoringViolation) => {
    setTabSwitchWarning(null);
    setCameraFaceWarning(null);
    setFullscreenWarning(null);
    setMalpracticeNotice({ reason, violation });
    setCurrentScreen('MALPRACTICE_BLOCKED');

    try {
      sessionStorage.removeItem('proctor_candidate_session');
    } catch {}

    if (candidate) {
      fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          candidateId: candidate.id,
          candidateEmail: candidate.email,
          jobId: candidate.jobId,
          registrationId: candidate.registrationId,
          accessCode: candidate.accessCode,
          role: candidate.role,
          durationSeconds: Math.round((Date.now() - (testStartTime || Date.now())) / 1000),
          aptitudeAnswers,
          codingResults: {},
          violations: [violation]
        })
      }).catch(err => console.error('Failed to log malpractice termination to DB:', err));
    }
  }, [candidate, testStartTime, aptitudeAnswers]);

  const handleTabSwitchWarning = useCallback((current: number, max: number, remaining: number) => {
    setTabSwitchWarning({ current, max, remaining });
  }, []);

  const handleCameraFaceWarning = useCallback((current: number, max: number, remaining: number, reason: string) => {
    setCameraFaceWarning({ current, max, remaining, reason });
  }, []);

  const handleFullscreenWarning = useCallback((current: number, max: number, remaining: number) => {
    setFullscreenWarning({ current, max, remaining });
  }, []);

  const [activeExamStream, setActiveExamStream] = useState<MediaStream | null>(null);

  const {
    videoRef,
    videoStream,
    faceDetected,
    faceAbsenceSeconds,
    violations,
    isTabFocused,
    tabSwitchCount,
    maxTabAttempts,
    cameraFaceWarningCount,
    maxCameraFaceAttempts,
    fullscreenWarningCount,
    maxFullscreenAttempts,
    resumeFromCameraWarning,
    resumeFromFullscreenWarning
  } = useProctoring({
    isActive: currentScreen === 'EXAM',
    candidateId: candidate?.id || '',
    initialStream: activeExamStream,
    onMalpracticeTriggered: handleMalpracticeTriggered,
    onTabSwitchWarning: handleTabSwitchWarning,
    onCameraFaceWarning: handleCameraFaceWarning,
    onFullscreenWarning: handleFullscreenWarning
  });

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('proctor_candidate_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.candidate && parsed.currentScreen === 'DEVICE_SETUP') {
          fetch('/api/candidate/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidateIdOrEmail: parsed.candidate.email || parsed.candidate.id || parsed.candidate.accessCode,
              accessCode: parsed.candidate.accessCode
            })
          })
            .then(async res => {
              const text = await res.text();
              try {
                return JSON.parse(text);
              } catch {
                return { authorized: false };
              }
            })
            .then(valData => {
              if (valData.authorized && valData.candidate) {
                setCandidate(valData.candidate);
                if (parsed.aptitudeQuestions) setAptitudeQuestions(parsed.aptitudeQuestions);
                if (parsed.codingQuestions) setCodingQuestions(parsed.codingQuestions);
                if (parsed.userCodes) setUserCodes(parsed.userCodes);
                setCurrentScreen('DEVICE_SETUP');
              } else {
                sessionStorage.removeItem('proctor_candidate_session');
                setCandidate(null);
                setCurrentScreen('LOGIN');
              }
            })
            .catch(() => {
              sessionStorage.removeItem('proctor_candidate_session');
              setCandidate(null);
              setCurrentScreen('LOGIN');
            });
        }
      }
    } catch (e) {
      console.warn('Failed to restore candidate session:', e);
    }
  }, []);

  useEffect(() => {
    if (currentScreen !== 'EXAM') return;
    const timer = setInterval(() => {
      setTimeRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentScreen]);

  const handleLoginSuccess = async (loggedCandidate: Candidate) => {
    setCandidate(loggedCandidate);
    let extractedAptitude: AptitudeQuestion[] = [];
    let extractedCoding: CodingQuestion[] = [];
    let initialCodes: Record<string, { code: string; language: SupportedLanguage }> = {};

    try {
      const res = await fetch('/api/assessment/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          candidateId: loggedCandidate.id,
          email: loggedCandidate.email,
          role: loggedCandidate.role,
          jobId: loggedCandidate.jobId,
          accessCode: loggedCandidate.accessCode
        })
      });
      const data = await res.json();
      if (data.aptitudeQuestions && Array.isArray(data.aptitudeQuestions)) {
        extractedAptitude = data.aptitudeQuestions;
        setAptitudeQuestions(data.aptitudeQuestions);
      }
      if (data.codingQuestions && Array.isArray(data.codingQuestions)) {
        extractedCoding = data.codingQuestions;
        setCodingQuestions(data.codingQuestions);
        data.codingQuestions.forEach((q: any) => {
          initialCodes[q.id] = {
            code: '',
            language: 'python'
          };
        });
        setUserCodes(initialCodes);
      }
    } catch (e) {
      console.error('Failed to extract questions from database:', e);
    }

    try {
      sessionStorage.setItem('proctor_candidate_session', JSON.stringify({
        candidate: loggedCandidate,
        currentScreen: 'DEVICE_SETUP',
        aptitudeQuestions: extractedAptitude,
        codingQuestions: extractedCoding,
        userCodes: initialCodes
      }));
    } catch (e) {
      console.warn('Failed to persist candidate session:', e);
    }

    setCurrentScreen('DEVICE_SETUP');
  };

  const handleStartAssessment = (stream: MediaStream | null) => {
    setActiveExamStream(stream);
    setTestStartTime(Date.now());
    setCurrentScreen('EXAM');
    setActiveSection('APTITUDE');

    if (candidate) {
      fetch('/api/assessment/start-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          candidateEmail: candidate.email,
          registrationId: candidate.registrationId,
          accessCode: candidate.accessCode
        })
      }).catch(err => console.error('Failed to mark assessment start:', err));
    }
  };

  const handleSelectAptitudeAnswer = (questionId: string, optionIndex: number) => {
    setAptitudeAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleUpdateCode = (questionId: string, code: string, language: SupportedLanguage) => {
    setUserCodes(prev => ({
      ...prev,
      [questionId]: { code, language }
    }));
    // Keep last run test case button score intact so candidate never loses marks on editing
  };

  const handleExecutionCompleted = (questionId: string, result: CodeExecutionResponse) => {
    setExecutionResults(prev => ({
      ...prev,
      [questionId]: result
    }));
  };

  const handleFinalSubmit = async () => {
    if (!candidate) return;
    setIsSubmitting(true);
    try {
      const duration = Math.round((Date.now() - (testStartTime || Date.now())) / 1000);
      const codingPayload: Record<string, any> = {};

      for (const q of codingQuestions) {
        let resEntry = executionResults[q.id];
        const userCodeEntry = userCodes[q.id];
        const activeCode = userCodeEntry?.code?.trim() || '';
        const lang = userCodeEntry?.language || 'python';

        // Evaluate before submission if un-run or if code was written without running
        if ((!resEntry || (resEntry.passedCases === 0 && (!resEntry.scoreAwarded || resEntry.scoreAwarded === 0))) && activeCode.length > 0) {
          try {
            const execRes = await fetch('/api/compiler/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                questionId: q.id,
                code: activeCode,
                language: lang
              })
            });
            const execData = await execRes.json();
            if (execData && (execData.passedCases !== undefined || execData.passedTestCases !== undefined)) {
              resEntry = execData;
            }
          } catch (e) {
            console.warn('Auto test case evaluation notice:', e);
          }
        }

        const scoreAwarded = resEntry?.scoreAwarded !== undefined
          ? resEntry.scoreAwarded
          : ((resEntry as any)?.score !== undefined ? (resEntry as any).score : 0);

        codingPayload[q.id] = {
          code: activeCode,
          language: lang,
          score: scoreAwarded,
          scoreAwarded,
          passedCases: resEntry?.passedCases ?? (resEntry as any)?.passedTestCases ?? 0,
          totalCases: resEntry?.totalCases ?? (resEntry as any)?.totalTestCases ?? (q.testCases?.length || 3)
        };
      }

      const res = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          candidateId: candidate.id,
          candidateEmail: candidate.email,
          jobId: candidate.jobId,
          registrationId: candidate.registrationId,
          accessCode: candidate.accessCode,
          role: candidate.role,
          durationSeconds: duration,
          aptitudeAnswers,
          codingResults: codingPayload,
          violations
        })
      });

      try {
        sessionStorage.removeItem('proctor_candidate_session');
      } catch {}

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = {
          success: true,
          submission: {
            candidateId: candidate.id,
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            role: candidate.role,
            startedAt: testStartTime || Date.now() - duration * 1000,
            completedAt: Date.now(),
            durationSeconds: duration,
            violations: violations || [],
            status: violations.some(v => v.type === 'TAB_SWITCH' || v.type === 'WINDOW_BLUR') ? 'TERMINATED_MALPRACTICE' : 'COMPLETED'
          }
        };
      }

      if (data && data.submission) {
        setFinalSubmission(data.submission);
        setShowSubmitModal(false);
        setCurrentScreen('SUMMARY');
      }
    } catch (err) {
      console.error('Submission error:', err);
      try {
        sessionStorage.removeItem('proctor_candidate_session');
      } catch {}
      if (candidate) {
        setFinalSubmission({
          candidateId: candidate.id,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          role: candidate.role,
          startedAt: testStartTime || Date.now() - 1800000,
          completedAt: Date.now(),
          durationSeconds: 1800,
          aptitudeScore: 0,
          codingScore: 0,
          totalScore: 0,
          status: 'FAIL',
          violations: violations || [],
          aptitudeAnswers: aptitudeAnswers || {},
          codingSubmissions: {},
          recruiterSyncStatus: 'LOCAL_STORED'
        });
        setShowSubmitModal(false);
        setCurrentScreen('SUMMARY');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* 1. Login View */}
      {currentScreen === 'LOGIN' && (
        <CandidateLogin
          onLoginSuccess={handleLoginSuccess}
          onOpenRecruiterPortal={() => setCurrentScreen('RECRUITER_PORTAL')}
        />
      )}

      {/* 2. Device Pre-Flight & Anti-Cheating Setup */}
      {currentScreen === 'DEVICE_SETUP' && candidate && (
        <DeviceSetup
          candidate={candidate}
          onStartAssessment={handleStartAssessment}
          onCancel={() => {
            try {
              sessionStorage.removeItem('proctor_candidate_session');
            } catch {}
            setCandidate(null);
            setCurrentScreen('LOGIN');
          }}
        />
      )}

      {/* 3. Live Assessment View */}
      {currentScreen === 'EXAM' && candidate && (
        <div
          className="flex flex-col min-h-screen select-none proctor-locked secure-exam-container"
          onContextMenu={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onPaste={(e) => e.preventDefault()}
        >
          {/* Proctoring HUD Header */}
          <ProctoringHUD
            candidate={candidate}
            timeRemainingSeconds={timeRemainingSeconds}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            videoRef={videoRef}
            faceDetected={faceDetected}
            faceAbsenceSeconds={faceAbsenceSeconds}
            isTabFocused={isTabFocused}
            aptitudeProgress={{
              answered: Object.keys(aptitudeAnswers).length,
              total: aptitudeQuestions.length,
              totalMarks: Math.max(0, 100 - (codingQuestions.length * 10))
            }}
            codingProgress={{
              solved: Object.values(executionResults).filter(r => r.status === 'ACCEPTED').length,
              total: codingQuestions.length,
              totalMarks: codingQuestions.length * 10
            }}
            onSubmitClick={() => setShowSubmitModal(true)}
            tabSwitchCount={tabSwitchCount}
            maxTabAttempts={maxTabAttempts}
            cameraFaceWarningCount={cameraFaceWarningCount}
            maxCameraFaceAttempts={maxCameraFaceAttempts}
            fullscreenWarningCount={fullscreenWarningCount}
            maxFullscreenAttempts={maxFullscreenAttempts}
          />

          {/* Continuous Floating Live Proctoring Camera Widget */}
          <FloatingProctorCamera
            videoRef={videoRef}
            videoStream={videoStream}
            faceDetected={faceDetected}
            faceAbsenceSeconds={faceAbsenceSeconds}
            tabSwitchCount={tabSwitchCount}
            maxTabAttempts={maxTabAttempts}
            cameraFaceWarningCount={cameraFaceWarningCount}
            maxCameraFaceAttempts={maxCameraFaceAttempts}
            fullscreenWarningCount={fullscreenWarningCount}
            maxFullscreenAttempts={maxFullscreenAttempts}
            candidate={candidate}
          />

          {/* In-App Camera Closed / No Face Warning Modal (1s absence rule, max 3 before block) */}
          {cameraFaceWarning && (
            <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="h-14 w-14 rounded-2xl bg-rose-950/80 border-2 border-rose-500 flex items-center justify-center text-rose-400 mx-auto shadow-lg shadow-rose-900/50">
                  <VideoOff className="w-8 h-8 animate-pulse" />
                </div>
                <div className="text-center space-y-1.5">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-rose-400 uppercase bg-rose-950 px-3 py-1 rounded-full border border-rose-700">
                    CAMERA / FACE VIOLATION &bull; WARNING {cameraFaceWarning.current} OF {cameraFaceWarning.max}
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight pt-1">
                    Camera Closed or Face Absent
                  </h3>
                  <p className="text-xs text-rose-200/90 leading-relaxed">
                    {cameraFaceWarning.reason} Continuous visual presence is strictly required.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Violations Triggered:</span>
                    <span className="font-mono font-bold text-rose-400">{cameraFaceWarning.current} / {cameraFaceWarning.max}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Remaining Warnings:</span>
                    <span className="font-mono font-bold text-amber-400">{cameraFaceWarning.remaining} Chance(s) Left</span>
                  </div>
                  <p className="text-[11px] text-rose-300/90 font-mono pt-1 border-t border-slate-800">
                    &bull; Strict Rule: If camera is closed or face is missing for 1s more than 3 times, you will be permanently blocked from the test with 0 marks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resumeFromCameraWarning();
                    setCameraFaceWarning(null);
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-rose-950"
                >
                  I Understand &bull; Resume Assessment
                </button>
              </div>
            </div>
          )}

          {/* In-App Fullscreen Mode Warning Modal (3 chances rule) */}
          {fullscreenWarning && (
            <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-slate-900 border-2 border-indigo-500 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="h-14 w-14 rounded-2xl bg-indigo-950/80 border-2 border-indigo-500 flex items-center justify-center text-indigo-400 mx-auto shadow-lg shadow-indigo-900/50">
                  <Maximize2 className="w-8 h-8 animate-pulse" />
                </div>
                <div className="text-center space-y-1.5">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-indigo-400 uppercase bg-indigo-950 px-3 py-1 rounded-full border border-indigo-700">
                    FULLSCREEN VIOLATION &bull; WARNING {fullscreenWarning.current} OF {fullscreenWarning.max}
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight pt-1">
                    Exited Full Screen Container
                  </h3>
                  <p className="text-xs text-indigo-200/90 leading-relaxed">
                    You have exited the mandatory full screen assessment environment. Continuous full screen presence is strictly enforced.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Violations Triggered:</span>
                    <span className="font-mono font-bold text-indigo-400">{fullscreenWarning.current} / {fullscreenWarning.max}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Remaining Warnings:</span>
                    <span className="font-mono font-bold text-amber-400">{fullscreenWarning.remaining} Chance(s) Left</span>
                  </div>
                  <p className="text-[11px] text-indigo-300/90 font-mono pt-1 border-t border-slate-800">
                    &bull; Strict Rule: If you exit full screen mode more than 3 times, you will be permanently blocked from the test with 0 marks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (document.documentElement.requestFullscreen) {
                        await document.documentElement.requestFullscreen();
                      }
                    } catch (e) {
                      console.warn('Re-enter fullscreen request bypassed:', e);
                    }
                    resumeFromFullscreenWarning();
                    setFullscreenWarning(null);
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-indigo-950"
                >
                  Re-enter Full Screen & Resume
                </button>
              </div>
            </div>
          )}

          {/* In-App Tab Switch Warning Modal (3 chances rule) */}
          {tabSwitchWarning && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="h-14 w-14 rounded-2xl bg-amber-950/80 border-2 border-amber-500 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-900/40">
                  <AlertTriangle className="w-8 h-8 animate-bounce" />
                </div>
                <div className="text-center space-y-1.5">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase bg-amber-950 px-3 py-1 rounded-full border border-amber-700">
                    PROCTORING WARNING &bull; ATTEMPT {tabSwitchWarning.current} OF {tabSwitchWarning.max}
                  </span>
                  <h3 className="text-xl font-bold text-white tracking-tight pt-1">
                    Tab Switch or Window Blur Detected
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Navigating away from the assessment tab, minimizing the browser, or interacting with background windows is monitored and penalized.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Chances Used:</span>
                    <span className="font-mono font-bold text-amber-400">{tabSwitchWarning.current} / {tabSwitchWarning.max}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Remaining Warnings:</span>
                    <span className="font-mono font-bold text-rose-400">{tabSwitchWarning.remaining} Warning(s) Left</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90 font-mono pt-1 border-t border-slate-800">
                    &bull; Strict Rule: If you switch tabs more than 3 times, you will be permanently blocked from the test with 0 marks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTabSwitchWarning(null)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-amber-950"
                >
                  I Understand &bull; Return to Assessment
                </button>
              </div>
            </div>
          )}

          {/* Body Section Switcher */}
          <main className="flex-1 pb-12">
            {activeSection === 'APTITUDE' ? (
              <AptitudeSection
                questions={aptitudeQuestions}
                answers={aptitudeAnswers}
                onSelectAnswer={handleSelectAptitudeAnswer}
                onNavigateToCoding={() => setActiveSection('CODING')}
                codingMarks={codingQuestions.length * 10}
              />
            ) : (
              <CodingSection
                questions={codingQuestions}
                userCodes={userCodes}
                onUpdateCode={handleUpdateCode}
                executionResults={executionResults}
                onExecutionCompleted={handleExecutionCompleted}
                onNavigateToAptitude={() => setActiveSection('APTITUDE')}
                aptitudeMarks={Math.max(0, 100 - (codingQuestions.length * 10))}
              />
            )}
          </main>
        </div>
      )}

      {/* 4. Malpractice Disqualification Screen */}
      {currentScreen === 'MALPRACTICE_BLOCKED' && candidate && (
        <MalpracticeBlocked
          candidateName={candidate.name}
          candidateId={candidate.id}
          role={candidate.role}
          reason={malpracticeNotice?.reason || 'Malpractice violation detected.'}
          violation={malpracticeNotice?.violation}
          onReturnHome={() => {
            setCandidate(null);
            setCurrentScreen('LOGIN');
          }}
        />
      )}

      {/* 5. Legitimate Assessment Summary View */}
      {currentScreen === 'SUMMARY' && finalSubmission && (
        <AssessmentSummary
          submission={finalSubmission}
          onReturnHome={() => {
            setCandidate(null);
            setCurrentScreen('LOGIN');
          }}
          onOpenRecruiterPortal={() => setCurrentScreen('RECRUITER_PORTAL')}
        />
      )}

      {/* 6. Recruiter Portal & DB Sync Console */}
      {currentScreen === 'RECRUITER_PORTAL' && (
        <RecruiterPortal
          onClose={() => setCurrentScreen(candidate ? 'EXAM' : 'LOGIN')}
        />
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 mx-auto">
              <Send className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-xl font-bold text-white tracking-tight">Confirm Final Submission?</h3>
              <p className="text-xs text-slate-400">
                Your answers and coding submissions will be finalized, scored out of 100 marks, and transmitted to the database.
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Aptitude Questions Answered:</span>
                <strong className="text-cyan-400 font-mono">
                  {Object.keys(aptitudeAnswers).length} / {aptitudeQuestions.length}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Coding Problems Tested:</span>
                <strong className="text-blue-400 font-mono">
                  {Object.keys(executionResults).length} / {codingQuestions.length}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Time Remaining:</span>
                <strong className="text-slate-200 font-mono">
                  {Math.floor(timeRemainingSeconds / 60)}m {timeRemainingSeconds % 60}s
                </strong>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Return to Test
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Confirm & Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
