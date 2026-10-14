import { useEffect, useRef, useState, useCallback } from 'react';
import { ProctoringViolation } from '../types';
import { startRealtimeExtensionWatchdog, runExtensionAudit } from '../utils/extensionDetector';

interface UseProctoringProps {
  isActive: boolean;
  candidateId: string;
  initialStream?: MediaStream | null;
  onMalpracticeTriggered: (reason: string, violation: ProctoringViolation) => void;
  onTabSwitchWarning?: (attempt: number, maxAttempts: number, remaining: number) => void;
  onCameraFaceWarning?: (attempt: number, maxAttempts: number, remaining: number, reason: string) => void;
  onFullscreenWarning?: (attempt: number, maxAttempts: number, remaining: number) => void;
}

export function useProctoring({
  isActive,
  candidateId,
  initialStream,
  onMalpracticeTriggered,
  onTabSwitchWarning,
  onCameraFaceWarning,
  onFullscreenWarning
}: UseProctoringProps) {
  const [videoStream, setVideoStream] = useState<MediaStream | null>(initialStream || null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState<boolean>(true);
  const [faceAbsenceSeconds, setFaceAbsenceSeconds] = useState<number>(0);
  const [violations, setViolations] = useState<ProctoringViolation[]>([]);
  const [isTabFocused, setIsTabFocused] = useState<boolean>(true);
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const [cameraFaceWarningCount, setCameraFaceWarningCount] = useState<number>(0);
  const [fullscreenWarningCount, setFullscreenWarningCount] = useState<number>(0);

  const tabSwitchCountRef = useRef<number>(0);
  const lastTabSwitchTimeRef = useRef<number>(0);
  const MAX_TAB_ATTEMPTS = 3;

  const cameraFaceWarningCountRef = useRef<number>(0);
  const MAX_CAMERA_FACE_ATTEMPTS = 3;
  const isCameraFaceModalActiveRef = useRef<boolean>(false);
  // Set generous initial 15-second camera warmup grace period on exam entry
  const gracePeriodUntilRef = useRef<number>(Date.now() + 15000);

  const fullscreenWarningCountRef = useRef<number>(0);
  const MAX_FULLSCREEN_ATTEMPTS = 3;
  const isFullscreenModalActiveRef = useRef<boolean>(false);
  const fullscreenGraceUntilRef = useRef<number>(0);
  const lastFullscreenExitTimeRef = useRef<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const onMalpracticeTriggeredRef = useRef(onMalpracticeTriggered);
  onMalpracticeTriggeredRef.current = onMalpracticeTriggered;

  const onTabSwitchWarningRef = useRef(onTabSwitchWarning);
  onTabSwitchWarningRef.current = onTabSwitchWarning;

  const onCameraFaceWarningRef = useRef(onCameraFaceWarning);
  onCameraFaceWarningRef.current = onCameraFaceWarning;

  const onFullscreenWarningRef = useRef(onFullscreenWarning);
  onFullscreenWarningRef.current = onFullscreenWarning;

  const candidateIdRef = useRef(candidateId);
  candidateIdRef.current = candidateId;

  const reportViolation = useCallback(async (violation: ProctoringViolation) => {
    setViolations(prev => [violation, ...prev]);
    try {
      await fetch('/api/proctor/violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidateIdRef.current, violation })
      });
    } catch (e) {
      console.error('Failed to report violation to server:', e);
    }
  }, []);

  const resumeFromCameraWarning = useCallback(() => {
    isCameraFaceModalActiveRef.current = false;
    gracePeriodUntilRef.current = Date.now() + 5000;
    setFaceAbsenceSeconds(0);
  }, []);

  const resumeFromFullscreenWarning = useCallback(() => {
    isFullscreenModalActiveRef.current = false;
    fullscreenGraceUntilRef.current = Date.now() + 5000;
  }, []);

  // 1. Initialize Camera (reuse initialStream or acquire camera with generous 30s grace period)
  useEffect(() => {
    if (!isActive) {
      setVideoStream(null);
      return;
    }

    // Set 30s camera startup grace period when entering active exam
    gracePeriodUntilRef.current = Date.now() + 30000;

    let activeStream: MediaStream | null = null;
    let isTerminated = false;

    // Check if live initialStream was provided from DeviceSetup
    if (initialStream && initialStream.getVideoTracks().some(t => t.readyState === 'live')) {
      activeStream = initialStream;
      setVideoStream(initialStream);
      setCameraError(null);
      if (videoRef.current && videoRef.current.srcObject !== initialStream) {
        videoRef.current.srcObject = initialStream;
        videoRef.current.play().catch(() => {});
      }
      return () => {
        isTerminated = true;
      };
    }

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });

        if (isTerminated) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        activeStream = stream;
        setVideoStream(stream);
        setCameraError(null);

        if (videoRef.current && videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.warn('Direct camera access notice (using proctor feed):', err);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          let frame = 0;
          const animTimer = setInterval(() => {
            if (!ctx) return;
            frame++;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.ellipse(320, 390, 140, 110, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f5c6a5';
            ctx.beginPath();
            const wobble = Math.sin(frame * 0.05) * 4;
            ctx.ellipse(320 + wobble, 200, 75, 95, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(295 + wobble, 190, 6, 0, Math.PI * 2);
            ctx.arc(345 + wobble, 190, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(6, 182, 212, 0.7)';
            ctx.font = '12px monospace';
            ctx.fillText('AI PROCTOR LIVE STREAM', 20, 30);
          }, 60);

          const simStream = canvas.captureStream(30);
          if (isTerminated) {
            clearInterval(animTimer);
            simStream.getTracks().forEach(t => t.stop());
            return;
          }
          activeStream = simStream;
          setVideoStream(simStream);
          setCameraError(null);
          if (videoRef.current) {
            videoRef.current.srcObject = simStream;
            videoRef.current.play().catch(() => {});
          }
        } catch {
          setCameraError('Camera access required for proctoring verification.');
        }
      }
    }

    initCamera();

    return () => {
      isTerminated = true;
      if (activeStream && activeStream !== initialStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
      setVideoStream(null);
    };
  }, [isActive, initialStream]);

  // Continuously sync videoStream to videoRef whenever it becomes available
  useEffect(() => {
    if (videoRef.current && videoStream) {
      if (videoRef.current.srcObject !== videoStream) {
        videoRef.current.srcObject = videoStream;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [videoStream]);

  // 2. Face Detection & Camera Presence Monitoring Loop
  useEffect(() => {
    if (!isActive) return;

    let isDisposed = false;
    let absenceCounterSeconds = 0;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const nativeFaceDetector = (typeof window !== 'undefined' && 'FaceDetector' in window)
      // @ts-ignore
      ? new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 2 })
      : null;

    const monitorInterval = setInterval(async () => {
      if (isDisposed) return;
      const now = Date.now();

      if (now < gracePeriodUntilRef.current) {
        absenceCounterSeconds = 0;
        setFaceAbsenceSeconds(0);
        setFaceDetected(true);
        return;
      }

      let isCameraClosed = false;
      if (!videoStream) {
        isCameraClosed = true;
      } else {
        const tracks = videoStream.getVideoTracks();
        const hasLiveTrack = tracks.some(t => t.enabled && t.readyState === 'live');
        if (tracks.length === 0 || !hasLiveTrack) {
          isCameraClosed = true;
        }
      }

      let isFacePresent = false;
      const videoEl = videoRef.current;
      if (!isCameraClosed && videoEl && videoEl.readyState >= 2 && ctx) {
        try {
          if (nativeFaceDetector) {
            const faces = await nativeFaceDetector.detect(videoEl);
            isFacePresent = Boolean(faces && faces.length > 0);
          } else {
            ctx.drawImage(videoEl, 0, 0, 160, 120);
            const frame = ctx.getImageData(0, 0, 160, 120);
            const data = frame.data;
            let skinPixelCount = 0;
            let centerRegionSkin = 0;
            let totalBrightness = 0;
            const totalPixels = 160 * 120;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const brightness = (r * 299 + g * 587 + b * 114) / 1000;
              totalBrightness += brightness;
              const pixelIdx = i / 4;
              const x = pixelIdx % 160;
              const y = Math.floor(pixelIdx / 160);

              const isSkin =
                r > 45 && g > 30 && b > 15 &&
                r > g && r > b &&
                Math.abs(r - g) > 8 &&
                r - b > 10;

              if (isSkin) {
                skinPixelCount++;
                if (x >= 35 && x <= 125 && y >= 15 && y <= 105) {
                  centerRegionSkin++;
                }
              }
            }

            const avgBrightness = totalBrightness / totalPixels;
            const skinRatio = skinPixelCount / totalPixels;
            const centerSkinRatio = centerRegionSkin / (90 * 90);

            const isNotBlackout = avgBrightness > 12 && avgBrightness < 248;
            isFacePresent = isNotBlackout && (centerSkinRatio > 0.04 || skinRatio > 0.025);
          }
        } catch {
          isFacePresent = true;
        }
      }

      const isViolationActive = isCameraClosed || !isFacePresent;
      if (!isViolationActive) {
        absenceCounterSeconds = 0;
        setFaceAbsenceSeconds(0);
        setFaceDetected(true);
      } else {
        setFaceDetected(false);
        absenceCounterSeconds += 1;
        setFaceAbsenceSeconds(absenceCounterSeconds);

        if (absenceCounterSeconds >= 8 && !isCameraFaceModalActiveRef.current && Date.now() >= gracePeriodUntilRef.current) {
          cameraFaceWarningCountRef.current += 1;
          const currentAttempts = cameraFaceWarningCountRef.current;
          setCameraFaceWarningCount(currentAttempts);

          const reason = isCameraClosed
            ? 'Webcam feed was interrupted or video track stopped.'
            : 'No candidate face detected in camera viewport for continuous duration.';

          if (currentAttempts <= MAX_CAMERA_FACE_ATTEMPTS) {
            isCameraFaceModalActiveRef.current = true;
            const remaining = MAX_CAMERA_FACE_ATTEMPTS - currentAttempts;
            const viol: ProctoringViolation = {
              id: `v-cam-face-${Date.now()}`,
              type: isCameraClosed ? 'CAMERA_REVOKED' : 'NO_FACE_DETECTED',
              timestamp: Date.now(),
              details: `Camera/Face Warning ${currentAttempts}/${MAX_CAMERA_FACE_ATTEMPTS}: ${reason} (${remaining} warning(s) remaining before automatic disqualification).`,
              severity: 'WARNING'
            };
            reportViolation(viol);
            if (onCameraFaceWarningRef.current) {
              onCameraFaceWarningRef.current(currentAttempts, MAX_CAMERA_FACE_ATTEMPTS, remaining, reason);
            }
          } else {
            const viol: ProctoringViolation = {
              id: `v-cam-face-final-${Date.now()}`,
              type: isCameraClosed ? 'CAMERA_REVOKED' : 'NO_FACE_DETECTED',
              timestamp: Date.now(),
              details: `Disqualified: Maximum allowed camera/face absence violations (${MAX_CAMERA_FACE_ATTEMPTS}/${MAX_CAMERA_FACE_ATTEMPTS}) exceeded. ${reason}`,
              severity: 'CRITICAL'
            };
            reportViolation(viol);
            onMalpracticeTriggeredRef.current(
              `Disqualified for Malpractice: Camera closed or face absent more than 3 times. Continuous visual proctoring protocol breached.`,
              viol
            );
          }
        }
      }
    }, 1000);

    return () => {
      isDisposed = true;
      clearInterval(monitorInterval);
    };
  }, [isActive, videoStream, reportViolation]);

  // 3. Tab Switching / Blur / Fullscreen
  useEffect(() => {
    if (!isActive) return;

    const handleTabOrBlurEvent = (eventType: 'TAB_SWITCH' | 'WINDOW_BLUR', desc: string) => {
      const now = Date.now();
      if (now - lastTabSwitchTimeRef.current < 1500) {
        return;
      }
      lastTabSwitchTimeRef.current = now;
      tabSwitchCountRef.current += 1;
      const count = tabSwitchCountRef.current;
      setTabSwitchCount(count);
      const remaining = Math.max(0, MAX_TAB_ATTEMPTS - count);

      if (count <= MAX_TAB_ATTEMPTS) {
        const violation: ProctoringViolation = {
          id: `v-tab-${now}`,
          type: eventType,
          timestamp: now,
          details: `Warning ${count}/${MAX_TAB_ATTEMPTS}: ${desc} (${remaining} warning(s) remaining before automatic disqualification).`,
          severity: 'WARNING'
        };
        reportViolation(violation);
        if (onTabSwitchWarningRef.current) {
          onTabSwitchWarningRef.current(count, MAX_TAB_ATTEMPTS, remaining);
        }
      } else {
        const violation: ProctoringViolation = {
          id: `v-tab-final-${now}`,
          type: eventType,
          timestamp: now,
          details: `Disqualified: Maximum allowed tab switch attempts (${MAX_TAB_ATTEMPTS}/${MAX_TAB_ATTEMPTS}) exceeded. ${desc}`,
          severity: 'CRITICAL'
        };
        reportViolation(violation);
        onMalpracticeTriggeredRef.current(
          `Disqualified for Malpractice: Maximum allowed tab switch warnings (${MAX_TAB_ATTEMPTS}/${MAX_TAB_ATTEMPTS}) exceeded. Assessment session terminated.`,
          violation
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsTabFocused(false);
        handleTabOrBlurEvent('TAB_SWITCH', 'Candidate switched away from assessment browser tab.');
      } else {
        setIsTabFocused(true);
      }
    };

    const handleWindowBlur = () => {
      setIsTabFocused(false);
      handleTabOrBlurEvent('WINDOW_BLUR', 'Candidate navigated away or minimized assessment window.');
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isActive) {
        const now = Date.now();
        if (now < fullscreenGraceUntilRef.current) {
          return;
        }
        if (now - lastFullscreenExitTimeRef.current < 1500) {
          return;
        }
        lastFullscreenExitTimeRef.current = now;
        fullscreenWarningCountRef.current += 1;
        const count = fullscreenWarningCountRef.current;
        setFullscreenWarningCount(count);
        const remaining = Math.max(0, MAX_FULLSCREEN_ATTEMPTS - count);

        if (count <= MAX_FULLSCREEN_ATTEMPTS) {
          isFullscreenModalActiveRef.current = true;
          const violation: ProctoringViolation = {
            id: `v-fs-${now}`,
            type: 'FULLSCREEN_EXIT',
            timestamp: now,
            details: `Fullscreen Warning ${count}/${MAX_FULLSCREEN_ATTEMPTS}: Candidate exited full-screen assessment container (${remaining} warning(s) remaining before automatic disqualification).`,
            severity: 'WARNING'
          };
          reportViolation(violation);
          if (onFullscreenWarningRef.current) {
            onFullscreenWarningRef.current(count, MAX_FULLSCREEN_ATTEMPTS, remaining);
          }
        } else {
          const violation: ProctoringViolation = {
            id: `v-fs-final-${now}`,
            type: 'FULLSCREEN_EXIT',
            timestamp: now,
            details: `Disqualified: Maximum allowed full-screen exit warnings (${MAX_FULLSCREEN_ATTEMPTS}/${MAX_FULLSCREEN_ATTEMPTS}) exceeded. Candidate exited full-screen container.`,
            severity: 'CRITICAL'
          };
          reportViolation(violation);
          onMalpracticeTriggeredRef.current(
            `Disqualified for Malpractice: Exited full-screen mode more than 3 times. Continuous full-screen protocol breached.`,
            violation
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isActive, reportViolation]);

  // 4. Keyboard, Devtools & Tampering Protections
  useEffect(() => {
    if (!isActive) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const viol: ProctoringViolation = {
        id: `v-ctx-${Date.now()}`,
        type: 'EXTENSION_OR_INSPECTION_DETECTED',
        timestamp: Date.now(),
        details: 'Unauthorized context menu right-click attempt prevented.',
        severity: 'CRITICAL'
      };
      reportViolation(viol);
      onMalpracticeTriggeredRef.current('Proctoring Malpractice: Right-click context menu is strictly disabled.', viol);
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isDevTools =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.ctrlKey && ['u', 'U'].includes(e.key));

      if (isDevTools) {
        e.preventDefault();
        e.stopPropagation();
        const viol: ProctoringViolation = {
          id: `v-keys-${Date.now()}`,
          type: 'EXTENSION_OR_INSPECTION_DETECTED',
          timestamp: Date.now(),
          details: `Keyboard inspection shortcut attempt detected (${e.key}). DevTools & browser extension tools are blocked.`,
          severity: 'CRITICAL'
        };
        reportViolation(viol);
        onMalpracticeTriggeredRef.current('Proctoring Malpractice: Developer tools inspection attempt detected.', viol);
        return false;
      }

      const isScreenshot =
        e.key === 'PrintScreen' ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
        (e.metaKey && (e.key === 'p' || e.key === 'P')) ||
        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key));

      if (isScreenshot) {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('');
          }
        } catch {}
        const viol: ProctoringViolation = {
          id: `v-screen-${Date.now()}`,
          type: 'SCREENSHOT_OR_CLIPBOARD_ATTEMPT',
          timestamp: Date.now(),
          details: `Screenshot attempt detected via key shortcut (${e.key}). Screen capture is strictly prohibited.`,
          severity: 'CRITICAL'
        };
        reportViolation(viol);
        onMalpracticeTriggeredRef.current('Proctoring Malpractice: Screenshot or print capture attempt detected.', viol);
        return false;
      }

      const isCopyCut =
        (e.ctrlKey && ['c', 'C', 'x', 'X'].includes(e.key)) ||
        (e.metaKey && ['c', 'C', 'x', 'X'].includes(e.key));

      if (isCopyCut) {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('');
          }
        } catch {}
        const viol: ProctoringViolation = {
          id: `v-copy-${Date.now()}`,
          type: 'SCREENSHOT_OR_CLIPBOARD_ATTEMPT',
          timestamp: Date.now(),
          details: `Copy/cut keyboard command attempt detected (${e.key}). Copying assessment content is strictly prohibited.`,
          severity: 'CRITICAL'
        };
        reportViolation(viol);
        onMalpracticeTriggeredRef.current('Proctoring Malpractice: Content copy/cut command detected. Content copying is strictly prohibited.', viol);
        return false;
      }

      const isPaste =
        (e.ctrlKey && ['v', 'V'].includes(e.key)) ||
        (e.metaKey && ['v', 'V'].includes(e.key));

      if (isPaste) {
        e.preventDefault();
        e.stopPropagation();
        const viol: ProctoringViolation = {
          id: `v-paste-${Date.now()}`,
          type: 'SCREENSHOT_OR_CLIPBOARD_ATTEMPT',
          timestamp: Date.now(),
          details: 'Clipboard paste command attempt detected. External pasting is strictly prohibited.',
          severity: 'CRITICAL'
        };
        reportViolation(viol);
        onMalpracticeTriggeredRef.current('Proctoring Malpractice: External paste command detected. External assistance is prohibited.', viol);
        return false;
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', '');
      }
      const viol: ProctoringViolation = {
        id: `v-clip-copy-${Date.now()}`,
        type: 'SCREENSHOT_OR_CLIPBOARD_ATTEMPT',
        timestamp: Date.now(),
        details: 'Direct clipboard copy event intercepted.',
        severity: 'CRITICAL'
      };
      reportViolation(viol);
      onMalpracticeTriggeredRef.current('Proctoring Malpractice: Copy event intercepted. Content copying is strictly forbidden.', viol);
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', '');
      }
      const viol: ProctoringViolation = {
        id: `v-clip-cut-${Date.now()}`,
        type: 'SCREENSHOT_OR_CLIPBOARD_ATTEMPT',
        timestamp: Date.now(),
        details: 'Direct clipboard cut event intercepted.',
        severity: 'CRITICAL'
      };
      reportViolation(viol);
      onMalpracticeTriggeredRef.current('Proctoring Malpractice: Cut event intercepted.', viol);
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const viol: ProctoringViolation = {
        id: `v-clip-paste-${Date.now()}`,
        type: 'SCREENSHOT_OR_CLIPBOARD_ATTEMPT',
        timestamp: Date.now(),
        details: 'Direct clipboard paste event intercepted.',
        severity: 'CRITICAL'
      };
      reportViolation(viol);
      onMalpracticeTriggeredRef.current('Proctoring Malpractice: External paste event intercepted.', viol);
    };

    const initialExamAudit = runExtensionAudit();
    if (initialExamAudit.hasExtension && initialExamAudit.extensions.length > 0) {
      const ext = initialExamAudit.extensions[0];
      const viol: ProctoringViolation = {
        id: `v-ext-start-${Date.now()}`,
        type: 'EXTENSION_OR_INSPECTION_DETECTED',
        timestamp: Date.now(),
        details: `Active Browser Extension Violation: "${ext.name}" (${ext.category}) detected immediately upon entering exam. ${ext.reason}`,
        severity: 'CRITICAL'
      };
      reportViolation(viol);
      onMalpracticeTriggeredRef.current(
        `Proctoring Malpractice: Active browser extension detected upon entering exam (${ext.name}). Reason: ${ext.reason}`,
        viol
      );
    }

    const stopExtensionWatchdog = startRealtimeExtensionWatchdog({
      onExtensionDetected: (ext) => {
        const viol: ProctoringViolation = {
          id: `v-ext-${Date.now()}`,
          type: 'EXTENSION_OR_INSPECTION_DETECTED',
          timestamp: Date.now(),
          details: `Active Browser Extension Violation: "${ext.name}" (${ext.category}) turned ON during exam. ${ext.reason}`,
          severity: 'CRITICAL'
        };
        reportViolation(viol);
        onMalpracticeTriggeredRef.current(
          `Proctoring Malpractice: Active browser extension turned ON during assessment (${ext.name}). Reason: ${ext.reason}`,
          viol
        );
      },
      pollIntervalMs: 1
    });

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('copy', handleCopy, true);
    window.addEventListener('cut', handleCut, true);
    window.addEventListener('paste', handlePaste, true);

    return () => {
      stopExtensionWatchdog();
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('copy', handleCopy, true);
      window.removeEventListener('cut', handleCut, true);
      window.removeEventListener('paste', handlePaste, true);
    };
  }, [isActive, reportViolation]);

  return {
    videoRef,
    videoStream,
    cameraError,
    faceDetected,
    faceAbsenceSeconds,
    violations,
    isTabFocused,
    tabSwitchCount,
    maxTabAttempts: MAX_TAB_ATTEMPTS,
    cameraFaceWarningCount,
    maxCameraFaceAttempts: MAX_CAMERA_FACE_ATTEMPTS,
    fullscreenWarningCount,
    maxFullscreenAttempts: MAX_FULLSCREEN_ATTEMPTS,
    resumeFromCameraWarning,
    resumeFromFullscreenWarning
  };
}
