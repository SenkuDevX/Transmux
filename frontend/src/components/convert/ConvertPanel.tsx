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
import { createUrlJob, createConversionJob } from '@/lib/api';

export default function ConvertPanel() {
  const { files, urlMetadata, settings, mode, addJob, clearFiles, setUrlMetadata, setUrlInput } = useAppStore();
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
      if (urlMetadata) {
        const sourceUrl = (urlMetadata as any).url;
        const result = await createUrlJob({
          sourceUrl,
          mode,
          outputFormat: settings.outputFormat,
          options: { quality: settings.quality, ...settings.options },
        });
        addJob({
          jobId: result.jobId,
          status: 'queued',
          progress: 0,
          inputName: sourceUrl.split('/').pop() || 'Media',
          outputFormat: settings.outputFormat,
        });
        toast.success('Conversion started!');
        setUrlMetadata(null);
        setUrlInput('');
      } else if (files.length > 0) {
        for (const fileItem of files) {
          const result = await createConversionJob({
            url: 'file://' + fileItem.file.name,
            format: settings.outputFormat,
            quality: settings.quality,
            mode,
          });
          addJob({
            jobId: result.jobId,
            status: 'queued',
            progress: 0,
            inputName: fileItem.file.name,
            outputFormat: settings.outputFormat,
          });
        }
        toast.success(`${files.length} job(s) queued!`);
        clearFiles();
      }
    } catch (err: any) {
      const isNetworkErr = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError');
      if (isNetworkErr) {
        toast.error('Backend not reachable. Check your connection.');
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