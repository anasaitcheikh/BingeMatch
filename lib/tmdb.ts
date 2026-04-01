const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p";
const API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;

export const tmdbImage = (path: string | null, size = "w500") =>
  path ? `${TMDB_IMAGE}/${size}${path}` : "/placeholder-poster.jpg";

export const tmdbImageOriginal = (path: string | null) =>
  path ? `${TMDB_IMAGE}/original${path}` : "/placeholder-backdrop.jpg";

async function tmdbFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("api_key", API_KEY || "");
  url.searchParams.set("language", "fr-FR");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

export async function getTrending(mediaType: "movie" | "tv" | "all" = "all") {
  return tmdbFetch(`/trending/${mediaType}/week`);
}

export async function searchMulti(query: string) {
  return tmdbFetch("/search/multi", { query, include_adult: "false" });
}

export async function getMovieDetails(id: number) {
  return tmdbFetch(`/movie/${id}`, { append_to_response: "credits,similar,videos" });
}

export async function getTVDetails(id: number) {
  return tmdbFetch(`/tv/${id}`, { append_to_response: "credits,similar,videos" });
}

export async function discoverByGenres(
  mediaType: "movie" | "tv",
  genreIds: number[],
  page = 1
) {
  return tmdbFetch(`/discover/${mediaType}`, {
    with_genres: genreIds.join(","),
    sort_by: "vote_average.desc",
    "vote_count.gte": "200",
    page: String(page),
  });
}

export async function getGenres(mediaType: "movie" | "tv") {
  return tmdbFetch(`/genre/${mediaType}/list`);
}

export async function getSimilar(mediaType: "movie" | "tv", id: number) {
  return tmdbFetch(`/${mediaType}/${id}/similar`);
}

export async function getPopularAnime() {
  return tmdbFetch("/discover/tv", {
    with_genres: "16",
    with_keywords: "210024",
    sort_by: "vote_average.desc",
    "vote_count.gte": "200",
  });
}

// Media type helpers
export type MediaType = "movie" | "tv" | "anime";

export interface MediaItem {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  media_type?: string;
}

export function getTitle(item: MediaItem): string {
  return item.title || item.name || "Titre inconnu";
}

export function getYear(item: MediaItem): string {
  const date = item.release_date || item.first_air_date;
  return date ? new Date(date).getFullYear().toString() : "—";
}

// Genre mapping for quiz
export const MOOD_TO_GENRES: Record<string, { movie: number[]; tv: number[] }> = {
  action: { movie: [28, 12], tv: [10759] },
  comedy: { movie: [35], tv: [35] },
  drama: { movie: [18], tv: [18] },
  horror: { movie: [27, 53], tv: [9648] },
  scifi: { movie: [878, 9648], tv: [10765] },
  romance: { movie: [10749, 35], tv: [10749] },
  animation: { movie: [16], tv: [16] },
  documentary: { movie: [99], tv: [99] },
  thriller: { movie: [53, 80], tv: [80] },
  fantasy: { movie: [14, 12], tv: [10765, 10759] },
};
