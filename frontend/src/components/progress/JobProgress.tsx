'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getDownloadUrl } from '@/lib/api';
import type { ActiveJob, ConversionStatus } from '@/lib/api';

const STATUS: Record<ConversionStatus, { label: string; dot: string }> = {
  queued: { label: 'Queued', dot: 'bg-amber-400' },
  downloading: { label: 'Downloading', dot: 'bg-blue-400' },
  converting: { label: 'Converting', dot: 'bg-accent-2' },
  uploading: { label: 'Uploading', dot: 'bg-purple-400' },
  completed: { label: 'Done', dot: 'bg-green-400' },
  failed: { label: 'Failed', dot: 'bg-red-400' },
  expired: { label: 'Expired', dot: 'bg-gray-400' },
};

export default function JobProgress() {
  const { activeJobs: jobs, updateJob } = useAppStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (jobs.length === 0 || typeof window === 'undefined') return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    try {
      const ws = new WebSocket(apiUrl.replace(/^http/, 'ws') + '/ws');
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type === 'job_update' && d.job) updateJob(d.job.jobId, d.job as Partial<ActiveJob>);
        } catch { /* ignore */ }
      };
      ws.onerror = () => { wsRef.current = null; };
      ws.onclose = () => { wsRef.current = null; };
    } catch { wsRef.current = null; }
    return () => { wsRef.current?.close(); wsRef.current = null; };
  }, [jobs.length, updateJob]);

  if (!jobs.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 pb-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-tx-3">Active Conversions</span>
        <div className="h-px flex-1 bg-brd" />
        <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-tx-3">{jobs.length}</span>
      </div>
      <AnimatePresence initial={false}>
        {jobs.map(job => <JobCard key={job.jobId} job={job} />)}
      </AnimatePresence>
    </div>
  );
}

function JobCard({ job }: { job: ActiveJob }) {
  const s = STATUS[job.status] || STATUS.queued;

  const download = () => {
    const a = document.createElement('a');
    a.href = getDownloadUrl(job.jobId);
    a.download = job.inputName || 'output';
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
        <div className="mb-3 flex items-center gap-3">
          <div className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${s.dot} ${job.status === 'converting' ? 'animate-pulse' : ''}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-tx">
              {(job.inputName || 'Untitled').replace(/\.[^.]+$/, '')}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-tx-3">
              → {job.outputFormat?.toUpperCase()}
            </p>
          </div>
          <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
            job.status === 'completed' ? 'border-green-500/20 text-green-400' :
            job.status === 'failed' ? 'border-red-500/20 text-red-400' :
            'border-brd-2 bg-surface text-tx-2'
          }`}>
            {s.label}
          </span>
        </div>

        {(job.status === 'queued' || job.status === 'converting') && (
          <div className="mb-3">
            <div className="mb-1.5 h-[3px] overflow-hidden rounded-full bg-surface">
              <motion.div
                className="shimmer-bar h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: job.status === 'queued' ? '4%' : `${job.progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-tx-3">
              <span>{job.status === 'queued' ? 'Waiting…' : `${Math.round(job.progress)}%`}</span>
            </div>
          </div>
        )}

        {job.status === 'failed' && job.error && (
          <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-red-400">
            {job.error.split('\n')[0]}
          </div>
        )}

        {job.status === 'completed' && (
          <motion.button
            onClick={download}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 py-2.5 text-[12px] font-medium text-green-400 transition-colors hover:bg-green-500/15"
          >
            <Download size={13} strokeWidth={2.5} />
            Download {job.outputFormat?.toUpperCase()}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}