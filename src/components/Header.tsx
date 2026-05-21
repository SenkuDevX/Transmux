import { Layers, Activity, ServerCrash, Sun, Moon, Info } from "lucide-react";

interface HeaderProps {
  isServerOnline: boolean;
  serverInfo: {
    uptime: number;
    product: string;
  } | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenInfo?: () => void;
}

export default function Header({ isServerOnline, serverInfo, theme, onToggleTheme, onOpenInfo }: HeaderProps) {
  return (
    <header id="transmux-header" className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-50 py-4 px-6 sm:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Codename */}
        <div id="brand-container" className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-950">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span id="brand-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-sans">
                Transmux
              </span>
              <span id="brand-tagline" className="px-2 py-0.5 bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 rounded text-[10px] font-medium tracking-widest uppercase">
                Saga PRO
              </span>
            </div>
            <p id="brand-subtitle" className="text-xs text-slate-500 dark:text-slate-400">
              Enterprise-Grade Multi-Codec Remuxer & Transcoder
            </p>
          </div>
        </div>

        {/* Server Connection Badge & Theme Controller */}
        <div id="server-status" className="flex items-center gap-3">
          {/* Info Button */}
          {onOpenInfo && (
            <button
              onClick={onOpenInfo}
              id="btn-info-modal"
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-705 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="About Transmux"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
          {/* Tone Theme Switch Pill */}
          <button
            onClick={onToggleTheme}
            id="btn-theme-toggle"
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-705 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Toggle color theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {isServerOnline ? (
            <div id="status-badge-online" className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 px-3 py-1.5 rounded-full text-xs font-mono">
              <Activity className="h-3 w-3" />
              <span>Engine Status: Live</span>
              {serverInfo && (
                <span className="hidden sm:inline text-emerald-600/70 dark:text-emerald-500/70 text-[10px]">
                  | v{(serverInfo.uptime / 3600).toFixed(2)}h
                </span>
              )}
            </div>
          ) : (
            <div id="status-badge-offline" className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-250 dark:border-rose-900 px-3 py-1.5 rounded-full text-xs font-mono">
              <ServerCrash className="h-3.5 w-3.5" />
              <span className="animate-pulse">Engine Offline</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
