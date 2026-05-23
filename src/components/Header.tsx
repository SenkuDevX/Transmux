import { Layers, Activity, ServerCrash, Sun, Moon, Info, HelpCircle, Wrench, Cookie, X, AlertTriangle } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../api";

interface HeaderProps {
  isServerOnline: boolean;
  serverInfo: {
    uptime: number;
    product: string;
  } | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenInfo?: () => void;
  onOpenFAQ?: () => void;
}

export default function Header({ isServerOnline, serverInfo, theme, onToggleTheme, onOpenInfo, onOpenFAQ }: HeaderProps) {
  const logoClickCount = useRef(0);
  const [logoClicks, setLogoClicks] = useState(0);
  const [cookieModalOpen, setCookieModalOpen] = useState(false);
  const [hasCookies, setHasCookies] = useState<boolean | null>(null);
  const [cookieText, setCookieText] = useState("");
  const [adminKey, setAdminKey] = useState(localStorage.getItem("transmux_admin_key") || "");
  const [cookieStatus, setCookieStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useState(() => {
    apiFetch("/api/cookies").then(r => r.json()).then(d => {
      setHasCookies(d.hasCookies);
    }).catch(() => setHasCookies(false));
  });

  const handleSaveCookies = async () => {
    if (!adminKey) {
      setCookieStatus({ message: "Admin key is required", type: "error" });
      return;
    }
    localStorage.setItem("transmux_admin_key", adminKey);
    try {
      const res = await apiFetch("/api/cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ cookies: cookieText }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHasCookies(true);
        setCookieStatus({ message: "Cookies saved successfully!", type: "success" });
      } else {
        setCookieStatus({ message: data.error || "Failed to save cookies", type: "error" });
      }
    } catch {
      setCookieStatus({ message: "Network error saving cookies", type: "error" });
    }
  };

  const handleLogoClick = () => {
    logoClickCount.current++;
    setLogoClicks(logoClickCount.current);
    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0;
      setLogoClicks(0);
      window.dispatchEvent(new CustomEvent("logo-easter-egg"));
    }
  };

  return (
    <>
    <header id="transmux-header" className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-50 py-3 px-4 sm:py-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Codename */}
        <div id="brand-container" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-950 shrink-0">
            <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span id="brand-title" onClick={handleLogoClick} className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white font-sans cursor-pointer select-none truncate">
                Transmux
                {logoClicks > 0 && logoClicks < 5 && (
                  <span className="ml-1 text-[10px] text-slate-400">{5 - logoClicks}</span>
                )}
              </span>
              <span id="brand-tagline" className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 rounded text-[9px] sm:text-[10px] font-medium tracking-widest uppercase shrink-0">
                Saga PRO
              </span>
            </div>
            <p id="brand-subtitle" className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              Enterprise-Grade Multi-Codec Remuxer & Transcoder
            </p>
          </div>
        </div>

        {/* Server Connection Badge & Theme Controller */}
        <div id="server-status" className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Cookie Config Button */}
          <button
            onClick={() => setCookieModalOpen(true)}
            id="btn-cookie-config"
            className={`p-1.5 sm:p-2 rounded-xl border transition-colors cursor-pointer relative ${
              hasCookies === false
                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border-slate-200 dark:border-slate-705 text-slate-600 dark:text-slate-300"
            }`}
            title={hasCookies === false ? "YouTube cookies not set — click to configure" : "YouTube Cookies"}
          >
            <Cookie className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {hasCookies === false && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            )}
          </button>
          {/* Info Button */}
          {onOpenInfo && (
            <button
              onClick={onOpenInfo}
              id="btn-info-modal"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-705 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="About Transmux"
            >
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          )}
          {/* FAQ Button */}
          {onOpenFAQ && (
            <button
              onClick={onOpenFAQ}
              id="btn-faq-modal"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-705 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="FAQ"
            >
              <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          )}
          {/* Tone Theme Switch Pill */}
          <button
            onClick={onToggleTheme}
            id="btn-theme-toggle"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-705 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Toggle color theme"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" /> : <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </button>

          {isServerOnline ? (
            <div id="status-badge-online" className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-mono">
              <Activity className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="hidden xs:inline">Engine:</span>
              <span>Live</span>
              {serverInfo && (
                <span className="hidden sm:inline text-emerald-600/70 dark:text-emerald-500/70 text-[10px]">
                  | v{(serverInfo.uptime / 3600).toFixed(2)}h
                </span>
              )}
            </div>
          ) : (
            <div id="status-badge-offline" className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-250 dark:border-rose-900 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-mono">
              <ServerCrash className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
              <span className="animate-pulse">Offline</span>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Cookie Configuration Modal */}
    <AnimatePresence>
      {cookieModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md"
          onClick={() => { setCookieModalOpen(false); setCookieStatus(null); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-slate-600 dark:text-slate-300" />
              <h3 className="text-sm font-bold">YouTube Cookies</h3>
            </div>
            <button
              onClick={() => { setCookieModalOpen(false); setCookieStatus(null); }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {hasCookies === false && (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Cookies not configured. YouTube downloads may fail and fall back through proxy.</span>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Admin Key</label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter ADMIN_KEY from server"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Netscape Cookie File Contents</label>
              <textarea
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
                placeholder="Paste the full content of your cookies.txt file here..."
                rows={6}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-mono resize-none"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Export cookies from browser extensions like "Get cookies.txt" for YouTube.
              </p>
            </div>
            {cookieStatus && (
              <div className={`text-xs px-3 py-2 rounded-lg ${
                cookieStatus.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
                  : "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
              }`}>
                {cookieStatus.message}
              </div>
            )}
            <button
              onClick={handleSaveCookies}
              className="w-full text-xs font-bold py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Save Cookies
            </button>
          </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
