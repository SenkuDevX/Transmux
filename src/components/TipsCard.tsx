import { useState, useEffect } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export const EDUCATIONAL_TIPS = [
  {
    title: "Browser Extension Helper",
    tag: "Cookies Sync",
    color: "from-green-500 to-emerald-500",
    text: "Install the Transmux Chrome extension to automatically send fresh YouTube cookies when needed. It securely extracts cookies from your logged-in browser session and delivers them to the backend — no manual copying required."
  },
  {
    title: "Downloading Media",
    tag: "Stream Capture",
    color: "from-blue-500 to-indigo-500",
    text: "Paste any supported URL to analyze available formats. Transmux downloads the original stream, then re-encodes it to your chosen output format using FFmpeg. For best quality, select 'Best Available' and let the system choose."
  },
  {
    title: "Uploading to Gallery",
    tag: "Community Share",
    color: "from-purple-500 to-pink-500",
    text: "After conversion, you can publish your media to the public gallery. Published files get a shareable link and appear in the Panoramic Showroom feed for others to preview."
  },
  {
    title: "Meet the Creator",
    tag: "Open Source",
    color: "from-amber-500 to-orange-500",
    text: "Transmux (Project Saga) was built by SenkuDevX as an open-source media conversion platform. The entire codebase is available on GitHub — contributions, issues, and forks are welcome."
  },
  {
    title: "Download Speeds",
    tag: "Performance",
    color: "from-cyan-500 to-teal-500",
    text: "Download speed depends on the source server (YouTube, etc.) and your connection. Transmux uses yt-dlp with curl_cffi impersonation to maximize throughput. Large 4K videos may take several minutes."
  },
  {
    title: "Supported Sources",
    tag: "Compatibility",
    color: "from-violet-500 to-fuchsia-500",
    text: "Transmux supports YouTube, along with hundreds of other sites via yt-dlp. Paste any supported video URL to get started. File uploads are also supported for local media conversion."
  },
  {
    title: "Format Guide",
    tag: "Codec Tips",
    color: "from-rose-500 to-red-500",
    text: "MP4 with H.264 video + AAC audio offers the best compatibility across devices. MKV supports advanced subtitle embedding. For audio-only, Opus gives the best quality at low bitrates, while MP3 is universally compatible."
  }
];

export default function TipsCard() {
  const [currentTipIdx, setCurrentTipIdx] = useState(0);
  const [progressTimer, setProgressTimer] = useState(0);

  useEffect(() => {
    // Reset timer every slide change
    setProgressTimer(0);
  }, [currentTipIdx]);

  useEffect(() => {
    const intervalTime = 100; // update scale UI every 100ms
    const totalDuration = 20000; // 20 seconds
    const step = (intervalTime / totalDuration) * 100;

    const timer = setInterval(() => {
      setProgressTimer((prev) => {
        if (prev >= 100) {
          // Trigger next slide
          setCurrentTipIdx((idx) => (idx + 1) % EDUCATIONAL_TIPS.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  return (
    <div id="tips-educational-card" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-500" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-white font-sans uppercase tracking-wider">
            Media Handbook Tips
          </h4>
        </div>
        
        {/* Slide Navigation controls */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            type="button"
            onClick={() => setCurrentTipIdx((idx) => (idx - 1 + EDUCATIONAL_TIPS.length) % EDUCATIONAL_TIPS.length)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:text-slate-705 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="Previous Tip"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[9px] font-mono font-bold text-slate-400 select-none">
            {currentTipIdx + 1} / {EDUCATIONAL_TIPS.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentTipIdx((idx) => (idx + 1) % EDUCATIONAL_TIPS.length)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg hover:text-slate-705 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="Next Tip"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Carousel Slide Card wrapper */}
      <div className="relative overflow-hidden bg-slate-50/70 dark:bg-slate-950/45 border border-slate-250/50 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2.5 shadow-inner hover:bg-slate-50 dark:hover:bg-slate-950 transition-all">
        {/* Top Badge & Tag info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${EDUCATIONAL_TIPS[currentTipIdx].color}`}></span>
            <span className="font-extrabold font-mono text-[10.5px] text-slate-800 dark:text-slate-200">
              {EDUCATIONAL_TIPS[currentTipIdx].title}
            </span>
          </div>
          <span className="text-[9px] font-mono font-purple bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-100/30 dark:border-indigo-900/40">
            {EDUCATIONAL_TIPS[currentTipIdx].tag}
          </span>
        </div>

        {/* Slide Body text with subtle fade animation */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[70px] transition-opacity duration-300">
          {EDUCATIONAL_TIPS[currentTipIdx].text}
        </p>

        {/* Progress indicators dots layout with 20 second fill line */}
        <div className="pt-1.5 text-xs flex flex-col gap-1.5">
          {/* Circular or linear timer line */}
          <div className="w-full h-1 bg-slate-150 dark:bg-slate-850 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${EDUCATIONAL_TIPS[currentTipIdx].color} transition-all duration-100 ease-linear`}
              style={{ width: `${progressTimer}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 select-none">
            <span>Auto rotating</span>
            <span>{Math.ceil((20000 - (progressTimer / 100) * 20000) / 1000)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
