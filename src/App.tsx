import { useState, useEffect } from "react";
import { Layers, HardDrive, Globe, Info, Github, HelpCircle, Activity, Play, AlertCircle, CheckCircle2, X, Cpu, Shield, Sparkles, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Header from "./components/Header";
import FileDropzone from "./components/FileDropzone";
import UrlInput from "./components/UrlInput";
import PlaylistView from "./components/PlaylistView";
import MetadataPreview from "./components/MetadataPreview";
import TranscodeSettings from "./components/TranscodeSettings";
import ProgressCard from "./components/ProgressCard";
import HistoryList from "./components/HistoryList";

import SkeletonLoader from "./components/SkeletonLoader";
import PreviewPopup from "./components/PreviewPopup";
import PublishedGallery from "./components/PublishedGallery";
import { apiFetch } from "./api";
import { MediaMetadata, ConversionSettings, Job, ConversionHistoryItem } from "./types";

export default function App() {
  // Theme Management
  const [theme, setTheme] = useState<"light" | "dark" | any>(() => {
    const saved = localStorage.getItem("saga_theme");
    return saved === "dark" ? "dark" : "light";
  });

  // Connection states
  const [isServerOnline, setIsServerOnline] = useState(false);
  const [serverInfo, setServerInfo] = useState<{ uptime: number; product: string } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Active Source management: 'file' | 'url'
  const [sourceType, setSourceType] = useState<"file" | "url">("file");

  // Inspected state details
  const [jobId, setJobId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [playlistData, setPlaylistData] = useState<any | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState<string>("best");
  const [urlLoading, setUrlLoading] = useState(false);

  // Preview media overlay target state
  const [previewMedia, setPreviewMedia] = useState<{
    id: string;
    name: string;
    size: number;
    isPublished: boolean;
  } | null>(null);

  // Sync index for community directory
  const [syncTrigger, setSyncTrigger] = useState(0);

  // Conversion engine track
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [pollingId, setPollingId] = useState<NodeJS.Timeout | null>(null);

  // Journal listing
  const [history, setHistory] = useState<ConversionHistoryItem[]>([]);

  // Info modal state
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Elegant Toast notification states
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  // Toggle theme utility
  const toggleTheme = () => {
    setTheme((prev: string) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("saga_theme", theme);
  }, [theme]);

  // Sync showroom elements when global notifications complete
  useEffect(() => {
    const handleSyncEvent = () => {
      setSyncTrigger((prev) => prev + 1);
    };
    window.addEventListener("publish-sync", handleSyncEvent);
    return () => {
      window.removeEventListener("publish-sync", handleSyncEvent);
    };
  }, []);

  // Listen for dynamic custom in-app notifications/toasts
  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent && customEvent.detail) {
        setToast({
          message: customEvent.detail.message || "Request completed",
          type: customEvent.detail.type || "info"
        });
      }
    };
    window.addEventListener("app-toast", handleToastEvent);
    return () => {
      window.removeEventListener("app-toast", handleToastEvent);
    };
  }, []);

  // ─── Easter eggs ───

  // Console egg
  useEffect(() => {
    console.log("%c🔮 Transmux Saga PRO", "font-size:24px;font-weight:bold;color:#6366f1");
    console.log("%c👀 Looking for secrets? Try the Konami Code...", "font-size:14px;color:#94a3b8");
  }, []);

  // Konami code easter egg
  useEffect(() => {
    const konami = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let idx = 0;
    const handler = (e: KeyboardEvent) => {
      if (e.key === konami[idx]) {
        idx++;
        if (idx === konami.length) {
          idx = 0;
          window.dispatchEvent(new CustomEvent("app-toast", {
            detail: { message: "🕹️ Konami Code Activated! You unlocked the secret sauce! 🎉", type: "success" }
          }));
          document.body.classList.add("easter-egg-rainbow");
          setTimeout(() => document.body.classList.remove("easter-egg-rainbow"), 5000);
        }
      } else {
        idx = e.key === konami[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Logo click counter (managed in Header, triggered via custom event)
  useEffect(() => {
    const handler = () => {
      window.dispatchEvent(new CustomEvent("app-toast", {
        detail: { message: "👻 You found me! Transmux was built with ❤️ and lots of ☕", type: "info" }
      }));
    };
    window.addEventListener("logo-easter-egg", handler);
    return () => window.removeEventListener("logo-easter-egg", handler);
  }, []);

  // Safe timeout sweeper for clearing toast alert layers
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 1. Listen for background connection status on mount
  useEffect(() => {
    async function checkServerHealth() {
      try {
        const res = await apiFetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setIsServerOnline(true);
          setServerInfo(data);
        } else {
          setIsServerOnline(false);
        }
      } catch (err) {
        setIsServerOnline(false);
      } finally {
        setPageLoading(false);
      }
    }
    checkServerHealth();
    const intervalHealth = setInterval(checkServerHealth, 15000);

    // Load recent completions from LocalStorage
    const saved = localStorage.getItem("transmux_journal");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem("transmux_journal");
      }
    }

    return () => {
      clearInterval(intervalHealth);
      if (pollingId) clearInterval(pollingId);
    };
  }, []);

  // 2. Clear current workflows
  const handleReset = () => {
    setJobId(null);
    setMetadata(null);
    setPlaylistData(null);
    setSelectedFormatId("best");
    setActiveJob(null);
    if (pollingId) {
      clearInterval(pollingId);
      setPollingId(null);
    }
  };

  // 3. Complete Upload callbacks
  const handleUploadSuccess = (newJobId: string, parsedMeta: any) => {
    handleReset();
    setSourceType("file");
    setJobId(newJobId);
    setMetadata({
      title: parsedMeta.filename,
      thumbnail: "",
      duration: parsedMeta.duration,
      extractor: "raw-file",
      filename: parsedMeta.filename,
      video: parsedMeta.video,
      audio: parsedMeta.audio,
      format: parsedMeta.format,
      size: parsedMeta.size,
    });
  };

  // 4. URL extraction success callbacks
  const handleUrlSuccess = (parsedMeta: any) => {
    handleReset();
    setSourceType("url");
    setMetadata(parsedMeta);
  };

  const handlePlaylistDetected = (playlist: any) => {
    handleReset();
    setSourceType("url");
    setPlaylistData(playlist);
  };

  // 5. Trigger transcoder on backend
  const handleStartConversion = async (settings: ConversionSettings) => {
    if (!isServerOnline) return;

    // Check parameters
    const body: any = {
      settings: {
        ...settings,
        selectedFormatId,
        thumbnailUrl: metadata?.thumbnail || "",
        mediaTitle: metadata?.title || "",
      },
    };

    if (sourceType === "file" && jobId) {
      body.jobId = jobId;
    } else if (sourceType === "url" && metadata?.originalUrl) {
      body.url = metadata.originalUrl;
    } else {
      return;
    }

    try {
      const response = await apiFetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resData = await response.json();
      if (response.ok && resData.success) {
        // Construct temporary loading Job
        const initJob: Job = {
          id: resData.jobId,
          type: sourceType,
          status: "queued",
          progress: 2,
          speed: "0x",
          eta: "queued",
          inputName: metadata?.title || "Evaluating media",
          inputSize: metadata?.filename ? 100 : 0, 
          outputName: null,
          outputSize: 0,
          error: null,
          createdAt: new Date().toISOString(),
          downloadUrl: null,
        };
        setActiveJob(initJob);
        startPolling(resData.jobId);
      } else {
        showToast(resData.error || "Failed to submit conversion parameters to transcoder.", "error");
      }
    } catch (e) {
      showToast("Network failure connection interrupted invoking direct conversions. Please try again.", "error");
    }
  };

  // 6. Poll for job state updates on the server
  const startPolling = (jobToPoll: string) => {
    if (pollingId) clearInterval(pollingId);

    const poll = setInterval(async () => {
      try {
        const response = await apiFetch(`/api/job/${jobToPoll}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setActiveJob(data.job);
            
            if (data.job.status === "completed") {
              clearInterval(poll);
              setPollingId(null);

              // Record in journal
              const newItem: ConversionHistoryItem = {
                jobId: data.job.id,
                inputName: data.job.inputName,
                outputName: data.job.outputName || "converted_file",
                outputFormat: (data.job.outputName || "").split(".").pop() || "mp3",
                completedAt: new Date().toISOString(),
                size: data.job.outputSize,
                bitrate: data.job.outputBitrate,
              };

              setHistory((prev) => {
                const updated = [newItem, ...prev.slice(0, 19)]; // Keep up to 20 records
                localStorage.setItem("transmux_journal", JSON.stringify(updated));
                return updated;
              });
            } else if (data.job.status === "failed") {
              clearInterval(poll);
              setPollingId(null);
            }
          }
        }
      } catch (err) {
        console.error("Failed to connect with background polling thread:", err);
      }
    }, 1000);

    setPollingId(poll);
  };

  const handleClearHistory = () => {
    localStorage.removeItem("transmux_journal");
    setHistory([]);
  };

  return (
    <div id="applet-viewport" className="min-h-screen flex flex-col font-sans relative text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Corporate Header */}
      <Header isServerOnline={isServerOnline} serverInfo={serverInfo} theme={theme} onToggleTheme={toggleTheme} onOpenInfo={() => setShowInfoModal(true)} />

      {/* Main Container Layout */}
      <main id="main-content" className="relative flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-8">
        
        {pageLoading ? (
          <SkeletonLoader type="fullPage" />
        ) : (
        <>
        
        {/* Intro Hero Section */}
        <motion.div
          id="intro-hero"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center max-w-2xl mx-auto space-y-3"
        >
          <h1 id="hero-heading" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans sm:leading-tight">
            Seamlessly Transcode & Remux <span className="font-extrabold bg-gradient-to-r from-indigo-600 to-violet-500 dark:from-indigo-400 dark:to-purple-300 bg-clip-text text-transparent">Any Media Stream</span>
          </h1>
          <p id="hero-lead" className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Transmux parses file binaries and extracts public target links via Project Saga engines. Perfect for fast, codec-clean audio, video, or subtitles scaling.
          </p>
        </motion.div>

        {/* Content workflow panels */}
        <motion.div
          id="app-workspace-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          
          {/* Workhorse Left-side Configuration Area */}
          <div id="config-col" className="lg:col-span-2 space-y-6">
            
            {/* 1. Source selector cards (Hide when processing conversion) */}
            {!activeJob && (
              <div id="selector-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-sm">
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white font-sans">Choose Media Origin</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">File uploads vs link parsing</p>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800">
                    <button
                      id="origin-tab-file"
                      onClick={() => {
                        setSourceType("file");
                        handleReset();
                      }}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        sourceType === "file"
                          ? "bg-white dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-200/50 dark:border-slate-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-205"
                      }`}
                    >
                      <HardDrive className="h-3.5 w-3.5" />
                      File Upload
                    </button>
                    <button
                      id="origin-tab-url"
                      onClick={() => {
                        setSourceType("url");
                        handleReset();
                      }}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        sourceType === "url"
                          ? "bg-white dark:bg-slate-800 text-slate-950 dark:text-white border border-slate-200/50 dark:border-slate-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-250"
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Link Stream
                    </button>
                  </div>
                </div>

                {/* Sub panels slots */}
                <div id="source-active-view" className="relative">
                  {sourceType === "file" ? (
                    <FileDropzone
                      onUploadSuccess={handleUploadSuccess}
                      onUploadReset={handleReset}
                      activeUploadName={metadata && metadata.extractor === "raw-file" ? metadata.title : null}
                    />
                  ) : (
                    <UrlInput
                      onMetadataFetched={handleUrlSuccess}
                      onUrlReset={handleReset}
                      activeUrl={metadata && metadata.originalUrl ? metadata.originalUrl : (playlistData && playlistData.originalUrl ? playlistData.originalUrl : null)}
                      onLoadingChange={setUrlLoading}
                      onPlaylistDetected={handlePlaylistDetected}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 2. Playlist view */}
            {playlistData && (
              <PlaylistView playlist={playlistData} onReset={handleReset} />
            )}

            {/* 3. Metadata presentation of analyzed assets */}
            {!playlistData && urlLoading ? (
              <SkeletonLoader type="metadata" />
            ) : !playlistData && metadata && (
              <MetadataPreview
                metadata={metadata}
                selectedFormatId={selectedFormatId}
                onFormatSelected={setSelectedFormatId}
              />
            )}

            {/* 4. Render configs panel when target is analyzed but not yet converting */}
            {!playlistData && metadata && !activeJob && !urlLoading && (
              <TranscodeSettings
                onStartConversion={handleStartConversion}
                isProcessing={false}
                sourceType={sourceType}
                initialDuration={metadata.duration}
                sourceMetadata={metadata}
                selectedFormatId={selectedFormatId}
              />
            )}

            {/* 4. Active Job progress screen */}
            {activeJob && (
              <ProgressCard
                job={activeJob}
                onReset={handleReset}
                onPreview={(id, name, size) => setPreviewMedia({ id, name, size, isPublished: false })}
              />
            )}
          </div>

          {/* Right-side dynamic sidebar with help tips and histories journal */}
          <div id="sidebar-col" className="space-y-6">
            
            {/* Connection engine error warnings */}
            {!isServerOnline && (
              <div id="connection-warning-card" className="bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900 rounded-2xl p-5 space-y-2">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-widest font-mono">Engine is Booting</p>
                <p className="text-xs text-amber-700 dark:text-amber-500 font-medium leading-relaxed">
                  The container's background transcode servers are currently firing up. File uploads and url checks are blocked until initialization completes. (Usually takes 5-10 seconds)
                </p>
              </div>
            )}

            {/* Active History log column card */}
            <HistoryList
              history={history}
              onClearHistory={handleClearHistory}
              onPreview={(id, name, size) => setPreviewMedia({ id, name, size, isPublished: false })}
            />
          </div>
        </motion.div>

        {/* Panoramic Horizontal Showroom Feed Section */}
        <motion.div
          id="panoramic-showroom-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
          className="pt-2"
        >
          <PublishedGallery
            onPreview={(id, name, size, isPub) => setPreviewMedia({ id, name, size, isPublished: isPub })}
            syncTrigger={syncTrigger}
          />
        </motion.div>
        </>
        )}
      </main>

      {/* Small informative Footer */}
      {pageLoading ? (
        <div className="border-t border-slate-200 dark:border-slate-800 py-6 px-4 text-center space-y-2 mt-auto animate-pulse">
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-96 mx-auto" />
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-md w-80 mx-auto" />
        </div>
      ) : (
      <motion.footer
        id="app-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="border-t border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 py-6 px-4 text-center text-xs text-slate-400 dark:text-slate-500 mt-auto relative z-10 space-y-2"
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-slate-800 dark:text-slate-300" />
            <span>Transmux Engine: Node 22 + FFmpeg + yt-dlp + Simulated Redis Core</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer text-slate-450">Project Saga Open-Source Platform</span>
        </div>
        <p className="text-[10px] text-slate-450">
          Intellectual integrity disclaimer: Transmux does not authorize download or distribution of copyrighted files without consent of the IP owners.
        </p>
      </motion.footer>
      )}

      {/* Modern scale-up transition loopback Previewer Modal */}
      {previewMedia && (
        <PreviewPopup
          mediaId={previewMedia.id}
          filename={previewMedia.name}
          size={previewMedia.size}
          isPublished={previewMedia.isPublished}
          onClose={() => setPreviewMedia(null)}
        />
      )}

      {/* Info Modal */}
      <AnimatePresence>
        {showInfoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md"
            onClick={() => setShowInfoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-sans">About Transmux</h3>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">Project Saga</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Codename & Creator */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <Cpu className="h-3.5 w-3.5" />
                    <span>Codename & Creator</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 space-y-2 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Codename</span>
                      <span className="text-xs font-bold font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded">Project Saga</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Creator</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">SENKUDEVX</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Version</span>
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-300">1.0.0</span>
                    </div>
                  </div>
                </div>

                {/* How It Works */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>How It Works</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { step: "1", title: "Choose Source", desc: "Upload a local media file or paste a URL from YouTube, Vimeo, SoundCloud, etc." },
                      { step: "2", title: "Inspect & Configure", desc: "View media metadata, select output format, adjust codec, bitrate, resolution, and trim settings." },
                      { step: "3", title: "Transcode", desc: "The server processes your media using FFmpeg with real-time progress tracking." },
                      { step: "4", title: "Preview & Download", desc: "Preview the result instantly in-browser, download, or publish to the community gallery." },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800">
                        <div className="w-6 h-6 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {item.step}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tech Stack */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Powered By</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["React", "TypeScript", "Express", "FFmpeg", "yt-dlp", "Tailwind CSS", "Vite"].map((tech) => (
                      <span key={tech} className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4">
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Transmux is an enterprise-grade, open-source media conversion platform. It provides extreme scaling for container metadata inspection, dynamic bitrate selection, and cross-codec transcoding — all through a clean, modern interface.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-center">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  Crafted with <span className="text-rose-500">&hearts;</span> by SENKUDEVX &mdash; Project Saga
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Toast System Overlay */}
      {toast && (
        <div
          id="global-toast-notification"
          className={`fixed bottom-6 right-6 z-[120] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-md animate-scale-up max-w-md ${
            toast.type === "error"
              ? "bg-rose-50/95 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900 text-rose-805 dark:text-rose-300"
              : toast.type === "success"
              ? "bg-emerald-50/95 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-900 text-emerald-805 dark:text-emerald-300"
              : "bg-slate-900/95 dark:bg-slate-950/90 border-slate-700 text-white"
          }`}
        >
          {toast.type === "error" ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Info className="h-5 w-5 shrink-0 text-indigo-400" />
          )}
          <div className="text-xs font-semibold font-sans leading-relaxed">
            {toast.message}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-[10px] font-bold uppercase tracking-wider pl-2 border-l border-slate-350/30 hover:opacity-80 text-current transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
