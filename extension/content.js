// Transmux v5.0 Content Script
// Bridges page <-> extension communication
// Injects download buttons on YouTube and detects media URLs

// ─── Cookie Relay Bridge ───

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data?.type === "TRANSMUX_REFRESH_COOKIES") {
    const { backendUrl, jobId } = event.data;
    const port = chrome.runtime.connect({ name: "transmux-cookies" });
    port.postMessage({ type: "TRANSMUX_GET_COOKIES", backendUrl, jobId });
    port.onMessage.addListener((response) => {
      window.postMessage({ type: "TRANSMUX_COOKIES_RESULT", ...response }, "*");
    });
  }

  if (event.data?.type === "TRANSMUX_SEND_PENDING_COOKIES") {
    const { backendUrl } = event.data;
    const port = chrome.runtime.connect({ name: "transmux-cookies" });
    port.postMessage({ type: "TRANSMUX_SEND_PENDING_COOKIES", backendUrl });
    port.onMessage.addListener((response) => {
      window.postMessage({ type: "TRANSMUX_PENDING_COOKIES_RESULT", ...response }, "*");
    });
  }

  // Auth state bridge: web app -> extension
  if (event.data?.type === "TRANSMUX_AUTH_STATE") {
    chrome.runtime.sendMessage({
      type: "TRANSMUX_AUTH_STATE",
      authState: event.data.authState,
      user: event.data.user,
    });
  }
});

// ─── YouTube Page: Inject Download Buttons ───

function injectYouTubeButtons() {
  if (!window.location.hostname.includes("youtube.com")) return;
  if (document.getElementById("transmux-youtube-btn")) return; // already injected

  const observer = new MutationObserver(() => {
    const target = document.querySelector("#top-level-buttons-computed");
    if (!target || document.getElementById("transmux-youtube-btn")) return;

    const buttonContainer = document.createElement("div");
    buttonContainer.id = "transmux-youtube-btn";
    buttonContainer.style.cssText = "display:inline-flex;align-items:center;margin-left:4px;gap:2px";

    const btnStyle = {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "6px 10px",
      borderRadius: "18px",
      border: "none",
      background: "#4f46e5",
      color: "#fff",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "background 0.2s",
    };

    const createBtn = (label, action) => {
      const btn = document.createElement("button");
      Object.assign(btn.style, btnStyle);
      btn.innerHTML = label;
      btn.title = action === "mp3" ? "Download MP3" : action === "clip" ? "Create Clip" : "Quick Convert";
      btn.onmouseenter = () => { btn.style.background = "#6366f1"; };
      btn.onmouseleave = () => { btn.style.background = "#4f46e5"; };
      btn.onclick = (e) => {
        e.stopPropagation();
        const videoUrl = window.location.href.split("&")[0];
        const params = new URLSearchParams({ url: videoUrl });
        if (action === "mp3") params.set("outputFormat", "mp3");
        if (action === "clip") params.set("action", "clip");
        window.open(`https://KurbaniBoy-transmux.hf.space?${params.toString()}`, "_blank");
      };
      return btn;
    };

    buttonContainer.appendChild(createBtn("⬇ MP3", "mp3"));
    buttonContainer.appendChild(createBtn("✂ Clip", "clip"));

    target.appendChild(buttonContainer);
    observer.disconnect();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Media URL Detection ───

function detectPageMedia() {
  const videos = [];
  const audios = [];

  document.querySelectorAll("video").forEach(v => {
    if (v.src && v.src.startsWith("http")) {
      videos.push({ src: v.src, duration: v.duration, poster: v.poster });
    }
    v.querySelectorAll("source").forEach(s => {
      if (s.src && s.src.startsWith("http")) videos.push({ src: s.src });
    });
  });

  document.querySelectorAll("audio").forEach(a => {
    if (a.src && a.src.startsWith("http")) {
      audios.push({ src: a.src, duration: a.duration });
    }
  });

  // Detect m3u8 streams
  document.querySelectorAll('script[src*="hls"], link[href*=".m3u8"]').forEach(el => {
    const href = el.href || el.src;
    if (href) videos.push({ src: href, type: "hls" });
  });

  return { videos, audios, pageUrl: window.location.href, pageTitle: document.title };
}

// Listen for media detection requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TRANSMUX_DETECT_MEDIA") {
    sendResponse(detectPageMedia());
  }
  if (message.type === "TRANSMUX_PING") {
    sendResponse({ alive: true });
  }
  if (message.type === "TRANSMUX_STEALTH_DOWNLOAD") {
    // Stealth download: fetch media through browser context and send to backend
    handleStealthDownload(message.url, message.jobId, message.backendUrl);
    sendResponse({ started: true });
  }
});

