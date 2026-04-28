'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ModeTabs from './ModeTabs';
import UrlInput from '../upload/UrlInput';
import SettingsPanel from '../settings/SettingsPanel';
import JobProgress from '../progress/JobProgress';
import FeatureCards from './FeatureCards';
import { useAppStore } from '@/lib/store';
import { createUrlJob } from '@/lib/api';
import type { ActiveJob, ConversionStatus } from '@/lib/api';

export default function ConvertPanel() {
  const { mode } = useAppStore();
  const [url, setUrl] = useState('');
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    if (!url) {
      toast.error('Enter a URL first');
      return;
    }

    setConverting(true);
    try {
      const response = await createUrlJob({
        sourceUrl: url,
        mode,
        outputFormat: useAppStore.getState().format,
        options: { quality: useAppStore.getState().quality },
      });
      useAppStore.getState().addJob({
        jobId: response.jobId,
        status: response.status as ConversionStatus,
        progress: 0,
      });
      toast.success('Job queued');
      setUrl('');
    } catch (err: any) {
      const isNetworkErr = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
      if (isNetworkErr) {
        toast.info('Backend not reachable');
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
      <UrlInput />
      <AnimatePresence>
        {url && (
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
