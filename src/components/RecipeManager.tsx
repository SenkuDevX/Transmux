import { useState, useEffect } from "react";
import { ConversionRecipe, ConversionSettings } from "../types";
import { X, Plus, Trash2, FlaskConical, Music, Video, Image, Disc3, Sparkles, Film, Bookmark } from "lucide-react";

const STORAGE_KEY = "transmux_recipes";

function loadRecipes(): ConversionRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecipes(recipes: ConversionRecipe[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

const DEFAULT_ICONS = [FlaskConical, Music, Video, Image, Disc3, Sparkles, Film, Bookmark];

interface RecipeManagerProps {
  open: boolean;
  onClose: () => void;
  onApplyRecipe: (settings: Partial<ConversionSettings>) => void;
  currentSettings: ConversionSettings;
}

export default function RecipeManager({ open, onClose, onApplyRecipe, currentSettings }: RecipeManagerProps) {
  const [recipes, setRecipes] = useState<ConversionRecipe[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    if (open) setRecipes(loadRecipes());
  }, [open]);

  const handleSaveAsRecipe = () => {
    const recipe: ConversionRecipe = {
      id: crypto.randomUUID(),
      name: `Recipe ${recipes.length + 1}`,
      description: "",
      icon: "FlaskConical",
      settings: {
        outputFormat: currentSettings.outputFormat,
        audioBitrate: currentSettings.audioBitrate,
        audioSampleRate: currentSettings.audioSampleRate,
        audioChannels: currentSettings.audioChannels,
        videoResolution: currentSettings.videoResolution,
        videoFps: currentSettings.videoFps,
        videoCodec: currentSettings.videoCodec,
        audioCodec: currentSettings.audioCodec,
        videoBitrate: currentSettings.videoBitrate,
        videoCrf: currentSettings.videoCrf,
        burnSubtitles: currentSettings.burnSubtitles,
        stripAudio: currentSettings.stripAudio,
        hardwareAccel: currentSettings.hardwareAccel,
        webhookUrl: currentSettings.webhookUrl,
      },
      createdAt: new Date().toISOString(),
    };
    const updated = [recipe, ...recipes];
    setRecipes(updated);
    saveRecipes(updated);
    setEditing(recipe.id);
    setEditName(recipe.name);
    setEditDesc(recipe.description);
  };

  const handleDelete = (id: string) => {
    const updated = recipes.filter((r) => r.id !== id);
    setRecipes(updated);
    saveRecipes(updated);
    if (editing === id) setEditing(null);
  };

  const handleApply = (recipe: ConversionRecipe) => {
    onApplyRecipe(recipe.settings);
    onClose();
  };

  const handleSaveEdit = (id: string) => {
    const updated = recipes.map((r) =>
      r.id === id ? { ...r, name: editName || r.name, description: editDesc } : r
    );
    setRecipes(updated);
    saveRecipes(updated);
    setEditing(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-indigo-500" />
            Batch Automation Recipes
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          <button
            onClick={handleSaveAsRecipe}
            className="w-full text-xs px-3 py-2 bg-indigo-100 dark:bg-indigo-950/40 hover:bg-indigo-200 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl font-medium transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Save Current Settings as Recipe
          </button>

          {recipes.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-8">
              No recipes saved yet. Configure your settings and save them as a recipe for quick reuse.
            </p>
          )}

          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
            >
              {editing === recipe.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Recipe name"
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-400"
                  />
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(recipe.id)}
                      className="text-xs px-3 py-1.5 bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 rounded-lg font-medium cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FlaskConical className="h-4 w-4 text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{recipe.name}</p>
                        {recipe.description && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{recipe.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => { setEditing(recipe.id); setEditName(recipe.name); setEditDesc(recipe.description); }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Rename"
                      >
                        <Bookmark className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(recipe.id)}
                        className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {recipe.settings.outputFormat && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-mono">
                        {recipe.settings.outputFormat.toUpperCase()}
                      </span>
                    )}
                    {(recipe.settings.videoCodec && recipe.settings.videoCodec !== "keep") && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded font-mono">
                        {recipe.settings.videoCodec}
                      </span>
                    )}
                    {(recipe.settings.videoResolution && recipe.settings.videoResolution !== "keep") && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded font-mono">
                        {recipe.settings.videoResolution}
                      </span>
                    )}
                    {(recipe.settings.videoCrf && recipe.settings.videoCrf !== "keep") && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded font-mono">
                        CRF {recipe.settings.videoCrf}
                      </span>
                    )}
                    {(recipe.settings.audioBitrate && recipe.settings.audioBitrate !== "keep") && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded font-mono">
                        {recipe.settings.audioBitrate}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleApply(recipe)}
                    className="w-full text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium transition-all cursor-pointer"
                  >
                    Apply Recipe
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
