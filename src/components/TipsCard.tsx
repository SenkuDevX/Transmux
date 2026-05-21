import { useState, useEffect } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export const EDUCATIONAL_TIPS = [
  {
    title: "MKV Matroska Shell",
    tag: "Nesting Star",
    color: "from-sky-500 to-indigo-500",
    text: "Named after Russian stacking dolls (Matryoshka). MKV is an open-standard extensible container capable of holding unlimited video, audio, multiple subtitle streams (like SRT or premium ASS files), menus, and chapters in one bundle."
  },
  {
    title: "MP4 Web Compliance",
    tag: "Streaming Standard",
    color: "from-indigo-500 to-purple-500",
    text: "Standardized by ISO based on standard Apple QuickTime specifications. While constrained for complex multi-language audio tracks, it is the absolute king of network direct playback compatibility across Safari, Chrome, iOS, and game consoles."
  },
  {
    title: "Audio Encoding Epochs",
    tag: "AAC vs MP3",
    color: "from-purple-500 to-pink-500",
    text: "MP3 launched standard digital audiophiles globally, but compresses poorly at low spatial densities. Advanced Audio Coding (AAC) succeeded MP3, with optimized psychoacoustic filtering giving superior acoustic preservation at identical bitrates."
  },
  {
    title: "Remuxing vs Transcoding",
    tag: "Zero Quality Loss",
    color: "from-emerald-500 to-teal-500",
    text: "Selecting 'Copy' or 'keep' options triggers standard zero-copy Remuxing (called Stream Copy). Instead of exhausting CPU re-writing pixels, it extracts intact content streams and updates the outer wrapper metadata index in milliseconds."
  },
  {
    title: "Studio-Grade Lossless Audio",
    tag: "FLAC & WAV archives",
    color: "from-pink-500 to-rose-500",
    text: "Swapping any multi-track video stream directly using FLAC/WAV audio tags handles extreme demuxing. It strips visual layers and structures uncompressed acoustic waveform segments at master-recording preservation accuracy levels."
  },
  {
    title: "The Genius of FFmpeg",
    tag: "Universal Engine",
    color: "from-amber-500 to-orange-500",
    text: "Founded by French programmer Fabrice Bellard in 2000. Under the hood of AI Studio's Transmux lies this legendary hyper-optimized software suite. Standard web platforms and digital televisions run FFmpeg on billions of cores daily."
  },
  {
    title: "Advanced Subtitles Styling",
    tag: "SRT vs SSA/ASS",
    color: "from-cyan-500 to-blue-500",
    text: "While SRT represents simple text paragraphs with time markers, advanced ASS/SSA (SubStation Alpha) specifications allow exact dynamic typesetting placement, custom font overrides, colored karaoke fades, and animated vectors."
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
