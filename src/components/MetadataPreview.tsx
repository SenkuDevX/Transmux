import { useState } from "react";
import { Play, Clock, Info, Check, HardDrive, Cpu, Music } from "lucide-react";
import { MediaMetadata, MediaFormat } from "../types";

interface MetadataPreviewProps {
  metadata: MediaMetadata;
  selectedFormatId: string;
  onFormatSelected: (formatId: string) => void;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const mStr = m.toString().padStart(2, "0");
  const sStr = s.toString().padStart(2, "0");

  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

export function formatSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return "N/A";
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function MetadataPreview({ metadata, selectedFormatId, onFormatSelected }: MetadataPreviewProps) {
  const [showAllFormats, setShowAllFormats] = useState(false);

  const isUrlType = !!metadata.formats;
  const listFormats = metadata.formats || [];
  
  // Show first 6 formats by default, or all if expanded
  const itemsToDisplay = showAllFormats ? listFormats : listFormats.slice(0, 5);

  return (
    <div id="metadata-preview-card" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm relative">
      <div className="p-6 flex flex-col md:flex-row gap-6">
        
        {/* Visual Thumbnail (URL sources) or Default Vector Plate (Local files) */}
        <div id="meta-media-preview" className="md:w-44 w-full h-28 md:h-auto rounded-xl overflow-hidden relative border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0 flex items-center justify-center">
          {metadata.thumbnail ? (
            <img
              id="meta-thumbnail"
              src={metadata.thumbnail}
              alt={metadata.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-50 dark:from-slate-950 to-slate-100 dark:to-slate-900 flex flex-col items-center justify-center p-4">
              <Play className="h-8 w-8 text-slate-500 dark:text-slate-400 opacity-60 mb-1" />
              <span className="text-[10px] font-mono tracking-wider text-slate-500 dark:text-slate-400 uppercase font-bold">
                {metadata.extractor || "Local File"}
              </span>
            </div>
          )}
          
          <div id="meta-duration-tag" className="absolute bottom-2 right-2 bg-slate-900/90 dark:bg-slate-950/90 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(metadata.duration)}</span>
          </div>
        </div>

        {/* Textual Inspection Information */}
        <div id="meta-details-container" className="flex-1 space-y-3 min-w-0">
          <div>
            <span id="meta-extractor-badge" className="text-[9px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-full">
              {metadata.extractor === "generic" ? "Media Source" : metadata.extractor || "File Inspector"}
            </span>
            <h3 id="meta-title" className="text-base font-bold text-slate-900 dark:text-white mt-2 truncate font-sans max-w-xl">
              {metadata.title}
            </h3>
          </div>

          <div id="meta-stats-grid" className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="space-y-0.5">
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-550 uppercase tracking-wider">File Format</p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <HardDrive className="h-3.5 w-3.5 text-slate-400" />
                <span>{metadata.filename ? metadata.filename.split(".").pop()?.toUpperCase() : (isUrlType ? "HLS Streaming" : "Parsed")}</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-550 uppercase tracking-wider">File Size</p>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {metadata.filename ? "Inspected" : (isUrlType ? "~ Variable streams" : "N/A")}
              </p>
            </div>

            <div className="space-y-0.5 col-span-2 sm:col-span-1">
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-550 uppercase tracking-wider">Duration</p>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formatDuration(metadata.duration)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* URL Stream Format Selector Area (ONLY when content is URL) */}
      {isUrlType && listFormats.length > 0 && (
        <div id="url-formats-section" className="border-t border-slate-250/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 animate-fade-in">
              <Info className="h-3.5 w-3.5 text-slate-900 dark:text-slate-100" />
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Dynamic Port Streams (Select stream to direct format conversions)</p>
            </div>
            
            {listFormats.length > 5 && (
              <button
                id="btn-toggle-formats"
                onClick={() => setShowAllFormats(!showAllFormats)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
              >
                {showAllFormats ? "Show less options" : `Show all options (${listFormats.length})`}
              </button>
            )}
          </div>

          <div id="formats-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {/* Direct Best Match Preset */}
            <div
              id="format-best"
              onClick={() => onFormatSelected("best")}
              className={`p-3 rounded-xl border flex flex-col justify-between text-left cursor-pointer transition-all duration-200 ${
                selectedFormatId === "best"
                  ? "border-2 border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Best Preset
                  </span>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1.5">Primary Audio + Video Stream</p>
                </div>
                {selectedFormatId === "best" && (
                  <div className="h-4 w-4 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 scale-90 font-bold">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-mono">Resolves to maximum visual quality</p>
            </div>

            {/* List dynamically loaded formats from yt-dlp */}
            {itemsToDisplay.map((fmt) => {
              const isSelected = selectedFormatId === fmt.formatId;
              const hasVideo = fmt.videoCodec !== "none";
              const label = hasVideo ? `${fmt.resolution} (${fmt.extension.toUpperCase()})` : `Audio Stream (${fmt.extension.toUpperCase()})`;
              const codecInfo = hasVideo ? `Video: ${fmt.videoCodec}` : `Audio: ${fmt.audioCodec}`;

              return (
                <div
                  id={`format-item-${fmt.formatId}`}
                  key={fmt.formatId}
                  onClick={() => onFormatSelected(fmt.formatId)}
                  className={`p-3 rounded-xl border flex flex-col justify-between text-left cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "border-2 border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5 min-w-0">
                    <div className="min-w-0">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase tracking-wider border ${
                        hasVideo ? "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900/60" : "bg-sky-50 dark:bg-sky-950/20 text-sky-800 dark:text-sky-400 border-sky-200 dark:border-sky-900/60"
                      }`}>
                        {hasVideo ? "Video + Audio" : "Audio Only"}
                      </span>
                      <p className="text-xs font-semibold text-slate-950 dark:text-white mt-1.5 truncate max-w-[170px]" title={label}>{label}</p>
                    </div>
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 scale-90 font-bold">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-1">
                    <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[120px]" title={codecInfo}>{codecInfo}</span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {fmt.filesize > 0 ? formatSize(fmt.filesize) : (fmt.note || "unspecified")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
