# Session Summary

## Current Session (May 22, 2026)

### Fixes

- **HF Spaces Docker build failing** — `pip3 install curl_cffi` fails with PEP 668 "externally-managed-environment" on Debian Bookworm.
  - **Fix**: Added `--break-system-packages` to pip install commands in `Dockerfile`.
- **Rate limiter IPv6 warning** — Custom `keyGenerator` using `req.ip` triggered `ERR_ERL_KEY_GEN_IPV6`.
  - **Fix**: Replaced with `defaultKeyGenerator(req)` from `express-rate-limit` (server.ts:39).
- **"Save Stream File" downloads index.html** — `ProgressCard.tsx` used `window.location.origin` to build the download URL. In cloud mode (frontend on Vercel, backend on HF Spaces), requests went to Vercel and served index.html instead of the actual file.
  - **Fix**: Replaced `window.location.origin` with `apiUrl()` helper from `src/api.ts`, which respects `VITE_API_URL` (ProgressCard.tsx:113).

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
