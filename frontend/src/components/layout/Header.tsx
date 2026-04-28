'use client';

import { motion } from 'framer-motion';
import { Zap, Shield, Clock } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex items-center justify-between py-6">
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-3 glow-accent">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Transmux</h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-tx-3">Media Converter</p>
        </div>
      </motion.div>

      <motion.div
        className="hidden items-center gap-4 sm:flex"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[11px] text-tx-2">
          <Shield className="h-3 w-3 text-green-400" />
          Free Tier Ready
        </div>
        <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[11px] text-tx-2">
          <Clock className="h-3 w-3 text-accent2" />
          1hr Auto-Delete
        </div>
      </motion.div>
    </header>
  );
}