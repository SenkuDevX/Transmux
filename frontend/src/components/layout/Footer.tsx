'use client';

import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <motion.footer
      className="mt-16 border-t border-brdd/50 py-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <p className="font-mono text-[11px] text-tx-3">
        Built with FFmpeg + yt-dlp + Cloudinary + Upstash Redis
      </p>
      <p className="mt-1 font-mono text-[10px] text-tx-3">
        Production-ready for Render + Vercel free tier
      </p>
    </motion.footer>
  );
}