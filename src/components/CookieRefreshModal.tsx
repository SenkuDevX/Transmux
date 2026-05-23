import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCw, Chrome, Terminal, CheckCircle, AlertTriangle } from "lucide-react";
import { apiFetch } from "../api";

interface Props {
  jobId: string;
  backendUrl: string;
  onDismiss: () => void;
  onCancel?: () => void;
}

export default function CookieRefreshModal({ jobId, backendUrl, onDismiss, onCancel }: Props) {
  const [mode, setMode] = useState<"prompt" | "manual" | "sending" | "success">("prompt");
  const [cookiesText, setCookiesText] = useState("");
  const [error, setError] = useState("");
  const [extensionTried, setExtensionTried] = useState(false);

  const sendCookies = async (cookies: string) => {
    setMode("sending");
    setError("");
    try {
      const res = await apiFetch(`/api/cookies/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies }),
      });
      const data = await res.json();
      if (data.success) {
        setMode("success");
        setTimeout(onDismiss, 2000);
      } else {
        throw new Error(data.error || "Failed to send cookies");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
      setMode("manual");
    }
  };

  const tryExtension = () => {
    setExtensionTried(true);
    setError("");

    // Try extension via postMessage only (CustomEvent doesn't cross isolated world)
    window.postMessage(
      { type: "TRANSMUX_REFRESH_COOKIES", backendUrl, jobId },
      "*"
    );

    // Listen for extension response
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "TRANSMUX_COOKIES_RESULT") {
        window.removeEventListener("message", handler);
        if (event.data.success) {
          clearTimeout(fallbackTimeout);
          setMode("success");
          setTimeout(onDismiss, 2000);
        } else {
          setError(event.data.error || "Extension failed to send cookies");
          setMode("manual");
        }
      }
    };
    window.addEventListener("message", handler);

    // Fallback to manual after 20 seconds if no extension response (MV3 cold start can be slow)
    const fallbackTimeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      if (mode === "prompt") {
        setMode("manual");
        setError("Extension did not respond. Paste cookies manually below.");
      }
    }, 20000);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
        >
          {mode === "prompt" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">YouTube Requires Authentication</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    The server needs fresh YouTube cookies to continue.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={tryExtension}
                  disabled={extensionTried}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Chrome className="h-5 w-5 text-indigo-500" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Auto-Relay via Extension</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Transmux Cookie Relay extension sends cookies in one click</p>
                  </div>
                  <RefreshCw className="h-4 w-4 text-slate-400 ml-auto" />
                </button>

                <button
                  onClick={() => setMode("manual")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Terminal className="h-5 w-5 text-slate-500" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Paste Cookies Manually</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Export via "Get cookies.txt" extension and paste below</p>
                  </div>
                </button>
              </div>

              <button
                onClick={onCancel || onDismiss}
                className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-2 cursor-pointer"
              >
                Cancel download
              </button>
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Terminal className="h-5 w-5 text-slate-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Paste YouTube Cookies</h3>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Use a browser extension like{" "}
                <a href="https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer" className="underline text-indigo-500">"Get cookies.txt LOCALLY"</a>{" "}
                to export YouTube cookies in Netscape format, then paste below.
              </p>

              <textarea
                value={cookiesText}
                onChange={(e) => setCookiesText(e.target.value)}
                rows={8}
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white resize-none"
                placeholder="# Netscape HTTP Cookie File"
              />

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setMode("prompt")}
                  className="flex-1 px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={() => sendCookies(cookiesText)}
                  disabled={!cookiesText.trim()}
                  className="flex-1 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  Send Cookies & Resume
                </button>
              </div>
            </div>
          )}

          {mode === "sending" && (
            <div className="flex items-center gap-3 py-4">
              <RefreshCw className="h-5 w-5 text-indigo-500 animate-spin" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Sending cookies and resuming conversion...</p>
            </div>
          )}

          {mode === "success" && (
            <div className="flex items-center gap-3 py-4">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p className="text-sm text-green-600 dark:text-green-400">Cookies accepted! Conversion resuming...</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
