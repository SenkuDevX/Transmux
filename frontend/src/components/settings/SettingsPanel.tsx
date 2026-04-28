'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { ConversionMode, OutputFormat } from '@transmux/shared';

// ── Format lists ──────────────────────────────────────────────────────────────
const FORMATS: Record<ConversionMode, OutputFormat[]> = {
  audio:    ['MP3', 'WAV', 'OGG', 'M4A', 'AAC', 'FLAC', 'OPUS', 'ALAC', 'AIFF', 'WMA'],
  video:    ['MP4', 'MKV', 'WEBM', 'MOV', 'AVI', 'FLV', 'M4V', '3GP', 'TS'],
  subtitle: ['SRT', 'VTT', 'ASS', 'SUB'],
  image:    ['PNG', 'JPG', 'WEBP', 'GIF'],
};

// ── Audio: lossy formats accept a bitrate; lossless don't ────────────────────
const LOSSY_AUDIO = new Set(['MP3', 'OGG', 'AAC', 'OPUS', 'WMA', 'M4A']);

// ── Video: lossy formats accept bitrate/resolution controls ──────────────────
// Lossless video containers (archival use) skip quality controls
const LOSSLESS_VIDEO = new Set(['TS']); // TS can be lossless copy; treat conservatively
// In practice all our video targets are lossy encoders, but we keep the set
// for future-proofing and parity with audio behaviour

const AUDIO_BITRATES = [
  { label: '320 kbps', value: '320k' },
  { label: '256 kbps', value: '256k' },
  { label: '192 kbps', value: '192k' },
  { label: '160 kbps', value: '160k' },
  { label: '128 kbps', value: '128k' },
  { label: '96 kbps',  value: '96k'  },
  { label: '64 kbps',  value: '64k'  },
];

const VIDEO_RESOLUTIONS = [
  { label: 'Original', value: 'original'  },
  { label: '4K',       value: '3840x2160' },
  { label: '1440p',    value: '2560x1440' },
  { label: '1080p',    value: '1920x1080' },
  { label: '720p',     value: '1280x720'  },
  { label: '480p',     value: '854x480'   },
  { label: '360p',     value: '640x360'   },
];

// Video quality presets map to CRF values
// Lower CRF = better quality (larger file); higher = more compressed
const VIDEO_QUALITY = [
  { label: 'Best',    value: 18, hint: 'Near-lossless, large file' },
  { label: 'High',    value: 21, hint: 'Excellent quality'         },
  { label: 'Medium',  value: 24, hint: 'Good balance'              },
  { label: 'Small',   value: 28, hint: 'Smaller file, some loss'   },
];

interface Props { onConvert: () => void; converting: boolean }

