import React, { useState, useEffect } from "react";
import { Sliders, Video, Music, Scissors, VolumeX, RefreshCw, AlertTriangle } from "lucide-react";
import { ConversionSettings } from "../types";

interface TranscodeSettingsProps {
  onStartConversion: (settings: ConversionSettings) => void;
  isProcessing: boolean;
  sourceType: "file" | "url";
  initialDuration?: number;
  sourceMetadata?: any;
  selectedFormatId?: string;
}

export default function TranscodeSettings({ 
  onStartConversion, 
  isProcessing, 
  sourceType, 
  initialDuration,
  sourceMetadata,
  selectedFormatId
}: TranscodeSettingsProps) {
  // Tabs: 'video' | 'audio'
  const [activeTab, setActiveTab] = useState<"video" | "audio">("video");
  
  // Local Conversion Settings state
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [videoCodec, setVideoCodec] = useState("keep");
  const [videoResolution, setVideoResolution] = useState("keep");
  const [videoFps, setVideoFps] = useState("keep");
  const [videoBitrate, setVideoBitrate] = useState("keep");
  const [videoCrf, setVideoCrf] = useState("keep");
  
  const [audioCodec, setAudioCodec] = useState("keep");
  const [audioBitrate, setAudioBitrate] = useState("keep");
  const [audioSampleRate, setAudioSampleRate] = useState("keep");
  const [audioChannels, setAudioChannels] = useState("keep");
  
  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");
  const [stripAudio, setStripAudio] = useState(false);
  const [burnSubtitles, setBurnSubtitles] = useState(false);
  const [qualityPreset, setQualityPreset] = useState("keep");
  const [trimError, setTrimError] = useState<string | null>(null);

  // Helper: analyze media stream specs for validation warnings
  const getSourceSpecs = () => {
    if (!sourceMetadata) return null;
    
    let resolution: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let fps: number | null = null;
    let sampleRate: number | null = null;
    let channels: number | null = null;
    let codec: string | null = null;
    let audioCodec: string | null = null;

    if (sourceType === "file") {
      resolution = sourceMetadata.video?.resolution || null;
      if (resolution) {
        const parts = resolution.split("x").map(Number);
        if (parts.length === 2) {
          width = parts[0];
          height = parts[1];
        }
      }
      sampleRate = sourceMetadata.audio?.sampleRate || null;
      channels = sourceMetadata.audio?.channels || null;
      codec = sourceMetadata.video?.codec || null;
      audioCodec = sourceMetadata.audio?.codec || null;
    } else if (sourceType === "url" && sourceMetadata.formats) {
      const formats = sourceMetadata.formats as any[];
      const activeFmt = formats.find(f => f.formatId === selectedFormatId) || formats[0];
      if (activeFmt) {
        resolution = activeFmt.resolution && activeFmt.resolution !== "audio-only" ? activeFmt.resolution : null;
        if (resolution) {
          const parts = resolution.split("x").map(Number);
          if (parts.length === 2) {
            width = parts[0];
            height = parts[1];
          }
        }
        codec = activeFmt.videoCodec && activeFmt.videoCodec !== "none" ? activeFmt.videoCodec : null;
        audioCodec = activeFmt.audioCodec && activeFmt.audioCodec !== "none" ? activeFmt.audioCodec : null;
        // Search note for frame rate
        const fpsMatch = activeFmt.note?.match(/(\d+)\s*fps/i) || activeFmt.resolution?.match(/@(\d+)fps/i);
        if (fpsMatch) fps = parseInt(fpsMatch[1]);
      }
    }
    return { resolution, width, height, fps, sampleRate, channels, codec, audioCodec };
  };

  const getValidationWarnings = () => {
    const specs = getSourceSpecs();
    if (!specs) return [];

    const warnings: string[] = [];

    // 1. Resolution Upscaling check
    if (activeTab === "video" && videoResolution !== "keep" && specs.resolution) {
      const targetParts = videoResolution.split("x").map(Number);
      if (targetParts.length === 2 && specs.width && specs.height) {
        const targetW = targetParts[0];
        const targetH = targetParts[1];
        if (targetW > specs.width || targetH > specs.height) {
          warnings.push(`Upscaling Resolution Alert: Target output is ${videoResolution}, but the source stream resolution is only ${specs.resolution}. Artificially stretching pixels multiplies output size without actual improvement in visual clarity.`);
        }
      }
    }

    // 2. Framerate limit check
    if (activeTab === "video" && videoFps !== "keep" && specs.fps) {
      const targetFps = parseInt(videoFps);
      if (!isNaN(targetFps) && targetFps > specs.fps) {
        warnings.push(`Framerate Interpolation Warning: Chosen framerate is ${targetFps} FPS, but the source media is recorded at ${specs.fps} FPS. Artificially compounding frames will swell container size unnecessarily.`);
      }
    }

    // 3. Audio Channels up-mixing
    if (audioChannels !== "keep" && specs.channels) {
      const targetChannels = parseInt(audioChannels);
      if (!isNaN(targetChannels) && specs.channels < targetChannels) {
        warnings.push(`Audio Channels Expansion: Target channel is ${targetChannels === 6 ? "5.1 Surround" : "Stereo"}, which is larger than the original source's ${specs.channels === 1 ? "Mono" : "Stereo"} channels. Standard FFmpeg will duplicate identical tracks on surrounding speakers rather than true directional surround sound.`);
      }
    }

    // 4. Audio Sample Rate check
    if (audioSampleRate !== "keep" && specs.sampleRate) {
      const targetHz = parseInt(audioSampleRate);
      if (!isNaN(targetHz) && targetHz > specs.sampleRate) {
        warnings.push(`Acoustic Sampling Upsampler: Chosen frequency is ${targetHz.toLocaleString()} Hz but the source is captured at ${specs.sampleRate.toLocaleString()} Hz. Re-sampling to high rates will not reconstruct missing master frequencies and increases storage usage.`);
      }
    }

    // 5. Lossless Archival size warning
    if (activeTab === "video" && videoCrf === "12") {
      warnings.push(`Extreme Storage Preset: Constant Rate Factor (CRF 12) generates near-lossless archival files. Ensure you have high cache space, as this can result in massive file sizes.`);
    }

    return warnings;
  };

  // Helper: convert string duration '00:01:30' or '90' to seconds
  const parseTimeToSeconds = (timeStr: string): number | null => {
    if (!timeStr || timeStr.trim() === "") return null;
    const clean = timeStr.trim();
    if (/^\d+(\.\d+)?$/.test(clean)) {
      return parseFloat(clean);
    }
    const parts = clean.split(":").map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return null;
  };

  // Helper: convert numeric seconds to 'HH:MM:SS' string
  const formatSecondsToTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    const hStr = h.toString().padStart(2, "0");
    const mStr = m.toString().padStart(2, "0");
    const sStr = s.toString().padStart(2, "0");
    
    return `${hStr}:${mStr}:${sStr}`;
  };

  // Synchronize formats when tabs change
  useEffect(() => {
    if (activeTab === "audio") {
      setOutputFormat("mp3");
    } else {
      setOutputFormat("mp4");
    }
  }, [activeTab]);

  const triggerConversion = () => {
    setTrimError(null);

    const startSec = parseTimeToSeconds(trimStart);
    const endSec = parseTimeToSeconds(trimEnd);

    if (trimStart !== "" && startSec === null) {
      setTrimError("Invalid 'Trim From' timestamp. Use seconds (e.g. 90) or HH:MM:SS format (e.g. 01:30).");
      return;
    }
    if (trimEnd !== "" && endSec === null) {
      setTrimError("Invalid 'Trim To' timestamp. Use seconds (e.g. 180) or HH:MM:SS format (e.g. 03:00).");
      return;
    }

    if (startSec !== null && startSec < 0) {
      setTrimError("Start trim time cannot be negative.");
      return;
    }

    if (initialDuration) {
      if (startSec !== null && startSec > initialDuration) {
        setTrimError(`Start trim time (${formatSecondsToTime(startSec)}) is greater than total duration (${formatSecondsToTime(initialDuration)}).`);
        return;
      }
      if (endSec !== null && endSec > initialDuration) {
        setTrimError(`End trim time (${formatSecondsToTime(endSec)}) is greater than total duration (${formatSecondsToTime(initialDuration)}).`);
        return;
      }
    }

    if (startSec !== null && endSec !== null && startSec >= endSec) {
      setTrimError("Start trim time must be strictly less than the end trim time.");
      return;
    }

    onStartConversion({
      outputFormat,
      audioBitrate,
      audioSampleRate,
      audioChannels,
      videoResolution,
      videoFps,
      videoCodec,
      audioCodec,
      videoBitrate,
      videoCrf,
      trimStart,
      trimEnd,
      burnSubtitles,
      stripAudio,
      selectedFormatId: "best" // handled locally in parent component
    });
  };

  const videoFormats = ["mp4", "mkv", "webm", "mov", "avi"];
  const audioFormats = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "opus"];

  return (
    <div id="transcode-settings-form" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Sliders className="h-5 w-5 text-slate-900 dark:text-slate-100" />
        <h2 className="text-base font-bold text-slate-900 dark:text-white font-sans">Conversion Parameters & Settings</h2>
      </div>

      {/* Target Media Type Tabs */}
      <div id="settings-type-tabs" className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          id="tab-video"
          onClick={() => setActiveTab("video")}
          className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "video"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700"
              : "text-slate-500 hover:text-slate-955 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Video className="h-3.5 w-3.5" />
          <span>Video Output</span>
        </button>
        <button
          type="button"
          id="tab-audio"
          onClick={() => setActiveTab("audio")}
          className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "audio"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700"
              : "text-slate-500 hover:text-slate-955 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Music className="h-3.5 w-3.5" />
          <span>Audio Output</span>
        </button>
      </div>

      {/* Output Format Container Selection */}
      <div id="format-selection" className="space-y-2">
        <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Output Container Format (Extension)
        </label>
        <div id="format-selection-chips" className="flex flex-wrap gap-2">
          {(activeTab === "video" ? videoFormats : audioFormats).map((fmt) => (
            <button
              type="button"
              id={`format-chip-${fmt}`}
              key={fmt}
              onClick={() => setOutputFormat(fmt)}
              className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-xl border transition-all cursor-pointer ${
                outputFormat === fmt
                  ? "border-2 border-slate-900 bg-slate-50 text-slate-900 dark:border-slate-100 dark:bg-slate-800 dark:text-slate-100"
                  : "border-slate-200 hover:border-slate-350 bg-white text-slate-550 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              .{fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Quality Presets Selector (Downgrade or Optimize) */}
      <div id="quality-presets-container" className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Saga Compression & Quality Presets
          </label>
          {qualityPreset === "low" && (
            <span className="text-[9px] font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 px-1.5 py-0.5 rounded animate-pulse">
              Extreme Downgrade Active
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { id: "keep", label: "Copy (Lossless)", desc: "Direct container shift", color: "border-slate-300 hover:border-slate-800 text-slate-800 bg-slate-50" },
            { id: "high", label: "High (HD)", desc: "1080p, AAC 256k", color: "border-emerald-200 hover:border-emerald-400 text-emerald-800 bg-emerald-50" },
            { id: "medium", label: "Medium (SD)", desc: "720p, AAC 192k", color: "border-blue-200 hover:border-blue-400 text-blue-800 bg-blue-50" },
            { id: "low", label: "Downgrade (Low)", desc: "360p Mono, AAC 96k", color: "border-amber-200 hover:border-amber-400 text-amber-800 bg-amber-50" },
          ].map((preset) => {
            const isSelected = qualityPreset === preset.id;
            return (
              <button
                type="button"
                key={preset.id}
                onClick={() => {
                  setQualityPreset(preset.id);
                  if (preset.id === "keep") {
                    setVideoCodec("keep");
                    setVideoResolution("keep");
                    setVideoFps("keep");
                    setVideoCrf("keep");
                    setAudioCodec("keep");
                    setAudioBitrate("keep");
                    setAudioSampleRate("keep");
                    setAudioChannels("keep");
                  } else if (preset.id === "high") {
                    setVideoCodec("libx264");
                    setVideoResolution("1920x1080");
                    setVideoFps("30");
                    setVideoCrf("18"); // high quality
                    setAudioCodec("aac");
                    setAudioBitrate("256k");
                    setAudioSampleRate("48000");
                    setAudioChannels("2");
                  } else if (preset.id === "medium") {
                    setVideoCodec("libx264");
                    setVideoResolution("1280x720");
                    setVideoFps("30");
                    setVideoCrf("23"); // balanced
                    setAudioCodec("aac");
                    setAudioBitrate("192k");
                    setAudioSampleRate("44100");
                    setAudioChannels("2");
                  } else if (preset.id === "low") {
                    // Extreme Downgrade to lower quality & compressed size
                    setVideoCodec("libx264");
                    setVideoResolution("640x360"); // down resolution
                    setVideoFps("24"); // down frame rate
                    setVideoCrf("28"); // compression factor
                    setAudioCodec("aac");
                    setAudioBitrate("128k"); // standard downgrade
                    setAudioSampleRate("32000"); // lower sampling rate
                    setAudioChannels("1"); // Downmix trigger channel to mono
                  }
                }}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? "border-2 border-slate-900 bg-slate-55 dark:bg-slate-800 dark:border-white shadow-sm ring-2 ring-slate-100/50"
                    : "border-slate-200 hover:border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700"
                }`}
              >
                <span className={`text-xs font-bold leading-none ${isSelected ? "text-slate-950 dark:text-white" : "text-slate-800 dark:text-slate-200"}`}>
                  {preset.label}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block leading-tight">
                  {preset.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conditional Advanced Options Panel */}
      <div id="settings-group-container" className="space-y-5">
        
        {/* VIDEO ENCODING PANEL (Only visible if video tab is active) */}
        {activeTab === "video" && (
          <div id="video-parameters-box" className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white font-sans flex items-center gap-1.5">
              <span>Video Encoder Profiles (H.264, VP9 etc)</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400">Target Video Codec</label>
                <select
                  id="select-video-codec"
                  value={videoCodec}
                  onChange={(e) => setVideoCodec(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="keep" className="bg-white dark:bg-slate-900">Keep Source Codec (Remux/Copy)</option>
                  <option value="libx264" className="bg-white dark:bg-slate-900">H.264 (AVC - Universal standard)</option>
                  <option value="libx265" className="bg-white dark:bg-slate-900">H.265 (HEVC - High efficiency)</option>
                  <option value="libvpx-vp9" className="bg-white dark:bg-slate-900">VP9 (WebM web format)</option>
                  <option value="libaom-av1" className="bg-white dark:bg-slate-900">AV1 (Next-Gen high compression ratio)</option>
                  <option value="prores" className="bg-white dark:bg-slate-900">Apple ProRes (High-End Studio Archive)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400">Resize Resolution</label>
                <select
                  id="select-resolution"
                  value={videoResolution}
                  onChange={(e) => setVideoResolution(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="keep" className="bg-white dark:bg-slate-900">Keep Original Resolution</option>
                  <option value="3840x2160" className="bg-white dark:bg-slate-900">4K Ultra HD (3840x2160)</option>
                  <option value="2560x1440" className="bg-white dark:bg-slate-900">2K QHD (2560x1440)</option>
                  <option value="1920x1080" className="bg-white dark:bg-slate-900">1080p Full HD (1920x1080)</option>
                  <option value="1280x720" className="bg-white dark:bg-slate-900">720p HD Ready (1280x720)</option>
                  <option value="854x480" className="bg-white dark:bg-slate-900">480p Wide SD (854x480)</option>
                  <option value="640x360" className="bg-white dark:bg-slate-900">360p Mobile SD (640x360)</option>
                  <option value="426x240" className="bg-white dark:bg-slate-900">240p Retro Low SD (426x240)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400">Frame Rate (FPS)</label>
                <select
                  id="select-fps"
                  value={videoFps}
                  onChange={(e) => setVideoFps(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="keep" className="bg-white dark:bg-slate-900">Keep Original Framerate</option>
                  <option value="120" className="bg-white dark:bg-slate-900">120 FPS (Ultra Smooth/High-Speed)</option>
                  <option value="60" className="bg-white dark:bg-slate-900">60 FPS (Super Smooth)</option>
                  <option value="30" className="bg-white dark:bg-slate-900">30 FPS (Standard Web)</option>
                  <option value="24" className="bg-white dark:bg-slate-900">24 FPS (Cinematic standard)</option>
                  <option value="15" className="bg-white dark:bg-slate-900">15 FPS (Time-lapse/Industrial)</option>
                  <option value="12" className="bg-white dark:bg-slate-900">12 FPS (Retro/Stop-motion)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400">Constant Rate Factor (CRF)</label>
                <select
                  id="select-crf"
                  value={videoCrf}
                  onChange={(e) => setVideoCrf(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
                >
                  <option value="keep" className="bg-white dark:bg-slate-900">Default Encoding Balance (23)</option>
                  <option value="12" className="bg-white dark:bg-slate-900">Studio Archival Lossless (12)</option>
                  <option value="18" className="bg-white dark:bg-slate-900">Visual lossless preset compressed (18)</option>
                  <option value="21" className="bg-white dark:bg-slate-900">High visual output quality (21)</option>
                  <option value="28" className="bg-white dark:bg-slate-900">Medium Compression output (28)</option>
                  <option value="32" className="bg-white dark:bg-slate-900">High Space-saving Compression (32)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* AUDIO ENCODING PANEL */}
        <div id="audio-parameters-box" className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-5">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white font-sans">
            Audio Stream Settings
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-slate-400">Audio Codec</label>
              <select
                id="select-audio-codec"
                value={audioCodec}
                onChange={(e) => setAudioCodec(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
              >
                <option value="keep" className="bg-white dark:bg-slate-900">Default Core Codec</option>
                {outputFormat === "mp3" && <option value="libmp3lame" className="bg-white dark:bg-slate-900">MP3 Encoder (LAME)</option>}
                {(outputFormat === "aac" || outputFormat === "mp4") && <option value="aac" className="bg-white dark:bg-slate-900">AAC (Standard audio)</option>}
                {outputFormat === "wav" && <option value="pcm_s16le" className="bg-white dark:bg-slate-900">Uncompressed WAV 16-bit PCM</option>}
                {outputFormat === "ogg" && <option value="libvorbis" className="bg-white dark:bg-slate-900">Vorbis OGG Codec</option>}
                <option value="opus" className="bg-white dark:bg-slate-900">Opus (Ultra high voice fidelity)</option>
                <option value="flac" className="bg-white dark:bg-slate-900">FLAC (Lossless storage)</option>
                <option value="ac3" className="bg-white dark:bg-slate-900">AC3 (Dolby Digital Surround)</option>
                <option value="alac" className="bg-white dark:bg-slate-900">ALAC (Apple Lossless encoder)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-slate-400">Audio Bitrate</label>
              <select
                id="select-audio-bitrate"
                value={audioBitrate}
                onChange={(e) => setAudioBitrate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
              >
                <option value="keep" className="bg-white dark:bg-slate-900">Keep Original Bitrate</option>
                <option value="512k" className="bg-white dark:bg-slate-900">512 kbps (Ultra Studio Surround)</option>
                <option value="320k" className="bg-white dark:bg-slate-900">320 kbps (Studio standard)</option>
                <option value="256k" className="bg-white dark:bg-slate-900">256 kbps (High Fidelity)</option>
                <option value="192k" className="bg-white dark:bg-slate-900">192 kbps (Standard high)</option>
                <option value="128k" className="bg-white dark:bg-slate-900">128 kbps (Standard efficient)</option>
                <option value="96k" className="bg-white dark:bg-slate-900">96 kbps (Compressed background)</option>
                <option value="64k" className="bg-white dark:bg-slate-900">64 kbps (Low-bandwidth mono)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-slate-400">Audio Sample Rate</label>
              <select
                id="select-sample-rate"
                value={audioSampleRate}
                onChange={(e) => setAudioSampleRate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
              >
                <option value="keep" className="bg-white dark:bg-slate-900">Keep Original Sample Rate</option>
                <option value="96000" className="bg-white dark:bg-slate-900">96,000 Hz (High-Res Studio Master)</option>
                <option value="48000" className="bg-white dark:bg-slate-900">48,000 Hz (Video Broadcast)</option>
                <option value="44100" className="bg-white dark:bg-slate-900">44,100 Hz (CD Audio Standard)</option>
                <option value="32000" className="bg-white dark:bg-slate-900">32,000 Hz (Voice compressed)</option>
                <option value="22050" className="bg-white dark:bg-slate-900">22,050 Hz (Retro/Lofi acoustic rate)</option>
                <option value="8000" className="bg-white dark:bg-slate-900">8,000 Hz (Telephony Narrowband)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-slate-400">Audio Channels</label>
              <select
                id="select-channels"
                value={audioChannels}
                onChange={(e) => setAudioChannels(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none"
              >
                <option value="keep" className="bg-white dark:bg-slate-900">Keep Original Channels</option>
                <option value="6" className="bg-white dark:bg-slate-900">5.1 Surround Sound (6 Channels)</option>
                <option value="2" className="bg-white dark:bg-slate-900">Stereo (2 Channels)</option>
                <option value="1" className="bg-white dark:bg-slate-900">Mono (1 Channel)</option>
              </select>
            </div>
          </div>
        </div>

        {/* TRIMMING & STRIPPING UTILLITIES */}
        <div id="util-parameters-box" className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-5">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white font-sans flex items-center gap-1.5">
            <Scissors className="h-3.5 w-3.5 text-indigo-500" />
            <span>Multi-Segment Trimming & Time-Clipped Remuxing</span>
          </h3>

          {trimError && (
            <div id="trim-warning-box" className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-450 p-3 rounded-xl text-xs leading-relaxed flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <p className="font-semibold flex-1 mt-0.5">{trimError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono text-slate-400">Trim From (Start Duration)</label>
                {trimStart && (
                  <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-1 py-0.2 rounded">
                    Parsed: {formatSecondsToTime(parseTimeToSeconds(trimStart) ?? 0)}
                  </span>
                )}
              </div>
              <input
                type="text"
                id="trim-start-field"
                value={trimStart}
                onChange={(e) => {
                  setTrimStart(e.target.value);
                  setTrimError(null);
                }}
                placeholder="00:00:00 or seconds"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder-slate-400 dark:placeholder-slate-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono text-slate-400">Trim To (End Duration)</label>
                {trimEnd && (
                  <span className="text-[9px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-1 py-0.2 rounded">
                    Parsed: {formatSecondsToTime(parseTimeToSeconds(trimEnd) ?? (initialDuration ?? 0))}
                  </span>
                )}
              </div>
              <input
                type="text"
                id="trim-end-field"
                value={trimEnd}
                onChange={(e) => {
                  setTrimEnd(e.target.value);
                  setTrimError(null);
                }}
                placeholder="00:01:30 or seconds"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-100 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder-slate-400 dark:placeholder-slate-500 font-mono"
              />
            </div>
          </div>

          {/* Quick Trimmings Helper Preset Buttons inside Form Control */}
          {initialDuration && initialDuration > 0 && (
            <div className="space-y-2.5 mt-2 pt-1">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold uppercase tracking-wider">
                Interactive Trimming Presets ({formatSecondsToTime(initialDuration)} Source Length)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {initialDuration > 15 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart("00:00:00");
                      setTrimEnd("00:00:15");
                      setTrimError(null);
                    }}
                    className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-105 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-800 transition-all cursor-pointer"
                  >
                    ✂️ Capture First 15s
                  </button>
                )}
                {initialDuration > 30 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart("00:00:00");
                      setTrimEnd("00:00:30");
                      setTrimError(null);
                    }}
                    className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-105 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-800 transition-all cursor-pointer"
                  >
                    ✂️ Capture First 30s
                  </button>
                )}
                {initialDuration > 60 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart("00:00:00");
                      setTrimEnd("00:01:00");
                      setTrimError(null);
                    }}
                    className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-105 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-800 transition-all cursor-pointer"
                  >
                    ✂️ Capture First 60s
                  </button>
                )}
                {initialDuration > 300 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart("00:00:00");
                      setTrimEnd("00:05:00");
                      setTrimError(null);
                    }}
                    className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-105 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-800 transition-all cursor-pointer"
                  >
                    ✂️ First 5 min
                  </button>
                )}
                {initialDuration > 10 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart("00:00:10");
                      setTrimEnd("");
                      setTrimError(null);
                    }}
                    className="px-2.5 py-1 text-[10px] font-mono font-bold bg-slate-105 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200/60 dark:border-slate-800 transition-all cursor-pointer"
                  >
                    ✂️ Skip first 10s
                  </button>
                )}
                {(trimStart !== "" || trimEnd !== "") && (
                  <button
                    type="button"
                    onClick={() => {
                      setTrimStart("");
                      setTrimEnd("");
                      setTrimError(null);
                    }}
                    className="px-2.5 py-1 text-[10px] font-mono font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg border border-rose-200/50 dark:border-rose-900/50 transition-all cursor-pointer"
                  >
                    🔄 Clear Trims (Full video)
                  </button>
                )}
              </div>

              {/* Cutting Segment Visualization Bar overlay */}
              <div className="space-y-1.5 mt-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/80 p-3.5 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-750 dark:text-slate-300">Cut Timeline Segment:</span>
                  <span className="font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded border border-indigo-100/40 dark:border-indigo-900/40 font-bold whitespace-nowrap">
                    {trimStart || trimEnd 
                      ? `${formatSecondsToTime(parseTimeToSeconds(trimStart) ?? 0)} ➔ ${formatSecondsToTime(parseTimeToSeconds(trimEnd) ?? initialDuration)} (${formatSecondsToTime(Math.max(0, (parseTimeToSeconds(trimEnd) ?? initialDuration) - (parseTimeToSeconds(trimStart) ?? 0)))} Segment)`
                      : "Whole Media Length (No trimming clips applied)"
                    }
                  </span>
                </div>
                
                {/* Custom bar */}
                <div className="relative w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1 select-none">
                  <div 
                    className="absolute h-full bg-indigo-505 dark:bg-indigo-400 rounded-full transition-all duration-300"
                    style={{
                      left: `${(Math.max(0, parseTimeToSeconds(trimStart) ?? 0) / initialDuration) * 100}%`,
                      width: `${(Math.max(0, (parseTimeToSeconds(trimEnd) ?? initialDuration) - (parseTimeToSeconds(trimStart) ?? 0)) / initialDuration) * 100}%`
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>00:00:00</span>
                  <span>{formatSecondsToTime(initialDuration)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-6 pt-1">
            {activeTab === "video" && (
              <label className="flex items-center gap-2 text-xs text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="check-strip-audio"
                  checked={stripAudio}
                  onChange={(e) => setStripAudio(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-indigo-400 focus:ring-slate-905 dark:focus:ring-offset-slate-950"
                />
                <VolumeX className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>Strip Audio Channel (Pure Mute Video)</span>
              </label>
            )}

            {activeTab === "video" && (
              <label className="flex items-center gap-2 text-xs text-slate-550 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="check-burn-subtitles"
                  checked={burnSubtitles}
                  onChange={(e) => setBurnSubtitles(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-indigo-400 focus:ring-slate-905 dark:focus:ring-offset-slate-950"
                />
                <span>Embed Metadata / Remux Subtitles</span>
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Source Compatibility Audit warns */}
      {getValidationWarnings().length > 0 && (
        <div id="compatibility-audit-card" className="bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/50 rounded-2xl p-4.5 space-y-2.5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-amber-200/50 dark:border-amber-900/40 pb-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <h5 className="text-[10.5px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-widest font-sans animate-pulse">
              Transmux Compatibility Audit
            </h5>
          </div>
          <div className="space-y-2 text-[11px] text-amber-700 dark:text-amber-500 font-medium leading-relaxed">
            {getValidationWarnings().map((w, idx) => (
              <div key={idx} className="flex items-start gap-1.5 pl-0">
                <span className="text-amber-500 shrink-0 select-none font-bold">•</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Conversion Action trigger */}
      <div id="settings-action-panel" className="border-t border-slate-100 dark:border-slate-800 pt-5">
        <button
          type="button"
          id="btn-trigger-transcode"
          disabled={isProcessing}
          onClick={() => { try { triggerConversion(); } catch (e) { console.error("Conversion trigger error:", e); } }}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-505 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm tracking-wide transition-all uppercase cursor-pointer"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Processing Media pipeline...
            </>
          ) : (
            <>
              Launch Transcoding Engine
            </>
          )}
        </button>
      </div>
    </div>
  );
}
