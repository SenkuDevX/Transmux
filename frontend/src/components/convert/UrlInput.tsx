'use client';

import { motion } from 'framer-motion';
import { Link2, X } from 'lucide-react';

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onClear?: () => void;
}

export default function UrlInput({ value, onChange, error, onClear }: UrlInputProps) {
  return (
    <div className="mb-6">
      <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-tx-3">
        Media URL
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Link2 className="h-4 w-4 text-tx-3" />
        </div>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className={`w-full rounded-xl border bg-surface/50 py-4 pl-12 pr-12 font-mono text-sm text-tx placeholder:text-tx-3 focus:outline-none focus:ring-2 focus:ring-accent/50 ${
            error ? 'border-red-500/50' : 'border-brdd'
          }`}
        />
        {value && (
          <button
            onClick={onClear}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-tx-3 hover:text-tx"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && (
        <motion.p
          className="mt-2 text-[12px] text-red-400"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}