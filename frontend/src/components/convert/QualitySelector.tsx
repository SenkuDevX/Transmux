'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';

interface Quality {
  value: string;
  label: string;
}

interface QualitySelectorProps {
  qualities: Quality[];
  value: string;
  onChange: (value: string) => void;
}

export default function QualitySelector({ qualities, value, onChange }: QualitySelectorProps) {
  return (
    <div className="mb-6">
      <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-tx-3">
        Quality
      </label>
      <div className="flex flex-wrap gap-2">
        {qualities.map((q) => (
          <button
            key={q.value}
            onClick={() => onChange(q.value)}
            className={clsx(
              'rounded-lg px-4 py-2 text-[12px] font-medium transition-all',
              value === q.value
                ? 'glass glow-accent text-accent2'
                : 'bg-surface text-tx-2 hover:bg-surface2 hover:text-tx'
            )}
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}