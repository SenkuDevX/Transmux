import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Download, FileAudio, FileVideo, FileText, Copy, Check, RefreshCw, Play } from "lucide-react";
import { formatSize } from "./MetadataPreview";
import { Job } from "../types";
import { apiUrl } from "../api";

interface ProgressCardProps {
  job: Job;
  onReset: () => void;
  onPreview?: (id: string, name: string, size: number) => void;
}

export default function ProgressCard({ job, onReset, onPreview }: ProgressCardProps) {
  const [downloadName, setDownloadName] = useState("");
  const [copied, setCopied] = useState(false);

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
      : `${apiUrl(job.downloadUrl)}?filename=${encodeURIComponent(getDownloadFilename())}`
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

        </div>
      </div>
  );
}