// ─── Stealth Download Handler ───

async function handleStealthDownload(url, jobId, backendUrl) {
  try {
    const response = await fetch(url, { credentials: "include", headers: { "Accept": "video/*,audio/*,*/*" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append("media", blob, `stealth_${jobId}.mp4`);
    formData.append("jobId", jobId);
    formData.append("sourceUrl", url);
    await fetch(`${backendUrl}/api/stealth-upload`, { method: "POST", body: formData });
    // Notify popup
    chrome.runtime.sendMessage({ type: "TRANSMUX_STEALTH_COMPLETE", jobId, url });
  } catch (err) {
    console.error("[Stealth] Download failed:", err);
    // Fallback: open normal transmux
    window.open(`${backendUrl}?url=${encodeURIComponent(url)}`, "_blank");
  }
}

// ─── Floating Media Detector ───

function injectFloatingButton() {
  if (document.getElementById("transmux-float-btn")) return;

  const media = detectPageMedia();
  if (media.videos.length === 0 && media.audios.length === 0) return;

  const btn = document.createElement("div");
  btn.id = "transmux-float-btn";
  btn.innerHTML = "⚡";
  btn.title = "Convert with Transmux";
  btn.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:999999;
    width:48px;height:48px;border-radius:50%;
    background:linear-gradient(135deg,#4f46e5,#7c3aed);
    color:#fff;font-size:20px;display:flex;
    align-items:center;justify-content:center;
    cursor:pointer;box-shadow:0 4px 16px rgba(79,70,229,0.4);
    border:none;transition:transform 0.2s,box-shadow 0.2s;
  `;
  btn.onmouseenter = () => { btn.style.transform = "scale(1.1)"; btn.style.boxShadow = "0 6px 24px rgba(79,70,229,0.6)"; };
  btn.onmouseleave = () => { btn.style.transform = "scale(1)"; btn.style.boxShadow = "0 4px 16px rgba(79,70,229,0.4)"; };
  btn.onclick = () => {
    const params = new URLSearchParams({ url: window.location.href });
    window.open(`https://KurbaniBoy-transmux.hf.space?${params.toString()}`, "_blank");
  };

  document.body.appendChild(btn);
}

// ─── Clipboard Watcher ───

document.addEventListener("copy", () => {
  setTimeout(() => {
    try {
      const text = navigator.clipboard?.readText ? null : null;
      // Note: clipboard.readText requires user gesture, so we use a different approach
      // We check if the copied text looks like a URL on next click
    } catch {}
  }, 100);
});

// Listen for clicks after copy to check clipboard
document.addEventListener("click", () => {
  try {
    navigator.clipboard.readText().then(text => {
      if (text && (text.includes("youtube.com") || text.includes("youtu.be") || text.includes("soundcloud.com") || text.includes("vimeo.com") || text.includes("tiktok.com"))) {
        // Store detected URL for popup to pick up
        chrome.storage.local.set({ detectedClipboardUrl: text, detectedAt: Date.now() });
      }
    }).catch(() => {});
  } catch {}
});

// ─── Media Intelligence Overlay ───

let overlayActive = false;
let overlayEl = null;

function injectMediaOverlay() {
  if (overlayEl) return;
  overlayEl = document.createElement("div");
  overlayEl.id = "transmux-overlay";
  overlayEl.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;
    pointer-events:none;display:none;
  `;
  overlayEl.innerHTML = `<div id="transmux-overlay-content" style="
    position:absolute;bottom:80px;right:20px;
    background:rgba(0,0,0,0.85);color:#fff;
    padding:12px 16px;border-radius:12px;
    font-family:monospace;font-size:11px;line-height:1.6;
    max-width:280px;backdrop-filter:blur(8px);
    border:1px solid rgba(255,255,255,0.1);
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
  "></div>`;
  document.body.appendChild(overlayEl);

  // Toggle overlay on Ctrl+Shift+I
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "I") {
      e.preventDefault();
      overlayActive = !overlayActive;
      if (overlayEl) overlayEl.style.display = overlayActive ? "block" : "none";
      if (overlayActive) updateOverlayInfo();
    }
  });
}

