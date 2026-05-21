import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, Download, FileAudio, FileVideo, FileText, Copy, Check, RefreshCw, Play, BookOpen, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { formatSize } from "./MetadataPreview";
import { Job } from "../types";

const EDUCATIONAL_TIPS = [
  {
    title: "MKV Matroska Shell",
    tag: "Nesting Star",
    color: "from-sky-500 to-indigo-500",
    text: "Named after Russian stacking dolls (Matryoshka). MKV is an open-standard extensible container capable of holding unlimited video, audio, multiple subtitle streams (like SRT or premium ASS files), menus, and chapters in one bundle."
  },
  {
    title: "MP4 Web Compliance",
    tag: "Streaming Standard",
    color: "from-indigo-500 to-purple-500",
    text: "Standardized by ISO based on standard Apple QuickTime specifications. While constrained for complex multi-language audio tracks, it is the absolute king of network direct playback compatibility across Safari, Chrome, iOS, and game consoles."
  },
  {
    title: "Audio Encoding Epochs",
    tag: "AAC vs MP3",
    color: "from-purple-500 to-pink-500",
    text: "MP3 launched standard digital audiophiles globally, but compresses poorly at low spatial densities. Advanced Audio Coding (AAC) succeeded MP3, with optimized psychoacoustic filtering giving superior acoustic preservation at identical bitrates."
  },
  {
    title: "Remuxing vs Transcoding",
    tag: "Zero Quality Loss",
    color: "from-emerald-500 to-teal-500",
    text: "Selecting 'Copy' or 'keep' options triggers standard zero-copy Remuxing (called Stream Copy). Instead of exhausting CPU re-writing pixels, it extracts intact content streams and updates the outer wrapper metadata index in milliseconds."
  },
  {
    title: "Studio-Grade Lossless Audio",
    tag: "FLAC & WAV archives",
    color: "from-pink-500 to-rose-500",
    text: "Swapping any multi-track video stream directly using FLAC/WAV audio tags handles extreme demuxing. It strips visual layers and structures uncompressed acoustic waveform segments at master-recording preservation accuracy levels."
  },
  {
    title: "The Genius of FFmpeg",
    tag: "Universal Engine",
    color: "from-amber-500 to-orange-500",
    text: "Founded by French programmer Fabrice Bellard in 2000. Under the hood of AI Studio's Transmux lies this legendary hyper-optimized software suite. Standard web platforms and digital televisions run FFmpeg on billions of cores daily."
  },
  {
    title: "Advanced Subtitles Styling",
    tag: "SRT vs SSA/ASS",
    color: "from-cyan-500 to-blue-500",
    text: "While SRT represents simple text paragraphs with time markers, advanced ASS/SSA (SubStation Alpha) specifications allow exact dynamic typesetting placement, custom font overrides, colored karaoke fades, and animated vectors."
  }
];

interface ProgressCardProps {
  job: Job;
  onReset: () => void;
  onPreview?: (id: string, name: string, size: number) => void;
}

