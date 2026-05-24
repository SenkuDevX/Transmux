import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Languages, Type, Clock, FileText, Download } from "lucide-react";
import { apiFetch } from "../api";

interface SubtitleToolProps {
  jobId: string;
  open: boolean;
  onClose: () => void;
}

export default function SubtitleTool({ jobId, open, onClose }: SubtitleToolProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [targetLang, setTargetLang] = useState("es");
  const [fontSize, setFontSize] = useState("18");
  const [fontColor, setFontColor] = useState("#ffffff");
  const [fontName, setFontName] = useState("Arial");
  const [shiftSec, setShiftSec] = useState("0");
  const [result, setResult] = useState<{ filename: string; url: string } | null>(null);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState("");

  useEffect(() => {
    if (open) {
      setResult(null); setTranscript(""); setLoading("");
      apiFetch(`/api/job/${jobId}/subtitles`).then(r => r.json()).then(d => { if (d.success) setFiles(d.subtitles); }).catch(() => {});
    }
  }, [open, jobId]);

  const doAction = async (action: string, body: any) => {
    setLoading(action);
    setResult(null); setTranscript("");
    try {
      if (action === "transcript") {
        const r = await apiFetch(`/api/job/${jobId}/subtitle/transcript?filename=${encodeURIComponent(selected)}`);
        const d = await r.json();
        if (d.success) setTranscript(d.transcript);
      } else {
        const r = await apiFetch(`/api/job/${jobId}/subtitle/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: selected, ...body }) });
        const d = await r.json();
        if (d.success) setResult(d);
      }
    } catch {}
    setLoading("");
  };

  const langs: Record<string, string> = { es: "Spanish → English", fr: "French → English", de: "German → English" };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold">Subtitle Tools</h3>
              <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {files.length === 0 ? <p className="text-xs text-slate-400 text-center py-4">No subtitle files found.</p> : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-slate-400">Select Subtitle</label>
                    <select value={selected} onChange={(e) => setSelected(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— Select —</option>
                      {files.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {selected && (
                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {/* Translate */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono flex items-center gap-1 text-slate-400"><Languages className="h-3 w-3" /> Translate</label>
                        <div className="flex gap-2">
                          <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
                            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                          >
                            {Object.entries(langs).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <button onClick={() => doAction("translate", { targetLang })}
                            className="text-[10px] px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium cursor-pointer hover:bg-indigo-100"
                          >{loading === "translate" ? "..." : "Go"}</button>
                        </div>
                      </div>

                      {/* Restyle */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono flex items-center gap-1 text-slate-400"><Type className="h-3 w-3" /> Restyle</label>
                        <div className="grid grid-cols-3 gap-2">
                          <input value={fontSize} onChange={(e) => setFontSize(e.target.value)} placeholder="Size"
                            className="text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 w-full" />
                          <input value={fontColor} onChange={(e) => setFontColor(e.target.value)} type="color"
                            className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 w-full cursor-pointer" />
                          <input value={fontName} onChange={(e) => setFontName(e.target.value)} placeholder="Font"
                            className="text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 w-full" />
                        </div>
                        <button onClick={() => doAction("restyle", { fontSize, fontColor, fontName })}
                          className="w-full text-[10px] px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 font-medium cursor-pointer hover:bg-purple-100"
                        >{loading === "restyle" ? "..." : "Apply Styling"}</button>
                      </div>

                      {/* Shift Timing */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono flex items-center gap-1 text-slate-400"><Clock className="h-3 w-3" /> Shift Timing (seconds)</label>
                        <div className="flex gap-2">
                          <input value={shiftSec} onChange={(e) => setShiftSec(e.target.value)} type="number"
                            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950" />
                          <button onClick={() => doAction("shift", { offsetSeconds: parseFloat(shiftSec) || 0 })}
                            className="text-[10px] px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 font-medium cursor-pointer hover:bg-amber-100"
                          >{loading === "shift" ? "..." : "Shift"}</button>
                        </div>
                      </div>

                      {/* Transcript */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono flex items-center gap-1 text-slate-400"><FileText className="h-3 w-3" /> Export Transcript</label>
                        <button onClick={() => doAction("transcript", {})}
                          className="w-full text-[10px] px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 text-teal-700 dark:text-teal-300 font-medium cursor-pointer hover:bg-teal-100"
                        >{loading === "transcript" ? "..." : "Extract Transcript"}</button>
                        {transcript && (
                          <div className="mt-2 bg-slate-50 dark:bg-slate-950 rounded-lg p-3 max-h-32 overflow-y-auto">
                            <p className="text-[10px] text-slate-500 whitespace-pre-wrap">{transcript}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {result && (
                    <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
                      <Download className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="flex-1 text-emerald-700 dark:text-emerald-300 truncate">{result.filename}</span>
                      <a href={result.url} target="_blank" rel="noreferrer"
                        className="text-[10px] px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold cursor-pointer hover:bg-emerald-200 shrink-0"
                      >Download</a>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
