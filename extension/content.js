// Content script — bridges postMessage from the page to the extension background.
// Content scripts run in an isolated world; postMessage is the only way
// to communicate across the boundary.

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "TRANSMUX_REFRESH_COOKIES") return;

  const { backendUrl, jobId } = event.data;

  chrome.runtime.sendMessage(
    { type: "TRANSMUX_GET_COOKIES", backendUrl, jobId },
    (response) => {
      window.postMessage(
        { type: "TRANSMUX_COOKIES_RESULT", ...response },
        "*"
      );
    }
  );
});