function updateOverlayInfo() {
  const content = document.getElementById("transmux-overlay-content");
  if (!content) return;
  const videos = document.querySelectorAll("video");
  const info = [];
  videos.forEach((v, i) => {
    const data = [];
    data.push(`Video ${i + 1}: ${v.videoWidth}x${v.videoHeight}`);
    if (v.duration) data.push(`Duration: ${Math.floor(v.duration)}s`);
    data.push(`Current: ${Math.floor(v.currentTime)}s`);
    data.push(`Ready: ${v.readyState}/${4}`);
    data.push(`Paused: ${v.paused}`);
    data.push(`Volume: ${Math.round(v.volume * 100)}%`);
    info.push(data.join(" | "));
  });
  content.innerHTML = info.length > 0
    ? `🎬 <strong>Media Intelligence</strong><br>${info.join("<br>")}<br><br><span style="font-size:9px;color:#94a3b8">Ctrl+Shift+I to toggle overlay</span>`
    : `🎬 <strong>Media Intelligence</strong><br>No video elements<br><br><span style="font-size:9px;color:#94a3b8">Ctrl+Shift+I to toggle overlay</span>`;
}

// Update overlay info every 2 seconds when active
setInterval(() => {
  if (overlayActive) updateOverlayInfo();
}, 2000);

// ─── Creator Workflow Tools (YouTube Studio) ───

function injectStudioShortcuts() {
  if (!window.location.hostname.includes("studio.youtube.com")) return;
  if (document.getElementById("transmux-studio-bar")) return;

  const bar = document.createElement("div");
  bar.id = "transmux-studio-bar";
  bar.style.cssText = `
    position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
    z-index:9999;display:flex;gap:4px;
    background:rgba(0,0,0,0.8);padding:6px 12px;
    border-radius:12px;backdrop-filter:blur(8px);
    border:1px solid rgba(255,255,255,0.1);
  `;

  const shortcuts = [
    { label: "⬇ MP3", action: "mp3" },
    { label: "⬇ MP4", action: "mp4" },
    { label: "🎞 GIF", action: "gif" },
    { label: "✂ Clip", action: "clip" },
  ];

  shortcuts.forEach(s => {
    const btn = document.createElement("button");
    btn.textContent = s.label;
    btn.style.cssText = `
      padding:4px 10px;border-radius:6px;border:none;
      background:#4f46e5;color:#fff;font-size:10px;
      font-weight:600;cursor:pointer;font-family:inherit;
      transition:background 0.2s;
    `;
    btn.onmouseenter = () => { btn.style.background = "#6366f1"; };
    btn.onmouseleave = () => { btn.style.background = "#4f46e5"; };
    btn.onclick = () => {
      const params = new URLSearchParams({ url: window.location.href.replace("studio.youtube.com", "youtube.com"), outputFormat: s.action });
      window.open(`https://KurbaniBoy-transmux.hf.space?${params.toString()}`, "_blank");
    };
    bar.appendChild(btn);
  });

  document.body.appendChild(bar);
}

// ─── Initialize ───

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    injectYouTubeButtons();
    setTimeout(injectFloatingButton, 2000);
    injectMediaOverlay();
    injectStudioShortcuts();
  });
} else {
  injectYouTubeButtons();
  setTimeout(injectFloatingButton, 2000);
  injectMediaOverlay();
  injectStudioShortcuts();
}
