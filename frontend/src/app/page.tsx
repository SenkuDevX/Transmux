'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Hero from '@/components/layout/Hero';
import ConvertPanel from '@/components/convert/ConvertPanel';
import HistoryPanel from '@/components/history/HistoryPanel';

export type AppTab = 'convert' | 'history' | 'about';

export default function HomePage() {
  const [tab, setTab] = useState<AppTab>('convert');

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="noise-overlay" />
      <div className="pointer-events-none fixed left-[-120px] top-[-180px] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(59,124,244,0.1)_0%,transparent_70%)]" />
      <div className="pointer-events-none fixed bottom-[-60px] right-[-100px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(240,79,89,0.07)_0%,transparent_70%)]" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <Navbar activeTab={tab} onTabChange={setTab} />

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'convert' && (<><Hero /><ConvertPanel /></>)}
          {tab === 'history' && <HistoryPanel />}
          {tab === 'about' && <AboutSection />}
        </motion.div>
      </div>
    </div>
  );
}

const stackItems = [
  { name: 'Next.js 14', color: 'bg-black text-white' },
  { name: 'Tailwind CSS', color: 'bg-cyan-950 text-cyan-300' },
  { name: 'Framer Motion', color: 'bg-violet-950 text-violet-300' },
  { name: 'FFmpeg', color: 'bg-green-950 text-green-300' },
  { name: 'yt-dlp', color: 'bg-yellow-950 text-yellow-300' },
  { name: 'Express', color: 'bg-slate-800 text-slate-300' },
  { name: 'TypeScript', color: 'bg-blue-950 text-blue-300' },
  { name: 'Zustand', color: 'bg-orange-950 text-orange-300' },
  { name: 'WebSockets', color: 'bg-red-950 text-red-300' },
];

const cards = [
  {
    icon: '⚡',
    title: 'FFmpeg at the core',
    body: 'Every conversion runs through FFmpeg — the same engine used in VLC, YouTube, and virtually every media pipeline on the planet.',
  },
  {
    icon: '🔗',
    title: 'URL support',
    body: 'Paste a YouTube or Vimeo link and convert it directly. Designed for content you have rights to — yt-dlp handles the rest.',
  },
  {
    icon: '🗑️',
    title: 'Auto cleanup',
    body: 'Files are stored temporarily and deleted automatically after one hour. Nothing is retained or logged permanently.',
  },
  {
    icon: '📖',
    title: 'Open source',
    body: 'MIT licensed. Fork it, self-host it, extend it. The full source is on GitHub and every part is documented.',
  },
];

function AboutSection() {
  return (
    <div className="flex flex-col items-center py-8">

      <motion.div
        className="mb-10 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-3 shadow-lg shadow-accent/30">
          <span className="text-2xl">⚡</span>
        </div>
        <h2 className="mb-2 text-3xl font-extrabold tracking-tight">Transmux</h2>
        <p className="text-[11px] font-mono tracking-widest text-tx-3 uppercase">v1.0.0 — Full Release</p>
      </motion.div>

      <motion.p
        className="mb-10 max-w-lg text-center text-[14px] leading-relaxed text-tx-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        A self-hosted media converter built on FFmpeg and yt-dlp.
        Upload a file or paste a URL, pick your output format, download the result.
        Simple, fast, and completely open source.
      </motion.p>

      <motion.div
        className="mb-10 grid w-full max-w-2xl gap-3 sm:grid-cols-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        {cards.map(({ icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-brd bg-bg-2 p-5 transition-colors hover:border-brd-2"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-brd bg-bg-3 text-lg">
              {icon}
            </div>
            <p className="mb-1.5 text-[13px] font-semibold">{title}</p>
            <p className="text-[12px] leading-relaxed text-tx-3">{body}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        className="mb-6 w-full max-w-2xl overflow-hidden rounded-2xl border border-brd bg-bg-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="border-b border-brd px-5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-tx-3">Project layout</p>
        </div>
        <pre className="p-5 font-mono text-[12px] leading-7 text-tx-2">{`transmux/  frontend/ Next.js — deploys to Vercel  backend/ Express + FFmpeg — any server  shared/ TypeScript types  docs/ API & deployment guides`}</pre>
      </motion.div>

      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-tx-3">Built with</p>
        <div className="flex flex-wrap justify-center gap-2">
          {stackItems.map(({ name, color }) => (
            <span
              key={name}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium ${color}`}
            >
              {name}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="mt-8 w-full max-w-2xl rounded-2xl border border-brd bg-bg-2 px-6 py-5 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-[12px] leading-relaxed text-tx-3">
          Only use the URL feature for content you own or have permission to convert.
          This tool does not bypass DRM or circumvent access controls.
        </p>
      </motion.div>

    </div>
  );
}