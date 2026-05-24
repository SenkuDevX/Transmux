# TransMux v5.0 - Setup & Deployment

## Quick Start

### Prerequisites
- Node.js 22+
- FFmpeg (with ffprobe)
- yt-dlp
- aria2c (optional, for faster downloads)

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required for basic operation:**
- `PORT` (default: 3000)
- `BACKEND_URL` (public URL of the backend)

**Auth (optional - for production):**
- `VITE_CLERK_PUBLISHABLE_KEY` - Clerk frontend key
- `CLERK_JWT_VERIFICATION_KEY` - Clerk JWT verification PEM
- `AUTH_ENABLED` - Set to "true" to enforce login
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` - Supabase project

**Other:**
- `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_OUTPUT_BUCKET` - Optional S3/R2 storage
- `ADMIN_KEY` - Secret key for cookie management
- `PROXY_URL` - Proxy for yt-dlp fallback

### Run Development
```bash
npm run dev
# Starts at http://localhost:3000
```

### Build for Production
```bash
npm run build
npm start
```

## Deploy to Hugging Face Spaces

Push to a HF Spaces repo with `NODE_ENV=production`. The `BACKEND_URL` must be the HF Space URL. Set environment variables in the Space settings.

## Auth Flow

1. **No Auth (development/default)**: When `AUTH_ENABLED=false` and Clerk vars are empty, the app runs in anonymous mode. All features work without login.

2. **Full Auth (production)**: When `AUTH_ENABLED=true` and Clerk vars are configured:
   - All routes require a valid Clerk JWT (sent as `Authorization: Bearer <token>`)
   - Frontend wraps with ClerkProvider, showing a sign-in page for unauthenticated users
   - Backend validates JWTs via the `authMiddleware`
   - Extension syncs auth state with the web app through a port connection

### Setting up Clerk
1. Create an account at [clerk.com](https://clerk.com)
2. Create a new application (enable Google, Discord, GitHub OAuth)
3. Copy the Publishable Key to `VITE_CLERK_PUBLISHABLE_KEY`
4. Download the JWT Verification Key (PEM) to `CLERK_JWT_VERIFICATION_KEY`

### Setting up Supabase
1. Create an account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run the migration SQL from `supabase/migrations/00001_init.sql`
4. Copy the Project URL and anon key to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## Database Schema

See `supabase/migrations/00001_init.sql` for the full schema.

Tables:
- `users` - Synced with Clerk via clerk_id
- `jobs` - Conversion jobs with ownership
- `presets` - User saved conversion presets
- `gallery` - Published files

Row Level Security (RLS) is enabled on all tables, scoping access to the user's own data.

## Socket.IO Event Map

| Event | Direction | Payload | Trigger |
|-------|-----------|---------|---------|
| `job:update` | Server → Client | `{ jobId, status, progress }` | Any job state change |
| `job:progress` | Server → Client | `{ jobId, progress, eta }` | Download/encode progress tick |
| `job:complete` | Server → Client | `{ jobId, outputName, outputSize }` | Conversion finished |
| `job:error` | Server → Client | `{ jobId, error }` | Conversion failed |
| `thumbnail:progress` | Server → Client | `{ jobId, current, total }` | Thumbnail extraction |
| `subscribe:job` | Client → Server | `jobId` | Join job-specific room |
| `unsubscribe:job` | Client → Server | `jobId` | Leave job-specific room |

## Extension Communication

### Cookie Relay
1. Web app `postMessage`s `TRANSMUX_REFRESH_COOKIES` to content script
2. Content script opens a named port `transmux-cookies` to background service worker
3. Background worker extracts YouTube cookies, formats as Netscape file, POSTs to backend
4. Response relayed back through the chain

### Auth Sync
1. Web app `postMessage`s `TRANSMUX_AUTH_STATE` with `{ authState, user }`
2. Content script `chrome.runtime.sendMessage`s it to background
3. Background stores in `chrome.storage.local` as `authState`/`authUser`
4. Background listens on `transmux-auth` port for `AUTH_LOGIN`/`AUTH_LOGOUT`/`AUTH_CHECK`

### Stealth Download
1. Context menu click → background.js sends `TRANSMUX_STEALTH_DOWNLOAD` to content script
2. Content script does `fetch(url, { credentials: "include" })` (authenticated browser context)
3. Blob sent as FormData to `/api/stealth-upload`
4. Falls back to server-side yt-dlp impersonation if browser fetch fails

### Context Menu Items
Right-click on any link/video/audio:
- Convert with Transmux, Download Audio (MP3), Download Video (MP4)
- Create GIF, Extract Subtitles, Send to Queue
- Instant Remux (Lossless MP4), Compress Media
- Open in Transmux, Stealth Download

## Creator Toolkit API

All endpoints require a completed job (POST to specific endpoint):

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/repair/:jobId` | POST | — | Fix broken timestamps/containers |
| `/api/creator/gif/:jobId` | POST | `{ start, duration, fps, width }` | Create animated GIF |
| `/api/creator/clip/:jobId` | POST | `{ start, end }` | Extract segment (stream copy) |
| `/api/creator/shorts/:jobId` | POST | `{ start, duration }` | Crop to 9:16 vertical |
| `/api/creator/silence-remove/:jobId` | POST | — | Trim leading/trailing silence |
| `/api/creator/loudness-normalize/:jobId` | POST | — | EBU R128 to -23 LUFS |
| `/api/creator/metadata/:jobId` | POST | `{ title, artist, ... }` | Update media metadata |
| `/api/thumbnails/:jobId` | GET | `?count=10` | Extract interval-based thumbnails |
| `/api/quality-compare/:jobId` | GET | — | Compare original vs output |

## File Structure
```
/
├── server.ts              # Express backend + Socket.IO
├── src/
│   ├── App.tsx            # Main React app with modals, auth, changelog
│   ├── main.tsx           # Entry point with ClerkProvider
│   ├── components/        # React UI components
│   ├── lib/
│   │   ├── auth.ts        # Frontend auth helpers
│   │   ├── socket.ts      # Socket.IO client
│   │   ├── supabase.ts    # Supabase client
│   │   └── socket-server.ts # Server-side Socket.IO
│   ├── middleware/
│   │   └── auth.ts        # JWT validation middleware
│   └── api.ts             # API fetch utilities
├── extension/             # Chrome MV3 extension
│   ├── background.js      # Service worker (cookies, menus, auth)
│   ├── content.js         # Content scripts (YouTube injection, stealth)
│   ├── popup.html         # Popup UI (dashboard, thumbnails, sync)
│   └── popup.js           # Popup logic
├── supabase/migrations/   # Database schema
├── CHANGELOG.md           # Version changelog
└── .env.example           # Environment variable template
```
