'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import UrlInput from '@/components/convert/UrlInput';
import FormatSelector from '@/components/convert/FormatSelector';
import QualitySelector from '@/components/convert/QualitySelector';
import ConvertButton from '@/components/convert/ConvertButton';
import JobCard from '@/components/jobs/JobCard';
import Header from '@/components/layout/Header';
import Hero from '@/components/layout/Hero';
import Footer from '@/components/layout/Footer';
import { useAppStore, AUDIO_FORMATS, VIDEO_FORMATS, AUDIO_QUALITIES, VIDEO_QUALITIES } from '@/lib/store';
import { createConversionJob, getJobStatus } from '@/lib/api';
import { useJobsWebSocket } from '@/lib/socket';
import type { ConversionStatus } from '@/lib/api';

export default function HomePage() {
  const {
    url, setUrl,
    format, setFormat,
    quality, setQuality,
    mode, setMode,
    activeJobs, addJob, updateJob,
  } = useAppStore();

  const [converting, setConverting] = useState(false);
  const [inputError, setInputError] = useState('');

  const handleWsEvent = (event: string, data: any) => {
    switch (event) {
      case 'progress':
        updateJob(data.jobId, {
          status: data.status as ConversionStatus,
          progress: data.progress,
        });
        break;
      case 'complete':
        updateJob(data.jobId, {
          status: 'completed',
          progress: 100,
          downloadUrl: data.downloadUrl,
          expiresAt: data.expiresAt,
        });
        toast.success('Conversion complete! Click to download.');
        break;
      case 'failed':
        updateJob(data.jobId, {
          status: 'failed',
          error: data.error,
        });
        toast.error(`Conversion failed: ${data.error}`);
        break;
      case 'expired':
        updateJob(data.jobId, { status: 'expired' });
        toast.warning('File has expired and was deleted.');
        break;
    }
  };

  useJobsWebSocket(handleWsEvent);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      setInputError('Please enter a URL');
      return false;
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setInputError('URL must use HTTP or HTTPS');
        return false;
      }
      const allowed = ['youtube.com', 'youtu.be', 'vimeo.com', 'soundcloud.com', 'twitch.tv', 'dailymotion.com', 'bilibili.com'];
      const isAllowed = allowed.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
      if (!isAllowed) {
        setInputError('Only YouTube, Vimeo, SoundCloud, Twitch, Dailymotion, and Bilibili are supported');
        return false;
      }
    } catch {
      setInputError('Please enter a valid URL');
      return false;
    }
    setInputError('');
    return true;
  };

  const handleConvert = async () => {
    if (!validateUrl(url)) return;

    setConverting(true);
    try {
      const result = await createConversionJob({
        url,
        format,
        quality,
        mode,
      });

      addJob({
        jobId: result.jobId,
        status: 'queued',
        progress: 0,
        inputName: url.split('/').pop() || 'Media',
        outputFormat: format,
      });

      toast.success('Conversion started!');

      const pollStatus = async () => {
        try {
          const status = await getJobStatus(result.jobId);
          updateJob(result.jobId, {
            status: status.status as ConversionStatus,
            progress: status.progress,
            downloadUrl: status.downloadUrl,
            expiresAt: status.expiresAt,
          });

          if (status.status === 'completed' || status.status === 'failed' || status.status === 'expired') {
            if (status.status === 'completed') {
              toast.success('Conversion complete!');
            }
            return;
          }
          setTimeout(pollStatus, 2000);
        } catch {
          setTimeout(pollStatus, 5000);
        }
      };

      setTimeout(pollStatus, 1000);

    } catch (err: any) {
      toast.error(err.message || 'Failed to start conversion');
    } finally {
      setConverting(false);
    }
  };

  const formats = mode === 'audio' ? AUDIO_FORMATS : VIDEO_FORMATS;
  const qualities = mode === 'audio' ? AUDIO_QUALITIES : VIDEO_QUALITIES;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="noise-overlay" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Header />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Hero />
        </motion.div>

        <motion.div
          className="mt-8 space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="glass-strong rounded-3xl p-6 sm:p-8">
            <div className="mb-6">
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setMode('audio')}
                  className={`flex-1 rounded-xl px-4 py-3 font-medium transition-all ${
                    mode === 'audio'
                      ? 'glass glow-accent text-accent2'
                      : 'bg-surface text-tx-2 hover:bg-surface2'
                  }`}
                >
                  Audio
                </button>
                <button
                  onClick={() => setMode('video')}
                  className={`flex-1 rounded-xl px-4 py-3 font-medium transition-all ${
                    mode === 'video'
                      ? 'glass glow-accent text-accent2'
                      : 'bg-surface text-tx-2 hover:bg-surface2'
                  }`}
                >
                  Video
                </button>
              </div>
            </div>

            <UrlInput
              value={url}
              onChange={setUrl}
              error={inputError}
              onClear={() => { setUrl(''); setInputError(''); }}
            />

            <FormatSelector
              formats={formats}
              value={format}
              onChange={setFormat}
            />

            <QualitySelector
              qualities={qualities}
              value={quality}
              onChange={setQuality}
            />

            <ConvertButton
              onClick={handleConvert}
              loading={converting}
              disabled={!url.trim()}
            />
          </div>
        </motion.div>

        {activeJobs.length > 0 && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-4 flex items-center gap-3">
              <h2 className="font-mono text-xs uppercase tracking-widest text-tx-3">Active Conversions</h2>
              <div className="h-px flex-1 bg-brdd" />
              <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-[10px] text-tx-3">
                {activeJobs.length}
              </span>
            </div>

            <div className="space-y-4">
              {activeJobs.map((job) => (
                <JobCard key={job.jobId} job={job} />
              ))}
            </div>
          </motion.div>
        )}

        <Footer />
      </div>
    </div>
  );
}