export default function ProgressCard({ job, onReset, onPreview }: ProgressCardProps) {
  const [downloadName, setDownloadName] = useState("");
  const [copied, setCopied] = useState(false);

  const [currentTipIdx, setCurrentTipIdx] = useState(0);
  const [progressTimer, setProgressTimer] = useState(0);

  useEffect(() => {
    // Reset timer every slide change
    setProgressTimer(0);
  }, [currentTipIdx]);

  useEffect(() => {
    // Increment visual progress percent on active tilecard
    const intervalTime = 100; // update scale UI every 100ms
    const totalDuration = 20000; // 20 seconds
    const step = (intervalTime / totalDuration) * 100;

    const timer = setInterval(() => {
      setProgressTimer((prev) => {
        if (prev >= 100) {
          // Trigger next slide
          setCurrentTipIdx((idx) => (idx + 1) % EDUCATIONAL_TIPS.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  // Extract base output extension
  const getExtension = (name: string) => {
    return name.split(".").pop() || "";
  };

  const getCleanBase = (name: string) => {
    return name.substring(0, name.lastIndexOf("."));
  };

  const extOutput = job.outputName ? getExtension(job.outputName) : "";

  // Set initial default title if not set
  const getDownloadFilename = () => {
    if (!job.outputName) return "converted_file";
    if (!downloadName.trim()) return job.outputName;
    const base = downloadName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "");
    return `${base}.${extOutput}`;
  };

  const isAbsolute = job.downloadUrl?.startsWith("http://") || job.downloadUrl?.startsWith("https://");
  const downloadLink = job.downloadUrl
    ? isAbsolute
      ? job.downloadUrl
      : `${window.location.origin}${job.downloadUrl}?filename=${encodeURIComponent(getDownloadFilename())}`
    : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Graceful fallback for browsers inside restricted iframes
      const textArea = document.createElement("textarea");
      textArea.value = downloadLink;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error("Clipboard copy failed inside frame context.");
      }
      document.body.removeChild(textArea);
    }
  };

  const isAudio = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "opus"].includes(extOutput);
  const isSubtitle = ["srt", "vtt", "ass", "sub"].includes(extOutput);

  return (
    <div id="progress-card-root" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-6 space-y-6 text-slate-900 dark:text-slate-100">
      
      {/* HEADER STATUS */}
      <div id="progress-card-header" className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          {job.status === "completed" ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          ) : job.status === "failed" ? (
            <XCircle className="h-6 w-6 text-rose-600 dark:text-rose-450" />
          ) : (
            <Loader2 className="h-6 w-6 text-slate-900 dark:text-slate-100 animate-spin" />
          )}

          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans capitalize">
              {job.status === "completed" && "Transmux Success"}
              {job.status === "failed" && "Failed Task Pipeline"}
              {job.status === "queued" && "Queued in Pool..."}
              {job.status === "processing" && "Saga Core Transcoding..."}
            </h3>
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              ID: {job.id.substring(0, 8)} | Type: {job.type}
            </p>
          </div>
        </div>

        {job.status === "processing" && (
          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-955 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800">
            {job.speed || "N/A"} Speed
          </span>
        )}
      </div>

      {/* CORE DISPLAY (Depending on States) */}
      <div id="progress-card-body" className="space-y-4">
        
        {/* Active conversion state details */}
        {(job.status === "queued" || job.status === "processing") && (
          <div id="progress-active-panel" className="space-y-4">
            <div className="flex justify-between items-baseline text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[280px]">
                {job.inputName}
              </p>
              <span className="text-xs font-mono font-bold text-slate-550 dark:text-slate-400">
                {job.progress}%
              </span>
            </div>

            {/* Glowing progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
              <div
                className="bg-slate-900 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 dark:text-slate-500">Transmux ETA</span>
                <p className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5">{job.eta || "calculating"}</p>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">Task Source Size</span>
                <p className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5">{formatSize(job.inputSize)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Failed pipeline states */}
        {job.status === "failed" && (
          <div id="progress-failed-panel" className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-4 text-center space-y-3">
            <p className="text-xs text-rose-700 dark:text-rose-400 font-medium leading-relaxed">
              {job.error || "An error occurred during transcoding. Ensure format codes and time trimmings are inside bounds."}
            </p>
            <button
              id="btn-re-attempt"
              onClick={onReset}
              className="text-xs px-4 py-2 bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 dark:hover:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-450 rounded-xl font-medium transition-all cursor-pointer"
            >
              Re-attempt parameters
            </button>
          </div>
        )}

        {/* Success / Completed delivery panel */}
        {job.status === "completed" && job.outputName && (
          <div id="progress-completed-panel" className="space-y-5">
            
            {/* Output File Card layout */}
            <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 items-center justify-between">
              <div className="flex gap-3 items-center min-w-0">
                <div className={`p-3 rounded-xl border shrink-0 ${
                  isAudio ? "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900 text-sky-800 dark:text-sky-400" :
                  isSubtitle ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400" :
                  "bg-slate-100 dark:bg-slate-850 border-slate-250 dark:border-slate-805 text-slate-800 dark:text-slate-300"
                }`}>
                  {isAudio ? <FileAudio className="h-5 w-5" /> :
                   isSubtitle ? <FileText className="h-5 w-5" /> :
                   <FileVideo className="h-5 w-5" />}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]" title={job.outputName}>
                    {job.outputName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {formatSize(job.outputSize)}{job.outputBitrate ? ` \u00B7 ${job.outputBitrate}` : ""}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded shrink-0 uppercase tracking-wider">
                Ready
              </span>
            </div>

            {/* Optional Output Rename Field prior to downloads */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center justify-between">
                <span>Rename Output File (Optional)</span>
                <span className="text-slate-500 dark:text-slate-400 font-normal">extension: .{extOutput}</span>
              </label>
              <input
                type="text"
                id="rename-field"
                value={downloadName}
                onChange={(e) => setDownloadName(e.target.value)}
                placeholder={getCleanBase(job.outputName)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-slate-900 dark:focus:border-slate-200 outline-none placeholder-slate-400 font-sans"
              />
            </div>

            {/* Actions: Download with Custom Renamings + Share link */}
            <div className="space-y-3 pt-2">
              {onPreview && (
                <button
                  type="button"
                  onClick={() => onPreview(job.id, getDownloadFilename(), job.outputSize)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-505 dark:hover:bg-indigo-650 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.01]"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>Preview Media Output Instantly</span>
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  id="btn-trigger-download"
                  href={downloadLink}
                  download={getDownloadFilename()}
                  className="py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wide transition-all cursor-pointer select-none"
                >
                  <Download className="h-4 w-4" />
                  <span>Save Stream File</span>
                </a>

                <button
                  type="button"
                  id="btn-copy-link"
                  onClick={handleCopyLink}
                  className="py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-705 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-750 font-semibold dark:text-emerald-400">Address Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span>Copy Direct URI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Clear workflow to transcode another asset */}
            <div className="text-center pt-1 border-t border-slate-100 dark:border-slate-850">
              <button
                type="button"
                id="btn-completed-reset"
                onClick={onReset}
                className="text-xs text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-101 dark:hover:bg-slate-700 px-4 py-2 border border-slate-200 dark:border-slate-705 rounded-lg transition-all cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Reset to homepage</span>
              </button>
            </div>
          </div>
        )}

        {/* FORMAT REFERENCE & HISTORY HANDBOOK - CARD BASED CAROUSEL */}
        <div id="format-educational-section" className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-500" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white font-sans uppercase tracking-wider">
                Media Architecture & Codec Tips
              </h4>
            </div>
            
            {/* Slide Navigation controls */}
            <div className="flex items-center gap-1.5 text-slate-400">
              <button
                type="button"
                onClick={() => setCurrentTipIdx((idx) => (idx - 1 + EDUCATIONAL_TIPS.length) % EDUCATIONAL_TIPS.length)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Previous Tip"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[10px] font-mono font-bold text-slate-400 select-none">
                {currentTipIdx + 1} / {EDUCATIONAL_TIPS.length}
              </span>
              <button
                type="button"
                onClick={() => setCurrentTipIdx((idx) => (idx + 1) % EDUCATIONAL_TIPS.length)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Next Tip"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Carousel Slide Card wrapper */}
          <div className="relative overflow-hidden bg-slate-50/70 dark:bg-slate-950/45 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4.5 space-y-3 shadow-inner hover:bg-slate-50 dark:hover:bg-slate-950 transition-all">
            
            {/* Top Badge & Tag info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${EDUCATIONAL_TIPS[currentTipIdx].color}`}></span>
                <span className="font-extrabold font-mono text-[11px] text-slate-800 dark:text-slate-200">
                  {EDUCATIONAL_TIPS[currentTipIdx].title}
                </span>
              </div>
              <span className="text-[10px] font-mono font-purple bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100/30 dark:border-indigo-900/40">
                {EDUCATIONAL_TIPS[currentTipIdx].tag}
              </span>
            </div>

            {/* Slide Body text with subtle fade animation */}
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[58px] transition-opacity duration-300">
              {EDUCATIONAL_TIPS[currentTipIdx].text}
            </p>

            {/* Progress indicators dots layout with 20 second fill line */}
            <div className="pt-2 text-xs flex flex-col gap-2">
              {/* Circular or linear timer line */}
              <div className="w-full h-1 bg-slate-150 dark:bg-slate-850 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${EDUCATIONAL_TIPS[currentTipIdx].color} transition-all duration-100 ease-linear`}
                  style={{ width: `${progressTimer}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 select-none">
                <span>Rotates every 20s</span>
                <span>{Math.ceil((20000 - (progressTimer / 100) * 20000) / 1000)}s remaining</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/40 p-3 rounded-xl flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong>Interactive Tip:</strong> Click the arrows above to manually sweep the comprehensive codec handbook guide logs!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
