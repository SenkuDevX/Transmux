'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const FORMAT_GROUPS = {
  audio: ['mp3','wav','ogg','m4a','aac','flac','opus','aiff','wma','amr'],
  video: ['mp4','mkv','webm','mov','avi','flv','m4v','3gp','ts'],
  subtitle: ['srt','vtt','ass','sub'],
  image: ['png','jpg','webp','gif','bmp','tiff'],
};

export default function DropZone() {
  const { addFiles, mode } = useAppStore();

  const onDrop = useCallback((accepted: File[]) => {
    addFiles(accepted);
  }, [addFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  const formats = FORMAT_GROUPS[mode] || FORMAT_GROUPS.audio;

  return (
    <motion.div
      {...(getRootProps() as any)}
      className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-all duration-300 ${
        isDragActive
          ? 'scale-[1.01] border-accent bg-accent/5'
          : 'border-brd-2 bg-bg-2 hover:border-accent hover:bg-accent/[0.03]'
      }`}
      whileHover={{ scale: 1.005 }}
    >
      <input {...getInputProps()} />

      {/* Upload icon */}
      <motion.div
        animate={isDragActive ? { y: -8, scale: 1.1 } : { y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10"
      >
        <Upload size={28} className="text-accent-2" />
      </motion.div>

      <div className="mb-2 text-lg font-bold">
        {isDragActive ? 'Drop files here' : 'Drop files or click to browse'}
      </div>
      <div className="mb-5 text-sm text-tx-2">Max 500MB · Multiple files supported</div>

      {/* Format tags */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {formats.map(f => (
          <span
            key={f}
            className="rounded-md border border-brd bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tx-3"
          >
            {f}
          </span>
        ))}
      </div>

      {/* Drag overlay glow */}
      {isDragActive && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: 'inset 0 0 60px rgba(108,92,231,0.15)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </motion.div>
  );
}
