'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Link, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { fetchUrlInfo } from '@/lib/api';

export default function UrlInput() {
  const { urlInput, setUrlInput, urlMetadata, setUrlMetadata } = useAppStore();
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    if (!urlInput.trim()) return toast.error('Enter a URL first');

    setLoading(true);
    try {
      const { metadata } = await fetchUrlInfo(urlInput.trim());
      setUrlMetadata({ ...metadata, url: urlInput.trim() });
      toast.success(`Found: ${(metadata as any).title || 'Media'}`);
    } catch {
      // If metadata fetch fails, just store the URL directly - conversion can still work
      setUrlMetadata({ url: urlInput.trim(), title: urlInput.split('/').pop() || 'Media' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-3" />
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://... (YouTube, Vimeo, SoundCloud — content you own)"
            className="w-full rounded-xl border border-brd bg-bg-2 py-3 pl-9 pr-4 font-mono text-sm text-tx outline-none transition-colors placeholder:text-tx-3 focus:border-accent"
          />
        </div>
        <button
          onClick={handleFetch}
          disabled={loading || !urlInput.trim()}
          className="flex items-center gap-2 rounded-xl border border-brd-2 bg-surface px-5 py-3 text-sm font-semibold transition-all hover:border-accent hover:bg-accent/10 hover:text-accent-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : '↗'}
          Fetch
        </button>
      </div>

      {/* URL metadata preview */}
      <AnimatePresence>
        {urlMetadata && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded-xl border border-brd bg-bg-2 p-4"
          >
            <div className="mb-3 flex items-start gap-3">
              {(urlMetadata as any).thumbnail && (
                <img
                  src={(urlMetadata as any).thumbnail}
                  alt="thumbnail"
                  className="h-16 w-24 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1 truncate text-sm font-semibold">
                  {(urlMetadata as any).title || 'Unknown title'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(urlMetadata as any).duration && (
                    <span className="rounded-md border border-brd bg-surface px-2 py-0.5 font-mono text-[11px] text-tx-2">
                      {Math.floor((urlMetadata as any).duration / 60)}:{String((urlMetadata as any).duration % 60).padStart(2, '0')}
                    </span>
                  )}
                  {(urlMetadata as any).width && (
                    <span className="rounded-md border border-brd bg-surface px-2 py-0.5 font-mono text-[11px] text-tx-2">
                      {(urlMetadata as any).width}×{(urlMetadata as any).height}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setUrlMetadata(null); setUrlInput(''); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
              >
                ✕
              </button>
            </div>

            {/* Available formats */}
            {(urlMetadata as any).availableFormats?.length > 0 && (
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-tx-3">Available formats</div>
                <div className="flex flex-wrap gap-1.5">
                  {(urlMetadata as any).availableFormats.slice(0, 8).map((f: any) => (
                    <span key={f.formatId} className="rounded-md border border-brd bg-surface px-2 py-1 font-mono text-[11px] text-tx-2">
                      {f.label || f.ext}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
