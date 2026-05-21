import React, { useState } from "react";
import { Link2, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { apiFetch } from "../api";

interface UrlInputProps {
  onMetadataFetched: (metadata: any) => void;
  onUrlReset: () => void;
  activeUrl: string | null;
  onLoadingChange?: (isLoading: boolean) => void;
}

export default function UrlInput({ onMetadataFetched, onUrlReset, activeUrl, onLoadingChange }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setErrorText(null);
    setIsLoading(true);
    if (onLoadingChange) onLoadingChange(true);

    try {
      const response = await apiFetch("/api/url/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        onMetadataFetched(data.metadata);
      } else {
        setErrorText(data.error || "The link could not be parsed. Make sure it points to a valid public stream.");
      }
    } catch (err) {
      setErrorText("Connecting to media inspector failed. Please retry.");
    } finally {
      setIsLoading(false);
      if (onLoadingChange) onLoadingChange(false);
    }
  };

  const handleClear = () => {
    setUrl("");
    setErrorText(null);
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
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap transition-colors whitespace-nowrap"
          >
            Clear URL
          </button>
        </div>
      ) : (
        <form id="url-input-form" onSubmit={handleSubmit} className="relative">
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
              disabled={isLoading}
              className="w-full pl-12 pr-32 py-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 focus:border-slate-900 dark:focus:border-slate-200 focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-200 rounded-2xl text-sm placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 outline-none transition-all"
            />
            <button
              type="submit"
              id="url-submit-btn"
              disabled={isLoading || !url.trim()}
              className="absolute right-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-650 dark:hover:bg-indigo-600 disabled:bg-slate-100 dark:disabled:bg-slate-950 disabled:text-slate-400 dark:disabled:text-slate-600 text-white dark:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Analyze Url
                </>
              )}
            </button>
          </div>

          <p id="url-disclaimer" className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 px-1">
            * Transmux is designed to pull metadata and format layouts of public or user-authorized sources only.
          </p>
        </form>
      )}

      {errorText && (
        <div id="url-input-error" className="flex items-start gap-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 px-4 py-3 rounded-xl text-xs leading-relaxed">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-medium flex-1">{errorText}</p>
        </div>
      )}
    </div>
  );
}
