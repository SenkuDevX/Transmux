// Content script - listens for cookie requests from the Transmux page
// and relays them to the extension's background service worker.

window.addEventListener("TRANSMUX_REFRESH_COOKIES", (event) => {
  const detail = event.detail;
  chrome.runtime.sendMessage(
    {
      type: "TRANSMUX_GET_COOKIES",
      backendUrl: detail.backendUrl,
      jobId: detail.jobId,
    },
    (response) => {
      window.dispatchEvent(
        new CustomEvent("TRANSMUX_COOKIES_RESULT", { detail: response })
      );
    }
  );
});
