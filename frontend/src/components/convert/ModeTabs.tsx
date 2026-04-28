'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';

type ConversionMode = 'audio' | 'video' | 'subtitle';

const tabs: { id: ConversionMode; label: string; icon: string }[] = [
  { id: 'audio', label: 'Audio', icon: '🎵' },
  { id: 'video', label: 'Video', icon: '🎬' },
  { id: 'subtitle', label: 'Subtitles', icon: '💬' },
];

export default function ModeTabs() {
  const { mode, setMode } = useAppStore();

  return (
    <div className="flex gap-1 rounded-2xl border border-brd bg-bg-2 p-1">
      {tabs.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => setMode(id)}
          className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === id ? 'text-tx' : 'text-tx-2 hover:text-tx'
          }`}
        >
          {mode === id && (
            <motion.div
              layoutId="mode-active"
              className="absolute inset-0 rounded-xl border border-brd-2 bg-surface-2"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10 text-base">{icon}</span>
          <span className="relative z-10 hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}