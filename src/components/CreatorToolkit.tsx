import { useState } from "react";
import { CreatorPreset, ConversionSettings } from "../types";
import { X, Youtube, Music, Video, Image, MessageCircle, Twitter, Podcast, Headphones, Film, Globe } from "lucide-react";

const PLATFORM_PRESETS: CreatorPreset[] = [
  {
    id: "youtube-1080",
    platform: "YouTube",
    category: "video",
    name: "YouTube Upload (1080p)",
    description: "H.264 1080p AAC — best compatibility for YouTube uploads",
    badge: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
    settings: {
      outputFormat: "mp4",
      videoCodec: "libx264",
      videoResolution: "1920x1080",
      videoFps: "30",
      videoBitrate: "8M",
      videoCrf: "23",
      audioCodec: "aac",
      audioBitrate: "192k",
      audioSampleRate: "48000",
      audioChannels: "2",
    },
  },
  {
    id: "youtube-4k",
    platform: "YouTube",
    category: "video",
    name: "YouTube Upload (4K)",
    description: "VP9 4K Opus — premium quality for YouTube",
    badge: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
    settings: {
      outputFormat: "webm",
      videoCodec: "vp9",
      videoResolution: "3840x2160",
      videoFps: "60",
      videoBitrate: "25M",
      videoCrf: "18",
      audioCodec: "opus",
      audioBitrate: "192k",
      audioSampleRate: "48000",
      audioChannels: "2",
    },
  },
  {
    id: "tiktok",
    platform: "TikTok",
    category: "video",
    name: "TikTok Reel",
    description: "Vertical 1080x1920 H.264 — optimized for TikTok",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    settings: {
      outputFormat: "mp4",
      videoCodec: "libx264",
      videoResolution: "1080x1920",
      videoFps: "30",
      videoBitrate: "5M",
      videoCrf: "23",
      audioCodec: "aac",
      audioBitrate: "128k",
      audioSampleRate: "44100",
      audioChannels: "2",
    },
  },
  {
    id: "instagram",
    platform: "Instagram",
    category: "video",
    name: "Instagram Reel",
    description: "Vertical 1080x1920 H.264 — Instagram ready",
    badge: "bg-pink-100 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-900",
    settings: {
      outputFormat: "mp4",
      videoCodec: "libx264",
      videoResolution: "1080x1920",
      videoFps: "30",
      videoBitrate: "4M",
      videoCrf: "23",
      audioCodec: "aac",
      audioBitrate: "128k",
      audioSampleRate: "44100",
      audioChannels: "2",
    },
  },
  {
    id: "discord-video",
    platform: "Discord",
    category: "video",
    name: "Discord Video Clip",
    description: "720p H.264 with 25MB size target",
    badge: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900",
    settings: {
      outputFormat: "mp4",
      videoCodec: "libx264",
      videoResolution: "1280x720",
      videoFps: "30",
      videoBitrate: "2M",
      videoCrf: "28",
      audioCodec: "aac",
      audioBitrate: "128k",
      audioSampleRate: "44100",
      audioChannels: "2",
      trimStart: "",
      trimEnd: "",
    },
  },
  {
    id: "discord-audio",
    platform: "Discord",
    category: "audio",
    name: "Discord Audio Clip",
    description: "MP3 128k — small size for Discord uploads",
    badge: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900",
    settings: {
      outputFormat: "mp3",
      audioCodec: "libmp3lame",
      audioBitrate: "128k",
      audioSampleRate: "44100",
      audioChannels: "2",
    },
  },
  {
    id: "twitter-clip",
    platform: "Twitter/X",
    category: "video",
    name: "Twitter/X Video",
    description: "720p H.264 — 512MB limit compatible",
    badge: "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900",
    settings: {
      outputFormat: "mp4",
      videoCodec: "libx264",
      videoResolution: "1280x720",
      videoFps: "30",
      videoBitrate: "4M",
      videoCrf: "23",
      audioCodec: "aac",
      audioBitrate: "128k",
      audioSampleRate: "44100",
      audioChannels: "2",
    },
  },
  {
    id: "podcast-mp3",
    platform: "Podcast",
    category: "audio",
    name: "Podcast Master (MP3)",
    description: "MP3 192k 44100Hz — standard podcast format",
    badge: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900",
    settings: {
      outputFormat: "mp3",
      audioCodec: "libmp3lame",
      audioBitrate: "192k",
      audioSampleRate: "44100",
      audioChannels: "2",
    },
  },
  {
    id: "podcast-aac",
    platform: "Podcast",
    category: "audio",
    name: "Podcast Master (AAC)",
    description: "AAC 128k 44100Hz — Apple Podcasts compatible",
    badge: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900",
    settings: {
      outputFormat: "m4a",
      audioCodec: "aac",
      audioBitrate: "128k",
      audioSampleRate: "44100",
      audioChannels: "2",
    },
  },
  {
    id: "gif",
    platform: "General",
    category: "gif",
    name: "High-Quality GIF",
    description: "720p 15fps GIF — for social media",
    badge: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900",
    settings: {
      outputFormat: "gif",
      videoCodec: "libx264",
      videoResolution: "1280x720",
      videoFps: "15",
      videoCrf: "18",
      audioCodec: "keep",
      audioBitrate: "keep",
      audioSampleRate: "keep",
      audioChannels: "keep",
      stripAudio: true,
    },
  },
  {
    id: "whatsapp",
    platform: "WhatsApp",
    category: "video",
    name: "WhatsApp Video",
    description: "480p H.264 — under 16MB for WhatsApp sharing",
    badge: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900",
    settings: {
      outputFormat: "mp4",
      videoCodec: "libx264",
      videoResolution: "854x480",
      videoFps: "30",
      videoBitrate: "1.5M",
      videoCrf: "28",
      audioCodec: "aac",
      audioBitrate: "96k",
      audioSampleRate: "44100",
      audioChannels: "2",
    },
  },
  {
    id: "telegram",
    platform: "Telegram",
    category: "video",
    name: "Telegram Video",
    description: "720p H.264 — under 2GB for Telegram",
    badge: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
    settings: {
      outputFormat: "mp4",
      videoCodec: "libx264",
      videoResolution: "1280x720",
      videoFps: "30",
      videoBitrate: "3M",
      videoCrf: "23",
      audioCodec: "aac",
      audioBitrate: "128k",
      audioSampleRate: "44100",
      audioChannels: "2",
    },
  },
  {
    id: "archive-lossless",
    platform: "Archive",
    category: "video",
    name: "Archive Master (Lossless)",
    description: "MKV with original quality preserved",
    badge: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    settings: {
      outputFormat: "mkv",
      videoCodec: "keep",
      videoResolution: "keep",
      videoFps: "keep",
      videoBitrate: "keep",
      videoCrf: "keep",
      audioCodec: "keep",
      audioBitrate: "keep",
      audioSampleRate: "keep",
      audioChannels: "keep",
    },
  },
];

