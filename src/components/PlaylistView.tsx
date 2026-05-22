import { useState } from "react";
import { ListMusic, Download, Loader2, Music, Film, Check, AlertCircle } from "lucide-react";
import { apiFetch } from "../api";

interface PlaylistEntry {
  index: number;
  id: string;
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
}

interface PlaylistData {
  title: string;
  count: number;
  entries: PlaylistEntry[];
  thumbnail: string;
}

interface PlaylistViewProps {
  playlist: PlaylistData;
  onReset: () => void;
}

export default function PlaylistView({ playlist, onReset }: PlaylistViewProps) {
  const [converting, setConverting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [audioOnly, setAudioOnly] = useState(false);
  const [formatSelections, setFormatSelections] = useState<Record<number, string>>({});
  const [outputFormat, setOutputFormat] = useState("mp4");

  const handleConvertAll = async () => {
    setConverting(true);
    setProgress(`Starting conversion of ${playlist.count} items...`);

    try {
      const entries = playlist.entries.map((e) => ({
        ...e,
        formatId: formatSelections[e.index] || "best",
      }));

      const response = await apiFetch("/api/convert/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries,
          outputFormat,
          audioOnly,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setBatchId(data.batchId);
        setProgress(`Done! ${data.completed} converted, ${data.failed} failed.`);
      } else {
        setProgress(`Error: ${data.error || "Conversion failed"}`);
      }
    } catch {
      setProgress("Network error during batch conversion.");
    } finally {
      setConverting(false);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-indigo-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">{playlist.title}</h3>
            <span className="text-xs text-slate-400">({playlist.count} items)</span>
          </div>
          <button onClick={onReset} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            Clear
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300"
          >
            <option value="mp4">MP4</option>
            <option value="mkv">MKV</option>
            <option value="webm">WebM</option>
            <option value="mp3">MP3 (audio)</option>
            <option value="opus">Opus (audio)</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={audioOnly} onChange={(e) => setAudioOnly(e.target.checked)} />
            Audio only
          </label>
        </div>

        <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
          {playlist.entries.map((entry) => (
            <div key={entry.index} className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-slate-400 font-mono w-6">{entry.index + 1}.</span>
              <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">{entry.title}</span>
              <span className="text-[10px] text-slate-400 font-mono">{formatDuration(entry.duration)}</span>
              <select
                value={formatSelections[entry.index] || "best"}
                onChange={(e) => setFormatSelections((p) => ({ ...p, [entry.index]: e.target.value }))}
                className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-600 dark:text-slate-400"
              >
                <option value="best">Best</option>
                <option value="bestvideo+bestaudio">Best Video</option>
                <option value="bestaudio">Best Audio</option>
                <option value="worst">Worst</option>
              </select>
            </div>
          ))}
        </div>

        {batchId ? (
          <a
            href={`/api/download/batch/${batchId}`}
            download={`transmux_playlist_${batchId.slice(0, 8)}.zip`}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Download ZIP ({playlist.count} items)
          </a>
        ) : (
          <button
            onClick={handleConvertAll}
            disabled={converting}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {converting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Converting...</>
            ) : (
              <><Download className="h-3.5 w-3.5" /> Convert All ({playlist.count})</>
            )}
          </button>
        )}

        {progress && !batchId && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">{progress}</p>
        )}
      </div>
    </div>
  );
}
