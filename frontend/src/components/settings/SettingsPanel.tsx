'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';

type ConversionMode = 'audio' | 'video' | 'subtitle';

const FORMATS: Record<ConversionMode, string[]> = {
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'alac', 'aiff', 'wma'],
  video: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'm4v', '3gp', 'ts'],
  subtitle: ['srt', 'vtt', 'ass', 'sub'],
};

const LOSSY_AUDIO = new Set(['mp3', 'ogg', 'aac', 'opus', 'wma', 'm4a']);

const LOSSLESS_VIDEO = new Set(['ts']);

const AUDIO_BITRATES = [
  { label: '320 kbps', value: '320k' },
  { label: '256 kbps', value: '256k' },
  { label: '192 kbps', value: '192k' },
  { label: '160 kbps', value: '160k' },
  { label: '128 kbps', value: '128k' },
  { label: '96 kbps', value: '96k' },
  { label: '64 kbps', value: '64k' },
];

const VIDEO_RESOLUTIONS = [
  { label: 'Original', value: 'original' },
  { label: '4K', value: '3840x2160' },
  { label: '1440p', value: '2560x1440' },
  { label: '1080p', value: '1920x1080' },
  { label: '720p', value: '1280x720' },
  { label: '480p', value: '854x480' },
  { label: '360p', value: '640x360' },
];

const VIDEO_QUALITY = [
  { label: 'Best', value: 18, hint: 'Near-lossless, large file' },
  { label: 'High', value: 21, hint: 'Excellent quality' },
  { label: 'Medium', value: 24, hint: 'Good balance' },
  { label: 'Small', value: 28, hint: 'Smaller file, some loss' },
];

interface Props { onConvert: () => void; converting: boolean }

export default function SettingsPanel({ onConvert, converting }: Props) {
  const { mode, format, setFormat, settings, setSettings } = useAppStore();

  const formats = FORMATS[mode as ConversionMode] ?? FORMATS.audio;
  const fmt = settings.outputFormat;
  const bitrate = settings.options?.bitrate;
  const resolution = settings.options?.resolution;
  const crf = settings.options?.crf;
  const normalize = !!settings.options?.normalize;
  const removeAudio = !!settings.options?.removeAudio;

  const isLossyAudio = mode === 'audio' && fmt != null && LOSSY_AUDIO.has(fmt.toLowerCase());
  const isLosslessAudio = mode === 'audio' && fmt != null && !LOSSY_AUDIO.has(fmt.toLowerCase());
  const isLossyVideo = mode === 'video' && fmt != null && !LOSSLESS_VIDEO.has(fmt.toLowerCase());
  const showQualitySection = isLossyAudio || mode === 'video' || mode === 'audio';
  const canConvert = !!fmt && !converting;

  const handleFormatClick = (f: string) => {
    setFormat(f);
    setSettings({ outputFormat: f });
    if (mode === 'audio' && !LOSSY_AUDIO.has(f.toLowerCase())) {
      setSettings({ options: { ...settings.options, bitrate: undefined } });
    }
  };

  const handleBitrateClick = (value: string) => {
    setSettings({ options: { ...settings.options, bitrate: value } });
  };

  const handleResolutionClick = (value: string) => {
    setSettings({ options: { ...settings.options, resolution: value } });
  };

  const handleCrfClick = (value: number) => {
    setSettings({ options: { ...settings.options, crf: value } });
  };

  const handleNormalizeToggle = (value: boolean) => {
    setSettings({ options: { ...settings.options, normalize: value } });
  };

  const handleRemoveAudioToggle = (value: boolean) => {
    setSettings({ options: { ...settings.options, removeAudio: value } });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-brd bg-bg-2">

      <div className="p-5">
        <Label>Output format</Label>
        <div className="flex flex-wrap gap-2">
          {formats.map(f => (
            <Chip
              key={f}
              label={f.toUpperCase()}
              active={fmt === f}
              onClick={() => handleFormatClick(f)}
            />
          ))}
        </div>
      </div>

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

              {isLossyAudio && (
                <div>
                  <Label>Bitrate</Label>
                  <div className="flex flex-wrap gap-2">
                    {AUDIO_BITRATES.map(b => (
                      <Chip
                        key={b.value}
                        label={b.label}
                        active={bitrate === b.value}
                        onClick={() => handleBitrateClick(b.value)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isLosslessAudio && (
                <div className="flex items-start gap-2.5 rounded-xl border border-brd bg-bg-3 px-4 py-3">
                  <span className="mt-0.5 text-sm">🎯</span>
                  <p className="text-[12px] leading-relaxed text-tx-2">
                    <span className="font-semibold text-tx">{fmt?.toUpperCase()}</span> is lossless —
                    the full audio signal is preserved exactly. No bitrate setting applies.
                  </p>
                </div>
              )}

              {mode === 'audio' && (
                <Toggle
                  label="Normalize volume"
                  sublabel="Level out loudness across the track"
                  value={normalize}
                  onChange={handleNormalizeToggle}
                />
              )}

              {mode === 'video' && (
                <div>
                  <Label>Resolution</Label>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_RESOLUTIONS.map(r => (
                      <Chip
                        key={r.value}
                        label={r.label}
                        active={resolution === r.value || (!resolution && r.value === 'original')}
                        onClick={() => handleResolutionClick(r.value)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isLossyVideo && (
                <div>
                  <Label>Quality</Label>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_QUALITY.map(q => (
                      <button
                        key={q.value}
                        onClick={() => handleCrfClick(q.value)}
                        title={q.hint}
                        className={`group relative rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                          crf === q.value
                            ? 'border-accent bg-accent/15 text-accent-2'
                            : 'border-brd bg-bg-3 text-tx-2 hover:border-brd-2 hover:text-tx'
                        }`}
                      >
                        {q.label}
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

              {mode === 'video' && (
                <Toggle
                  label="Remove audio"
                  sublabel="Export video stream only, no audio track"
                  value={removeAudio}
                  onChange={handleRemoveAudioToggle}
                />
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                ? <>Convert <ArrowRight size={13} /> {fmt.toUpperCase()}</>
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

function Toggle({ label, sublabel, value, onChange }: { label: string; sublabel?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-4 text-left">
      <div>
        <p className="text-[13px] font-medium text-tx">{label}</p>
        {sublabel && <p className="mt-0.5 text-[11px] text-tx-3">{sublabel}</p>}
      </div>
      <div className={`relative h-5 w-9 flex-shrink-0 rounded-full border transition-colors duration-200 ${ value ? 'border-accent bg-accent/60' : 'border-brd-2 bg-surface-2' }`}>
        <motion.div
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
          animate={{ left: value ? '18px' : '2px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </div>
    </button>
  );
}