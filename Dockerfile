FROM node:22-slim

# Install system deps + deno + curl_cffi + yt-dlp
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip curl git unzip && rm -rf /var/lib/apt/lists/* && \
    npm install -g deno && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages -U pip && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages curl_cffi && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    deno --version && \
    python3 -c "from curl_cffi import requests; print('curl_cffi OK')"

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build:server
ENV NODE_ENV=production
ENV PORT=7860
ENV CLOUD_MODE=true
EXPOSE 7860
CMD ["node", "dist/server.cjs"]
