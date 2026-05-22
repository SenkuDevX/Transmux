# Session Summary

## Current Session (May 22, 2026)

### Build Fix
- **HF Spaces Docker build failing** — `pip3 install curl_cffi` fails with PEP 668 "externally-managed-environment" error on Debian Bookworm.
- **Fix**: Added `--break-system-packages` flag to pip install commands in `Dockerfile` (lines 6-7). The existing `PIP_REQUIRE_VIRTUALENV=false` env var wasn't sufficient for PEP 668.

## Previous Sessions (from git history)

### Architecture
- Node.js/Express server with modular `express.Router()` structure
- Routes: `album`, `track`, `playlist`, `download`, `stream`, `search`, `subscribe`, `subscriptionMeta`
- Middleware: `auth`, `errorHandler`, `requestLogger`
- Caching: `node-cache` integration (`TrackCache`, `SearchCache`, `PlaylistCache`, `AlbumCache`)
- yt-dlp abstraction: `TrackResolver`, `HealthMonitor`, `MetadataExtractor`

### Features Implemented
- Grid background overlay at 50% opacity
- Dark mode with custom slate colors in Tailwind v4 `@theme`
- Subtitle embedding in video output (and later blocking from showroom)
- Rate limiting, engine status toggle, playlist system, easter eggs
- `YOUTUBE_COOKIES` env var for cookie-based auth (no API calls)
- `ADMIN_KEY` protection for cookie endpoint
- TLS fingerprint impersonation via `curl_cffi`
- Deno as yt-dlp JS runtime (Android client to bypass bot detection)
- HF Spaces deployment config

### Infrastructure
- `Dockerfile` — node:22-slim base, ffmpeg, python3, deno via npm, curl_cffi, yt-dlp
- Static build through Netlify/Vercel
- `VITE_API_URL` env var config
