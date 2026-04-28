'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';

interface FormatSelectorProps {
  formats: string[];
  value: string;
  onChange: (value: string) => void;
}

export default function FormatSelector({ formats, value, onChange }: FormatSelectorProps) {
  return (
    <div className="mb-6">
      <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-tx-3">
        Output Format
      </label>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {formats.map((fmt) => (
          <button
            key={fmt}
            onClick={() => onChange(fmt)}
            className={clsx(
              'rounded-lg px-3 py-2.5 font-mono text-[12px] font-medium uppercase transition-all',
              value === fmt
                ? 'glass glow-accent text-accent2'
                : 'bg-surface text-tx-2 hover:bg-surface2 hover:text-tx'
            )}
          >
            {fmt}
          </button>
        ))}
      </div>
    </div>
  );
}