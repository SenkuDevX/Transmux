import { useState, useEffect, useRef } from "react";
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
import TipsCard from "./components/TipsCard";

import SkeletonLoader from "./components/SkeletonLoader";
import PreviewPopup from "./components/PreviewPopup";
import PublishedGallery from "./components/PublishedGallery";
import CookieRefreshModal from "./components/CookieRefreshModal";
import { apiFetch } from "./api";
import { MediaMetadata, ConversionSettings, Job, ConversionHistoryItem } from "./types";

const BACKEND_URL = import.meta.env.VITE_API_URL || window.location.origin;

// ✏️ EDIT ANNOUNCEMENT BANNER: change this text or set to "" to hide
const BANNER_MESSAGE = "Transmux 5.0 — smarter conversions, faster downloads, extension-powered cookie sync, 30+ FAQ, and improved stability!";

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
    thumbnailUrl?: string;
    isPublished: boolean;
  } | null>(null);

  // Sync index for community directory
  const [syncTrigger, setSyncTrigger] = useState(0);

  // Cookie refresh flow
  const [cookieRefreshJobId, setCookieRefreshJobId] = useState<string | null>(null);

  // Conversion engine track
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [pollingId, setPollingId] = useState<NodeJS.Timeout | null>(null);
  const [showStallWarning, setShowStallWarning] = useState(false);

  // Journal listing
  const [history, setHistory] = useState<ConversionHistoryItem[]>([]);

  // Info modal state
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [hasNewVersion, setHasNewVersion] = useState(false);

  // Elegant Toast notification states
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showBanner, setShowBanner] = useState(() => {
    if (!BANNER_MESSAGE) return false;
    try { return localStorage.getItem("transmux_banner_dismissed") !== BANNER_MESSAGE; } catch { return true; }
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
  };

  // Auto-open changelog on new version
  useEffect(() => {
    const seenVersion = localStorage.getItem("transmux_changelog_seen");
    if (seenVersion !== "5.0") {
      setHasNewVersion(true);
      const timer = setTimeout(() => setShowChangelogModal(true), 500);
      localStorage.setItem("transmux_changelog_seen", "5.0");
      return () => clearTimeout(timer);
    }
  }, []);

  // Socket.IO connection
  useEffect(() => {
    let socket: any = null;
    try {
      import("./lib/socket").then(mod => { socket = mod.connectSocket(); });
    } catch {}
    return () => { try { socket?.disconnect(); } catch {} };
  }, []);

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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape: close any open modal
      if (e.key === "Escape") {
        if (previewMedia) {
          setPreviewMedia(null);
          e.preventDefault();
        } else if (showInfoModal) {
          setShowInfoModal(false);
          e.preventDefault();
        } else if (showFAQModal) {
          setShowFAQModal(false);
          e.preventDefault();
        } else if (cookieRefreshJobId) {
          setCookieRefreshJobId(null);
          e.preventDefault();
        }
      }
      // Ctrl+Enter: trigger conversion
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const btn = document.getElementById("btn-trigger-transcode");
        if (btn) {
          btn.click();
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewMedia, showInfoModal, showFAQModal, cookieRefreshJobId]);

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
        mediaUploader: metadata?.uploader || "",
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
  const stallTimerRef = useRef<number>(0);
  const lastProgressRef = useRef<{ progress: number; status: string; time: number }>({ progress: 0, status: "", time: Date.now() });
  const STALL_THRESHOLD = 30; // seconds
  const startPolling = (jobToPoll: string) => {
    if (pollingId) clearInterval(pollingId);

    const poll = setInterval(async () => {
      try {
        const response = await apiFetch(`/api/job/${jobToPoll}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setActiveJob(data.job);

            // Stall detection
            const job = data.job;
            if (job.status === "queued" || job.status === "processing") {
              const prev = lastProgressRef.current;
              if (job.progress !== prev.progress || job.status !== prev.status) {
                lastProgressRef.current = { progress: job.progress, status: job.status, time: Date.now() };
                setShowStallWarning(false);
              } else if (Date.now() - prev.time > STALL_THRESHOLD * 1000) {
                setShowStallWarning(true);
              }
            } else {
              setShowStallWarning(false);
              lastProgressRef.current = { progress: 0, status: "", time: Date.now() };
            }
            
            if (job.status === "completed") {
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
            } else if (data.job.status === "waiting_cookies" && data.job.waitingCookies) {
              setCookieRefreshJobId(data.job.id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to connect with background polling thread:", err);
      }
    }, 1000);

    setPollingId(poll);
  };

  const handleCookieRefreshDismiss = () => {
    setCookieRefreshJobId(null);
  };

  const handleCookieRefreshCancel = () => {
    setCookieRefreshJobId(null);
    setActiveJob((prev) => prev ? { ...prev, status: "failed", error: "Cookie refresh cancelled by user" } : prev);
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await apiFetch(`/api/job/${jobId}/cancel`, { method: "POST" });
    } catch {}
    handleReset();
  };

  const handleClearHistory = () => {
    localStorage.removeItem("transmux_journal");
    setHistory([]);
  };

  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const gridOffsetX = (mousePos.x - 0.5) * 12;
  const gridOffsetY = (mousePos.y - 0.5) * 12;

  return (
    <div id="applet-viewport" className="min-h-screen flex flex-col font-sans relative text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Interactive background grid overlay — moves with cursor */}
      <div id="bg-grid" className={theme === "dark" ? "dark" : "light"} style={{ transform: `translate(${gridOffsetX}px, ${gridOffsetY}px)` }} />

      {/* Corporate Header */}
      <Header isServerOnline={isServerOnline} serverInfo={serverInfo} theme={theme} onToggleTheme={toggleTheme} onOpenInfo={() => setShowInfoModal(true)} onOpenFAQ={() => setShowFAQModal(true)} onOpenChangelog={() => setShowChangelogModal(true)} hasNewVersion={hasNewVersion} />

      {BANNER_MESSAGE && showBanner && (
        <div className="bg-red-600 dark:bg-red-700 text-white text-center text-xs sm:text-sm font-medium px-4 py-2.5 flex items-center justify-center gap-3">
          <span className="flex-1">{BANNER_MESSAGE}</span>
          <button
            onClick={() => { setShowBanner(false); try { localStorage.setItem("transmux_banner_dismissed", BANNER_MESSAGE); } catch {} }}
            className="shrink-0 p-0.5 hover:bg-red-500 dark:hover:bg-red-600 rounded-full transition-colors cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
            Transmux parses file binaries and extracts public target links via Project Saga engines. Install the <a href="#" onClick={(e) => { e.preventDefault(); setShowInfoModal(true); }} className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">Transmux browser extension</a> to auto-sync cookies for seamless YouTube downloads — your cookies stay encrypted and are used exclusively for your own account activity.
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
              <div className="space-y-3">
                <ProgressCard
                  job={activeJob}
                  onReset={handleReset}
                  onCancel={() => handleCancelJob(activeJob.id)}
                  onPreview={(id, name, size) => setPreviewMedia({ id, name, size, thumbnailUrl: metadata?.thumbnail, isPublished: false })}
                  onJobUpdate={(j) => { setActiveJob(j); }}
                />
                {showStallWarning && (
                  <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center space-y-2">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Server seems slow — please wait</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500">The backend is still processing. You can wait or cancel.</p>
                    <button
                      onClick={() => handleCancelJob(activeJob.id)}
                      className="text-xs px-3 py-1.5 bg-rose-100 dark:bg-rose-950/30 hover:bg-rose-200 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-lg font-medium transition-all cursor-pointer"
                    >
                      Cancel job
                    </button>
                  </div>
                )}
              </div>
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

            {/* Tips & Knowledge */}
            <TipsCard />

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
          <span className="text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">v5.0</span>
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
          thumbnailUrl={previewMedia.thumbnailUrl}
          isPublished={previewMedia.isPublished}
          onClose={() => setPreviewMedia(null)}
        />
      )}

      {/* Cookie Refresh Modal */}
      {cookieRefreshJobId && (
        <CookieRefreshModal
          jobId={cookieRefreshJobId}
          backendUrl={BACKEND_URL}
          onDismiss={handleCookieRefreshDismiss}
          onCancel={handleCookieRefreshCancel}
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
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-300">5.0</span>
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
                <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4 space-y-2">
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Transmux is a free, open-source media converter that runs entirely in your browser. It downloads from YouTube, SoundCloud, and other sites, then transcodes into any format using FFmpeg.
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    🔌 <strong>Browser Extension:</strong> Install the Transmux Cookie Relay extension to auto-sync your YouTube cookies. No more "Sign in to confirm" errors. Your cookies are encrypted, never stored long-term, and used <strong>only</strong> for your own conversion requests — never shared or logged.
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    🧹 <strong>Privacy:</strong> All files are automatically deleted after 1 hour. No data is tracked, logged, or shared.
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

      {/* FAQ Modal — Q&A array editable below */}
      <AnimatePresence>
        {showFAQModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md"
            onClick={() => setShowFAQModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-sans">FAQ</h3>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">Frequently Asked Questions</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFAQModal(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                {/* FAQ items — 30+ questions covering all aspects */}
                {[
                  { q: "How do I download from YouTube?", a: 'Paste a YouTube URL into the input field. The server fetches available formats. Select quality, format, and click "Launch Transcoding Engine". For age-restricted or bot-blocked videos, use the Transmux browser extension to auto-sync your cookies.' },
                  { q: "What is the Transmux browser extension?", a: 'The Transmux Cookie Relay is a Chrome extension (Manifest V3) that securely sends your YouTube cookies to the server when needed. It eliminates "Sign in to confirm" errors by providing real browser authentication. Your cookies are encrypted in transit, never stored long-term, and used <strong>only</strong> for your own conversions.' },
                  { q: "How do I install the extension?", a: 'Download the extension from the <a href="#" class="underline text-indigo-600 dark:text-indigo-400">extension directory</a>, load it in Chrome via chrome://extensions with Developer Mode enabled (Load unpacked). Once installed, the Transmux website will detect it automatically.' },
                  { q: "Are my cookies safe with the extension?", a: 'Yes. Cookies are sent directly to the server via HTTPS, encrypted in transit, never stored in plaintext on the server, and used exclusively for your current conversion. They are automatically cleared after use. No cookie data is logged, shared, or accessible to anyone else.' },
                  { q: "The player says 'Sign in to confirm' — what do I do?", a: 'This means YouTube blocked the server IP. Install the Transmux browser extension which auto-sends your cookies. If you cannot use the extension, paste a cookies.txt file manually through the cookie icon (🍪) in the header.' },
                  { q: "What output formats are supported?", a: "Audio: MP3, WAV, FLAC, Opus, OGG, M4A, AAC. Video: MP4, WebM, MKV, AVI, MOV, FLV. Subtitle: SRT, VTT, ASS, SUB. Input: anything FFmpeg + yt-dlp can read (1000+ sites)." },
                  { q: "How do I convert a local file?", a: 'Click "File Upload" tab, drag-and-drop or browse for your file (max 1GB). The server probes the file and shows metadata. Configure your settings and click convert.' },
                  { q: "Can I convert playlists?", a: 'Yes! When you paste a YouTube URL that contains a playlist, Transmux detects it automatically. You can select individual videos or convert all at once. The output is packaged as a ZIP file.' },
                  { q: "How long are files kept?", a: "All job files are automatically deleted after 1 hour. Published gallery files are also cleaned after 1 hour. Always download your files before cleanup." },
                  { q: "Can I embed cover art?", a: "Yes! Album art is automatically fetched from YouTube (maxresdefault/hqdefault/sddefault) and embedded into MP3, M4A, FLAC, and Opus/OGG files. For video files, the thumbnail is embedded as metadata." },
                  { q: "Does it support subtitles?", a: "Yes. Check 'Embed Metadata / Remux Subtitles' in settings. The server downloads subtitles from YouTube (all available languages) and burns them into the output using FFmpeg. Supports SRT, VTT, ASS, and SUB formats." },
                  { q: "Can I trim videos?", a: "Yes. Use the trimming section in Conversion Parameters. Enter start and end timestamps (HH:MM:SS or seconds), or use the quick presets (First 15s, 30s, 60s, 5 min). A visual timeline shows the selected segment." },
                  { q: "What is remuxing vs transcoding?", a: "Remuxing (select 'Copy' for codec) copies streams without re-encoding — it's instant and lossless. Transcoding re-encodes the media, allowing format conversion and quality adjustment but takes longer." },
                  { q: "How do I get the best quality?", a: "Select the highest available format from metadata (4K/1080p). Use 'Copy (Lossless)' preset for video codec. For audio, select 'Studio (Lossless)' for FLAC or a high bitrate (320k). The CRF slider at lower values (12-18) gives better quality." },
                  { q: "Why is my download taking so long?", a: "4K videos are large (several GB). Download speed depends on your connection and YouTube's servers. The server uses aria2c for parallel downloads with 32 concurrent fragments. A 4K video typically takes 2-10 minutes." },
                  { q: "Why did I get a lower quality than selected?", a: "This can happen if the selected format ID isn't available at download time (e.g., cookies changed). The server logs the actual resolution. If this happens, try refreshing cookies via the extension and re-converting." },
                  { q: "Can I download only audio?", a: "Yes. Select an audio-only output format like MP3, Opus, or FLAC. The server will download and convert the audio stream only." },
                  { q: "What video codecs are available?", a: "H.264 (libx264), H.265/HEVC (libx265), VP9, AV1, Apple ProRes, or passthrough (copy). H.264 offers the best compatibility. H.265/AV1 give better compression but slower encoding." },
                  { q: "What audio codecs are available?", a: "LAME MP3, AAC, Opus, FLAC, Vorbis, AC3, ALAC, PCM WAV, or passthrough (copy). Opus offers the best quality-to-bitrate ratio. AAC is most compatible." },
                  { q: "Can I adjust bitrate?", a: "Yes. Audio bitrate: 64k to 512k. Video bitrate can be set via the bitrate field. CRF control (12-40) gives fine-grained quality control for video encoding." },
                  { q: "Can I change frame rate?", a: "Yes. Frame rate presets: Keep original, 120, 60, 30, 24, 15, 12 FPS. 24 FPS is cinematic, 30 FPS is standard video, 60 FPS is ideal for gaming/sports." },
                  { q: "Can I change resolution?", a: "Yes. Resolution presets: Keep original, 4K, 2K, 1080p, 720p, 480p, 360p, 240p. The server will scale the video accordingly." },
                  { q: "What is the Compatibility Audit?", a: "The audit checks your settings for potential issues before conversion: resolution upscaling, framerate interpolation, audio up-mixing, sample rate conversion, and extreme compression. Warnings appear before you convert." },
                  { q: "Can I publish to the gallery?", a: "Yes! After conversion, click 'Publish to Web' in the preview popup. Your file appears in the Public Shared Showroom with a shareable link. Published files are cleaned after 1 hour." },
                  { q: "How do I preview before downloading?", a: "Click 'Preview Media Output Instantly' on the completed job card. Video files play in a native player. Audio files show a spinning vinyl record with live waveform visualization powered by Web Audio API." },
                  { q: "What is the waveform visualization?", a: "The audio player uses Web Audio API for real-time frequency analysis. 32 dynamic bars respond to the music. Combined with a spinning vinyl album art, it creates an immersive preview experience." },
                  { q: "Can I rename files before downloading?", a: "Yes. On the completed job card, use the rename field to set a custom filename before clicking download." },
                  { q: "Is there a file size limit?", a: "Upload limit: 1GB per file. Downloads from URL sources are limited only by YouTube's streams. The server may reject extremely large files to prevent resource exhaustion." },
                  { q: "Can you fix corrupted videos?", a: "Partially. If the video has broken timestamps or container issues, re-encoding with FFmpeg often fixes playback. The remux option (copy streams) can restore damaged containers without quality loss." },
                  { q: "Does it work on mobile?", a: "Yes, the website is fully responsive and works on mobile browsers. However, the browser extension is only available for desktop Chrome-based browsers." },
                  { q: "Can I strip audio from a video?", a: "Yes. Check the 'Strip Audio Channel' checkbox in video settings to produce a video with no audio track." },
                  { q: "Can I convert multiple files at once?", a: "For playlists, yes — batch conversion is supported. For local file uploads, you can convert one file at a time. Use the history journal to track past conversions." },
                  { q: "What is the Konami Code easter egg?", a: "Type Up, Up, Down, Down, Left, Right, Left, Right, B, A on your keyboard for a surprise! (Hint: rainbow mode 🔮)" },
                  { q: "Where can I report bugs or request features?", a: 'Open an issue on <a href="https://github.com/SenkuDevX/Transmux/issues" target="_blank" rel="noopener noreferrer" class="underline text-indigo-600 dark:text-indigo-400 hover:text-indigo-800">GitHub Issues</a>. Check existing issues first to avoid duplicates.' },
                  { q: "Is my data private?", a: "Yes. Files are processed on the server and deleted within 1 hour. No data is logged, tracked, or shared. Cookies sent via extension are encrypted in transit and never stored long-term. Published files are public to anyone with the link." },
                  { q: "How is this different from other converters?", a: "Transmux is fully open-source, uses real browser impersonation (curl_cffi Chrome-136), supports 1000+ sites via yt-dlp, has a browser extension for cookie sync, offers real-time progress with waveform preview, and auto-cleans files after 1 hour. No account needed." },
                  { q: "Can I self-host Transmux?", a: "Yes! The project is open-source on GitHub. You can deploy it on your own server using the Dockerfile. Environment variables in .env.example configure S3 storage, admin keys, and proxy settings." },
                  { q: "How do I make a GIF from a video?", a: "After conversion, open Creator Tools on the completed job. Use the GIF Maker tab to set start time, duration, FPS, and width. The server extracts a segment and converts it to an animated GIF using FFmpeg palette generation." },
                  { q: "Can I repair corrupted or damaged videos?", a: "Yes! Open Creator Tools on any completed job and click 'Repair Video'. The server uses FFmpeg with -err_detect ignore_err and -fflags +genpts to fix broken timestamps, damaged containers, and unplayable media. Original file is never modified." },
                  { q: "How do I create YouTube Shorts / TikTok content?", a: "After conversion, open Creator Tools > Shorts Maker. Set start time and duration. The server crops the video to vertical 9:16 format with audio preserved. Works with MP4, WebM, and MOV outputs." },
                  { q: "Can I clip segments without re-encoding?", a: "Yes! Creator Tools > Clip Maker extracts a segment using stream copy — instant, lossless, and no quality degradation. Set start and end times in seconds." },
                  { q: "What format recommendations are available?", a: "The format selector shows smart recommendations: Discord (MP4, <25MB, ≤720p), WhatsApp (MP4, <16MB, ≤480p), YouTube (MP4/WebM, ≥1080p), Best Quality (4K+), and Editing (small files). Badges appear automatically on matching formats." },
                  { q: "How do I use the File Size Predictor?", a: "Below the conversion settings, the Estimated Output panel shows real-time estimates for file size, processing time, and quality score (1-10). Adjust codec, bitrate, resolution, or CRF to see instant updates." },
                  { q: "What is Smart Compression mode?", a: "In Conversion Parameters, click the Smart Compression dropdown and select a target size (10MB to 1GB). The server auto-tunes bitrate, CRF, resolution, and audio settings to fit under that limit. Adjust manually if needed." },
                  { q: "How do I add my own Q&A here?", a: 'Edit the FAQ array in <code class="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">src/App.tsx</code>. Each entry is <code class="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">{"q": "Question", "a": "Answer with HTML"}</code>. Support for links and formatting via dangerouslySetInnerHTML.' },
                  { q: "How does the conversion queue work?", a: "Jobs are processed in priority order. Short videos, remux-only (copy codec), and audio-only jobs get a higher priority score and jump ahead. You can manually promote/demote jobs in the Queue panel (click the Queue button in the header). Active jobs show real-time progress, speed, and ETA." },
                  { q: "Is Transmux free to use?", a: "Yes, Transmux is completely free and open-source. There are no paid tiers, subscription plans, or usage limits. You can convert as many files as you want. The project is community-supported and runs on donations." },
                  { q: "Does the output match the requested quality?", a: "The server downloads the best available format matching your selection. If the exact format ID is unavailable, it falls back to a resolution-based match (e.g., bestvideo[height<=1080]+bestaudio). After download, the server verifies the actual resolution and re-downloads with a better format if quality is significantly lower than requested." },
                  { q: "How do I sync presets and history across devices?", a: "Get an API key from the Transmux web app (Header > API Key button). Install the Transmux browser extension and set the same API key. Open the extension popup and use the Cloud Sync buttons to sync presets and history between devices. Data is stored encrypted on the server keyed to your API key." },
                  { q: "How does the extension pair with my login?", a: "The Transmux extension and web app communicate via a long-lived port connection. When you install the extension, it auto-detects the Transmux website. Your YouTube cookies are relayed securely when needed — no manual login prompts. The extension also detects your current site and adapts its UI accordingly." },
                ].map((item, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white flex items-start gap-2">
                      <span className="text-indigo-500 dark:text-indigo-400 mt-0.5 shrink-0">Q:</span>
                      <span>{item.q}</span>
                    </p>
                    <p
                      className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pl-5"
                      dangerouslySetInnerHTML={{ __html: item.a }}
                    />
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-center">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  More questions? <a href="https://github.com/SenkuDevX/Transmux/issues" target="_blank" rel="noopener noreferrer" className="underline text-indigo-600 dark:text-indigo-400">Open a GitHub issue</a>
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Changelog Modal */}
      <AnimatePresence>
        {showChangelogModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md"
            onClick={() => setShowChangelogModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold font-sans">What's New in v5.0</h3>
                      <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-full text-[9px] font-bold">Latest</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">Changelog</p>
                  </div>
                </div>
                <button onClick={() => { setShowChangelogModal(false); setHasNewVersion(false); }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                ><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto text-[11px] leading-relaxed">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">🎉 Added</h4>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                    <li>• Creator Toolkit: GIF Maker, Clip Maker, Shorts Maker, Silence Remover, Loudness Normalization, Metadata Editor, Repair Corrupted Video, Thumbnail Extractor</li>
                    <li>• Before/After Quality Split View with compression ratio visualization</li>
                    <li>• Smart Format Recommendation Engine (Discord, WhatsApp, YouTube, Best Quality, Editing)</li>
                    <li>• Instant File Size Predictor with real-time estimates and quality score</li>
                    <li>• Smart Compression Mode with target size dropdown and auto-tuning</li>
                    <li>• Frame Thumbnails in waveform timeline editor</li>
                    <li>• In-app Changelog with auto-open on version update</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400">🔧 Improved</h4>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                    <li>• Subtitle system: fixed download, merge, and burn flows with better format mapping</li>
                    <li>• Queue prioritization: short/remux/audio jobs jump ahead</li>
                    <li>• 4K download performance: 64 concurrent fragments, larger chunk sizes</li>
                    <li>• Cloud sync with pull-first-then-push strategy to prevent overwrites</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400">🐛 Fixed</h4>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                    <li>• Subtitles not downloading due to format ID mismatch</li>
                    <li>• Subtitles not merging/burning correctly into output</li>
                    <li>• 4K downloads timing out with default fragment settings</li>
                    <li>• Downloads producing lower quality than requested (re-download with fallback)</li>
                    <li>• TypeScript compilation errors</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400">🧩 Extension (20 features)</h4>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                    <li>• Stealth Download Engine, Creator Workflow Tools, Media Intelligence Overlay</li>
                    <li>• Sync Accounts + Presets across devices via API key</li>
                    <li>• Multi-Tab Batch Queue, Instant Remux, Privacy Mode, Download Dashboard</li>
                    <li>• Thumbnail preview in popup, 10 context menu items</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400">🔒 Security</h4>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                    <li>• Rate limiting on all API routes</li>
                    <li>• Cookie encryption in transit</li>
                    <li>• 1-hour auto-cleanup of all job files</li>
                    <li>• Backend JWT validation for protected routes</li>
                  </ul>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-center">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  See full changelog on <a href="https://github.com/SenkuDevX/Transmux" target="_blank" rel="noopener noreferrer" className="underline text-indigo-600 dark:text-indigo-400">GitHub</a>
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
