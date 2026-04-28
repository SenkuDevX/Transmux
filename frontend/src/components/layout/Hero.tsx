'use client';

import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <motion.div
      className="mb-12 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-1.5 font-mono text-[11px] tracking-wider text-accent-2"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
        FFmpeg · yt-dlp · Self-hosted · v1.0.0
      </motion.div>

      <motion.h1
        className="mb-4 text-5xl font-extrabold leading-tight tracking-tight md:text-6xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        Convert anything.
        <br />
        <span className="text-gradient">Keep it simple.</span>
      </motion.h1>

      <motion.p
        className="mx-auto max-w-lg text-[15px] leading-relaxed text-tx-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Audio, video and subtitle conversion powered by FFmpeg.
        Drop a file or paste a URL to get started.
      </motion.p>
    </motion.div>
  );
}