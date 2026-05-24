import { useState, useEffect } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export const EDUCATIONAL_TIPS = [
  {
    title: "Install the Browser Extension",
    tag: "Essential",
    color: "from-indigo-500 to-purple-500",
    text: "The Transmux Cookie Relay extension eliminates YouTube bot blocks. Install it, and cookies are auto-synced when needed — no manual pasting. Your cookies stay encrypted and are used only for your own conversions."
  },
  {
    title: "Best Format for Compatibility",
    tag: "Format Guide",
    color: "from-blue-500 to-indigo-500",
    text: "MP4 with H.264 video + AAC audio works on every device: iPhone, Android, Windows, Mac, smart TVs, and game consoles. Use MKV if you need multiple subtitle tracks."
  },
  {
    title: "Remux for Instant Conversion",
    tag: "Zero Quality Loss",
    color: "from-emerald-500 to-teal-500",
    text: "Selecting Copy for codec triggers remuxing instead of re-encoding. It takes seconds instead of minutes and preserves 100% of the original quality. Use this when you only need to change container format."
  },
  {
    title: "Best Audio Format by Use Case",
    tag: "Audio Encoding",
    color: "from-purple-500 to-pink-500",
    text: "Opus gives best quality at low bitrates (great for streaming). AAC is most compatible (iTunes, Android). FLAC is lossless (archiving). MP3 works everywhere but is outdated."
  },
  {
    title: "Cookie Auto-Sync Flow",
    tag: "YouTube Fix",
    color: "from-amber-500 to-orange-500",
    text: "When YouTube blocks a download, Transmux pauses and opens the cookie modal. If the extension is installed, it auto-sends cookies in under a second. If not, you have 8 seconds to paste manually."
  },
  {
    title: "4K Downloads Need Patience",
    tag: "Performance",
    color: "from-cyan-500 to-teal-500",
    text: "A 4K video can be 5-15GB. The server downloads with 32 parallel fragments using aria2c. Even on fast connections, expect 3-10 minutes for large 4K files."
  },
  {
    title: "Lower CRF = Better Quality",
    tag: "Video Encoding",
    color: "from-rose-500 to-red-500",
    text: "CRF (Constant Rate Factor) controls video quality: 12 is near-lossless, 18 is visually transparent, 28 is good for web uploads. Each increment of 6 roughly doubles file size."
  },
  {
    title: "Trim Before Converting",
    tag: "Save Time",
    color: "from-green-500 to-emerald-500",
    text: "Use trim presets (First 15s, 30s, 60s) to convert only the segment you need. This dramatically reduces processing time and file size. The visual timeline shows your selection."
  },
  {
    title: "YouTube Thumbnail as Cover Art",
    tag: "Album Art",
    color: "from-pink-500 to-rose-500",
    text: "When converting YouTube to MP3/FLAC/Opus, Transmux automatically downloads the highest-res thumbnail and embeds it as cover art. No manual tagging needed."
  },
  {
    title: "Subtitle Languages",
    tag: "Subtitles",
    color: "from-violet-500 to-fuchsia-500",
    text: "Transmux downloads ALL available subtitle languages from YouTube (both manual and auto-generated). They're converted to SRT format and burned into the output video."
  },
  {
    title: "Bitrate vs Quality",
    tag: "Size Tradeoff",
    color: "from-yellow-500 to-orange-500",
    text: "128kbps MP3 is acceptable for podcasts. 192-256kbps is good for music. 320kbps is indistinguishable from lossless for most people. For video, bitrate varies by resolution and codec."
  },
  {
    title: "Frame Rate Guide",
    tag: "FPS",
    color: "from-red-500 to-rose-500",
    text: "24fps = cinematic (movies). 30fps = standard (TV, YouTube). 60fps = smooth (gaming, sports). Converting from 60 to 30fps drops half the frames but can look choppy."
  },
  {
    title: "Resolution Scaling",
    tag: "Video Size",
    color: "from-sky-500 to-indigo-500",
    text: "Downscaling 4K to 1080p reduces file size ~75% with minimal quality loss. Upscaling 720p to 4K doesn't add real detail — it just makes the file bigger. Always prefer original resolution."
  },
  {
    title: "AV1 vs H.265 vs H.264",
    tag: "Codec Battle",
    color: "from-blue-500 to-cyan-500",
    text: "H.264: widest compatibility. H.265/HEVC: ~50% better compression than H.264. AV1: ~30% better than H.265 but very slow to encode. For quick conversions, stick with H.264."
  },
  {
    title: "Media Cleanup Schedule",
    tag: "Storage",
    color: "from-slate-500 to-gray-500",
    text: "All converted files are automatically deleted after 1 hour. Published gallery items also expire after 1 hour. Always download your results before they're cleaned up."
  },
  {
    title: "Why Use the Extension?",
    tag: "Privacy",
    color: "from-emerald-500 to-green-500",
    text: "The extension only activates when Transmux requests cookies. It sends them directly to the server via encrypted HTTPS. They're used ONLY for your current job and never stored or logged."
  },
  {
    title: "Batch Playlist Conversion",
    tag: "Power User",
    color: "from-indigo-500 to-violet-500",
    text: "Paste a YouTube playlist URL and Transmux detects it automatically. Convert up to 50 videos at once. All outputs are packaged into a single ZIP file for easy download."
  },
  {
    title: "Audio Channels Explained",
    tag: "Sound Setup",
    color: "from-purple-500 to-pink-500",
    text: "Mono: single channel (podcasts). Stereo: two channels (music, standard video). 5.1 Surround: six channels (movies). Converting stereo to 5.1 doesn't create real surround."
  },
  {
    title: "Sample Rate Matters",
    tag: "Audio Quality",
    color: "from-cyan-500 to-teal-500",
    text: "44.1kHz is CD quality. 48kHz is standard for video. 96kHz is studio-grade but files are much larger. Upsampling doesn't add quality — stick with the source sample rate."
  },
  {
    title: "The Server Stack",
    tag: "Behind the Scenes",
    color: "from-amber-500 to-orange-500",
    text: "Node.js + Express handles requests. FFmpeg transcodes. yt-dlp extracts media from 1000+ sites. aria2c accelerates downloads. curl_cffi impersonates Chrome-136 browser. All open-source."
  },
  {
    title: "Use Size Targets for Platform Limits",
    tag: "Smart Compression",
    color: "from-red-500 to-pink-500",
    text: "Discord: 25MB limit. WhatsApp: 16MB. Email: 10-25MB. Use Smart Compression's target size dropdown to auto-tune settings. The server adjusts bitrate, CRF, and resolution to fit."
  },
  {
    title: "Preview Before Full Export",
    tag: "Save Time",
    color: "from-cyan-500 to-blue-500",
    text: "Use the Preview popup on completed jobs to inspect quality before downloading. For video, the native player shows exact output. For audio, the waveform + spinning vinyl visualization confirms quality."
  },
  {
    title: "Batch Recipes for Repeated Tasks",
    tag: "Power User",
    color: "from-fuchsia-500 to-purple-500",
    text: "Save your most-used settings as Batch Recipes. Trim intro + normalize audio + convert to H.264 — save as one recipe and apply with one click. Recipes are stored in your browser's localStorage."
  },
  {
    title: "Use Queue Jobs for Heavy Files",
    tag: "Performance",
    color: "from-orange-500 to-amber-500",
    text: "Large 4K videos can take 10+ minutes. Send them to the queue and let the server process them in priority order. Short jobs jump ahead automatically. Check progress anytime."
  },
  {
    title: "Keep Originals When Testing Quality",
    tag: "Best Practice",
    color: "from-blue-500 to-indigo-500",
    text: "Always keep the original file when testing different quality settings. The server never modifies originals — each conversion creates a new output file. Compare size and visual quality side-by-side."
  },
  {
    title: "Smart Compression for Platform Limits",
    tag: "Size Targeting",
    color: "from-emerald-500 to-teal-500",
    text: "Use Smart Compression's target size dropdown to fit files under platform limits: 25MB for Discord, 16MB for WhatsApp, 10MB for email. The server auto-tunes bitrate, CRF, and resolution."
  },
  {
    title: "Subtitles as Selectable Tracks",
    tag: "Best Practice",
    color: "from-violet-500 to-fuchsia-500",
    text: "When possible, keep subtitles as selectable tracks (MKV with copy codec) rather than burning them into the video. Selectable subs retain language info, can be toggled off, and preserve original formatting."
  },
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
