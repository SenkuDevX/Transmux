FROM node:22-slim
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip curl git unzip && rm -rf /var/lib/apt/lists/*
RUN PIP_REQUIRE_VIRTUALENV=false pip3 install -U pip; PIP_REQUIRE_VIRTUALENV=false pip3 install curl_cffi
RUN curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -o /tmp/deno.zip && unzip -o /tmp/deno.zip -d /usr/local/bin && rm /tmp/deno.zip && chmod +x /usr/local/bin/deno
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp
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
