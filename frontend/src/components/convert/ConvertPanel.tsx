'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ModeTabs from './ModeTabs';
import DropZone from '../upload/DropZone';
import UrlInput from '../upload/UrlInput';
import FileList from '../upload/FileList';
import SettingsPanel from '../settings/SettingsPanel';
import JobProgress from '../progress/JobProgress';
import FeatureCards from './FeatureCards';
import { useAppStore } from '@/lib/store';
import { createFileJob, createUrlJob } from '@/lib/api';
import type { ActiveJob } from '@/lib/api';

export default function ConvertPanel() {
  const { files, urlMetadata, settings, mode, addJob, clearFiles } = useAppStore();
  const [converting, setConverting] = useState(false);

  const hasInput = files.length > 0 || urlMetadata !== null;

  const handleConvert = async () => {
    if (!settings.outputFormat) {
      toast.error('Select an output format first');
      return;
    }
    if (!hasInput) {
      toast.error('Add a file or URL first');
      return;
    }

    setConverting(true);
    try {
      const meta = {
        mode,
        outputFormat: settings.outputFormat,
        options: { ...settings.options, quality: settings.quality },
      };

      if (files.length > 0) {
        for (const fileItem of files) {
          const { job } = await createFileJob(fileItem.file, meta);
          addJob(job as unknown as ActiveJob);
          toast.success(`Job queued: ${fileItem.file.name}`);
        }
        clearFiles();
      } else if (urlMetadata) {
        const sourceUrl = (urlMetadata as any).url;
        const { job } = await createUrlJob({ ...meta, sourceUrl });
        addJob(job as unknown as ActiveJob);
        toast.success('URL job queued');
      }
    } catch (err: any) {
      // In demo mode (no backend), show a friendly message
      const isNetworkErr = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
      if (isNetworkErr) {
        toast.info('Backend not reachable. Make sure the backend is running on port 3001.');
      } else {
        toast.error(err.message || 'Conversion failed');
      }
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-4">
      <ModeTabs />
      <DropZone />

      <div className="relative flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-brd" />
        <span className="font-mono text-[11px] tracking-wider text-tx-3">or paste a URL</span>
        <div className="h-px flex-1 bg-brd" />
      </div>

      <UrlInput />

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <FileList />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasInput && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <SettingsPanel onConvert={handleConvert} converting={converting} />
          </motion.div>
        )}
      </AnimatePresence>

      <JobProgress />
      <FeatureCards />
    </div>
  );
}