export default function SettingsPanel({ onConvert, converting }: Props) {
  const { mode, settings, setOutputFormat, updateOptions } = useAppStore();

  const formats      = FORMATS[mode] ?? FORMATS.audio;
  const fmt          = settings.outputFormat as string | null;
  const bitrate      = (settings.options as any).bitrate    as string | undefined;
  const resolution   = (settings.options as any).resolution as string | undefined;
  const crf          = (settings.options as any).crf        as number | undefined;
  const normalize    = !!(settings.options as any).normalize;
  const removeAudio  = !!(settings.options as any).removeAudio;

  const isLossyAudio   = mode === 'audio'  && fmt != null && LOSSY_AUDIO.has(fmt);
  const isLosslessAudio = mode === 'audio' && fmt != null && !LOSSY_AUDIO.has(fmt);
  const isLossyVideo   = mode === 'video'  && fmt != null && !LOSSLESS_VIDEO.has(fmt);
  const showQualitySection = isLossyAudio || mode === 'video' || mode === 'audio';
  const canConvert = !!fmt && !converting;

  return (
    <div className="overflow-hidden rounded-2xl border border-brd bg-bg-2">

      {/* ── Output format ───────────────────────────────────────────────── */}
      <div className="p-5">
        <Label>Output format</Label>
        <div className="flex flex-wrap gap-2">
          {formats.map(f => (
            <Chip
              key={f}
              label={f}
              active={fmt === f}
              onClick={() => {
                setOutputFormat(f);
                if (mode === 'audio' && !LOSSY_AUDIO.has(f)) {
                  updateOptions({ bitrate: undefined });
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Quality controls ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showQualitySection && (
          <motion.div
            key={`opts-${mode}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-brd"
          >
            <div className="space-y-5 p-5">

              {/* ── AUDIO: bitrate for lossy ──────────────────────────── */}
              {isLossyAudio && (
                <div>
                  <Label>Bitrate</Label>
                  <div className="flex flex-wrap gap-2">
                    {AUDIO_BITRATES.map(b => (
                      <Chip
                        key={b.value}
                        label={b.label}
                        active={bitrate === b.value}
                        onClick={() => updateOptions({ bitrate: b.value })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── AUDIO: lossless note ──────────────────────────────── */}
              {isLosslessAudio && (
                <div className="flex items-start gap-2.5 rounded-xl border border-brd bg-bg-3 px-4 py-3">
                  <span className="mt-0.5 text-sm">🎯</span>
                  <p className="text-[12px] leading-relaxed text-tx-2">
                    <span className="font-semibold text-tx">{fmt}</span> is lossless —
                    the full audio signal is preserved exactly. No bitrate setting applies.
                  </p>
                </div>
              )}

              {/* ── AUDIO: normalize toggle ───────────────────────────── */}
              {mode === 'audio' && (
                <Toggle
                  label="Normalize volume"
                  sublabel="Level out loudness across the track"
                  value={normalize}
                  onChange={v => updateOptions({ normalize: v })}
                />
              )}

              {/* ── VIDEO: resolution ─────────────────────────────────── */}
              {mode === 'video' && (
                <div>
                  <Label>Resolution</Label>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_RESOLUTIONS.map(r => (
                      <Chip
                        key={r.value}
                        label={r.label}
                        active={resolution === r.value || (!resolution && r.value === 'original')}
                        onClick={() => updateOptions({ resolution: r.value })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── VIDEO: quality (CRF) for lossy containers ─────────── */}
              {isLossyVideo && (
                <div>
                  <Label>Quality</Label>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_QUALITY.map(q => (
                      <button
                        key={q.value}
                        onClick={() => updateOptions({ crf: q.value })}
                        title={q.hint}
                        className={`group relative rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                          crf === q.value
                            ? 'border-accent bg-accent/15 text-accent-2'
                            : 'border-brd bg-bg-3 text-tx-2 hover:border-brd-2 hover:text-tx'
                        }`}
                      >
                        {q.label}
                        {/* Tooltip */}
                        <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-brd bg-surface px-2 py-1 font-mono text-[10px] text-tx-2 opacity-0 transition-opacity group-hover:opacity-100">
                          {q.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-tx-3">
                    Defaults to High (CRF 21) if not set.
                  </p>
                </div>
              )}

              {/* ── VIDEO: remove audio toggle ────────────────────────── */}
              {mode === 'video' && (
                <Toggle
                  label="Remove audio"
                  sublabel="Export video stream only, no audio track"
                  value={removeAudio}
                  onChange={v => updateOptions({ removeAudio: v })}
                />
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Convert button ──────────────────────────────────────────────── */}
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
              : fmt
                ? <>Convert <ArrowRight size={13} /> {fmt}</>
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

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-tx-3">{children}</p>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${
        active
          ? 'border-accent bg-accent/15 text-accent-2'
          : 'border-brd bg-bg-3 text-tx-2 hover:border-brd-2 hover:text-tx'
      }`}
    >
      {label}
    </button>
  );
}

function Toggle({ label, sublabel, value, onChange }: {
  label: string; sublabel?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-4 text-left">
      <div>
        <p className="text-[13px] font-medium text-tx">{label}</p>
        {sublabel && <p className="mt-0.5 text-[11px] text-tx-3">{sublabel}</p>}
      </div>
      <div className={`relative h-5 w-9 flex-shrink-0 rounded-full border transition-colors duration-200 ${
        value ? 'border-accent bg-accent/60' : 'border-brd-2 bg-surface-2'
      }`}>
        <motion.div
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
          animate={{ left: value ? '18px' : '2px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </div>
    </button>
  );
}
