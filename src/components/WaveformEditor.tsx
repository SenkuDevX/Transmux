import { useRef, useEffect, useState, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { Scissors, Play, Image } from "lucide-react";

interface SubtitleCue { time: number; text: string }
interface Chapter { start: number; title: string }

interface WaveformEditorProps {
  duration: number;
  trimStart: string;
  trimEnd: string;
  onTrimChange: (start: string, end: string) => void;
  peaks?: number[];
  subtitles?: SubtitleCue[];
  chapters?: Chapter[];
  thumbnails?: string[];
  jobId?: string;
}

function timeToSeconds(t: string): number {
  if (!t) return 0;
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseFloat(t) || 0;
}

function secondsToTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function generateSyntheticPeaks(duration: number, count: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * duration;
    const base = Math.sin(t * 2.5) * 0.4 + Math.sin(t * 7.3) * 0.2 + Math.sin(t * 13.1) * 0.1 + 0.3;
    const spike = Math.random() > 0.97 ? 0.6 + Math.random() * 0.4 : 0;
    peaks.push(Math.min(1, Math.max(0.05, base + spike)));
  }
  return peaks;
}

export default function WaveformEditor({ duration, trimStart, trimEnd, onTrimChange, peaks: externalPeaks, subtitles, chapters, thumbnails, jobId }: WaveformEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbContainerRef = useRef<HTMLDivElement>(null);
  const [dragType, setDragType] = useState<"start" | "end" | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [thumbLoaded, setThumbLoaded] = useState<Set<number>>(new Set());
  const localPeaks = externalPeaks || generateSyntheticPeaks(duration, 200);
  const startSec = Math.max(0, timeToSeconds(trimStart));
  const endSec = trimEnd ? Math.min(duration, timeToSeconds(trimEnd)) : duration;

  const getTimeFromX = useCallback((clientX: number): number => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    return ratio * duration;
  }, [duration]);

  const handleMouseDown = useCallback((e: ReactMouseEvent, type: "start" | "end") => {
    e.preventDefault();
    setDragType(type);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragType) {
      const t = getTimeFromX(e.clientX);
      const clamped = Math.max(0, Math.min(duration, Math.round(t)));
      if (dragType === "start") {
        const newEnd = endSec > clamped ? endSec : clamped + 1;
        onTrimChange(secondsToTime(clamped), secondsToTime(newEnd));
      } else {
        const newStart = startSec < clamped ? startSec : clamped - 1;
        onTrimChange(secondsToTime(newStart), secondsToTime(clamped));
      }
    } else {
      setHoverTime(getTimeFromX(e.clientX));
    }
  }, [dragType, duration, startSec, endSec, getTimeFromX, onTrimChange]);

  const handleMouseUp = useCallback(() => {
    setDragType(null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, w, h);

    // Draw waveform peaks
    const barW = w / localPeaks.length;
    ctx.fillStyle = "#475569";
    for (let i = 0; i < localPeaks.length; i++) {
      const barH = localPeaks[i] * h * 0.8;
      const x = i * barW;
      const y = (h - barH) / 2;
      ctx.fillRect(x, y, Math.max(1, barW - 0.5), barH);
    }

    // Highlight selected region
    const startX = (startSec / duration) * w;
    const endX = (endSec / duration) * w;
    ctx.fillStyle = "rgba(99, 102, 241, 0.25)";
    ctx.fillRect(startX, 0, endX - startX, h);

    // Subtitle markers (yellow dots at the top)
    if (subtitles && subtitles.length > 0) {
      for (const cue of subtitles) {
        const cx = (cue.time / duration) * w;
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(cx, 6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Chapter markers (vertical dashed lines + labels)
    if (chapters && chapters.length > 0) {
      ctx.strokeStyle = "rgba(167, 139, 250, 0.6)";
      ctx.setLineDash([3, 3]);
      for (const ch of chapters) {
        const cx = (ch.start / duration) * w;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // Chapter labels at top
      ctx.fillStyle = "#a78bfa";
      ctx.font = "bold 7px monospace";
      for (const ch of chapters) {
        const cx = (ch.start / duration) * w;
        ctx.fillText(ch.title.slice(0, 12), Math.max(2, cx), 8);
      }
    }

    // Draw trim handles
    const drawHandle = (x: number, label: string) => {
      ctx.fillStyle = "#6366f1";
      ctx.fillRect(x - 2, 0, 4, h);
      ctx.beginPath();
      ctx.arc(x, h / 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#818cf8";
      ctx.fill();
      ctx.strokeStyle = "#c7d2fe";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, x, h / 2 + 3);
    };

    drawHandle(startX, "S");
    drawHandle(endX, "E");

    // Hover indicator (vertical line + time)
    if (hoverTime !== null) {
      const hx = (hoverTime / duration) * w;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, h);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(secondsToTime(hoverTime), hx, h - 3);
    }

    // Time labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    const step = Math.max(1, Math.floor(duration / 6));
    for (let t = 0; t <= duration; t += step) {
      const x = (t / duration) * w;
      ctx.fillText(secondsToTime(t).slice(3), x, h - 3);
    }
  }, [localPeaks, duration, startSec, endSec, subtitles, chapters, hoverTime]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
          <Scissors className="h-3 w-3" /> Timeline Editor
        </label>
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500 dark:text-slate-400">
          <span>Start: <strong className="text-indigo-500 dark:text-indigo-400">{secondsToTime(startSec)}</strong></span>
          <span>End: <strong className="text-indigo-500 dark:text-indigo-400">{secondsToTime(endSec)}</strong></span>
          <span>Duration: <strong className="text-amber-500">{secondsToTime(endSec - startSec)}</strong></span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 cursor-ew-resize"
        style={{ height: 80 }}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: "block" }}
        />
        {/* Invisible drag overlays */}
        <div
          className="absolute top-0 bottom-0 w-4 cursor-col-resize z-10"
          style={{ left: `${(startSec / duration) * 100}%`, marginLeft: -8 }}
          onMouseDown={(e) => handleMouseDown(e, "start")}
        />
        <div
          className="absolute top-0 bottom-0 w-4 cursor-col-resize z-10"
          style={{ left: `${(endSec / duration) * 100}%`, marginLeft: -8 }}
          onMouseDown={(e) => handleMouseDown(e, "end")}
        />
      </div>

      {/* Frame thumbnail strip */}
      {thumbnails && thumbnails.length > 0 && (
        <div ref={thumbContainerRef} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700" style={{ height: 48 }}>
          <div className="flex h-full" style={{ width: "100%" }}>
            {thumbnails.map((url, i) => {
              const t = (i / thumbnails.length) * duration;
              const isInRange = t >= startSec && t <= endSec;
              return (
                <div key={i} className="relative flex-1 min-w-0" style={{ opacity: isInRange ? 1 : 0.35 }}>
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    onLoad={() => setThumbLoaded(prev => new Set(prev).add(i))}
                    className="w-full h-full object-cover"
                    style={{ filter: thumbLoaded.has(i) ? "none" : "blur(4px)" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {!thumbLoaded.has(i) && (
                    <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
          {/* Thumb selection overlay (matches trim) */}
          {startSec > 0 && (
            <div className="absolute inset-y-0 left-0 bg-slate-900/40" style={{ left: 0, width: `${(startSec / duration) * 100}%` }} />
          )}
          {endSec < duration && (
            <div className="absolute inset-y-0 bg-slate-900/40" style={{ left: `${(endSec / duration) * 100}%`, right: 0 }} />
          )}
          {/* Hover timestamp on thumbnails */}
          {hoverTime !== null && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-slate-900/80 text-white text-[8px] px-1.5 py-0.5 rounded font-mono whitespace-nowrap pointer-events-none">
              {secondsToTime(hoverTime)}
            </div>
          )}
        </div>
      )}

      {/* Quick trim presets */}
      <div className="flex gap-1.5 flex-wrap">
        {[15, 30, 60, 120, 300].map((sec) => (
          <button
            key={sec}
            onClick={() => onTrimChange(secondsToTime(0), secondsToTime(Math.min(sec, duration)))}
            className={`text-[8px] px-2 py-0.5 rounded-lg border font-medium transition-all cursor-pointer ${
              endSec - startSec <= sec + 2 && endSec - startSec >= sec - 2
                ? "bg-indigo-100 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-300"
            }`}
          >
            <Play className="h-2.5 w-2.5 inline mr-0.5" />
            {sec < 60 ? `${sec}s` : `${sec / 60}m`}
          </button>
        ))}
        <button
          onClick={() => onTrimChange("", "")}
          className="text-[8px] px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-300 bg-slate-100 dark:bg-slate-800 font-medium transition-all cursor-pointer"
        >
          Full
        </button>
      </div>

      {subtitles && subtitles.length > 0 && (
        <p className="text-[8px] text-amber-500 dark:text-amber-400">🟡 {subtitles.length} subtitle cues | {chapters && chapters.length > 0 ? `🟣 ${chapters.length} chapters` : ""}</p>
      )}
    </div>
  );
}
