'use client';

import { motion } from 'framer-motion';

const features = [
  { icon: '🗑️', title: 'Auto cleanup', desc: 'Converted files are deleted from the server after 1 hour.' },
  { icon: '⚡', title: 'FFmpeg', desc: 'Industry-standard encoder. Supports virtually every audio and video format.' },
  { icon: '🔗', title: 'URL support', desc: 'Paste a YouTube or Vimeo link to convert directly — for content you have rights to.' },
  { icon: '📖', title: 'Open source', desc: 'MIT licensed. Run it yourself on any server.' },
];

export default function FeatureCards() {
  return (
    <motion.div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      {features.map(({ icon, title, desc }) => (
        <div
          key={title}
          className="rounded-xl border border-brd bg-bg-2 p-4 transition-colors hover:border-brd-2"
        >
          <div className="mb-2 text-xl">{icon}</div>
          <div className="mb-1 text-[13px] font-semibold">{title}</div>
          <div className="text-[12px] leading-relaxed text-tx-3">{desc}</div>
        </div>
      ))}
    </motion.div>
  );
}
