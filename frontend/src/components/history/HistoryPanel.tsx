'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Download, Clock } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getDownloadUrl } from '@/lib/api';

export default function HistoryPanel() {
  const { activeJobs: jobs } = useAppStore();
  const doneJobs = jobs.filter(j => j.status === 'completed');

  return (
    <div className="mt-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-tx-3">Recent conversions</span>
        <div className="h-px flex-1 bg-brd" />
        <span className="rounded-full border border-brd bg-surface px-2 py-0.5 font-mono text-[10px] text-tx-3">
          {doneJobs.length}
        </span>
      </div>

      {doneJobs.length === 0 ? (
        <div className="rounded-2xl border border-brd bg-bg-2 p-16 text-center">
          <div className="mb-3 text-5xl opacity-30">📂</div>
          <div className="mb-2 text-base font-semibold text-tx-2">No conversions yet</div>
          <div className="text-sm text-tx-3">Your converted files will appear here</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brd bg-bg-2">
          <AnimatePresence>
            {doneJobs.map((job, i) => (
              <motion.div
                key={job.jobId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 border-b border-brd px-5 py-3.5 last:border-b-0 hover:bg-surface/50 transition-colors"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface text-lg">
                  📄
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {job.inputName || 'Conversion'}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-tx-3">
                    <span>{job.outputFormat}</span>
                  </div>
                </div>

                <div className="hidden items-center gap-1 font-mono text-[10px] text-tx-3 sm:flex">
                  {job.expiresAt && (
                    <>
                      <Clock size={10} />
                      Expires: {new Date(job.expiresAt).toLocaleDateString()}
                    </>
                  )}
                </div>

                {job.downloadUrl && (
                  <a
                    href={job.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 font-mono text-[11px] text-green-400 transition-all hover:bg-green-500/20"
                  >
                    <Download size={11} />
                    ↓
                  </a>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}