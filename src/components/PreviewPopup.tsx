import React, { useState, useEffect, useRef } from "react";
import { X, Play, Pause, Volume2, FileVideo, FileAudio, FileText, Download, Share2, Sparkles, Check, Globe } from "lucide-react";
import { apiUrl, apiFetch } from "../api";
import { formatSize } from "./MetadataPreview";

interface PreviewPopupProps {
  mediaId: string;
  filename: string;
  size: number;
  isPublished?: boolean;
  onClose: () => void;
}

export default function PreviewPopup({ mediaId, filename, size, isPublished = false, onClose }: PreviewPopupProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [textLines, setTextLines] = useState<string[]>([]);
  const [loadingText, setLoadingText] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const isAudio = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "opus"].includes(ext);
  const isSubtitle = false;
  const isVideo = !isAudio && !isSubtitle;

  const streamUrl = apiUrl(isPublished
    ? `/api/published/stream/${mediaId}`
    : `/api/job/stream/${mediaId}`);

  const downloadUrl = apiUrl(`/api/download/${mediaId}?filename=${encodeURIComponent(filename)}`);

  const BAR_COUNT = 32;
  const [barHeights, setBarHeights] = useState<number[]>(Array(BAR_COUNT).fill(6));
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    let frameId: number;
    const update = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const binsPerBar = Math.floor(dataArray.length / BAR_COUNT);
        const heights = Array.from({ length: BAR_COUNT }, (_, i) => {
          if (isPlaying) {
            let sum = 0;
            for (let j = 0; j < binsPerBar; j++) {
              sum += dataArray[i * binsPerBar + j];
            }
            const avg = sum / binsPerBar;
            return Math.max(4, (avg / 255) * 84 + 4);
          }
          // Idle animation: gentle wave
          const idle = Math.sin(Date.now() / 300 + i * 0.5) * 3 + 8;
          return Math.max(4, idle);
        });
        setBarHeights(heights);
      }
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (isSubtitle) {
      setLoadingText(true);
      const textEndpoint = isPublished ? `/api/published/text/${mediaId}` : `/api/job/text/${mediaId}`;
      apiFetch(textEndpoint)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.text) {
            setTextLines(data.text.split("\n"));
          } else {
            setTextLines(["Error loading subtitle transcript.", "Verify file contents."]);
          }
        })
        .catch(() => {
          setTextLines(["Network error fetching subtitle transcript file."]);
        })
        .finally(() => {
          setLoadingText(false);
        });
    }
  }, [mediaId, isSubtitle, isPublished]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (isVideo && videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    } else if (isAudio && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        try {
          if (!audioCtxRef.current) {
            const ctx = new AudioContext();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            const source = ctx.createMediaElementSource(audioRef.current);
            source.connect(analyser);
            analyser.connect(ctx.destination);
            audioCtxRef.current = ctx;
            analyserRef.current = analyser;
          }
          if (audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume();
          }
          audioRef.current.play().catch(() => {});
        } catch (e) {
          console.warn("Audio preview setup failed:", e);
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const currentMediaRef = isVideo ? videoRef : audioRef;

  const handleTimeUpdate = () => {
    const media = currentMediaRef.current;
    if (media) {
      setCurrentTime(media.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const media = currentMediaRef.current;
    if (media) {
      setDuration(media.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const media = currentMediaRef.current;
    if (media) {
      media.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const media = currentMediaRef.current;
    if (media) {
      media.volume = val;
    }
  };

  // Format second counters (e.g. 02:35)
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Publish workflow directly inside previewer!
  const handlePublishToWeb = async () => {
    if (published || isPublishing) return;
    setIsPublishing(true);
    try {
      const response = await apiFetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: mediaId,
          title: `Stream Capture: ${filename}`,
          description: `Polished ${ext.toUpperCase()} stream output published to public network lists.`
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setPublished(true);
        // Show success toast
        window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: "Successfully shared output to the project community showroom!", type: "success" } }));
        // Dispatch a global event or interval trigger so list updates instantly
        window.dispatchEvent(new Event("publish-sync"));
      } else {
        window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: data.error || "Unable to share conversion index.", type: "error" } }));
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: "Network connection failure sharing transcode record to showroom.", type: "error" } }));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyShareLink = async () => {
    const absolute = apiUrl(`/api/download/${mediaId}?filename=${encodeURIComponent(filename)}`);
    try {
      await navigator.clipboard.writeText(absolute);
      setCopiedLink(true);
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: "Download link copied successfully!", type: "success" } }));
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: `Clipboard permission blocked. Direct link: ${absolute}`, type: "info" } }));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md transition-all animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-slate-900 dark:text-slate-100 animate-scale-up">
        
        {/* HEADER bar */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isAudio ? "bg-sky-50 border-sky-100 text-sky-800 dark:bg-sky-950/20 dark:border-sky-900 dark:text-sky-400" :
              isSubtitle ? "bg-amber-50 border-amber-100/50 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-400" :
              "bg-slate-150 border-slate-200 text-slate-800 dark:bg-slate-850 dark:border-slate-800 dark:text-slate-300"
            }`}>
              {isAudio ? <FileAudio className="h-5 w-5" /> :
               isSubtitle ? <FileText className="h-5 w-5" /> :
               <FileVideo className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[320px]" title={filename}>
                {filename}
              </h3>
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                {formatSize(size)} | Container: .{ext} {isPublished && " | Shared"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* CONTAINER WORKSPACE AREA */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col justify-center min-h-[300px]">
          
          {isVideo && (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black aspect-video flex items-center justify-center shadow-inner group">
              <video
                ref={videoRef}
                src={streamUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full max-h-[380px] object-contain"
                controls
              />
              <div className="absolute top-2 left-2 bg-black/50 text-white font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-widest">
                Direct Loopback
              </div>
            </div>
          )}

          {isAudio && (
            <div className="space-y-6 max-w-md mx-auto w-full py-4 text-center">
              <audio
                ref={audioRef}
                src={streamUrl}
                crossOrigin="anonymous"
                preload="auto"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />

              {/* Spectacular pulsating visual sound waves */}
              <div className="flex items-center justify-center gap-[3px] h-28 mb-2">
                {barHeights.map((h, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full bg-gradient-to-t from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-pink-400 dark:to-rose-300 origin-center shadow-sm ${
                      isPlaying ? "" : "transition-all duration-200 ease-out"
                    }`}
                    style={{
                      height: `${h}px`,
                      opacity: isPlaying ? 0.6 + (h / 96) * 0.4 : 0.4,
                    }}
                  />
                ))}
              </div>

              {/* Progress and control values */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full accent-slate-900 dark:accent-white h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />

                {/* Main player controls interface */}
                <div className="flex items-center justify-center gap-6 pt-2">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                    <Volume2 className="h-4 w-4 shrink-0" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-16 accent-slate-900 dark:accent-white h-1 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={togglePlay}
                    className="p-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-full shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isVideo && !isAudio && (
            <div className="py-16 text-center">
              <FileText className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-400 dark:text-slate-500 text-sm">No preview available for this file type.</p>
            </div>
          )}

        </div>

        {/* BOTTOM INTERACTIVE ACTIONS BAR */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 grid grid-cols-1 md:grid-cols-3 gap-3">
          
          <a
            href={downloadUrl}
            download={filename}
            className="py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 tracking-wide uppercase transition-all shadow-sm cursor-pointer select-none"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Cache</span>
          </a>

          {!isPublished && (
            <button
              onClick={handlePublishToWeb}
              disabled={published || isPublishing}
              className={`py-2.5 border font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 uppercase transition-all cursor-pointer ${
                published
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-700 dark:text-emerald-400"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:text-slate-900 text-slate-700 dark:text-slate-300"
              }`}
            >
              {isPublishing ? (
                <span className="animate-pulse">Sharing...</span>
              ) : published ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Published Live</span>
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  <span>Publish to Web</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleCopyShareLink}
            className="py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 uppercase tracking-wide transition-all cursor-pointer hover:border-slate-400"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Stream Link</span>
              </>
            )}
          </button>

        </div>
      </div>

      <style>{`
        @keyframes bounce_waveform {
          0% { transform: scaleY(1); opacity: 0.7; }
          100% { transform: scaleY(4.5); opacity: 1; }
        }
        .anim-waveform-bar {
          transform-origin: center;
        }
      `}</style>
    </div>
  );
}
