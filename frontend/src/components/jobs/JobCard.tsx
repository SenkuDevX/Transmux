'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Clock, AlertCircle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import type { ActiveJob } from '@/lib/api';
import { getDownloadUrl, getTimeRemaining } from '@/lib/store';

const STATUS_CONFIG = {
  queued: {
    label: 'Queued',
    icon: Clock,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
  downloading: {
    label: 'Downloading',
    icon: Loader2,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  converting: {
    label: 'Converting',
    icon: Loader2,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20',
  },
  uploading: {
    label: 'Uploading',
    icon: Loader2,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/20',
  },
  completed: {
    label: 'Done',
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/20',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/20',
  },
  expired: {
    label: 'Expired',
    icon: AlertCircle,
    color: 'text-gray-400',
    bg: 'bg-gray-400/10',
    border: 'border-gray-400/20',
  },
} as const;

interface JobCardProps {
  job: ActiveJob;
}

export default function JobCard({ job }: JobCardProps) {
  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
  const Icon = config.icon;
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (job.expiresAt) {
      setTimeLeft(getTimeRemaining(job.expiresAt));
      const interval = setInterval(() => {
        setTimeLeft(getTimeRemaining(job.expiresAt));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [job.expiresAt]);

  const handleDownload = () => {
    if (job.downloadUrl) {
      window.open(job.downloadUrl, '_blank');
    } else {
      window.open(getDownloadUrl(job.jobId), '_blank');
    }
  };

  const isProcessing = ['queued', 'downloading', 'converting', 'uploading'].includes(job.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`overflow-hidden rounded-2xl border ${config.border} ${config.bg}`}
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bg}`}>
              <Icon className={`h-5 w-5 ${config.color} ${isProcessing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <p className="font-medium text-tx">{job.inputName || 'Converting...'}</p>
              <p className="font-mono text-[11px] text-tx-3">
                → {job.outputFormat?.toUpperCase()}
              </p>
            </div>
          </div>

          <span className={`rounded-full border px-3 py-1 font-mono text-[10px] font-medium ${config.color} ${config.bg} ${config.border}`}>
            {config.label}
          </span>
        </div>

        {isProcessing && (
          <div className="mb-4">
            <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-surface">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                initial={{ width: 0 }}
                animate={{ width: `${job.progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-tx-3">
              <span>{job.progress}%</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {job.status === 'failed' && job.error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
            {job.error}
          </div>
        )}

        {job.status === 'completed' && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10px] text-tx-3">
              <Clock className="h-3 w-3" />
              <span>Expires in {timeLeft}</span>
            </div>
          </div>
        )}

        {(job.status === 'completed' || job.status === 'expired') && (
          <div className="flex gap-2">
            {job.status === 'completed' && (
              <motion.button
                onClick={handleDownload}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 py-3 text-[13px] font-medium text-green-400 transition-colors hover:bg-green-500/20"
              >
                <Download className="h-4 w-4" />
                Download
              </motion.button>
            )}
            {job.status === 'expired' && (
              <div className="flex flex-1 items-center justify-center rounded-xl bg-surface/50 py-3 text-[13px] text-tx-3">
                File has expired
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}