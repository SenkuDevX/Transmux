'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const FILE_ICONS: Record<string, string> = {
  mp3: '🎵', wav: '🎵', ogg: '🎵', m4a: '🎵', aac: '🎵', flac: '🎵',
  mp4: '🎬', mkv: '🎬', webm: '🎬', mov: '🎬', avi: '🎬',
  srt: '💬', vtt: '💬', ass: '💬',
  png: '🖼️', jpg: '🖼️', webp: '🖼️', gif: '🖼️',
};

function getExt(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileList() {
  const { files, removeFile } = useAppStore();

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {files.map(({ id, file }) => {
          const ext = getExt(file.name);
          const icon = FILE_ICONS[ext] || '📄';
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -16, height: 0 }}
              className="flex items-center gap-3 rounded-xl border border-brd bg-bg-2 px-4 py-3"
            >
              {/* Icon */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface text-xl">
                {icon}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{file.name}</div>
                <div className="mt-0.5 flex gap-2">
                  <span className="rounded-md border border-brd bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tx-3">
                    {ext}
                  </span>
                  <span className="rounded-md border border-brd bg-surface px-1.5 py-0.5 font-mono text-[10px] text-tx-3">
                    {formatSize(file.size)}
                  </span>
                  <span className="rounded-md border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 font-mono text-[10px] text-green-400">
                    Ready
                  </span>
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={() => removeFile(id)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 transition-all hover:bg-red-500/20"
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
