import { useState, useEffect } from "react";
import { Clock, Trash, Play, Download, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { formatSize } from "./MetadataPreview";
import { apiUrl } from "../api";
import { ConversionHistoryItem } from "../types";

interface HistoryListProps {
  history: ConversionHistoryItem[];
  onClearHistory: () => void;
  onPreview: (id: string, name: string, size: number) => void;
}

export default function HistoryList({ history, onClearHistory, onPreview }: HistoryListProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [progressTimer, setProgressTimer] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Safely limit active index if history shrinks
  useEffect(() => {
    if (activeIdx >= history.length) {
      setActiveIdx(0);
    }
  }, [history, activeIdx]);

  // Reset progress bar on manual index switch
  useEffect(() => {
    setProgressTimer(0);
  }, [activeIdx]);

  // 20-second automatic rotation timer for history cards
  useEffect(() => {
    if (history.length <= 1) {
      setProgressTimer(0);
      return;
    }

    const intervalTime = 100; // incremental progress every 100ms
    const totalDuration = 20000; // 20 seconds
    const step = (intervalTime / totalDuration) * 100;

    const timer = setInterval(() => {
      setProgressTimer((prev) => {
        if (prev >= 100) {
          setActiveIdx((current) => (current + 1) % history.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [history.length]);

  if (history.length === 0) return null;

  const currentItem = history[activeIdx] || history[0];
  const directLink = apiUrl(`/api/download/${currentItem.jobId}?filename=${encodeURIComponent(currentItem.outputName)}`);

  return (
    <div id="history-container" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
      
      {/* CARD HEADER */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Clock className="h-4.5 w-4.5 text-indigo-500" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white font-sans uppercase tracking-wider">
            Transcode History Journal
          </h3>
        </div>
        <button
          id="btn-clear-history"
          onClick={onClearHistory}
          className="text-[9px] text-slate-400 hover:text-rose-600 font-mono tracking-wider uppercase transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Trash className="h-3 w-3" />
          Purge
        </button>
      </div>

      {/* SINGLE SPOTLIGHT CAROUSEL CARD */}
      <div className="relative overflow-hidden bg-slate-50/70 dark:bg-slate-950/45 border border-slate-250/50 dark:border-slate-800/80 rounded-xl p-4 space-y-3 shadow-inner hover:bg-slate-50 dark:hover:bg-slate-950 transition-all">
        
        {/* Spotlight Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider font-sans">Stream Output Saved</span>
          </div>
          
          {/* Spotlight manual pagination */}
          {history.length > 1 && (
            <div className="flex items-center gap-1 text-slate-400">
              <button
                type="button"
                onClick={() => setActiveIdx((idx) => (idx - 1 + history.length) % history.length)}
                className="p-0.5 hover:bg-slate-150 dark:hover:bg-slate-800 rounded text-slate-500 transition-colors cursor-pointer"
                title="Previous Record"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[8px] font-mono font-purple select-none bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                {activeIdx + 1}/{history.length}
              </span>
              <button
                type="button"
                onClick={() => setActiveIdx((idx) => (idx + 1) % history.length)}
                className="p-0.5 hover:bg-slate-150 dark:hover:bg-slate-800 rounded text-slate-500 transition-colors cursor-pointer"
                title="Next Record"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Media Details */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={currentItem.outputName}>
            {currentItem.outputName}
          </h4>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[9px] font-mono text-slate-400 dark:text-slate-500">
            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 rounded font-bold text-slate-650 dark:text-indigo-400 uppercase">
              {currentItem.outputFormat}
            </span>
            <span>{formatSize(currentItem.size)}{currentItem.bitrate ? ` \u00B7 ${currentItem.bitrate}` : ""}</span>
            <span>|</span>
            <span>{new Date(currentItem.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Action Controls inside the Card */}
        <div className="flex items-center gap-2 pt-1 pb-1">
          <button
            type="button"
            onClick={() => onPreview(currentItem.jobId, currentItem.outputName, currentItem.size)}
            className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold font-sans text-[10px] rounded-lg flex items-center justify-center gap-1 border border-indigo-100/40 dark:border-indigo-900/40 transition-all cursor-pointer"
            title="Direct media audio/video preview"
          >
            <Play className="h-3 w-3 fill-current" />
            Loopback Preview
          </button>

          <a
            href={directLink}
            download={currentItem.outputName}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-100/40 dark:border-emerald-900/40 rounded-lg flex items-center justify-center transition-all cursor-pointer"
            title="Download cached media stream file"
          >
            <Download className="h-3 w-3" />
          </a>
        </div>

        {/* 20-second Linear Fill Timer Bar at Card Base */}
        {history.length > 1 && (
          <div className="pt-1 text-xs flex flex-col gap-1">
            <div className="w-full h-0.5 bg-slate-150 dark:bg-slate-850 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-405 to-teal-500 transition-all duration-100 ease-linear"
                style={{ width: `${progressTimer}%`, backgroundColor: '#10b981' }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* EXPAND ALL COLLAPSIBLE ACCORDION PANEL */}
      {history.length > 1 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="w-full py-1 text-center text-[10px] text-slate-450 hover:text-slate-800 dark:hover:text-white font-mono tracking-wider uppercase border border-dashed border-slate-200 dark:border-slate-805 rounded-lg transition-all cursor-pointer"
          >
            {showAll ? "Hide past record logs" : `View all ${history.length} record journals`}
          </button>

          {showAll && (
            <div className="mt-3 space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {history.map((item, idx) => {
                const isSelected = idx === activeIdx;
                return (
                  <button
                    key={item.jobId}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={`w-full flex items-center justify-between p-2 text-left rounded-lg text-xs transition-all border ${
                      isSelected
                        ? "bg-indigo-50/40 border-indigo-200/50 dark:bg-indigo-950/20 dark:border-indigo-900/40"
                        : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-950/65"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-750 dark:text-slate-200 truncate pr-2">
                        {item.outputName}
                      </p>
                      <p className="text-[9px] font-mono text-slate-400 mt-0.5 uppercase">
                        .{item.outputFormat} | {formatSize(item.size)}{item.bitrate ? ` \u00B7 ${item.bitrate}` : ""}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DISCLAIMER RETENTION STATEMENT */}
      <p id="history-retention-disclaimer" className="text-[9px] text-slate-400 dark:text-slate-500 font-mono italic text-center pt-2 border-t border-slate-100 dark:border-slate-800">
        * Cache retention: Transcoded streams are cleared 1 hour after execution.
      </p>
    </div>
  );
}
