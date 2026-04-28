'use client';

import { motion } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';

interface ConvertButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function ConvertButton({ onClick, loading, disabled }: ConvertButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      className={`relative flex w-full items-center justify-center gap-3 rounded-xl px-6 py-4 font-semibold transition-all ${
        disabled || loading
          ? 'bg-surface cursor-not-allowed text-tx-3'
          : 'bg-gradient-to-r from-accent to-accent-2 glow-accent text-white hover:shadow-lg hover:shadow-accent/30'
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Converting...</span>
        </>
      ) : (
        <>
          <Zap className="h-5 w-5" />
          <span>Convert Now</span>
        </>
      )}
    </motion.button>
  );
}