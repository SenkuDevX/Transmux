# Transmux - Production-Ready Media Converter

A free-tier optimized media converter using Next.js, Express, FFmpeg, yt-dlp, Cloudinary, and Upstash Redis.

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Vercel    │────▶│    Render    │────▶│  Cloudinary │
│  (Frontend) │     │   (Backend)  │     │   (Storage) │
└─────────────┘     └──────┬───────┘     └─────────────┘
                          │
                    ┌─────▼───────┐     ┌─────────────┐
                    │ Upstash     │     │  Supabase   │
                    │   Redis     │     │    (DB)     │
                    └─────────────┘     └─────────────┘
```

## File Processing Flow

1. User submits media URL via frontend
2. Backend creates job in Bull queue (stored in Upstash Redis)
3. Worker downloads media using yt-dlp to `/tmp`
4. FFmpeg converts the media file
5. Output is uploaded to Cloudinary (tagged `temp`, `expires_1h`)
6. Job metadata is stored in Supabase DB
7. Frontend receives progress via Socket.IO WebSocket
8. User downloads file from Cloudinary for 1 hour
9. Cleanup worker removes expired files every 10 minutes

## Project Structure

```
transmux/
├── backend/                 # Express API + Worker
│   ├── src/
│   │   ├── index.ts        # Main entry point
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Security & rate limiting
│   ├── render.yaml         # Render deployment config
│   └── .env.example        # Environment variables
├── frontend/               # Next.js 14 app
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   └── lib/           # API client, store, socket
│   ├── vercel.json        # Vercel deployment config
│   └── .env.example       # Environment variables
├── shared/                 # Shared TypeScript types
└── supabase/
    └── migrations/         # Database migrations
```

## Deployment Guide

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Git](https://git-scm.com/)
- FFmpeg installed on backend server
- yt-dlp installed on backend server

### Step 1: Configure Upstash Redis (Free Tier)

1. Go to [upstash.com](https://upstash.com) and create a free account
2. Create a new Redis database
3. Copy the connection details:
   - `UPSTASH_REDIS_HOST`
   - `UPSTASH_REDIS_PORT`
   - `UPSTASH_REDIS_PASSWORD`

### Step 2: Configure Supabase

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to SQL Editor and run the migration from `supabase/migrations/001_create_jobs_table.sql`
3. Get your project URL and keys from Project Settings > API
4. Note down:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Configure Cloudinary

1. Go to [cloudinary.com](https://cloudinary.com) and create a free account
2. Copy your cloud name, API key, and API secret from Dashboard
3. Create upload preset:
   - Go to Settings > Upload
   - Add upload preset with name `transmux`
   - Set signing mode to "Unsigned"
   - Add folder: `converted-media`

### Step 4: Deploy Backend to Render

1. Fork this repository to GitHub
2. Go to [render.com](https://render.com) and create a free account
3. Click "New +" > "Blueprint"
4. Connect your GitHub repository
5. Render will use `render.yaml` to deploy automatically
6. Add all environment variables from `backend/.env.example`:
   ```
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://your-frontend.vercel.app
   UPSTASH_REDIS_HOST=your-host.upstash.io
   UPSTASH_REDIS_PORT=6379
   UPSTASH_REDIS_PASSWORD=your-password
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-key
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ADMIN_SECRET=your-secure-secret
   TEMP_DIR=/tmp/transmux
   MAX_CONCURRENT_JOBS=2
   JOB_TIMEOUT_MS=1800000
   ```
7. Note your backend URL (e.g., `https://transmux-backend.onrender.com`)

### Step 5: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and create a free account
2. Click "Add New..." > "Project"
3. Import your GitHub repository
4. Set root directory to `frontend`
5. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
   NEXT_PUBLIC_WS_URL=https://your-backend.onrender.com
   ```
6. Click "Deploy"

### Step 6: Verify Deployment

1. Visit your Vercel frontend URL
2. Paste a test YouTube URL
3. Select format and quality
4. Click Convert
5. Wait for conversion to complete
6. Download the file

## API Reference

### POST /api/convert

Create a new conversion job.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format": "mp3",
  "quality": "320k",
  "mode": "audio"
}
```

