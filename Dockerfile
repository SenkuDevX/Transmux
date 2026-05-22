FROM node:22-slim

# Install system deps + deno + curl_cffi (compiled against system OpenSSL) + yt-dlp
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip python3-dev build-essential libcurl4-openssl-dev pkg-config curl git unzip ca-certificates && rm -rf /var/lib/apt/lists/* && \
    npm install -g deno && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages -U pip && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages --no-binary curl_cffi 'curl_cffi>=0.7.0' && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages 'yt-dlp[default]' && \
    deno --version && \
    python3 -c "from curl_cffi import requests; print('curl_cffi OK')" && \
    yt-dlp --version

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
