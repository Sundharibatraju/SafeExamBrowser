import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Eye, Shield, Video, VideoOff, GripHorizontal, Camera, Maximize2 } from 'lucide-react';
import { Candidate } from '../types';

interface FloatingProctorCameraProps {
  videoStream: MediaStream | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  faceDetected: boolean;
  faceAbsenceSeconds: number;
  tabSwitchCount: number;
  maxTabAttempts: number;
  cameraFaceWarningCount?: number;
  maxCameraFaceAttempts?: number;
  fullscreenWarningCount?: number;
  maxFullscreenAttempts?: number;
  candidate: Candidate;
  onToggleCameraMute?: () => void;
}

export const FloatingProctorCamera: React.FC<FloatingProctorCameraProps> = ({
  videoStream,
  videoRef: externalVideoRef,
  faceDetected,
  faceAbsenceSeconds,
  tabSwitchCount,
  maxTabAttempts,
  cameraFaceWarningCount = 0,
  maxCameraFaceAttempts = 3,
  fullscreenWarningCount = 0,
  maxFullscreenAttempts = 3,
  candidate
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeVideoRef = externalVideoRef || localVideoRef;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const cardWidth = 260;
    const cardHeight = 200;
    const defaultX = Math.max(16, window.innerWidth - cardWidth - 24);
    const defaultY = Math.max(16, window.innerHeight - cardHeight - 24);
    setPosition({ x: defaultX, y: defaultY });

    const handleResize = () => {
      setPosition(prev => {
        if (!prev) return { x: defaultX, y: defaultY };
        const clampedX = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, prev.x));
        const clampedY = Math.max(12, Math.min(window.innerHeight - cardHeight - 12, prev.y));
        return { x: clampedX, y: clampedY };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const cardWidth = 260;
      const cardHeight = 200;
      const newX = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, e.clientX - dragOffsetRef.current.x));
      const newY = Math.max(12, Math.min(window.innerHeight - cardHeight - 12, e.clientY - dragOffsetRef.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const cardWidth = 260;
      const cardHeight = 200;
      const newX = Math.max(12, Math.min(window.innerWidth - cardWidth - 12, touch.clientX - dragOffsetRef.current.x));
      const newY = Math.max(12, Math.min(window.innerHeight - cardHeight - 12, touch.clientY - dragOffsetRef.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    const videoEl = activeVideoRef.current;
    if (!videoEl || !videoStream) return;
    if (videoEl.srcObject !== videoStream) {
      videoEl.srcObject = videoStream;
      videoEl.play().catch(() => {});
    }
  }, [videoStream, activeVideoRef]);

  const [isTestCameraDisabled, setIsTestCameraDisabled] = useState(false);
  const toggleTestCameraTrack = () => {
    if (!videoStream) return;
    const tracks = videoStream.getVideoTracks();
    const nextState = !isTestCameraDisabled;
    tracks.forEach(track => {
      track.enabled = !nextState;
    });
    setIsTestCameraDisabled(nextState);
  };

  const currentPos = position || { x: 20, y: 20 };

  return (
    <div
      ref={containerRef}
      className={`fixed z-40 w-64 bg-slate-950/95 border-2 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden select-none touch-none transform transition-shadow duration-200 ${
        faceDetected ? 'border-cyan-500/60' : 'border-rose-500/90'
      }`}
      style={{
        left: `${currentPos.x}px`,
        top: `${currentPos.y}px`,
        boxShadow: faceDetected
          ? '0 10px 25px -5px rgba(6, 182, 212, 0.3)'
          : '0 10px 25px -5px rgba(239, 68, 68, 0.5)',
        cursor: isDragging ? 'grabbing' : 'default',
        transform: 'translateZ(0)',
        willChange: 'left, top'
      }}
    >
      {/* Movable Drag Header Handle */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] cursor-grab active:cursor-grabbing select-none transition-colors ${
          isDragging ? 'bg-slate-800' : 'hover:bg-slate-850'
        }`}
        title="Click and drag to move camera window anywhere on screen"
      >
        <div className="flex items-center gap-1.5 font-bold tracking-wider">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-400 mr-0.5 opacity-80" />
          <span className="relative flex h-2 w-2">
            <span className={`relative inline-flex rounded-full h-2 w-2 ${faceDetected ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`} />
          </span>
          <span className="text-cyan-400 font-mono text-[10px]">LIVE PROCTOR</span>
        </div>

        {/* Live Proctoring Counters */}
        <div className="flex items-center gap-2.5 text-[10px] font-mono">
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
              cameraFaceWarningCount > 0 ? 'bg-rose-950/80 text-rose-300 border border-rose-800' : 'text-slate-400'
            }`}
            title="Camera/Face Absence Warnings (Max 3 Before Permanent Disqualification)"
          >
            <Eye className="w-3 h-3" />
            <span className="font-bold">{cameraFaceWarningCount}/{maxCameraFaceAttempts}</span>
          </div>

          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
              fullscreenWarningCount > 0 ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800' : 'text-slate-400'
            }`}
            title="Full Screen Exit Warnings (Max 3 Before Disqualification)"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="font-bold">{fullscreenWarningCount}/{maxFullscreenAttempts}</span>
          </div>

          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
              tabSwitchCount > 0 ? 'bg-amber-950/80 text-amber-300 border border-amber-800' : 'text-slate-400'
            }`}
            title="Tab Switch Warnings (Max 3 Before Block)"
          >
            <Shield className="w-3 h-3" />
            <span className="font-bold">{tabSwitchCount}/{maxTabAttempts}</span>
          </div>
        </div>
      </div>

      {/* Real-time Video Viewport */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={activeVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${
            videoStream && !isTestCameraDisabled ? 'block' : 'opacity-20'
          }`}
          style={{ transform: 'scaleX(-1) translateZ(0)' }}
        />

        {(!videoStream || isTestCameraDisabled) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-400 bg-slate-950/90 text-xs p-4 text-center space-y-1">
            <VideoOff className="w-6 h-6 text-rose-500 animate-pulse" />
            <span className="font-mono text-[11px] font-bold">CAMERA CLOSED / OFF</span>
            <span className="text-[10px] text-slate-400">1s Limit before warning</span>
          </div>
        )}

        <div className="absolute top-2 left-2 pointer-events-none">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md shadow-md ${
              faceDetected
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600/80'
                : 'bg-rose-950/95 text-rose-200 border-rose-600 animate-pulse'
            }`}
          >
            <Eye className="w-3 h-3" />
            {faceDetected ? 'Face Verified' : `Face / Cam Alert (${Math.max(0, 4 - faceAbsenceSeconds)}s)`}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTestCameraTrack}
          className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-900/85 hover:bg-slate-800 text-[9px] font-mono text-slate-300 border border-slate-700 backdrop-blur-sm cursor-pointer transition flex items-center gap-1"
          title="Toggle camera track to test 1s closed camera violation"
        >
          {isTestCameraDisabled ? (
            <>
              <Camera className="w-2.5 h-2.5 text-emerald-400" />
              <span>Turn On</span>
            </>
          ) : (
            <>
              <VideoOff className="w-2.5 h-2.5 text-rose-400" />
              <span>Simulate Cam Off</span>
            </>
          )}
        </button>

        <div className="absolute inset-0 pointer-events-none border border-cyan-500/20 m-3 rounded-lg flex items-center justify-center">
          <div className="w-16 h-20 border border-dashed border-cyan-400/30 rounded-full" />
        </div>
      </div>

      {/* Candidate Footer */}
      <div className="px-3 py-1 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
        <div className="truncate max-w-[130px]">
          <span className="font-semibold text-slate-200">{candidate.name}</span>
        </div>
        <div className="font-mono text-cyan-400 text-[9px] bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800">
          PROCTOR SECURE
        </div>
      </div>
    </div>
  );
};
