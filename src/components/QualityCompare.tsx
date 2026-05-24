import { useState, useEffect } from "react";
import { BarChart3, FileInput, FileOutput, X } from "lucide-react";
import { apiFetch } from "../api";

interface QualityInfo {
  name: string;
  size: number;
  resolution: string;
  codec: string;
  bitrate: string;
}

function formatSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return "N/A";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function QualityCompare({ jobId, open, onClose }: { jobId: string; open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState<QualityInfo | null>(null);
  const [output, setOutput] = useState<QualityInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await apiFetch(`/api/quality-compare/${jobId}`);
        const d = await r.json();
        if (d.success) {
          setInput(d.input);
          setOutput(d.output);
        } else {
          setError(d.error || "Could not load quality data");
        }
      } catch { setError("Network error"); }
      setLoading(false);
    })();
  }, [open, jobId]);

  return (
    <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md ${open ? "" : "hidden"}`} onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-bold">Quality Comparison</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="text-center text-xs text-slate-400 py-8">Loading quality data...</div>
          ) : error ? (
            <div className="text-center text-xs text-red-400 py-8">{error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><FileInput className="h-3 w-3" /> Original</div>
                  <div className="space-y-0.5 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                    <p>Size: {input ? formatSize(input.size) : "—"}</p>
                    <p>Res: {input?.resolution || "—"}</p>
                    <p>Codec: {input?.codec || "—"}</p>
                    <p>Bitrate: {input?.bitrate || "—"}</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600"><FileOutput className="h-3 w-3" /> Converted</div>
                  <div className="space-y-0.5 text-[10px] text-indigo-700 dark:text-indigo-300 font-mono">
                    <p>Size: {output ? formatSize(output.size) : "—"}</p>
                    <p>Res: {output?.resolution || "—"}</p>
                    <p>Codec: {output?.codec || "—"}</p>
                    <p>Bitrate: {output?.bitrate || "—"}</p>
                  </div>
                </div>
              </div>

              {input && output && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Compression Ratio</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {output.size > 0 && input.size > 0
                        ? `${((1 - output.size / input.size) * 100).toFixed(1)}% smaller`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-red-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, output.size > 0 && input.size > 0 ? (output.size / input.size) * 100 : 50)}%` }} />
                  </div>
                  <div className="flex justify-between text-[8px] text-slate-400 font-mono">
                    <span>0% (same)</span>
                    <span>50% smaller</span>
                    <span>90% smaller</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
