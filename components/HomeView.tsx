"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { MediaItem, getTitle, tmdbImage } from "@/lib/tmdb";

export default function HomeView() {
  const { setView, likedItems } = useAppStore();
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    fetch("/api/tmdb?action=trending")
      .then((r) => r.json())
      .then((d) => {
        setTrending(d.results?.slice(0, 20) || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (trending.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex((i) => (i + 1) % Math.min(5, trending.length));
    }, 6000);
    return () => clearInterval(interval);
  }, [trending]);

  const hero = trending[heroIndex];

  return (
    <div className="min-h-screen">
      {/* HERO */}
      <div className="relative h-screen overflow-hidden">
        {hero?.backdrop_path && (
          <div className="absolute inset-0">
            <img
              src={`https://image.tmdb.org/t/p/original${hero.backdrop_path}`}
              alt={getTitle(hero)}
              className="w-full h-full object-cover"
              style={{ opacity: 0.4 }}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-void/80 via-transparent to-transparent" />
        <div className="orb w-[700px] h-[700px] bg-accent/10 -top-60 -right-60" />
        <div className="orb w-[500px] h-[500px] bg-neon/10 -bottom-40 -left-40" />

        <div className="relative z-10 h-full flex flex-col justify-end pb-24 px-8 md:px-16 max-w-7xl mx-auto w-full">
          {hero && (
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-xs font-bold tracking-widest text-accent uppercase px-4 py-1.5 rounded-full border border-accent/30 bg-accent/10">
                  🔥 En tendance
                </span>
                <span className="text-white/40 text-sm">
                  {hero.media_type === "movie" ? "Film" : "Série"} · ⭐ {hero.vote_average.toFixed(1)}
                </span>
              </div>

              <h1
                className="text-6xl md:text-8xl font-bold text-white leading-none mb-5 text-glow-accent"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}
              >
                {getTitle(hero)}
              </h1>

              {hero.overview && (
                <p className="text-white/60 text-base md:text-lg leading-relaxed mb-8 max-w-xl line-clamp-3">
                  {hero.overview}
                </p>
              )}

              <div className="flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => setView("quiz")}
                  className="btn-primary text-white font-semibold px-8 py-4 rounded-full text-base"
                >
                  Trouver mon prochain coup de cœur →
                </button>
                <button
                  onClick={() => setView("analysis")}
                  className="glass text-white font-medium px-8 py-4 rounded-full text-base border border-white/15 hover:border-white/30 transition-all"
                >
                  J'ai déjà des favoris
                </button>
              </div>
            </div>
          )}

          {trending.length > 0 && (
            <div className="flex gap-2 mt-8">
              {Array.from({ length: Math.min(5, trending.length) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === heroIndex ? "w-8 bg-accent" : "w-2 bg-white/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-accent text-sm tracking-widest uppercase mb-4">Comment ça marche</p>
            <h2
              className="text-5xl md:text-6xl font-bold text-white"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.03em" }}
            >
              Deux chemins vers{" "}
              <span className="gradient-text-fire">vos pépites</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div
              className="group glass rounded-3xl p-8 border border-white/5 hover:border-accent/30 transition-all duration-500 cursor-pointer relative overflow-hidden"
              onClick={() => setView("quiz")}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🧠</div>
                <h3 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}>
                  Test Psychologique
                </h3>
                <p className="text-white/50 leading-relaxed mb-6">
                  Répondez à 6 questions sur vos émotions, vos goûts et votre humeur. Notre algorithme compose une sélection sur mesure.
                </p>
                <div className="flex items-center gap-3 text-sm text-accent font-medium">
                  <span>Commencer le test</span>
                  <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
                <div className="mt-6 flex gap-2 flex-wrap">
                  {["Humeur", "Ambiance", "Thèmes", "Format"].map((tag) => (
                    <span key={tag} className="genre-pill px-3 py-1 rounded-full text-xs text-white/50">{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="group glass rounded-3xl p-8 border border-white/5 hover:border-neon/30 transition-all duration-500 cursor-pointer relative overflow-hidden"
              onClick={() => setView("analysis")}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-neon/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-neon/10 border border-neon/20 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">📊</div>
                <h3 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.02em" }}>
                  Analyse de vos goûts
                </h3>
                <p className="text-white/50 leading-relaxed mb-6">
                  Entrez vos films et séries préférés. L'IA analyse les genres, styles et thématiques pour trouver ce qui vous ressemble.
                </p>
                <div className="flex items-center gap-3 text-sm font-medium" style={{ color: "#7b2fff" }}>
                  <span>Ajouter mes favoris</span>
                  <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
                <div className="mt-6 flex gap-2 flex-wrap">
                  {["Genres similaires", "Style narratif", "Univers", "Ton"].map((tag) => (
                    <span key={tag} className="genre-pill px-3 py-1 rounded-full text-xs text-white/50">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRENDING */}
      <section className="py-12 px-6 pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.03em" }}>
              Tendances de la semaine
            </h2>
            <span className="text-white/30 text-sm">↑ Mis à jour chaque semaine</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl shimmer" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {trending.slice(0, 15).map((item, i) => (
                <TrendingCard key={item.id} item={item} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* LIKED */}
      {likedItems.length > 0 && (
        <section className="py-12 px-6 pb-28 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-8" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.03em" }}>
              ♥ Vos coups de cœur
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {likedItems.map((item) => (
                <div key={item.id} className="flex-shrink-0 w-32">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-muted mb-2">
                    {item.poster_path ? (
                      <img src={tmdbImage(item.poster_path, "w185")} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                    )}
                  </div>
                  <p className="text-xs text-white/50 truncate text-center">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="py-10 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xl font-bold tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            CINE<span className="gradient-text-fire">AI</span>
          </span>
          <p className="text-white/20 text-sm text-center">
            Propulsé par l'IA · Données fournies par{" "}
            <a href="https://www.themoviedb.org" target="_blank" rel="noopener" className="text-white/40 hover:text-white/70 transition-colors">TMDB</a>
          </p>
          <span className="text-white/20 text-sm">© 2025 CineAI</span>
        </div>
      </footer>
    </div>
  );
}

function TrendingCard({ item, rank }: { item: MediaItem; rank: number }) {
  const { likedItems, toggleLike } = useAppStore();
  const [hovered, setHovered] = useState(false);
  const isLiked = likedItems.some((l) => l.id === item.id);

  return (
    <div
      className="poster-card relative rounded-xl overflow-hidden cursor-pointer group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-[2/3] bg-muted overflow-hidden">
        {item.poster_path ? (
          <img
            src={tmdbImage(item.poster_path)}
            alt={getTitle(item)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl">🎬</div>
        )}

        <div
          className="absolute bottom-0 left-0 text-7xl font-black leading-none select-none pointer-events-none"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: "rgba(255,255,255,0.12)", transform: "translateY(15px)" }}
        >
          {rank}
        </div>

        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}>
          <div className="absolute bottom-4 inset-x-4 flex items-end justify-between">
            <div>
              <p className="text-white text-xs font-semibold leading-tight mb-1 line-clamp-2">{getTitle(item)}</p>
              <p className="text-white/50 text-xs">⭐ {item.vote_average.toFixed(1)}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLike({ id: item.id, title: getTitle(item), poster_path: item.poster_path, media_type: item.media_type || "movie", vote_average: item.vote_average });
              }}
              className={`action-btn w-9 h-9 rounded-full glass flex items-center justify-center text-sm border border-white/20 ${isLiked ? "liked" : "text-white/60"}`}
            >
              ♥
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
