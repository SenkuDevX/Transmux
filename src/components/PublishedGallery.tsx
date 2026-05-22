import { useState, useEffect } from "react";
import { Film, Radio, FileText, Globe, Download, Play, Calendar, Search, RefreshCw, Copy, Check, FileAudio, FileVideo } from "lucide-react";
import { apiUrl, apiFetch } from "../api";
import { formatSize } from "./MetadataPreview";

interface PublishedItem {
  id: string;
  title: string;
  description: string;
  outputName: string;
  outputFormat: string;
  outputSize: number;
  publishedAt: string;
  isAudio: boolean;
  isVideo: boolean;
  isSubtitle: boolean;
}

interface PublishedGalleryProps {
  onPreview: (id: string, name: string, size: number, isPub: boolean) => void;
  syncTrigger: number;
}

export default function PublishedGallery({ onPreview, syncTrigger }: PublishedGalleryProps) {
  const [items, setItems] = useState<PublishedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "video" | "audio">("all");

  const fetchPublished = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/published");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setItems(data.gallery || []);
        }
      }
    } catch (e) {
      console.error("Failed to load community gallery entries:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublished();
  }, [syncTrigger]);

  const handleCopyLink = async (id: string, name: string) => {
    const directLink = apiUrl(`/api/published/stream/${id}?filename=${encodeURIComponent(name)}`);
    try {
      await navigator.clipboard.writeText(directLink);
      setCopiedId(id);
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: "Gallery stream link copied!", type: "success" } }));
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: `Clipboard permission blocked. Direct link: ${directLink}`, type: "info" } }));
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.outputName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = 
      typeFilter === "all" ||
      (typeFilter === "video" && item.isVideo) ||
      (typeFilter === "audio" && item.isAudio);
    
    return matchesSearch && matchesType;
  });

  return (
    <div id="gallery-container" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">Public Shared Showroom</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Shared conversion outcomes globally accessible</p>
          </div>
        </div>

        <button
          onClick={fetchPublished}
          className="text-xs text-slate-550 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          <span>Sync feed</span>
        </button>
      </div>

      {/* FILTER & TRAFFIC SEARCH bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search matching streams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none placeholder-slate-400"
          />
        </div>

        {/* Filters and Chips */}
        <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold">
          {[
            { id: "all", label: "All Items" },
            { id: "video", label: "Videos" },
            { id: "audio", label: "Audios" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id as any)}
              className={`flex-1 py-1.5 rounded-md text-center transition-all cursor-pointer ${
                typeFilter === tab.id
                  ? "bg-white dark:bg-slate-850 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-800"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* LISTING GALLERY */}
      {loading && items.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
          Fetching published streams from server arrays...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-slate-400 text-xs">
          {items.length === 0 ? "No files published into global lists yet. Be the first to share!" : "No files match active filters."}
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-950/20 dark:hover:bg-slate-900/40 border border-slate-250/60 dark:border-slate-800 rounded-2xl gap-3 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-3 rounded-xl border shrink-0 ${
                  item.isAudio ? "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900 text-sky-800 dark:text-sky-400" :
                  item.isSubtitle ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-400" :
                  "bg-slate-100 dark:bg-slate-850 border-slate-250 dark:border-slate-800 text-slate-800 dark:text-slate-300"
                }`}>
                  {item.isAudio ? <Radio className="h-4.5 w-4.5 animate-bounce-slow" /> :
                   item.isSubtitle ? <FileText className="h-4.5 w-4.5" /> :
                   <Film className="h-4.5 w-4.5" />}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[280px]" title={item.title}>
                    {item.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-1">
                    <span className="uppercase text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center gap-1">
                      {item.isAudio ? (
                        <FileAudio className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      ) : item.isSubtitle ? (
                        <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <FileVideo className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      )}
                      <span>.{item.outputFormat}</span>
                    </span>
                    <span>•</span>
                    <span>{formatSize(item.outputSize)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-3 w-3 inline" />
                      {new Date(item.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTON TRIGGER */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => onPreview(item.id, item.outputName, item.outputSize, true)}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-xl font-bold text-[10px] uppercase flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                  title="Preview/Play stream here directly"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => handleCopyLink(item.id, item.outputName)}
                  className="p-2.5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
                  title="Copy permanent stream address"
                >
                  {copiedId === item.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>

                <a
                  href={(item as any).downloadUrl || apiUrl(`/api/download/${item.id}?filename=${encodeURIComponent(item.outputName)}`)}
                  download={item.outputName}
                  className="p-2.5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-all cursor-pointer"
                  title="Download file contents"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FOOTER METRIC INDEX */}
      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono text-center pt-2 border-t border-slate-100 dark:border-slate-800">
        * Community showroom retains media indefinitely. Transcoded targets are hosted in Saga Server disk pools.
      </div>
    </div>
  );
}