**Response:**
```json
{
  "jobId": "abc123-def456",
  "status": "queued",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/status/:jobId

Get job status and progress.

**Response:**
```json
{
  "jobId": "abc123-def456",
  "status": "converting",
  "progress": 45,
  "inputName": "Video Title",
  "outputFormat": "mp3",
  "expiresAt": "2024-01-01T01:00:00.000Z"
}
```

### GET /api/download/:jobId

Redirect to Cloudinary download URL (validates expiration).

### POST /api/admin/cleanup

Manually trigger cleanup (protected by ADMIN_SECRET).

**Headers:** `Authorization: Bearer YOUR_ADMIN_SECRET`

**Response:**
```json
{
  "deletedCount": 5,
  "expiredCount": 5,
  "errors": []
}
```

### GET /api/health

Health check endpoint.

## 1-Hour Deletion Logic

### How It Works

1. **When uploading to Cloudinary:**
   - Files are tagged with `temp` and `expires_1h`
   - `expires_at` timestamp is stored in Supabase

2. **Automatic Cleanup (every 10 minutes):**
   - Query Supabase for jobs where `status='completed'` AND `expires_at < NOW()`
   - Delete corresponding files from Cloudinary
   - Update job status to `expired`

3. **Fallback Manual Cleanup:**
   - `POST /api/admin/cleanup` endpoint
   - Protected by `ADMIN_SECRET`
   - Can be called via Render Cron or webhook

### Render Cron Setup

The `render.yaml` includes a cron job that calls cleanup every 10 minutes:

```yaml
- type: cron
  name: transmux-cleanup
  schedule: "*/10 * * * *"
  command: curl -X POST https://transmux-backend.onrender.com/api/admin/cleanup -H "Authorization: Bearer $ADMIN_SECRET"
```

## Security Features

1. **Rate Limiting**: 20 requests/minute per IP
2. **Input Validation**: URL sanitization, format validation
3. **Path Security**: Blocks dangerous file paths (`../`, etc.)
4. **CORS**: Configured for frontend domain only
5. **Helmet**: Security headers middleware
6. **Admin Auth**: Cleanup endpoint protected

## Environment Variables Reference

### Backend (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | Yes |
| `NODE_ENV` | Environment | Yes |
| `FRONTEND_URL` | Vercel frontend URL | Yes |
| `UPSTASH_REDIS_HOST` | Upstash Redis host | Yes |
| `UPSTASH_REDIS_PORT` | Upstash Redis port | Yes |
| `UPSTASH_REDIS_PASSWORD` | Upstash Redis password | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `ADMIN_SECRET` | Secret for admin endpoints | Yes |
| `TEMP_DIR` | Temporary file directory | No (default: /tmp/transmux) |
| `MAX_CONCURRENT_JOBS` | Max parallel jobs | No (default: 2) |
| `LOG_LEVEL` | Log verbosity | No (default: info) |

### Frontend (.env.local)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL | No (defaults to API URL with ws://) |

## Troubleshooting

### Common Issues

1. **"Redis connection failed"**
   - Check Upstash credentials are correct
   - Verify Upstash Redis is active

2. **"Cloudinary upload failed"**
   - Check Cloudinary credentials
   - Verify upload preset exists

3. **"yt-dlp not found"**
   - Install yt-dlp on Render: `curl -L https://yt-dl.org/downloads/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp`

4. **"FFmpeg not found"**
   - Add FFmpeg to Render environment via `render.yaml` startup command

### Render Free Tier Limitations

- Sleeps after 15 minutes of inactivity
- 750 hours/month free
- No persistent disk (`/tmp` is ephemeral)
- No WebSocket support (use polling fallback)

### Cost Optimization

- Uses only free-tier services
- All temporary files deleted after 1 hour
- Cleanup worker minimizes Cloudinary storage

## License

MIT

## Contributing

Pull requests welcome. Please read contributing guidelines first.