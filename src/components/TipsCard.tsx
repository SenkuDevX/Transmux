import { useState, useEffect } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export const EDUCATIONAL_TIPS = [
  {
    title: "Downloading Videos",
    tag: "Stream Capture",
    color: "from-blue-500 to-indigo-500",
    text: "Paste any supported URL to analyze available formats. Transmux downloads the original stream and re-encodes it to your chosen output using FFmpeg."
  },
  {
    title: "Uploading to Gallery",
    tag: "Community Share",
    color: "from-purple-500 to-pink-500",
    text: "After conversion you can publish your media to the public gallery. Published files get a shareable link and appear in the feed for others."
  },
  {
    title: "Meet the Creator",
    tag: "Open Source",
    color: "from-amber-500 to-orange-500",
    text: "Transmux (Project Saga) was built by SenkuDevX as an open-source media conversion platform. The codebase is on GitHub."
  },
  {
    title: "Download Speeds",
    tag: "Performance",
    color: "from-cyan-500 to-teal-500",
    text: "Speed depends on the source server and your connection. Large 4K videos can take several minutes. A stable stable connection helps."
  },
  {
    title: "Supported Sources",
    tag: "Compatibility",
    color: "from-violet-500 to-fuchsia-500",
    text: "Transmux supports YouTube and hundreds of other sites via yt-dlp. Paste any supported video URL or upload a local file."
  },
  {
    title: "Format Guide",
    tag: "Codec Tips",
    color: "from-rose-500 to-red-500",
    text: "MP4 with H.264 + AAC offers the best compatibility. MKV supports advanced subtitle embedding. For audio-only Opus gives best quality."
  },
  {
    title: "MKV Container",
    tag: "Nesting Star",
    color: "from-sky-500 to-indigo-500",
    text: "MKV is an open-standard container that can hold unlimited video audio and subtitle streams plus chapters and menus in one file."
  },
  {
    title: "MP4 Standard",
    tag: "Streaming",
    color: "from-indigo-500 to-purple-500",
    text: "MP4 is the king of direct playback across Safari Chrome iOS and game consoles. It is standardized by ISO."
  },
  {
    title: "AAC vs MP3",
    tag: "Audio Encoding",
    color: "from-purple-500 to-pink-500",
    text: "AAC succeeded MP3 with optimized psychoacoustic filtering giving superior quality at identical bitrates."
  },
  {
    title: "Remuxing vs Transcoding",
    tag: "Zero Quality Loss",
    color: "from-emerald-500 to-teal-500",
    text: "Selecting Copy triggers remuxing instead of re-encoding. It extracts intact streams and updates the container metadata in milliseconds."
  },
  {
    title: "Lossless Audio",
    tag: "FLAC & WAV",
    color: "from-pink-500 to-rose-500",
    text: "FLAC compresses audio without any quality loss. WAV is uncompressed. Both preserve master-recording accuracy."
  },
  {
    title: "FFmpeg Engine",
    tag: "Universal Tool",
    color: "from-amber-500 to-orange-500",
    text: "Founded by Fabrice Bellard in 2000 FFmpeg runs on billions of devices daily. Transmux uses it under the hood."
  },
  {
    title: "SRT vs ASS Subtitles",
    tag: "Text Styles",
    color: "from-cyan-500 to-blue-500",
    text: "SRT is simple text with time markers. ASS allows custom fonts colors positioning and animated karaoke effects."
  },
  {
    title: "Bitrate Explained",
    tag: "Quality vs Size",
    color: "from-green-500 to-emerald-500",
    text: "Higher bitrate means better quality but larger file size. For music 128-320 kbps is typical. For video it varies by resolution."
  },
  {
    title: "Resolution Guide",
    tag: "SD HD 4K",
    color: "from-yellow-500 to-orange-500",
    text: "480p is standard definition 720p/1080p is HD and 2160p is 4K Ultra HD. Higher resolution needs more bandwidth."
  },
  {
    title: "Frame Rate",
    tag: "FPS",
    color: "from-red-500 to-rose-500",
    text: "24 fps is cinematic 30 fps is standard video and 60 fps is smooth for gaming and sports. Higher fps looks smoother but needs more processing."
  },
  {
    title: "Internet Downloading",
    tag: "How It Works",
    color: "from-blue-500 to-sky-500",
    text: "When you paste a URL the system fetches the media stream from the source server. The download speed depends on your connection to that server."
  },
  {
    title: "File Uploading",
    tag: "Local Media",
    color: "from-teal-500 to-cyan-500",
    text: "You can upload local files for conversion too. The file is stored temporarily and processed the same way as URL downloads."
  },
  {
    title: "What is Transcoding",
    tag: "Conversion",
    color: "from-indigo-500 to-violet-500",
    text: "Transcoding converts media from one format to another. It decompresses the source then re-encodes it to your chosen output format."
  },
  {
    title: "Storage & Cleanup",
    tag: "Auto Delete",
    color: "from-slate-500 to-gray-500",
    text: "Converted files are automatically deleted after some time to save space. Always download your files before the cleanup runs."
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
