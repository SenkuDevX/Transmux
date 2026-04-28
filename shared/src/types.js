"use strict";
// Shared TypeScript types for Transmux
// Used by both frontend and backend
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESETS = exports.IMAGE_FORMATS = exports.SUBTITLE_FORMATS = exports.VIDEO_FORMATS = exports.AUDIO_FORMATS = void 0;
// ─── Formats ───────────────────────────────────────────────────────────────
exports.AUDIO_FORMATS = ['MP3', 'WAV', 'OGG', 'M4A', 'AAC', 'FLAC', 'OPUS', 'ALAC', 'AIFF', 'WMA', 'AMR'];
exports.VIDEO_FORMATS = ['MP4', 'MKV', 'WEBM', 'MOV', 'AVI', 'FLV', 'M4V', '3GP', 'TS'];
exports.SUBTITLE_FORMATS = ['SRT', 'VTT', 'ASS', 'SUB'];
exports.IMAGE_FORMATS = ['PNG', 'JPG', 'WEBP', 'GIF'];
exports.PRESETS = [
    {
        id: 'podcast-mp3',
        label: 'Podcast Export',
        mode: 'audio',
        outputFormat: 'MP3',
        options: { bitrate: '128k', sampleRate: 44100, channels: 2, normalize: true },
        description: 'Ideal for podcast publishing (128kbps, normalized)',
    },
    {
        id: 'hq-audio',
        label: 'High Quality Audio',
        mode: 'audio',
        outputFormat: 'FLAC',
        options: { sampleRate: 48000, channels: 2 },
        description: 'Lossless archival quality',
    },
    {
        id: 'youtube-video',
        label: 'YouTube Compatible',
        mode: 'video',
        outputFormat: 'MP4',
        options: { resolution: '1920x1080', crf: 18, preset: 'slow', codec: 'h264' },
        description: 'Optimized for YouTube upload',
    },
    {
        id: 'web-video',
        label: 'Web Optimized',
        mode: 'video',
        outputFormat: 'WEBM',
        options: { resolution: '1280x720', crf: 28, codec: 'vp9' },
        description: 'Small file size for web streaming',
    },
    {
        id: 'web-caption',
        label: 'Web Captions',
        mode: 'subtitle',
        outputFormat: 'VTT',
        options: {},
        description: 'HTML5 video caption format',
    },
];
