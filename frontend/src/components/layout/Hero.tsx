'use client';

import { motion } from 'framer-motion';
import { Music, Video, Link2 } from 'lucide-react';

export default function Hero() {
  return (
    <div className="py-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="mb-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="text-gradient">Convert Media</span>
          <br />
          <span className="text-tx">in Seconds</span>
        </h2>
      </motion.div>

      <motion.p
        className="mx-auto mb-8 max-w-lg text-tx-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        Paste a YouTube, Vimeo, or SoundCloud link. Pick your format.
        Get a downloadable file that expires in 1 hour.
      </motion.p>

      <motion.div
        className="flex flex-wrap justify-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="flex items-center gap-2 rounded-xl bg-surface/50 px-4 py-2">
          <Music className="h-4 w-4 text-accent2" />
          <span className="text-sm text-tx-2">Audio Extraction</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-surface/50 px-4 py-2">
          <Video className="h-4 w-4 text-accent3" />
          <span className="text-sm text-tx-2">Video Conversion</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-surface/50 px-4 py-2">
          <Link2 className="h-4 w-4 text-green-400" />
          <span className="text-sm text-tx-2">URL Support</span>
        </div>
      </motion.div>
    </div>
  );
}