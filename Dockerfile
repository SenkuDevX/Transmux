FROM node:22-bookworm

# Install system deps + deno + yt-dlp
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip curl git unzip ca-certificates libcurl4-openssl-dev build-essential gcc g++ && rm -rf /var/lib/apt/lists/* && \
    npm install -g deno && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages -U pip && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages "yt-dlp[default]" "curl_cffi>=0.12,<0.13" && \
    deno --version && \
    yt-dlp --version

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
