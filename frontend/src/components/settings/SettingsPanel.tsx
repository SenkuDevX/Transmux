'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAppStore, AUDIO_FORMATS, VIDEO_FORMATS } from '@/lib/store';

interface Props { onConvert: () => void; converting: boolean }

export default function SettingsPanel({ onConvert, converting }: Props) {
  const { mode, format, setFormat } = useAppStore();

  const formats = mode === 'audio' ? AUDIO_FORMATS : VIDEO_FORMATS;
  const canConvert = !!format && !converting;

  return (
    <div className="overflow-hidden rounded-2xl border border-brd bg-bg-2">
      <div className="p-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-tx-3">Output format</p>
        <div className="flex flex-wrap gap-2">
          {formats.map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                format === f
                  ? 'border-accent bg-accent/15 text-accent-2'
                  : 'border-brd bg-bg-3 text-tx-2 hover:border-brd-2 hover:text-tx'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-brd p-4">
        <motion.button
          onClick={onConvert}
          disabled={!canConvert}
          whileHover={canConvert ? { scale: 1.008 } : {}}
          whileTap={canConvert ? { scale: 0.988 } : {}}
          className={`relative w-full overflow-hidden rounded-xl py-3.5 text-[13px] font-semibold tracking-wide text-white transition-all duration-200 ${
            canConvert
              ? 'bg-gradient-to-r from-accent to-accent-3 shadow-lg shadow-accent/20 hover:shadow-accent/35'
              : 'cursor-not-allowed bg-surface-2 text-tx-3'
          }`}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {converting
              ? <><Loader2 size={14} className="animate-spin" /> Converting…</>
              : format
                ? <>Convert <ArrowRight size={13} /> {format.toUpperCase()}</>
                : 'Select a format above'
            }
          </span>
          {canConvert && (
            <motion.span
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          )}
        </motion.button>
      </div>
    </div>
  );
}