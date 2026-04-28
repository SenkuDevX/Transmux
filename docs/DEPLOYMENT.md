# Transmux Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────┐
│              Frontend (Next.js on Vercel)                     │
│         https://transmux.vercel.app                          │
│                                                              │
│  - Static pages, React UI                                    │
│  - Proxies /api/* to backend                                 │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS API calls
┌────────────────────────▼────────────────────────────────────┐
│              Backend (Express on Fly.io / VPS)               │
│         https://transmux-backend.fly.dev                     │
│                                                              │
│  - FFmpeg conversion jobs                                    │
│  - yt-dlp URL processing                                     │
│  - WebSocket progress updates                                │
│  - Temp file management                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Option 1: Vercel + Fly.io (Recommended)

### Deploy Backend to Fly.io

1. Install Fly CLI: `brew install flyctl`
2. Authenticate: `fly auth login`
3. Launch app (first time):
   ```bash
   cd transmux
   fly launch --name transmux-backend
   ```
4. Set secrets:
   ```bash
   fly secrets set FRONTEND_URL=https://your-app.vercel.app
   fly secrets set NODE_ENV=production
   ```
5. Deploy:
   ```bash
   fly deploy
   ```

### Deploy Frontend to Vercel

1. Push repository to GitHub
2. Import project at vercel.com
3. Set root directory to `frontend`
4. Set environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://transmux-backend.fly.dev
   ```
5. Deploy

---

## Option 2: Vercel + Railway

Railway supports Docker and persistent volumes.

1. Create a Railway project
2. Add a service from your GitHub repo
3. Set start command: `npm run start --workspace=backend`
4. Set build command: `npm install && npm run build`
5. Add environment variables in Railway dashboard
6. Use the Railway-provided URL as `NEXT_PUBLIC_API_URL`

---

## Option 3: Self-hosted VPS (Full control)

### Using Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - FRONTEND_URL=http://localhost:3000
      - FILE_CLEANUP_HOURS=1
    volumes:
      - /tmp/transmux:/tmp/transmux

  frontend:
    build:
      context: ./frontend
      args:
        - NEXT_PUBLIC_API_URL=http://localhost:3001
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

Run: `docker-compose up -d`

### With nginx reverse proxy

```nginx
# /etc/nginx/sites-available/transmux
server {
    listen 80;
    server_name transmux.example.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # Backend API + WebSocket
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 500M;
    }

    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

---

## Environment Variables

### Backend (required)
```env
PORT=3001
FRONTEND_URL=https://your-frontend.vercel.app
```

### Backend (optional / tuning)
```env
MAX_FILE_SIZE_MB=500         # Max upload size
MAX_DURATION_SECONDS=3600    # Max media duration for URL jobs
FILE_CLEANUP_HOURS=1         # How long to keep output files
RATE_LIMIT_RPM=20            # Upload requests per minute per IP
FFMPEG_THREADS=4             # FFmpeg thread count
LOG_LEVEL=info               # winston log level
YTDLP_BIN=yt-dlp            # Path to yt-dlp binary
TEMP_DIR=/tmp/transmux       # Temp storage path
```

### Frontend
```env
NEXT_PUBLIC_API_URL=http://localhost:3001   # Backend URL
NEXT_PUBLIC_MAX_FILE_MB=500                 # UI file size limit display
```

---

## Production Checklist

- [ ] HTTPS enabled on both frontend and backend
- [ ] `FRONTEND_URL` set to actual frontend domain (for CORS)
- [ ] `NEXT_PUBLIC_API_URL` set to actual backend URL
- [ ] Sufficient disk space for temp files (`MAX_FILE_SIZE_MB × concurrent_users × 2`)
- [ ] FFmpeg installed and available in PATH
- [ ] yt-dlp installed and available in PATH
- [ ] Firewall allows port 3001 (or only via nginx)
- [ ] Cleanup scheduler running (it starts automatically)
- [ ] Rate limiting configured to your needs
- [ ] Monitored with uptime checker

---

## Scaling Notes

- For high throughput, add Redis + Bull queue (backend has queue/ stubs ready)
- Use S3/R2 object storage instead of local disk for output files
- Consider a CDN in front of download links for large files
- Run multiple backend instances behind a load balancer (stateless except for temp files)
- GPU-accelerated FFmpeg: replace `libx264` with `h264_nvenc` for NVIDIA GPUs
