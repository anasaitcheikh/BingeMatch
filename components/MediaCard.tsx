"use client";

import { useState } from "react";
import Image from "next/image";
import { MediaItem, getTitle, getYear, tmdbImage } from "@/lib/tmdb";
import { useAppStore } from "@/lib/store";

interface Props {
  item: MediaItem;
  index?: number;
  showActions?: boolean;
  onAdd?: (item: MediaItem) => void;
  addLabel?: string;
}

const GENRES: Record<number, string> = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie",
  80: "Crime", 99: "Documentaire", 18: "Drame", 10751: "Famille",
  14: "Fantastique", 36: "Histoire", 27: "Horreur", 10402: "Musique",
  9648: "Mystère", 10749: "Romance", 878: "Sci-Fi", 10770: "Téléfilm",
  53: "Thriller", 10752: "Guerre", 37: "Western", 10759: "Action & Aventure",
  10762: "Kids", 10763: "Actualités", 10764: "Réalité", 10765: "Sci-Fi & Fantastique",
  10766: "Soap", 10767: "Talk", 10768: "Guerre & Politique",
};

export default function MediaCard({ item, index = 0, showActions = true, onAdd, addLabel }: Props) {
  const { likedItems, dislikedIds, toggleLike, toggleDislike, addWatchedItem } = useAppStore();
  const [imageError, setImageError] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isLiked = likedItems.some((l) => l.id === item.id);
  const isDisliked = dislikedIds.includes(item.id);
  const score = Math.round(item.vote_average * 10);
  const title = getTitle(item);
  const year = getYear(item);
  const genres = (item.genre_ids || []).slice(0, 2).map((id) => GENRES[id]).filter(Boolean);

  const scoreColor =
    score >= 75 ? "#06d6a0" : score >= 60 ? "#f4a261" : "#e63946";

  return (
    <div
      className="poster-card relative rounded-xl overflow-hidden cursor-pointer group"
      style={{
        animationDelay: `${index * 0.08}s`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-muted overflow-hidden">
        {!imageError && item.poster_path ? (
          <Image
            src={tmdbImage(item.poster_path)}
            alt={title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            onError={() => setImageError(true)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-muted to-obsidian p-4 text-center">
            <span className="text-5xl mb-3">🎬</span>
            <p className="text-white/50 text-xs leading-tight">{title}</p>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Score badge */}
        <div
          className="absolute top-3 right-3 w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold"
          style={{ borderColor: scoreColor, color: scoreColor, backgroundColor: "rgba(0,0,0,0.7)" }}
        >
          {score}
        </div>

        {/* Actions overlay */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-end p-4 gap-2 transition-all duration-300 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          {showActions && (
            <div className="flex gap-3 mb-1">
              <button
                onClick={(e) => { e.stopPropagation(); toggleLike({ id: item.id, title, poster_path: item.poster_path, media_type: item.media_type || "movie", vote_average: item.vote_average }); }}
                className={`action-btn w-10 h-10 rounded-full glass flex items-center justify-center text-lg ${isLiked ? "liked" : "text-white/70"}`}
              >
                ♥
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleDislike(item.id); }}
                className={`action-btn w-10 h-10 rounded-full glass flex items-center justify-center text-lg ${isDisliked ? "disliked" : "text-white/70"}`}
              >
                ✕
              </button>
            </div>
          )}

          {onAdd && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(item); addWatchedItem(item); }}
              className="w-full py-2 rounded-lg text-xs font-medium text-white glass border border-white/20 hover:border-accent hover:text-accent transition-all"
            >
              {addLabel || "+ Déjà vu"}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-semibold text-white leading-tight truncate">{title}</h3>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">{year}</span>
          {genres.length > 0 && (
            <span className="text-xs text-white/40 truncate ml-2">{genres.join(" · ")}</span>
          )}
        </div>
        {/* Mini rating bar */}
        <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${score}%`, backgroundColor: scoreColor }}
          />
        </div>
      </div>
    </div>
  );
}
