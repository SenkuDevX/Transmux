const YOUTUBE_DOMAINS = [".youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"];

function toNetscapeCookie(c) {
  const domain = c.domain.startsWith(".") ? c.domain : "." + c.domain;
  const includeSub = domain.startsWith(".");
  const path = c.path || "/";
  const secure = c.secure ? "TRUE" : "FALSE";
  const httpOnly = c.httpOnly ? "TRUE" : "FALSE";
  const expires = c.expirationDate ? Math.floor(c.expirationDate).toString() : "0";
  return `${domain}\t${includeSub ? "TRUE" : "FALSE"}\t${path}\t${secure}\t${expires}\t${c.name}\t${c.value}`;
}

function log(msg) {
  const el = document.getElementById("log");
  if (!el) return;
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + el.textContent;
  el.scrollTop = 0;
}

async function countCookies() {
  let all = [];
  for (const domain of YOUTUBE_DOMAINS) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });
      all.push(...cookies);
    } catch {}
  }
  const deduped = new Map();
  for (const c of all) {
    const key = `${c.name}=${c.value}`;
    if (!deduped.has(key)) deduped.set(key, c);
  }
  return deduped.size;
}

async function updateUI() {
  const count = await countCookies();
  document.getElementById("cookie-count").textContent = `${count} cookies found`;

  chrome.storage.local.get("lastSentStr", (result) => {
    document.getElementById("last-sent").textContent = result.lastSentStr || "Never";
  });
}

document.getElementById("test-btn").addEventListener("click", async () => {
  const btn = document.getElementById("test-btn");
  btn.disabled = true;
  btn.textContent = "Checking...";
  log("Extracting YouTube cookies...");

  let all = [];
  for (const domain of YOUTUBE_DOMAINS) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });
      all.push(...cookies);
    } catch (e) {
      log(`Error for ${domain}: ${e.message}`);
    }
  }

  const deduped = new Map();
  for (const c of all) {
    const key = `${c.name}=${c.value}`;
    if (!deduped.has(key)) deduped.set(key, c);
  }

  log(`Found ${deduped.size} unique YouTube cookies`);

  if (deduped.size > 0) {
    const sampleKeys = [...deduped.keys()].slice(0, 5).join(", ");
    log(`Sample cookies: ${sampleKeys}`);
  }

  await updateUI();
  btn.disabled = false;
  btn.textContent = "Test: Check YouTube cookies now";
});

updateUI();