const PLATFORM_ICONS: Record<string, any> = {
  YouTube: Youtube,
  TikTok: Music,
  Instagram: Image,
  Discord: MessageCircle,
  "Twitter/X": Twitter,
  Podcast: Podcast,
  WhatsApp: MessageCircle,
  Telegram: Film,
  Archive: Globe,
  General: Video,
};

interface CreatorToolkitProps {
  open: boolean;
  onClose: () => void;
  onApplyPreset: (settings: Partial<ConversionSettings>) => void;
}

export default function CreatorToolkit({ open, onClose, onApplyPreset }: CreatorToolkitProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = ["all", "video", "audio", "gif"];
  const filtered = activeCategory === "all"
    ? PLATFORM_PRESETS
    : PLATFORM_PRESETS.filter((p) => p.category === activeCategory);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Video className="h-4 w-4 text-amber-500" />
            Creator Toolkit — Platform Presets
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 px-4 pt-3 pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer capitalize ${
                activeCategory === cat
                  ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              }`}
            >
              {cat === "all" ? "All" : cat === "gif" ? "GIF" : `${cat}s`}
            </button>
          ))}
        </div>

        {/* Presets grid */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filtered.map((preset) => {
              const Icon = PLATFORM_ICONS[preset.platform] || Video;
              return (
                <button
                  key={preset.id}
                  onClick={() => { onApplyPreset(preset.settings); onClose(); }}
                  className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/50 dark:hover:bg-amber-950/10 transition-all text-left cursor-pointer"
                >
                  <div className={`p-2 rounded-lg border shrink-0 ${preset.badge}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{preset.name}</p>
                      <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${preset.badge}`}>{preset.platform}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">{preset.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {preset.settings.outputFormat && (
                        <span className="text-[8px] px-1 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-mono">
                          {preset.settings.outputFormat.toUpperCase()}
                        </span>
                      )}
                      {preset.settings.videoResolution && preset.settings.videoResolution !== "keep" && (
                        <span className="text-[8px] px-1 py-0.5 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded font-mono">
                          {preset.settings.videoResolution}
                        </span>
                      )}
                      {preset.settings.videoCodec && preset.settings.videoCodec !== "keep" && (
                        <span className="text-[8px] px-1 py-0.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded font-mono">
                          {preset.settings.videoCodec}
                        </span>
                      )}
                      {preset.settings.audioBitrate && preset.settings.audioBitrate !== "keep" && (
                        <span className="text-[8px] px-1 py-0.5 bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded font-mono">
                          {preset.settings.audioBitrate}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">No presets found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
