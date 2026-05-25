# Changelog

## Version 5.0 (2026-05)

### 🎉 Added
- **Creator Toolkit**: GIF Maker, Clip Maker, Shorts Maker, Silence Remover, Loudness Normalization, Metadata Editor, Repair Corrupted Video, Thumbnail Extractor with interval/scene/count modes
- **Before/After Quality Split View**: Side-by-side original vs converted comparison with compression ratio visualization
- **Smart Format Recommendation Engine**: Auto-analyzes codec, resolution, size to recommend Discord/WhatsApp/YouTube/Best Quality/Editing formats
- **Instant File Size Predictor**: Real-time estimated size, processing time, and quality score reacting to all setting changes
- **Smart Compression Mode**: Target size dropdown (10MB–1GB) with auto-tuned bitrate, CRF, resolution, and audio settings
- **Browser Extension v5**: Complete overhaul with 20+ features
- **Extension Stealth Download Engine**: Browser-assisted media fetching through authenticated context
- **Extension Sync Accounts + Presets**: API-key-based cloud sync for presets and history
- **Extension Creator Workflow Tools**: YouTube Studio shortcut bar (MP3/MP4/GIF/Clip)
- **Extension Media Intelligence Overlay**: Ctrl+Shift+I to toggle codec/resolution/duration display
- **Extension Multi-Tab Batch Queue**: "All Tabs" button scans all supported-site tabs and queues them
- **Extension Instant Remux**: Context menu + popup button for lossless MP4 conversion
- **Extension Privacy Mode**: Toggle for local-only processing with auto-delete
- **Extension Download Dashboard**: Mini dashboard with queue/active/completed/ETA/storage stats
- **Extension Popup Thumbnail Preview**: Video thumbnail rendered in detected media cards with skeleton loading
- **Changelog System**: In-app changelog modal with auto-open on new version, "What's New" badge
- **Frame Thumbnails in Waveform Editor**: Timeline thumbnails synced with trim handles and playback position, virtualization/lazy loading
- **Auth Ecosystem (Clerk + Supabase + Socket.IO)**: Full login gate, OAuth (Google/Discord/GitHub), JWT validation, realtime progress, user workspace
- **FAQ**: 50+ questions covering all features
- **Tips**: 27 actionable tips with color-coded categories
- **Footer version badge**: v5.0 badge in footer
- **Error Boundary system**: Catches React errors gracefully with fallback UI
- **Supabase database schema**: users, jobs, presets, gallery tables with RLS policies
- **Socket.IO event-driven architecture**: Real-time job updates, progress, completion events

### 🔧 Improved
- **Subtitle System**: Fixed download, merge, and burn flows with better format mapping between listing and download clients
- **Quality Selection**: Resolution-based fallback formats, post-download resolution verification, automatic re-download on mismatch
- **4K Download Performance**: Increased concurrent fragments to 64 for 4K+, larger aria2c chunk sizes, optimized stream handling
- **Queue Prioritization**: Short jobs, remux-only, and audio-only jobs get higher priority and jump ahead
- **Cookie Sync**: 30-minute auto-refresh alarm, manual refresh/test buttons, privacy mode support
- **Cloud Sync**: Pull-first-then-push strategy to avoid accidental overwrites
- **Waveform Editor**: Subtitle markers, chapter markers, hover time indicator, time ruler, quick trim presets, frame thumbnails
- **Onboarding Flow**: Renamed to "Quick Launch Sequence" with step-by-step guided setup
- **Security**: rate limiting on API routes, encrypted cookie transit, auto-cleanup after 1 hour
- **Auth Middleware**: Route-level protection with requireAuthOrApiKey for write operations
- **Toast Dispatch**: Deduplication mechanism preventing duplicate toasts within 2 seconds
- **Socket Client**: Type-safe event helpers with unsubscribe functions, auto-reconnect with 10 attempts

### 🐛 Fixed
- Subtitles not downloading due to format ID mismatch between listing and download
- Subtitles not merging/burning correctly into output files
- 4K video downloads timing out with default fragment settings
- Downloads producing lower quality than requested (re-download with fallback formats)
- TypeScript compilation errors (duplicate code, missing imports)
- Extension context menu duplicate entries
- Server crash on uncaught exceptions (global handlers added)
- Zombie processes not killed on job cancel (SIGTERM → SIGKILL timeout)
- Orphan temp files not cleaned on server startup
- Race condition in queue processing (double-processing same job)
- Memory leak from unbounded ffmpeg stderr accumulation (truncated to 10k chars)
- Stalled queues when job handler throws (processQueue now in try/finally)
- S3 signed URLs not being cached between polls
- Missing Content-Type headers on download responses
- Stream pipe errors crashing server (error handlers added)
- CreatorToolsPanel not sending mode parameter to thumbnail API
- No response when count is out of valid range (1-100 validation added)
- Export missing in auth middleware (User interface added)
- Auth middleware not returning 401 when AUTH_ENABLED=true with no token
- Duplicate /api/hardware-accel endpoint (removed second definition)
- Theme FOUC (flash of unstyled content) on page load
- Toast system showing duplicate notifications
- Socket.IO not connecting properly in dev (transport priority fixed)
- Extension popup: missing skeleton loading for thumbnails
- Extension popup: memory leaks from repeated event listeners
- Extension popup: stale state from interval not being cleared
- Background.js: duplicate onConnect listener registered twice
- Background.js: stealth download trying to fetch from service worker (moved to content script)

### 🧩 Extension (20+ features)
- Manifest V3 with persistent background service worker
- 10 context menu items (Convert, MP3, MP4, GIF, Subtitles, Queue, Remux, Compress, Open, Stealth)
- YouTube direct injection (MP3 + Clip buttons)
- 5 quick actions in popup (MP3, MP4, GIF, Clip, Remux)
- Smart site detection (YouTube, SoundCloud, Vimeo, Twitter/X, Reddit, TikTok, Instagram, Twitch)
- Floating media detector button on any page with video/audio
- Clipboard watcher with convert/MP3/dismiss actions
- Browser notifications for job completion
- Full dashboard with real-time job stats
- Cookie auto-refresh every 30 minutes
- Privacy mode toggle for local-only processing
- Cloud sync for presets and history
- Multi-tab batch queue scanning
- Event delegation for memory-safe UI interactions
- Thumbnail preview with skeleton loading
- Stealth download via content script injection

### ⚡ Performance
- Optimized 4K download strategy with aria2c parallel connections (64 fragments)
- Reduced memory usage in waveform generation
- Efficient thumbnail extraction with lazy loading (blur-up placeholder)
- Socket.IO realtime with auto-reconnect and progress debounce (200ms)
- FFmpeg stderr truncated to prevent memory spikes
- S3 signed URL caching between poll intervals

### 🔒 Security
- Rate limiting on all API routes (12 requests per 30 seconds per IP)
- CORS restricted to allowed origins
- Cookie encryption in transit via HTTPS
- 1-hour auto-cleanup of all job and published files
- Input validation on all upload endpoints
- Auth middleware: 401 rejection for unauthenticated write operations
- requireAuthOrApiKey middleware on all write/delete routes
- Admin-only cookie management endpoint (ADMIN_KEY protected)
- Row Level Security on all Supabase tables
- File ownership validation through user context
- Startup cleanup of orphaned temp files
- Stream error handling to prevent crash exploits
