# Transmux API Reference

Base URL: `http://localhost:3001` (dev) or your deployed backend URL.

---

## Health

### `GET /api/health`
Returns service status and tool availability.

**Response**
```json
{
  "status": "ok",
  "ffmpeg": true,
  "ytdlp": true,
  "version": "1.0.0"
}
```

---

## Jobs

### `POST /api/jobs`
Create a new conversion job.

**Request** (multipart/form-data)
| Field  | Type   | Description                                  |
|--------|--------|----------------------------------------------|
| `file` | File   | Media file to convert (max 500MB)            |
| `meta` | string | JSON string with job settings (see below)    |

**meta JSON shape**
```json
{
  "mode": "audio",
  "outputFormat": "MP3",
  "options": {
    "bitrate": "192k",
    "sampleRate": 44100,
    "normalize": true,
    "trimStart": 10,
    "trimEnd": 120
  }
}
```

For URL-based jobs, omit `file` and add `sourceUrl` to the JSON body:
```json
{
  "mode": "video",
  "outputFormat": "MP4",
  "options": { "resolution": "1920x1080", "crf": 18 },
  "sourceUrl": "https://www.youtube.com/watch?v=..."
}
```

**Response** `201`
```json
{
  "job": {
    "id": "abc123",
    "status": "queued",
    "mode": "audio",
    "inputName": "song.m4a",
    "inputSize": 5242880,
    "outputFormat": "MP3",
    "options": { "bitrate": "192k" },
    "progress": 0,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z",
    "expiresAt": "2024-01-01T13:00:00Z"
  }
}
```

---

### `GET /api/jobs/:id`
Get current job status and progress.

**Response**
```json
{
  "job": {
    "id": "abc123",
    "status": "processing",
    "progress": 47,
    ...
  }
}
```

---

### `GET /api/jobs/:id/download`
Download the converted output file.

Returns the file with `Content-Disposition: attachment`.

**Errors**
- `404` — Job not found
- `409` — Job not complete yet
- `410` — Output file expired

---

### `DELETE /api/jobs/:id`
Cancel and delete a job and its output file.

---

### `POST /api/jobs/probe`
Upload a file to extract metadata without creating a conversion job.

**Request** (multipart/form-data): `file`

**Response**
```json
{
  "metadata": {
    "duration": 240.5,
    "width": 1920,
    "height": 1080,
    "fps": 29.97,
    "videoCodec": "h264",
    "audioCodec": "aac",
    "audioBitrate": 192000,
    "sampleRate": 44100,
    "channels": 2,
    "size": 52428800
  }
}
```

---

## URL Processing

### `POST /api/url/info`
Fetch metadata for a permitted URL using yt-dlp.

**Request**
```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

**Response**
```json
{
  "metadata": {
    "url": "https://...",
    "title": "My Video",
    "duration": 272,
    "width": 1280,
    "height": 720,
    "thumbnail": "https://i.ytimg.com/...",
    "availableFormats": [
      { "formatId": "22", "ext": "mp4", "resolution": "1280x720", "label": "720p" },
      { "formatId": "140", "ext": "m4a", "label": "Audio 128k" }
    ]
  }
}
```

**Errors**
- `403` — URL not in permitted domains list

---

## WebSocket

Connect to `ws://localhost:3001/ws` to receive real-time job updates.

**Message format**
```json
{
  "type": "job_update",
  "job": { ...ConversionJob }
}
```

---

## Rate Limits

| Endpoint          | Limit         |
|-------------------|---------------|
| Global            | 100 req/min   |
| `POST /api/jobs`  | 20 req/min    |
| `POST /api/url/*` | 10 req/min    |

Rate limit headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

---

## Conversion Options Reference

### Audio
| Option       | Type    | Example    | Description                    |
|-------------|---------|------------|--------------------------------|
| `bitrate`   | string  | `"192k"`   | Audio bitrate                  |
| `sampleRate`| number  | `44100`    | Sample rate in Hz              |
| `channels`  | 1 or 2  | `2`        | Mono or stereo                 |
| `normalize` | boolean | `true`     | EBU R128 loudness normalization|
| `trimStart` | number  | `10`       | Start time in seconds          |
| `trimEnd`   | number  | `120`      | End time in seconds            |

### Video
| Option        | Type    | Example        | Description                  |
|--------------|---------|----------------|------------------------------|
| `resolution` | string  | `"1920x1080"`  | Output resolution            |
| `fps`        | number  | `30`           | Frame rate                   |
| `crf`        | number  | `18`           | Quality (0=best, 51=worst)   |
| `preset`     | string  | `"medium"`     | Encoding speed/quality trade |
| `removeAudio`| boolean | `false`        | Strip audio track            |
| `trimStart`  | number  | `5`            | Start time in seconds        |
| `trimEnd`    | number  | `60`           | End time in seconds          |
| `rotate`     | 90/180/270 | `90`        | Rotation angle               |

### Image
| Option         | Type   | Example | Description                  |
|---------------|--------|---------|------------------------------|
| `quality`     | number | `85`    | JPEG/WebP quality (1-100)    |
| `extractFrame`| number | `5.5`   | Timestamp to extract         |
| `fps`         | number | `10`    | GIF frame rate               |
