// Content script — bridges postMessage from the page to the extension background.
// Content scripts run in an isolated world; postMessage is the only way
// to communicate across the boundary.

// Use long-lived port (chrome.runtime.connect) instead of one-shot sendMessage
// to prevent MV3 service worker from being terminated mid-async-operation.

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "TRANSMUX_REFRESH_COOKIES") return;

  const { backendUrl, jobId } = event.data;

  const port = chrome.runtime.connect({ name: "transmux-cookies" });
  port.postMessage({ type: "TRANSMUX_GET_COOKIES", backendUrl, jobId });
  port.onMessage.addListener((response) => {
    window.postMessage(
      { type: "TRANSMUX_COOKIES_RESULT", ...response },
      "*"
    );
  });
});
