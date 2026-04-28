'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getDownloadUrl } from '@/lib/api';
import type { ConversionJob, JobStatus } from '@transmux/shared';

const STATUS: Record<JobStatus, { label: string; dot: string; ring: string }> = {
  queued:     { label: 'Queued',     dot: 'bg-amber-400',  ring: 'border-amber-500/20 text-amber-400'  },
  processing: { label: 'Converting', dot: 'bg-accent-2',   ring: 'border-accent/20 text-accent-2'      },
  done:       { label: 'Done',       dot: 'bg-green-400',  ring: 'border-green-500/20 text-green-400'  },
  failed:     { label: 'Failed',     dot: 'bg-red-400',    ring: 'border-red-500/20 text-red-400'      },
};

export default function JobProgress() {
  const { jobs, updateJob } = useAppStore();
  const wsRef = useRef<WebSocket | null>(null);
  const activeCount = jobs.filter(j => j.status === 'queued' || j.status === 'processing').length;

  useEffect(() => {
    if (activeCount === 0 || typeof window === 'undefined') return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    try {
      const ws = new WebSocket(apiUrl.replace(/^http/, 'ws') + '/ws');
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === 'job_update' && d.job) updateJob(d.job.id, d.job as ConversionJob);
        } catch { /* ignore */ }
      };
      ws.onerror = () => { wsRef.current = null; };
      ws.onclose = () => { wsRef.current = null; };
    } catch { wsRef.current = null; }
    return () => { wsRef.current?.close(); wsRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCount]);

  if (!jobs.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 pb-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-tx-3">Jobs</span>
        <div className="h-px flex-1 bg-brd" />
        <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-tx-3">{jobs.length}</span>
      </div>
      <AnimatePresence initial={false}>
        {jobs.map(job => <JobCard key={job.id} job={job} />)}
      </AnimatePresence>
    </div>
  );
}

function fmt(bytes?: number) {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function JobCard({ job }: { job: ConversionJob }) {
  const s = STATUS[job.status];
  const outputSize = fmt(job.outputSize);

  const download = () => {
    const a = document.createElement('a');
    a.href = getDownloadUrl(job.id);
    a.download = job.outputName || 'output';
    a.click();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-xl border border-brd bg-bg-2"
    >
      <div className="p-4">

        {/* Top row — name + status badge */}
        <div className="mb-3 flex items-center gap-3">
          <div className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${s.dot} ${job.status === 'processing' ? 'animate-pulse' : ''}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-tx">
              {job.inputName.replace(/\.[^.]+$/, '')}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-tx-3">
              → {job.outputFormat}
              {outputSize && <span className="ml-2 text-tx-3">{outputSize}</span>}
            </p>
          </div>
          <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${s.ring}`}>
            {s.label}
          </span>
        </div>

        {/* Progress bar */}
        {(job.status === 'queued' || job.status === 'processing') && (
          <div className="mb-3">
            <div className="mb-1.5 h-[3px] overflow-hidden rounded-full bg-surface">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-3"
                initial={{ width: 0 }}
                animate={{ width: job.status === 'queued' ? '4%' : `${job.progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-tx-3">
              <span>{job.status === 'queued' ? 'Waiting…' : `${Math.round(job.progress)}%`}</span>
              <span>{new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        )}

        {/* Error */}
        {job.status === 'failed' && job.error && (
          <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-red-400">
            {job.error.split('\n')[0]}
          </div>
        )}

        {/* Download */}
        {job.status === 'done' && (
          <motion.button
            onClick={download}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 py-2.5 text-[12px] font-medium text-green-400 transition-colors hover:bg-green-500/15"
          >
            <Download size={13} strokeWidth={2.5} />
            Download {job.outputFormat}
          </motion.button>
        )}

      </div>
    </motion.div>
  );
}
