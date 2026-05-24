import React, { useState, useRef } from "react";
import { Link2, Sparkles, Loader2, AlertCircle, Chrome, RefreshCw, List } from "lucide-react";
import { apiFetch } from "../api";

const BACKEND_URL = import.meta.env.VITE_API_URL || window.location.origin;

interface UrlInputProps {
  onMetadataFetched: (metadata: any) => void;
  onUrlReset: () => void;
  activeUrl: string | null;
  onLoadingChange?: (isLoading: boolean) => void;
  onPlaylistDetected?: (playlist: any) => void;
}

export default function UrlInput({ onMetadataFetched, onUrlReset, activeUrl, onLoadingChange, onPlaylistDetected }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [waitingCookies, setWaitingCookies] = useState(false);
  const [multiUrl, setMultiUrl] = useState(false);
  const [multiUrls, setMultiUrls] = useState("");
  const pendingUrl = useRef<string>("");

  const submitUrl = async (targetUrl: string) => {
    setErrorText(null);
    setIsLoading(true);
    setWaitingCookies(false);
    if (onLoadingChange) onLoadingChange(true);

    try {
      // First: check if this is a playlist
      try {
        const playlistRes = await apiFetch("/api/url/playlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        const playlistData = await playlistRes.json();
        if (playlistRes.ok && playlistData.success && playlistData.isPlaylist && playlistData.count > 1) {
          setIsLoading(false);
          if (onLoadingChange) onLoadingChange(false);
          onPlaylistDetected?.(playlistData);
          return;
        }
      } catch {}

      // Single video metadata
      const response = await apiFetch("/api/url/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onMetadataFetched(data.metadata);
      } else if (data.waitingCookies) {
        pendingUrl.current = targetUrl;
        setWaitingCookies(true);
        setErrorText("YouTube requires authentication. Send cookies from your browser to continue.");
      } else {
        setErrorText(data.error || "The link could not be parsed. Make sure it points to a valid public stream.");
      }
    } catch {
      setErrorText("Connecting to media inspector failed. Please retry.");
    } finally {
      setIsLoading(false);
      if (onLoadingChange) onLoadingChange(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (multiUrl) {
      const urls = multiUrls.split("\n").map((u) => u.trim()).filter((u) => u.startsWith("http"));
      if (urls.length === 0) {
        setErrorText("Paste at least one valid URL (starting with http:// or https://)");
        return;
      }
      if (urls.length === 1) {
        await submitUrl(urls[0]);
        return;
      }
      // Multiple URLs: create synthetic playlist
      onPlaylistDetected?.({
        title: `Batch Import (${urls.length} URLs)`,
        count: urls.length,
        isPlaylist: true,
        entries: urls.map((u, i) => ({
          index: i,
          id: `batch-${i}`,
          title: `URL ${i + 1}`,
          url: u,
          duration: 0,
          thumbnail: "",
        })),
      });
      return;
    }

    if (!url.trim()) return;
    await submitUrl(url.trim());
  };

  const handleCookieRetry = async () => {
    setWaitingCookies(false);
    setErrorText("Requesting cookies from browser...");

    // Try extension via postMessage
    window.postMessage(
      { type: "TRANSMUX_REFRESH_COOKIES", backendUrl: BACKEND_URL, jobId: "pending" },
      "*"
    );

    // Wait for extension response with timeout
    const result = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 10000);
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "TRANSMUX_COOKIES_RESULT") {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve(event.data.success === true);
        }
      };
      window.addEventListener("message", handler);
    });

    if (!result) {
      setErrorText("Extension did not respond. Use the 🔑 Admin Key panel in the header to paste cookies manually, then try again.");
      return;
    }

    // Retry metadata extraction
    await submitUrl(pendingUrl.current);
  };

  const handleClear = () => {
    setUrl("");
    setErrorText(null);
    setWaitingCookies(false);
    onUrlReset();
  };

  return (
    <div id="url-input-container" className="w-full space-y-4">
      {activeUrl ? (
        <div id="url-input-selected" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 truncate">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800">
              <Link2 className="h-4.5 w-4.5" />
            </div>
            <div className="truncate">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Permitted URL Stream Loaded</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-md">{activeUrl}</p>
            </div>
          </div>
          <button
            id="btn-url-clear"
            onClick={handleClear}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap transition-colors"
          >
            Clear URL
          </button>
        </div>
      ) : (
        <form id="url-input-form" onSubmit={handleSubmit} className="relative">
          {/* Mode toggle */}
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => setMultiUrl(false)}
              className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                !multiUrl
                  ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-transparent"
              }`}
            >
              <Link2 className="h-3 w-3 inline mr-1" />Single URL
            </button>
            <button type="button" onClick={() => setMultiUrl(true)}
              className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                multiUrl
                  ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-transparent"
              }`}
            >
              <List className="h-3 w-3 inline mr-1" />Multi URL
            </button>
          </div>

          {multiUrl ? (
            <div className="relative">
              <textarea
                id="url-textarea"
                value={multiUrls}
                onChange={(e) => setMultiUrls(e.target.value)}
                placeholder="Paste multiple URLs, one per line:&#10;https://youtube.com/watch?v=...&#10;https://soundcloud.com/...&#10;https://twitter.com/..."
                disabled={isLoading || waitingCookies}
                rows={5}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-200 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-200 rounded-2xl p-3 text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 outline-none transition-all resize-none font-mono"
              />
              <button
                type="submit"
                id="url-multi-submit-btn"
                disabled={isLoading || !multiUrls.trim() || waitingCookies}
                className="absolute bottom-3 right-3 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-650 dark:hover:bg-indigo-600 disabled:bg-slate-100 dark:disabled:bg-slate-950 disabled:text-slate-400 dark:disabled:text-slate-600 text-white dark:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" />Import URLs</>
                )}
              </button>
            </div>
          ) : (
            <div className="relative flex items-center">
              <div className="absolute left-4 text-slate-400">
                <Link2 className="h-5 w-5" />
              </div>
              <input
                type="text"
                id="url-field"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste media link here (e.g. YouTube, Vimeo, Soundcloud...)"
                disabled={isLoading || waitingCookies}
                className="w-full pl-12 pr-32 py-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-200 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-200 rounded-2xl text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 outline-none transition-all"
              />
              <button
                type="submit"
                id="url-submit-btn"
                disabled={isLoading || !url.trim() || waitingCookies}
                className="absolute right-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-650 dark:hover:bg-indigo-600 disabled:bg-slate-100 dark:disabled:bg-slate-950 disabled:text-slate-400 dark:disabled:text-slate-600 text-white dark:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analyzing</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" />Analyze Url</>
                )}
              </button>
            </div>
          )}

          <p id="url-disclaimer" className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 px-1">
            * Transmux is designed to pull metadata and format layouts of public or user-authorized sources only.
          </p>
        </form>
      )}

      {errorText && !waitingCookies && (
        <div id="url-input-error" className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 px-4 py-3 rounded-xl text-xs leading-relaxed">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium flex-1">{errorText}</p>
        </div>
      )}

      {waitingCookies && (
        <div id="url-cookie-needed" className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">YouTube Requires Authentication</p>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
            The Transmux browser extension can send your signed-in YouTube cookies to bypass this.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleCookieRetry}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 cursor-pointer"
            >
              <Chrome className="h-3.5 w-3.5" />
              Send Cookies via Extension
            </button>
            <button
              onClick={() => setWaitingCookies(false)}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Retrying...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
