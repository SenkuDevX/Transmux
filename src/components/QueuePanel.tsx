import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowUp, ArrowDown, ListOrdered, Clock, Activity, Cpu } from "lucide-react";
import { apiFetch } from "../api";

interface QueueItem {
  id: string;
  status: string;
  progress: number;
  inputName: string;
  phase: string;
  priority: number;
  createdAt: string;
}

export default function QueuePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [queueLen, setQueueLen] = useState(0);

  const fetchJobs = async () => {
    try {
      const r = await apiFetch("/api/jobs");
      const d = await r.json();
      if (d.success) { setItems(d.jobs); setProcessing(d.isProcessing); setQueueLen(d.queueLength); }
    } catch {}
  };

  useEffect(() => { if (open) { fetchJobs(); const iv = setInterval(fetchJobs, 3000); return () => clearInterval(iv); } }, [open]);

  const adjustPriority = async (id: string, delta: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newP = Math.max(-5, Math.min(10, item.priority + delta));
    await apiFetch(`/api/jobs/${id}/priority`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priority: newP }) });
    fetchJobs();
  };

  const statusColor: Record<string, string> = { queued: "text-amber-500", processing: "text-blue-500", waiting_cookies: "text-purple-500" };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                <h3 className="text-sm font-bold">Job Queue</h3>
                {processing && <span className="text-[9px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono">Processing 1</span>}
                {queueLen > 0 && <span className="text-[9px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono">{queueLen} queued</span>}
              </div>
              <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-2 max-h-[50vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No active jobs in queue.</p>
              ) : (
                items.map((item, i) => (
                  <div key={item.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => adjustPriority(item.id, 1)} disabled={i === 0} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-slate-400"><ArrowUp className="h-3 w-3" /></button>
                      <button onClick={() => adjustPriority(item.id, -1)} disabled={i === items.length - 1} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-slate-400"><ArrowDown className="h-3 w-3" /></button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">{item.inputName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-mono ${statusColor[item.status] || "text-slate-400"}`}>{item.status}</span>
                        {item.phase && <span className="text-[9px] text-slate-400">{item.phase}</span>}
                        <span className="text-[9px] text-slate-400">priority: {item.priority}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-mono font-bold text-slate-500">{item.progress}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
