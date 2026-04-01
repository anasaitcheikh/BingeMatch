"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { MediaItem, getTitle, getYear, tmdbImage } from "@/lib/tmdb";
import MediaCard from "./MediaCard";

interface Props {
  onReset: () => void;
}

type FilterType = "all" | "movie" | "tv";

export default function ResultsView({ onReset }: Props) {
  const { recommendations, recommendationSource, likedItems, dislikedIds } = useAppStore();
  const [filter, setFilter] = useState<FilterType>("all");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  const filtered = recommendations.filter((item) => {
    if (dislikedIds.includes(item.id)) return false;
    if (filter === "all") return true;
    if (filter === "movie") return item.media_type === "movie" || (!item.media_type && item.title);
    if (filter === "tv") return item.media_type === "tv" || (!item.media_type && item.name);
    return true;
  });

  const likedCount = recommendations.filter((r) => likedItems.some((l) => l.id === r.id)).length;

  const sourceLabel = recommendationSource === "quiz" ? "Test Psychologique" : "Analyse de vos goûts";
  const sourceEmoji = recommendationSource === "quiz" ? "🧠" : "📊";

  return (
    <div className="min-h-screen px-6 py-28">
      {/* Background orbs */}
      <div className="fixed orb w-[600px] h-[600px] bg-neon/5 top-0 left-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-5 py-2 mb-6 text-sm text-white/60 border border-white/10">
            <span>{sourceEmoji}</span>
            <span>Recommandations via {sourceLabel}</span>
          </div>

          <h1
            className="text-5xl md:text-7xl font-bold text-white mb-4"
            style={{ fontFamily: "var(--font-display, 'Bebas Neue'), sans-serif", letterSpacing: "0.03em" }}
          >
            Vos{" "}
            <span className="gradient-text-fire">recommandations</span>
          </h1>

          <p className="text-white/50 text-lg">
            {filtered.length} contenus sélectionnés rien que pour vous
            {likedCount > 0 && ` · ${likedCount} sauvegardé${likedCount > 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Stats row */}
        <div
          className={`grid grid-cols-3 gap-4 mb-10 transition-all duration-700 delay-100 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {[
            { label: "Recommandations", value: recommendations.length, color: "text-accent" },
            { label: "Sauvegardés", value: likedItems.length, color: "text-cyan" },
            { label: "Score moyen", value: recommendations.length ? `${(recommendations.reduce((a, b) => a + b.vote_average, 0) / recommendations.length).toFixed(1)}/10` : "—", color: "text-gold" },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-2xl p-5 text-center border border-white/5">
              <p className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.value}</p>
              <p className="text-white/40 text-xs uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div
          className={`flex items-center gap-3 mb-8 flex-wrap transition-all duration-700 delay-200 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {(["all", "movie", "tv"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                filter === f
                  ? "bg-accent text-white shadow-lg shadow-accent/30"
                  : "glass text-white/60 hover:text-white border border-white/10 hover:border-white/20"
              }`}
            >
              {f === "all" ? "🎬 Tout" : f === "movie" ? "🎥 Films" : "📺 Séries"}
            </button>
          ))}

          <div className="ml-auto">
            <button
              onClick={onReset}
              className="text-white/30 hover:text-white/70 transition-colors text-sm flex items-center gap-2"
            >
              ← Nouvelle recherche
            </button>
          </div>
        </div>

        {/* Hero recommendation */}
        {filtered.length > 0 && (
          <div
            className={`mb-10 transition-all duration-700 delay-300 ${
              loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <HeroCard item={filtered[0]} />
          </div>
        )}

        {/* Grid */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 transition-all duration-700 delay-400 ${
            loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {filtered.slice(1).map((item, i) => (
            <MediaCard key={item.id} item={item} index={i} showActions={true} />
          ))}
        </div>

        {/* Empty */}
        {filtered.length === 0 && (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🫣</div>
            <p className="text-white/40 text-xl">Aucun résultat pour ce filtre</p>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <button onClick={onReset} className="btn-primary text-white font-semibold px-10 py-4 rounded-full text-base">
            🔄 Relancer une recherche
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroCard({ item }: { item: MediaItem }) {
  const { likedItems, toggleLike } = useAppStore();
  const isLiked = likedItems.some((l) => l.id === item.id);
  const score = Math.round(item.vote_average * 10);

  return (
    <div className="relative rounded-3xl overflow-hidden h-80 md:h-96 group">
      {/* Backdrop */}
      {item.backdrop_path ? (
        <img
          src={`https://image.tmdb.org/t/p/w1280${item.backdrop_path}`}
          alt={getTitle(item)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neon/30 to-accent/30" />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />

      {/* Badge */}
      <div className="absolute top-5 left-5 bg-accent text-white text-xs font-bold px-4 py-1.5 rounded-full tracking-wider">
        ⭐ TOP RECOMMANDATION
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
        <div className="flex items-start justify-between">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{ background: score >= 75 ? "rgba(6, 214, 160, 0.2)" : "rgba(244, 162, 97, 0.2)", color: score >= 75 ? "#06d6a0" : "#f4a261" }}
              >
                {score}% match
              </div>
              <span className="text-white/40 text-sm">{getYear(item)}</span>
            </div>

            <h2
              className="text-3xl md:text-5xl font-bold text-white mb-3 leading-tight"
              style={{ fontFamily: "var(--font-display, 'Bebas Neue'), sans-serif" }}
            >
              {getTitle(item)}
            </h2>

            {item.overview && (
              <p className="text-white/60 text-sm md:text-base leading-relaxed line-clamp-2">
                {item.overview}
              </p>
            )}
          </div>

          <button
            onClick={() => toggleLike({ id: item.id, title: getTitle(item), poster_path: item.poster_path, media_type: item.media_type || "movie", vote_average: item.vote_average })}
            className={`action-btn w-14 h-14 rounded-full glass border flex items-center justify-center text-2xl ml-4 flex-shrink-0 ${
              isLiked ? "liked border-cyan/50" : "border-white/20 text-white/60"
            }`}
          >
            ♥
          </button>
        </div>
      </div>
    </div>
  );
}
