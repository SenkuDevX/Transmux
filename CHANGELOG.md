# Changelog

## Version 5.0 (2026-05)

### Added
- **Creator Toolkit**: GIF Maker, Clip Maker, Shorts Maker, Silence Remover, Loudness Normalization, Metadata Editor, Repair Corrupted Video, Thumbnail Extractor
- **Before/After Quality Split View**: Side-by-side original vs converted comparison with compression ratio visualization
- **Smart Format Recommendation Engine**: Auto-analyzes codec, resolution, size to recommend Discord/WhatsApp/YouTube/Best Quality/Editing formats
- **Instant File Size Predictor**: Real-time estimated size, processing time, and quality score reacting to all setting changes
- **Smart Compression Mode**: Target size dropdown (10MB–1GB) with auto-tuned bitrate, CRF, resolution, and audio settings
- **Browser Extension v5**: Complete overhaul with 20 features
- **Extension Stealth Download Engine**: Browser-assisted media fetching through authenticated context
- **Extension Sync Accounts + Presets**: API-key-based cloud sync for presets and history
- **Extension Creator Workflow Tools**: YouTube Studio shortcut bar (MP3/MP4/GIF/Clip)
- **Extension Media Intelligence Overlay**: Ctrl+Shift+I to toggle codec/resolution/duration display
- **Extension Multi-Tab Batch Queue**: "All Tabs" button scans all supported-site tabs and queues them
- **Extension Instant Remux**: Context menu + popup button for lossless MP4 conversion
- **Extension Privacy Mode**: Toggle for local-only processing with auto-delete
- **Extension Download Dashboard**: Mini dashboard with queue/active/completed/ETA/storage stats
- **Extension Popup Thumbnail Preview**: Video thumbnail rendered in detected media cards
- **Changelog System**: In-app changelog modal with auto-open on new version, "What's New" badge
- **Frame Thumbnails in Waveform Editor**: Timeline thumbnails synced with trim handles and playback position
- **Auth Ecosystem (Clerk + Supabase + Socket.IO)**: Full login gate, OAuth (Google/Discord/GitHub), JWT validation, realtime progress, user workspace
- **FAQ**: 50+ questions covering all features
- **Tips**: 27 actionable tips with color-coded categories
- **Footer version badge**: v5.0 badge in footer

### Improved
- **Subtitle System**: Fixed download, merge, and burn flows with better format mapping between listing and download clients
- **Quality Selection**: Resolution-based fallback formats, post-download resolution verification, automatic re-download on mismatch
- **4K Download Performance**: Increased concurrent fragments to 64 for 4K+, larger aria2c chunk sizes, optimized stream handling
- **Queue Prioritization**: Short jobs, remux-only, and audio-only jobs get higher priority and jump ahead
- **Cookie Sync**: 30-minute auto-refresh alarm, manual refresh/test buttons, privacy mode support
- **Cloud Sync**: Pull-first-then-push strategy to avoid accidental overwrites
- **Waveform Editor**: Subtitle markers, chapter markers, hover time indicator, time ruler, quick presets
- **Onboarding Flow**: Renamed to "Quick Launch Sequence" with step-by-step guided setup
- **Security**: rate limiting on API routes, encrypted cookie transit, auto-cleanup after 1 hour

### Fixed
- Subtitles not downloading due to format ID mismatch between listing and download
- Subtitles not merging/burning correctly into output files
- 4K video downloads timing out with default fragment settings
- Downloads producing lower quality than requested (re-download with fallback formats)
- TypeScript compilation errors (duplicate code, missing imports)
- Extension context menu duplicate entries
- Server crash on uncaught exceptions (global handlers added)

### Extension
- Manifest V3 with persistent background service worker
- 10 context menu items (Convert, MP3, MP4, GIF, Subtitles, Queue, Remux, Compress, Open, Stealth)
- YouTube direct injection (MP3 + Clip buttons)
- 5 quick actions in popup (MP3, MP4, GIF, Clip, Remux)
- Smart site detection (YouTube, SoundCloud, Vimeo, Twitter/X, Reddit, TikTok, Instagram, Twitch)
- Floating media detector button on any page with video/audio
- Clipboard watcher with convert/MP3/dismiss actions
- Browser notifications for job completion
- Full dashboard with real-time job stats

### Performance
- Optimized 4K download strategy with aria2c parallel connections
- Reduced memory usage in waveform generation
- Efficient thumbnail extraction with lazy loading
- Socket.IO realtime with auto-reconnect

### Security
- Rate limiting on all API routes (100 requests per 15 minutes per IP)
- Helmet security headers
- CORS restricted to same-origin
- Cookie encryption in transit via HTTPS
- 1-hour auto-cleanup of all job files
- Input validation on all endpoints
