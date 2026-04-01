"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useAppStore } from "@/lib/store";
import { MediaItem, getTitle, tmdbImage } from "@/lib/tmdb";

interface Props {
  onAnalyze: (items: MediaItem[]) => void;
}

function useDebounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  return ((...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fn(...args), delay);
  }) as T;
}

export default function AnalysisView({ onAnalyze }: Props) {
  const { watchedItems, addWatchedItem, removeWatchedItem } = useAppStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const search = async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/tmdb?action=search&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const filtered = (data.results || [])
        .filter((item: any) => item.media_type !== "person" && (item.poster_path || item.title || item.name))
        .slice(0, 6);
      setResults(filtered);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useDebounce(search, 400);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val);
  };

  const handleAdd = (item: MediaItem) => {
    addWatchedItem(item);
    setQuery("");
    setResults([]);
  };

  const POPULAR_SUGGESTIONS = [
    "Breaking Bad", "Game of Thrones", "Inception", "Interstellar",
    "Attack on Titan", "The Office", "Parasite", "Dune",
  ];

  return (
    <div className="min-h-screen px-6 py-28">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-accent text-sm tracking-widest uppercase mb-4">Analyse Personnalisée</p>
          <h1
            className="text-5xl md:text-6xl font-bold text-white mb-4"
            style={{ fontFamily: "var(--font-display, 'Bebas Neue'), sans-serif", letterSpacing: "0.03em" }}
          >
            Ce que vous avez{" "}
            <span className="gradient-text-fire">déjà aimé</span>
          </h1>
          <p className="text-white/50 text-lg max-w-lg mx-auto">
            Entrez les films et séries que vous avez adorés. Notre IA analysera vos goûts pour vous proposer des pépites similaires.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <div className={`glass rounded-2xl border transition-all duration-300 ${focused ? "border-accent/50 glow-accent" : "border-white/10"}`}>
            <div className="flex items-center px-5 py-4 gap-4">
              <span className="text-xl">🔍</span>
              <input
                type="text"
                value={query}
                onChange={handleInput}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 200)}
                placeholder="Rechercher un film, série ou animé..."
                className="flex-1 bg-transparent text-white placeholder-white/30 text-base outline-none"
              />
              {loading && (
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Dropdown results */}
          {results.length > 0 && focused && (
            <div className="absolute top-full left-0 right-0 mt-2 glass-strong rounded-2xl border border-white/10 overflow-hidden z-30">
              {results.map((item) => (
                <button
                  key={item.id}
                  onMouseDown={() => handleAdd(item)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                >
                  <div className="w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    {item.poster_path ? (
                      <Image
                        src={tmdbImage(item.poster_path, "w92")}
                        alt={getTitle(item)}
                        width={40}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🎬</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{getTitle(item)}</p>
                    <p className="text-xs text-white/40">
                      {item.media_type === "movie" ? "Film" : item.media_type === "tv" ? "Série" : "Contenu"}
                      {" · "}
                      ⭐ {item.vote_average.toFixed(1)}
                    </p>
                  </div>
                  <span className="text-accent text-sm flex-shrink-0">+ Ajouter</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick suggestions */}
        {watchedItems.length === 0 && (
          <div className="mb-10">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-4">Suggestions populaires</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); search(s); setFocused(true); }}
                  className="genre-pill px-4 py-2 rounded-full text-sm text-white/60 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Watched list */}
        {watchedItems.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">
                Votre liste ({watchedItems.length})
              </h2>
              <span className="text-white/30 text-sm">
                {watchedItems.length >= 3
                  ? "✓ Assez pour analyser !"
                  : `Encore ${3 - watchedItems.length} pour de meilleures suggestions`}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-8">
              {watchedItems.map((item, i) => (
                <div key={item.id} className="relative group">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-muted">
                    {item.poster_path ? (
                      <Image
                        src={tmdbImage(item.poster_path, "w185")}
                        alt={getTitle(item)}
                        fill
                        className="object-cover"
                        sizes="120px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeWatchedItem(item.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:scale-110"
                  >
                    ×
                  </button>
                  <p className="text-xs text-white/50 mt-1.5 truncate text-center">{getTitle(item)}</p>
                </div>
              ))}
            </div>

            {/* Analyze CTA */}
            <div className="flex justify-center">
              <button
                onClick={() => onAnalyze(watchedItems)}
                className="btn-primary text-white font-semibold px-12 py-4 rounded-full text-base"
              >
                🧠 Analyser mes goûts →
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {watchedItems.length === 0 && !query && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎭</div>
            <p className="text-white/30 text-lg">Ajoutez au moins 3 contenus que vous avez aimés</p>
            <p className="text-white/20 text-sm mt-2">Notre IA analysera vos préférences pour vous trouver des pépites</p>
          </div>
        )}
      </div>
    </div>
  );
}
