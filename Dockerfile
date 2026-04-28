# Transmux Backend — Production Docker Image
FROM node:20-slim

# Install FFmpeg and yt-dlp system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && pip3 install yt-dlp --break-system-packages \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install dependencies
RUN npm install --workspace=backend --workspace=shared

# Copy source
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend

# Create temp directory
RUN mkdir -p /tmp/transmux && chmod 777 /tmp/transmux

EXPOSE 3001

ENV NODE_ENV=production
ENV TEMP_DIR=/tmp/transmux

CMD ["node", "backend/dist/index.js"]
