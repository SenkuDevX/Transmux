FROM node:22-bookworm

# Install system deps + deno + yt-dlp (build curl_cffi from source to match system OpenSSL 3.x)
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip python3-dev libssl-dev pkg-config rustc cargo curl git unzip ca-certificates libcurl4-openssl-dev build-essential gcc g++ && rm -rf /var/lib/apt/lists/* && \
    npm install -g deno && \
    PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages -U pip

# Build curl_cffi from source against system OpenSSL BEFORE yt-dlp installs its wheel
RUN PIP_NO_BINARY=curl_cffi PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages "curl_cffi>=0.12,<0.13"
RUN PIP_REQUIRE_VIRTUALENV=false pip3 install --break-system-packages "yt-dlp[default]"

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
