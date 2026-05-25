import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Download, Volume2, Music, Tag, Film, Image, Scissors, Smartphone, Wrench, Grid, Loader2, FileArchive } from "lucide-react";
import { apiFetch, apiUrl } from "../api";

interface CreatorToolsPanelProps {
  jobId: string;
  open: boolean;
  onClose: () => void;
}

export default function CreatorToolsPanel({ jobId, open, onClose }: CreatorToolsPanelProps) {
  const [loading, setLoading] = useState("");
  const [result, setResult] = useState<{ path: string; filename: string } | null>(null);
  const [meta, setMeta] = useState({ title: "", artist: "", album: "", genre: "", date: "", comment: "" });
  const [gifOpts, setGifOpts] = useState({ start: "0", duration: "3", fps: "10", width: "480" });
  const [clipOpts, setClipOpts] = useState({ start: "0", end: "30" });
  const [shortsOpts, setShortsOpts] = useState({ start: "0", duration: "30" });
  const [thumbOpts, setThumbOpts] = useState({ mode: "interval" as "interval" | "scene" | "count", count: "10" });
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [thumbProgress, setThumbProgress] = useState(0);
  const [thumbTotal, setThumbTotal] = useState(0);
  // Skeleton loader state: show skeleton placeholders equal to count while generating
  const [thumbSkeletonCount, setThumbSkeletonCount] = useState(0);
  // Image loading/error tracking: number of images that have loaded or errored
  const [thumbImageLoadedCount, setThumbImageLoadedCount] = useState(0);

  const doAction = async (action: string, body?: any) => {
    setLoading(action);
    setResult(null);
    try {
      const isRepair = action === "repair";
      const r = await apiFetch(`${isRepair ? "/api/repair" : `/api/creator/${action}`}/${jobId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json();
      if (d.success) setResult(d);
    } catch {}
    setLoading("");
  };

  // Reset thumbnails when mode changes to avoid stale data
  useEffect(() => {
    setThumbnails([]);
    setThumbProgress(0);
    setThumbTotal(0);
    setThumbImageLoadedCount(0);
    setThumbSkeletonCount(0);
  }, [thumbOpts.mode]);

  const extractThumbnails = async () => {
    // Validation: count must be an integer between 1 and 100
    const countVal = parseInt(thumbOpts.count);
    if (!thumbOpts.count || isNaN(countVal) || countVal < 1 || countVal > 100) {
      alert("Please enter a count between 1 and 100.");
      return;
    }

    setLoading("thumbnails");
    setThumbnails([]);
    setThumbProgress(0);
    setThumbTotal(0);
    setThumbImageLoadedCount(0);
    // Show skeleton placeholders immediately
    setThumbSkeletonCount(countVal);

    try {
      const count = countVal || 10;
      const r = await apiFetch(`/api/thumbnails/${jobId}?count=${count}&mode=${thumbOpts.mode}`);
      const d = await r.json();
      if (d.success && d.thumbnails) {
        setThumbnails(d.thumbnails);
        setThumbTotal(d.count || d.thumbnails.length);
        setThumbProgress(d.count || d.thumbnails.length);
      } else {
        setThumbnails([]);
      }
    } catch (e) {
      console.error("Thumbnail extraction failed:", e);
    } finally {
      setLoading("");
      // Keep skeleton until images load (handled by onLoad/onError)
    }
  };

  // Helper to render skeleton placeholders
  const renderSkeletons = () => {
    const items = [];
    for (let i = 0; i < thumbSkeletonCount; i++) {
      items.push(
        <div key={`skel-${i}`} className="w-full aspect-video rounded border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 animate-pulse" />
      );
    }
    return items;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md" onClick={onClose}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold">Creator Tools</h3>
              <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Silence Remover */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><Volume2 className="h-3.5 w-3.5" /> Remove Silence</div>
                <p className="text-[9px] text-slate-500">Auto-trim leading/trailing silence using EBU R128 detection.</p>
                <button onClick={() => doAction("silence-remove")} disabled={!!loading}
                  className="w-full text-[10px] font-bold py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-all cursor-pointer disabled:opacity-50"
                >{loading === "silence-remove" ? "Processing..." : "Remove Silence"}</button>
              </div>

              {/* Loudness Normalization */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><Music className="h-3.5 w-3.5" /> Loudness Normalization</div>
                <p className="text-[9px] text-slate-500">Normalize audio to -23 LUFS (EBU R128 broadcast standard).</p>
                <button onClick={() => doAction("loudness-normalize")} disabled={!!loading}
                  className="w-full text-[10px] font-bold py-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-all cursor-pointer disabled:opacity-50"
                >{loading === "loudness-normalize" ? "Processing..." : "Normalize Loudness"}</button>
              </div>

              {/* Repair Corrupted Video */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><Wrench className="h-3.5 w-3.5" /> Repair Corrupted Video</div>
                <p className="text-[9px] text-slate-500">Fix broken timestamps, damaged containers, and unplayable media via FFmpeg remux.</p>
                <button onClick={() => doAction("repair")} disabled={!!loading}
                  className="w-full text-[10px] font-bold py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-all cursor-pointer disabled:opacity-50"
                >{loading === "repair" ? "Repairing..." : "Repair Video"}</button>
              </div>

              {/* GIF Maker */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><Image className="h-3.5 w-3.5" /> GIF Maker</div>
                <p className="text-[9px] text-slate-500">Extract a short segment and convert to an animated GIF.</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {[{k:"start",l:"Start (sec)"},{k:"duration",l:"Duration"},{k:"fps",l:"FPS"},{k:"width",l:"Width (px)"}].map(f => (
                    <input key={f.k} value={gifOpts[f.k as keyof typeof gifOpts]} onChange={(e) => setGifOpts({...gifOpts,[f.k]:e.target.value})}
                      placeholder={f.l}
                      className="text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 w-full outline-none"
                    />
                  ))}
                </div>
                <button onClick={() => doAction("gif", { ...gifOpts, start: parseFloat(gifOpts.start), duration: parseFloat(gifOpts.duration), fps: parseFloat(gifOpts.fps), width: parseFloat(gifOpts.width) })} disabled={!!loading}
                  className="w-full text-[10px] font-bold py-2 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900 text-pink-700 dark:text-pink-300 hover:bg-pink-100 transition-all cursor-pointer disabled:opacity-50"
                >{loading === "gif" ? "Generating GIF..." : "Create GIF"}</button>
              </div>

              {/* Clip Maker */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><Scissors className="h-3.5 w-3.5" /> Clip Maker</div>
                <p className="text-[9px] text-slate-500">Extract a segment without re-encoding (instant, lossless).</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {[{k:"start",l:"Start (sec)"},{k:"end",l:"End (sec)"}].map(f => (
                    <input key={f.k} value={clipOpts[f.k as keyof typeof clipOpts]} onChange={(e) => setClipOpts({...clipOpts,[f.k]:e.target.value})}
                      placeholder={f.l}
                      className="text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 w-full outline-none"
                    />
                  ))}
                </div>
                <button onClick={() => doAction("clip", { start: parseFloat(clipOpts.start), end: parseFloat(clipOpts.end) })} disabled={!!loading}
                  className="w-full text-[10px] font-bold py-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 transition-all cursor-pointer disabled:opacity-50"
                >{loading === "clip" ? "Extracting..." : "Extract Clip"}</button>
              </div>

              {/* Shorts Maker */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><Smartphone className="h-3.5 w-3.5" /> Shorts Maker</div>
                <p className="text-[9px] text-slate-500">Crop video to vertical 9:16 format for YouTube Shorts / TikTok.</p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {[{k:"start",l:"Start (sec)"},{k:"duration",l:"Duration"}].map(f => (
                    <input key={f.k} value={shortsOpts[f.k as keyof typeof shortsOpts]} onChange={(e) => setShortsOpts({...shortsOpts,[f.k]:e.target.value})}
                      placeholder={f.l}
                      className="text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 w-full outline-none"
                    />
                  ))}
                </div>
                <button onClick={() => doAction("shorts", { start: parseFloat(shortsOpts.start), duration: parseFloat(shortsOpts.duration) })} disabled={!!loading}
                  className="w-full text-[10px] font-bold py-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-50"
                >{loading === "shorts" ? "Creating Shorts..." : "Create Shorts"}</button>
              </div>

              {/* Metadata Editor */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><Tag className="h-3.5 w-3.5" /> Metadata Editor</div>
                <div className="grid grid-cols-2 gap-2">
                  {["title", "artist", "album", "genre", "date", "comment"].map(f => (
                    <input key={f} value={meta[f as keyof typeof meta]} onChange={(e) => setMeta({ ...meta, [f]: e.target.value })}
                      placeholder={f.charAt(0).toUpperCase() + f.slice(1)}
                      className="text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 w-full"
                    />
                  ))}
                </div>
                <button onClick={() => doAction("metadata", meta)} disabled={!!loading}
                  className="w-full text-[10px] font-bold py-2 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 text-teal-700 dark:text-teal-300 hover:bg-teal-100 transition-all cursor-pointer disabled:opacity-50"
                >{loading === "metadata" ? "Updating..." : "Update Metadata"}</button>
              </div>

              {/* Thumbnail Extractor */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"><Grid className="h-3.5 w-3.5" /> Thumbnail Extractor</div>
                <p className="text-[9px] text-slate-500">Extract keyframe screenshots at regular intervals from the video.</p>
                <div className="flex items-center gap-2 text-[10px]">
                  <select
                    value={thumbOpts.mode}
                    onChange={(e) => setThumbOpts({ ...thumbOpts, mode: e.target.value as "interval" | "scene" | "count" })}
                    className="text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 w-full outline-none"
                  >
                    <option value="interval">Interval</option>
                    <option value="scene">Scene</option>
                    <option value="count">Count</option>
                  </select>
                  <input
                    value={thumbOpts.count}
                    onChange={(e) => setThumbOpts({ ...thumbOpts, count: e.target.value })}
                    placeholder="Count"
                    type="number"
                    min="1"
                    max="100"
                    className="text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 w-20 outline-none"
                  />
                  <button onClick={extractThumbnails} disabled={!!loading}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900 text-violet-700 dark:text-violet-300 hover:bg-violet-100 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >{loading === "thumbnails" ? "Extracting..." : "Extract"}</button>
                </div>

                {loading === "thumbnails" && thumbTotal > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-slate-500"><span>Extracting...</span><span>{thumbProgress}/{thumbTotal}</span></div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(thumbProgress / thumbTotal) * 100}%` }} />
                    </div>
                  </div>
                )}

                {/* Skeleton placeholders while fetching or loading images */}
                {thumbSkeletonCount > 0 && thumbnails.length === 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] text-slate-500">Loading thumbnails...</span>
                    <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                      {renderSkeletons()}
                    </div>
                  </div>
                )}

                {thumbnails.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500">{thumbnails.length} thumbnails extracted</span>
                      <a href={apiUrl(`/api/thumbnails/${jobId}/zip`)} download="thumbnails.zip"
                        className="text-[9px] font-bold flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 cursor-pointer"
                      ><FileArchive className="h-3 w-3" /> Download All</a>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                      {thumbnails.map((url, i) => (
                        <a key={i} href={apiUrl(url)} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={apiUrl(url)}
                            alt={`Thumb ${i + 1}`}
                            className="w-full aspect-video object-cover rounded border border-slate-300 dark:border-slate-700 hover:opacity-80 transition-opacity"
                            loading="lazy"
                            onLoad={() => setThumbImageLoadedCount(prev => prev + 1)}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                              (e.target as HTMLImageElement).classList.add("opacity-30");
                              setThumbImageLoadedCount(prev => prev + 1);
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {result && (
                <div className="flex items-center gap-2 text-xs bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
                  <Download className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="flex-1 text-emerald-700 dark:text-emerald-300 truncate">{result.filename}</span>
                  <a href={result.path} download={result.filename}
                    className="text-[10px] px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold cursor-pointer hover:bg-emerald-200 shrink-0"
                  >Download</a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
