'use client';

import { motion } from 'framer-motion';
import { Zap, Sun, Moon } from 'lucide-react';

type AppTab = 'convert' | 'history' | 'about';
import { useTheme } from './ThemeProvider';

interface NavbarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const tabs: { id: AppTab; label: string }[] = [
  { id: 'convert', label: 'Convert' },
  { id: 'history', label: 'History' },
  { id: 'about',   label: 'About'   },
];

export default function Navbar({ activeTab, onTabChange }: NavbarProps) {
  const { theme, toggle } = useTheme();

  return (
    <nav className="mb-12 flex items-center justify-between border-b border-brd py-5">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-3">
          <Zap size={16} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-xl font-extrabold tracking-tight">Transmux</span>
        <span className="rounded-full border border-brd-2 bg-surface px-2.5 py-0.5 font-mono text-[10px] tracking-wider text-tx-2">
          v1.0.0
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-brd bg-bg-2 p-1">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
              activeTab === id ? 'text-tx' : 'text-tx-2 hover:text-tx'
            }`}
          >
            {activeTab === id && (
              <motion.div
                layoutId="nav-active"
                className="absolute inset-0 rounded-lg border border-brd-2 bg-surface-2"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>

      {/* Right — theme toggle + badge */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-brd bg-surface text-tx-2 transition-all hover:border-brd-2 hover:text-tx"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <span className="hidden rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent-2 sm:block">
          MIT
        </span>
      </div>
    </nav>
  );
}
