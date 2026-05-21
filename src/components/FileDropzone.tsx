import React, { useState, useRef } from "react";
import { UploadCloud, FileVideo, FileAudio, CheckCircle2, AlertTriangle, Disc } from "lucide-react";

interface FileDropzoneProps {
  onUploadSuccess: (jobId: string, metadata: any) => void;
  onUploadReset: () => void;
  activeUploadName: string | null;
}

export default function FileDropzone({ onUploadSuccess, onUploadReset, activeUploadName }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedFormatsText = "MP3, WAV, OGG, AAC, FLAC, M4A, MP4, MKV, WEBM, MOV, AVI, SRT, VTT, PNG, JPG, WEBP";

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = (file: File) => {
    setErrorMessage(null);
    setUploadPercent(0);

    // Dynamic client-side format checks
    const allowedExtensions = [
      "mp3", "wav", "ogg", "aac", "flac", "m4a", "opus",
      "mp4", "mkv", "webm", "mov", "avi", "flv",
      "srt", "vtt", "ass",
      "png", "jpg", "jpeg", "webp", "gif"
    ];

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      setErrorMessage(
        `Rejected File: ".${fileExt || "unknown"}" is not a supported transcode target. ` +
        `Please select a valid media track:\n\n` +
        `• 🎵 Audio: MP3, WAV, OGG, AAC, FLAC, M4A, OPUS\n` +
        `• 🎬 Video: MP4, MKV, WEBM, MOV, AVI, FLV\n` +
        `• 📝 Subtitles: SRT, VTT, ASS\n` +
        `• 🖼️ Images: PNG, JPG, JPEG, WEBP, GIF`
      );
      setUploadPercent(null);
      return;
    }

    // Initial basic client check of size (1GB limits)
    if (file.size > 1024 * 1024 * 1024) {
      setErrorMessage("File exceeds the maximum 1GB container standard limit. Compression aborted.");
      setUploadPercent(null);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadPercent(percent);
      }
    };

    xhr.onload = () => {
      setUploadPercent(null);
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            onUploadSuccess(res.jobId, res.metadata);
          } else {
            setErrorMessage(res.error || "Failed to process uploaded container.");
          }
        } catch (err) {
          setErrorMessage("Failed to receive structured upload response.");
        }
      } else {
        setErrorMessage(`Server upload rejected with code ${xhr.status}`);
      }
    };

    xhr.onerror = () => {
      setUploadPercent(null);
      setErrorMessage("Network error occurred during stream delivery.");
    };

    xhr.send(formData);
  };

  return (
    <div id="dropzone-root" className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".mp3,.wav,.ogg,.aac,.flac,.m4a,.opus,.mp4,.mkv,.webm,.mov,.avi,.flv,.srt,.vtt,.ass,.png,.jpg,.jpeg,.webp,.gif"
        id="dropzone-file-input"
      />

      <div
        id="dropzone-area"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={activeUploadName ? undefined : triggerFileSelect}
        className={`relative overflow-hidden w-full h-[210px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 ${
          activeUploadName
            ? "border-emerald-250 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/5 cursor-default"
            : isDragging
            ? "border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/25 cursor-pointer scale-[1.015] shadow-xl shadow-indigo-150/50 dark:shadow-indigo-950/40 ring-4 ring-indigo-500/15"
            : "border-slate-300 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-805 bg-white dark:bg-slate-900 cursor-pointer"
        }`}
      >
        {uploadPercent !== null ? (
          /* Active Upload UI */
          <div id="dropzone-uploading" className="w-full max-w-sm px-6 text-center space-y-4">
            <div className="flex justify-center">
              <Disc className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Streaming Media Data...</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Enforcing integrity constraints ({uploadPercent}%)</p>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 dark:bg-indigo-550 h-1.5 rounded-full transition-all duration-150"
                style={{ width: `${uploadPercent}%` }}
              ></div>
            </div>
          </div>
        ) : activeUploadName ? (
          /* Upload Success File Details */
          <div id="dropzone-success" className="flex flex-col items-center text-center px-4 space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[320px]">
                {activeUploadName}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Source Active & Inspected</p>
            </div>
            <button
              id="btn-upload-reset"
              onClick={(e) => {
                e.stopPropagation();
                onUploadReset();
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline mt-1 cursor-pointer"
            >
              Convert a different file
            </button>
          </div>
        ) : (
          /* Waiting for Upload UI */
          <div id="dropzone-waiting" className="flex flex-col items-center text-center p-6 space-y-3 w-full">
            {isDragging ? (
              <div id="dropzone-dragging-active" className="flex flex-col items-center space-y-2 animate-pulse">
                <div className="p-3 bg-indigo-500 dark:bg-indigo-600 text-white rounded-2xl shadow-md">
                  <UploadCloud className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  Drop files to start inspecting streams!
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Valid audio, video, srt subtitles and main formats accepted
                </p>
              </div>
            ) : (
              <>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <UploadCloud className="h-7 w-7 text-indigo-500 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-900 dark:text-white">
                    Drag & drop media, or <span className="font-semibold underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[360px] leading-relaxed">
                    Supports media containers, multi-track audio/video or subtitle feeds up to 1GB
                  </p>
                </div>
                
                {/* Visual Feedback of Accepted Types */}
                <div className="flex flex-wrap justify-center gap-1.5 pt-1 max-w-[440px]">
                  <span className="flex items-center gap-1 text-[10px] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-305 px-2 py-0.5 rounded-full border border-sky-100 dark:border-sky-900/40 font-semibold font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                    🎵 Audio
                  </span>
                  <span className="flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-305 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/40 font-semibold font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                    🎬 Video
                  </span>
                  <span className="flex items-center gap-1 text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-305 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/40 font-semibold font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                    📝 Subtitles
                  </span>
                  <span className="flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-305 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/40 font-semibold font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    🖼️ Images
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Output banner */}
      {errorMessage && (
        <div id="dropzone-error" className="mt-3 flex items-start gap-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 px-4 py-3 rounded-xl text-xs leading-relaxed whitespace-pre-line">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium flex-1">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
