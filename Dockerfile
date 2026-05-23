FROM node:22-bookworm

# Install system deps + deno + ffmpeg + yt-dlp
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip python3-dev curl ca-certificates && rm -rf /var/lib/apt/lists/* && \
    npm install -g deno && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages -U pip && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages "yt-dlp[default]"

# Uninstall curl_cffi — its bundled OpenSSL 1.1 conflicts with system OpenSSL 3.x
# yt-dlp will fall back to Python's native requests library
RUN PIP_REQUIRE_VIRTUALENV=false pip3 uninstall -y curl_cffi

RUN deno --version && yt-dlp --version

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build:server
ENV NODE_ENV=production
ENV PORT=7860
ENV CLOUD_MODE=true
ENV PYTHONUNBUFFERED=1
EXPOSE 7860
CMD ["node", "dist/server.cjs"]
