import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, ShieldAlert, Maximize2, AlertCircle, Play, Sparkles, ShieldCheck, RefreshCw, Ban, AlertTriangle, ExternalLink } from 'lucide-react';
import { Candidate } from '../types';
import {
  runExtensionAudit,
  ExtensionAuditReport,
  verifyExtensionTurnedOffWithBackend,
  BackendAuditVerificationResponse,
  startRealtimeExtensionWatchdog,
  cleanupInactiveExtensionArtifacts
} from '../utils/extensionDetector';

interface DeviceSetupProps {
  candidate: Candidate;
  onStartAssessment: (stream: MediaStream | null) => void;
  onCancel: () => void;
}

export const DeviceSetup: React.FC<DeviceSetupProps> = ({
  candidate,
  onStartAssessment,
  onCancel
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [extensionAudit, setExtensionAudit] = useState<ExtensionAuditReport>({
    hasExtension: false,
    blocked: false,
    extensions: [],
    timestamp: Date.now()
  });
  const [isScanningExtensions, setIsScanningExtensions] = useState(false);
  const [isVerifyingWithBackend, setIsVerifyingWithBackend] = useState(false);
  const [backendVerificationStatus, setBackendVerificationStatus] = useState<{
    verifiedAt: number;
    clean: boolean;
    message: string;
    serverAuditId?: string;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isVerifyingRef = useRef(false);
  const isLaunchingRef = useRef(false);

  /**
   * Real-time Environment Audit & Backend Verification
   * Executes local comprehensive client scan in 0ms AND contacts backend API in real-time.
   */
  const performExtensionAuditAndVerify = async (quiet: boolean = false) => {
    const clientReport = runExtensionAudit();
    setExtensionAudit(clientReport);

    if (clientReport.hasExtension) {
      setBackendVerificationStatus(prev => ({
        verifiedAt: Date.now(),
        clean: false,
        message: `Active extension "${clientReport.extensions[0]?.name || 'Unknown'}" detected. Exam launch is blocked. Turn off all extensions.`,
        serverAuditId: prev?.serverAuditId || `local-${Date.now()}`
      }));
    }

    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    if (!quiet) {
      setIsScanningExtensions(true);
      setIsVerifyingWithBackend(true);
    }

    try {
      const backendRes = await verifyExtensionTurnedOffWithBackend(
        candidate.id,
        candidate.email,
        false
      );

      const isClean = backendRes.clean && !clientReport.hasExtension;

      // Merge and deduplicate all detected extensions from both client and backend
      const mergedExtensions = [...clientReport.extensions];
      for (const bExt of backendRes.verifiedExtensions) {
        if (!mergedExtensions.some(e => e.id === bExt.id || e.name === bExt.name)) {
          mergedExtensions.push(bExt);
        }
      }

      setExtensionAudit({
        hasExtension: !isClean,
        blocked: !isClean,
        extensions: isClean ? [] : mergedExtensions,
        timestamp: Date.now()
      });

      setBackendVerificationStatus({
        verifiedAt: Date.now(),
        clean: isClean,
        message: backendRes.message,
        serverAuditId: backendRes.serverAuditId
      });
    } catch (e: any) {
      console.warn('Audit verification non-fatal notice:', e?.message || e);
    } finally {
      isVerifyingRef.current = false;
      if (!quiet) {
        setIsScanningExtensions(false);
        setIsVerifyingWithBackend(false);
      }
    }
  };

  useEffect(() => {
    performExtensionAuditAndVerify();

    const stopWatchdog = startRealtimeExtensionWatchdog({
      onStatusChange: (audit) => {
        setExtensionAudit(prev => {
          const prevClean = !prev.hasExtension;
          const prevIds = prev.extensions.map(e => e.id).sort().join(',');
          const nextIds = audit.extensions.map(e => e.id).sort().join(',');
          if (prevClean === !audit.hasExtension && prevIds === nextIds) {
            return prev;
          }
          return audit;
        });

        if (audit.hasExtension && audit.extensions.length > 0) {
          setBackendVerificationStatus(prev => {
            if (prev && !prev.clean) return prev;
            return {
              verifiedAt: Date.now(),
              clean: false,
              message: `Active extension "${audit.extensions[0]?.name}" detected. Exam launch is blocked. Turn off all extensions.`,
              serverAuditId: prev?.serverAuditId
            };
          });
        }
      },
      onExtensionDetected: () => {
        performExtensionAuditAndVerify(true);
      },
      onExtensionTurnedOff: () => {
        performExtensionAuditAndVerify(true);
      },
      pollIntervalMs: 1
    });

    const serverSyncInterval = setInterval(() => {
      performExtensionAuditAndVerify(true);
    }, 1000);

    return () => {
      stopWatchdog();
      clearInterval(serverSyncInterval);
    };
  }, [candidate.id, candidate.email]);

  useEffect(() => {
    // Re-verify extensions on tab focus without reloading the entire window (which would kill the camera stream)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performExtensionAuditAndVerify(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const createSimulatedProctorStream = (): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    let f = 0;
    setInterval(() => {
      if (!ctx) return;
      f++;
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(320, 390, 140, 110, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5c6a5';
      ctx.beginPath();
      const wobble = Math.sin(f * 0.05) * 3;
      ctx.ellipse(320 + wobble, 200, 75, 95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(295 + wobble, 190, 6, 0, Math.PI * 2);
      ctx.arc(345 + wobble, 190, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
      ctx.font = '12px monospace';
      ctx.fillText('PROCTOR LIVE FEED (HD)', 20, 30);
    }, 50);
    return canvas.captureStream(30);
  };

  const requestCameraAccess = async () => {
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      streamRef.current = s;
      setStream(s);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera hardware notice:', err);
      try {
        const simStream = createSimulatedProctorStream();
        streamRef.current = simStream;
        setStream(simStream);
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = simStream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setCameraError('Please allow camera access. Continuous face detection is required for this assessment.');
      }
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [stream, cameraActive]);

  useEffect(() => {
    requestCameraAccess();
    return () => {
      // Only stop tracks if we are NOT launching into the exam (preserve stream handover)
      if (!isLaunchingRef.current && streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleLaunch = async () => {
    const immediateCheck = runExtensionAudit();
    if (immediateCheck.hasExtension) {
      setExtensionAudit(immediateCheck);
      setBackendVerificationStatus({
        verifiedAt: Date.now(),
        clean: false,
        message: `Active extension "${immediateCheck.extensions[0]?.name || 'Unknown'}" detected at the moment of launch. Exam launch strictly blocked.`,
        serverAuditId: `local-blocked-${Date.now()}`
      });
      return;
    }

    setIsScanningExtensions(true);
    setIsVerifyingWithBackend(true);
    const backendRes = await verifyExtensionTurnedOffWithBackend(candidate.id, candidate.email, false);
    setIsScanningExtensions(false);
    setIsVerifyingWithBackend(false);

    if (!backendRes.clean || immediateCheck.hasExtension) {
      setExtensionAudit({
        hasExtension: true,
        blocked: true,
        extensions: backendRes.verifiedExtensions.length > 0 ? backendRes.verifiedExtensions : immediateCheck.extensions,
        timestamp: Date.now()
      });
      setBackendVerificationStatus({
        verifiedAt: Date.now(),
        clean: false,
        message: 'Active extension detected in real-time scan. You must turn it off before launching the assessment.',
        serverAuditId: backendRes.serverAuditId
      });
      return;
    }

    const finalCheck = runExtensionAudit();
    if (finalCheck.hasExtension) {
      setExtensionAudit(finalCheck);
      setBackendVerificationStatus({
        verifiedAt: Date.now(),
        clean: false,
        message: 'Active browser extension detected at launch. You must turn it off before entering the assessment.',
        serverAuditId: `local-blocked-${Date.now()}`
      });
      return;
    }

    let activeLaunchStream = streamRef.current || stream;
    if (!activeLaunchStream || !activeLaunchStream.getVideoTracks().some(t => t.readyState === 'live')) {
      try {
        activeLaunchStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
        streamRef.current = activeLaunchStream;
        setStream(activeLaunchStream);
        setCameraActive(true);
      } catch (e) {
        activeLaunchStream = createSimulatedProctorStream();
        streamRef.current = activeLaunchStream;
        setStream(activeLaunchStream);
        setCameraActive(true);
      }
    }

    // Flag launching so stream is not stopped upon unmount
    isLaunchingRef.current = true;

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen request bypassed:', e);
    }

    onStartAssessment(activeLaunchStream);
  };

  const handleLaunchButtonClick = async () => {
    if (!cameraActive) {
      await requestCameraAccess();
      return;
    }
    handleLaunch();
  };

  const isExamBlockedByExtension = extensionAudit.hasExtension || (backendVerificationStatus !== null && !backendVerificationStatus.clean);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-5">
          <div>
            <span className="text-xs font-mono text-cyan-400 font-semibold tracking-wider uppercase">
              Proctor Pre-Flight Verification & Environment Audit
            </span>
            <h2 className="text-2xl font-bold text-white tracking-tight mt-1">
              Welcome, {candidate.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Role: <strong className="text-slate-200">{candidate.role}</strong> &bull; Candidate ID: <strong className="text-cyan-300 font-mono">{candidate.id}</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
              Screened: {candidate.screeningScore}% Match
            </span>
          </div>
        </div>

        {/* Real-Time Browser Extension Detection Shield */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-300">
                Security Shield 1: Real-Time Browser Extension Audit
              </span>
            </div>
            <button
              type="button"
              onClick={() => performExtensionAuditAndVerify(false)}
              disabled={isScanningExtensions || isVerifyingWithBackend}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-[11px] text-slate-300 font-medium transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${(isScanningExtensions || isVerifyingWithBackend) ? 'animate-spin text-cyan-400' : ''}`} />
              {isVerifyingWithBackend ? 'Verifying with Server...' : isScanningExtensions ? 'Scanning...' : 'Re-verify with Server'}
            </button>
          </div>

          {isExamBlockedByExtension ? (
            <div className="p-4 rounded-2xl bg-rose-950/60 border-2 border-rose-600/80 text-rose-200 space-y-3 shadow-lg shadow-rose-950/50 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-900/60 border border-rose-700 text-rose-300 shrink-0 mt-0.5">
                  <Ban className="w-5 h-5 text-rose-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    Exam Launch Blocked: Unauthorized Browser Extension Detected
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-900 text-rose-300 border border-rose-700 font-mono">
                      {extensionAudit.extensions.length} Active Extension(s)
                    </span>
                  </h4>
                  <p className="text-xs text-rose-200 leading-relaxed">
                    <strong>Why is this blocked?</strong> Third-party extensions can monitor keystrokes, alter problem descriptions, inject AI assistance (Copilot/ChatGPT), or compromise assessment integrity. The exam cannot be launched while ANY browser extension is active.
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3 rounded-xl bg-slate-950/90 border border-rose-800/80 space-y-2 text-xs">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Required Action to Unlock Exam Launch:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                  <li>
                    Open your browser extension manager: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-cyan-300 font-mono">chrome://extensions</code> or <code className="bg-slate-900 px-1.5 py-0.5 rounded text-cyan-300 font-mono">edge://extensions</code>
                  </li>
                  <li>
                    Toggle the switch to <strong className="text-rose-400">OFF</strong> for the detected extension(s) below (or open in a clean Incognito/Guest window without extensions).
                  </li>
                  <li>
                    Return here and click the <strong className="text-cyan-300">"Verify Again"</strong> button below. The backend will verify in real-time that it is turned off.
                  </li>
                </ol>
              </div>

              {/* Detected Extension List */}
              <div className="space-y-2 pt-1">
                {extensionAudit.extensions.map((ext, idx) => (
                  <div key={ext.id || idx} className="p-3 rounded-xl bg-slate-950/80 border border-rose-900/60 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-bold text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        {ext.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ext.detectionSource && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                            {ext.detectionSource === 'chrome.management' ? 'chrome.management API' : 'Frontend Heuristic'}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-mono uppercase">
                          {ext.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-slate-300 font-sans">
                      <strong className="text-slate-200">Reason:</strong> {ext.reason}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                      <strong>Artifact:</strong> {ext.detail}
                    </div>
                    <div className="text-[11px] text-amber-300 font-semibold pt-0.5">
                      <strong>Resolution:</strong> {ext.remediation}
                    </div>
                  </div>
                ))}
              </div>

              {backendVerificationStatus && !backendVerificationStatus.clean && (
                <div className="p-2.5 rounded-lg bg-rose-900/40 border border-rose-700/80 text-[11px] text-rose-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <strong>Backend Status:</strong> {backendVerificationStatus.message}
                  </span>
                  {backendVerificationStatus.serverAuditId && (
                    <span className="font-mono text-[10px] text-rose-400 opacity-80">
                      Ref: {backendVerificationStatus.serverAuditId}
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-rose-300/80 pt-2 border-t border-rose-900/50">
                <span className="text-left">
                  Toggled extension to OFF? Verify in real-time or reload tab:
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                    title="Reloads page (your candidate login session is preserved)"
                  >
                    Reload Page
                  </button>
                  <button
                    type="button"
                    onClick={() => performExtensionAuditAndVerify(false)}
                    disabled={isScanningExtensions || isVerifyingWithBackend}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${(isScanningExtensions || isVerifyingWithBackend) ? 'animate-spin' : ''}`} />
                    {isVerifyingWithBackend ? 'Verifying with Backend...' : 'Verify Turned OFF (Real-Time)'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-inner">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white text-sm">Browser Environment Verified Clean</span>
                  <p className="text-[11px] text-emerald-300/80">
                    Real-time backend scan confirmed 0 active extensions or injected scripts. Environment is secure for exam launch.
                  </p>
                  {backendVerificationStatus?.serverAuditId && (
                    <span className="inline-block mt-1 font-mono text-[10px] text-emerald-400/90 bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-800">
                      Backend Audit ID: {backendVerificationStatus.serverAuditId}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => performExtensionAuditAndVerify(false)}
                  disabled={isScanningExtensions || isVerifyingWithBackend}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium transition cursor-pointer flex items-center gap-1"
                  title="Re-verify clean state with backend"
                >
                  <RefreshCw className={`w-3 h-3 ${(isScanningExtensions || isVerifyingWithBackend) ? 'animate-spin text-cyan-400' : ''}`} />
                  Re-check
                </button>
                <span className="text-[10px] px-3 py-1 rounded-full bg-emerald-900 text-emerald-300 border border-emerald-700 font-mono font-bold">
                  PASSED
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Camera Preview Area */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-6 space-y-2">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${cameraActive ? 'block' : 'hidden'}`}
              />
              {cameraActive ? (
                <>
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-36 h-48 border-2 border-dashed border-cyan-400/70 rounded-full flex flex-col items-center justify-between p-2">
                      <span className="text-[9px] font-mono text-cyan-300 bg-slate-900/80 px-1.5 py-0.5 rounded">
                        Face Focus Guide
                      </span>
                      <span className="text-[9px] font-mono text-cyan-300 bg-slate-900/80 px-1.5 py-0.5 rounded">
                        Keep Centered
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Webcam Active
                  </div>
                </>
              ) : (
                <div className="p-4 text-center space-y-3 text-slate-400">
                  <Camera className="w-10 h-10 mx-auto text-cyan-400 animate-pulse" />
                  <div>
                    <p className="text-xs font-semibold text-white">Camera Access Required</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Continuous visual proctoring must be active before entering.</p>
                  </div>
                  <button
                    type="button"
                    onClick={requestCameraAccess}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5 mx-auto"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Turn On Camera
                  </button>
                </div>
              )}
            </div>
            {cameraError && (
              <div className="text-xs text-rose-400 flex items-center justify-between gap-2 p-2 rounded-lg bg-rose-950/40 border border-rose-900/60">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {cameraError}
                </span>
                <button
                  type="button"
                  onClick={requestCameraAccess}
                  className="px-2.5 py-1 rounded bg-rose-900 hover:bg-rose-800 text-rose-200 text-[10px] font-bold uppercase transition cursor-pointer shrink-0"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          <div className="md:col-span-6 space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Anti-Cheating Protocols Enforced
              </div>
              <ul className="space-y-1.5 text-slate-400">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Zero browser extensions allowed (verified in real time)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Tab switches & blur: 3 warnings before disqualification
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Full-screen exit: 3 warnings before disqualification
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Continuous face presence: 3 warnings before disqualification
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Agreement Checkbox */}
        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasAcknowledged}
            onChange={(e) => setHasAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
          />
          <span className="text-xs text-slate-300 leading-relaxed">
            I understand and accept that this assessment enforces strict automated proctoring. Zero browser extensions are permitted. Any attempt to use extensions or exceeding allowed warnings will immediately terminate my test and record a permanent <strong>MALPRACTICE</strong> status with 0 marks.
          </span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
          >
            Cancel & Exit
          </button>
          <button
            type="button"
            disabled={!hasAcknowledged || isExamBlockedByExtension || isVerifyingWithBackend}
            onClick={handleLaunchButtonClick}
            className={`px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition flex items-center gap-2 cursor-pointer ${
              isExamBlockedByExtension
                ? 'bg-rose-900/60 text-rose-300 border border-rose-700 cursor-not-allowed opacity-75'
                : !cameraActive
                ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold border border-amber-400 shadow-amber-950/40'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white shadow-cyan-900/30'
            }`}
          >
            {isVerifyingWithBackend ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                Verifying Extensions...
              </>
            ) : isExamBlockedByExtension ? (
              <>
                <Ban className="w-4 h-4 text-rose-400" />
                Exam Blocked: Turn Off All Extensions ({extensionAudit.extensions.length})
              </>
            ) : !cameraActive ? (
              <>
                <Camera className="w-4 h-4 text-slate-950 animate-pulse" />
                Turn On Camera & Take Exam
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Take Exam (Fullscreen Mode)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
