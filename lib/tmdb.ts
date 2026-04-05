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

export async function getSimilar(mediaType: "movie" | "tv", id: number) {
  return tmdbFetch(`/${mediaType}/${id}/similar`);
}

export async function getRecommendations(mediaType: "movie" | "tv", id: number) {
  return tmdbFetch(`/${mediaType}/${id}/recommendations`);
}

// Fetch keywords for a movie or tv show
export async function getKeywords(mediaType: "movie" | "tv", id: number) {
  const data = await tmdbFetch(`/${mediaType}/${id}/keywords`);
  // Movies return { keywords: [] }, TV returns { results: [] }
  return {
    keywords: data.keywords || data.results || [],
  };
}

export async function getMovieDetails(id: number) {
  return tmdbFetch(`/movie/${id}`, { append_to_response: "credits" });
}

export async function getTVDetails(id: number) {
  return tmdbFetch(`/tv/${id}`, { append_to_response: "credits" });
}

export async function discoverPrecise(
  mediaType: "movie" | "tv",
  opts: {
    genreIds?: number[];
    withoutGenreIds?: number[];
    withKeywords?: number[];
    sortBy?: string;
    minVotes?: number;
    minScore?: number;
    yearFrom?: number;
    yearTo?: number;
    page?: number;
    runtime?: { min?: number; max?: number };
  } = {}
) {
  const params: Record<string, string> = {
    sort_by: opts.sortBy || "vote_average.desc",
    "vote_count.gte": String(opts.minVotes ?? 200),
    "vote_average.gte": String(opts.minScore ?? 6.0),
    page: String(opts.page ?? 1),
  };
  if (opts.genreIds?.length)        params.with_genres    = opts.genreIds.join(",");
  if (opts.withoutGenreIds?.length) params.without_genres = opts.withoutGenreIds.join(",");
  if (opts.withKeywords?.length)    params.with_keywords  = opts.withKeywords.join("|"); // OR logic
  if (opts.runtime?.min) params["with_runtime.gte"] = String(opts.runtime.min);
  if (opts.runtime?.max) params["with_runtime.lte"] = String(opts.runtime.max);

  if (mediaType === "movie") {
    if (opts.yearFrom) params["primary_release_date.gte"] = `${opts.yearFrom}-01-01`;
    if (opts.yearTo)   params["primary_release_date.lte"] = `${opts.yearTo}-12-31`;
  } else {
    if (opts.yearFrom) params["first_air_date.gte"] = `${opts.yearFrom}-01-01`;
    if (opts.yearTo)   params["first_air_date.lte"] = `${opts.yearTo}-12-31`;
  }

  return tmdbFetch(`/discover/${mediaType}`, params);
}

export async function getPopularAnime() {
  return tmdbFetch("/discover/tv", {
    with_genres: "16",
    with_keywords: "210024",
    sort_by: "vote_average.desc",
    "vote_count.gte": "500",
    "vote_average.gte": "7",
  });
}

export type MediaType = "movie" | "tv" | "anime";

export interface MediaItem {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  media_type?: string;
}

export interface KeywordItem {
  id: number;
  name: string;
}

export function getTitle(item: MediaItem): string {
  return item.title || item.name || "Titre inconnu";
}

export function getYear(item: MediaItem): string {
  const date = item.release_date || item.first_air_date;
  return date ? new Date(date).getFullYear().toString() : "—";
}

// ── Quiz mappings ─────────────────────────────────────────────────────────────

export const MOOD_TO_GENRES: Record<string, { movie: number[]; tv: number[] }> = {
  action:      { movie: [28, 12, 53],        tv: [10759, 10765] },
  comedy:      { movie: [35, 10751],         tv: [35, 10751]    },
  drama:       { movie: [18, 36],            tv: [18, 10766]    },
  horror:      { movie: [27, 53],            tv: [9648, 80]     },
  scifi:       { movie: [878, 9648],         tv: [10765, 9648]  },
  romance:     { movie: [10749, 35, 18],     tv: [10749, 18]    },
  animation:   { movie: [16],                tv: [16]           },
  documentary: { movie: [99],                tv: [99]           },
  thriller:    { movie: [53, 80, 9648],      tv: [80, 9648]     },
  fantasy:     { movie: [14, 12, 16],        tv: [10765, 10759] },
};

export const VIBE_EXCLUDE: Record<string, { movie: number[]; tv: number[] }> = {
  intense: { movie: [35, 10751], tv: [35, 10751] },
  chill:   { movie: [27, 53, 28], tv: [27, 53]   },
  mind:    { movie: [35, 28],     tv: [35]        },
  fun:     { movie: [27, 18, 36], tv: [27, 18]   },
};

export const VIBE_SORT: Record<string, string> = {
  intense: "vote_average.desc",
  chill:   "popularity.desc",
  mind:    "vote_average.desc",
  fun:     "popularity.desc",
};

export const VIBE_MIN_VOTES: Record<string, number> = {
  intense: 300,
  chill:   150,
  mind:    300,
  fun:     150,
};

export const ERA_YEARS: Record<string, { yearFrom?: number; yearTo?: number }> = {
  classic: { yearTo: 2000 },
  modern:  { yearFrom: 2000, yearTo: 2015 },
  recent:  { yearFrom: 2015 },
  any:     {},
};

export const DURATION_RUNTIME: Record<string, { runtimeMin?: number; runtimeMax?: number }> = {
  short:  { runtimeMax: 95 },
  medium: { runtimeMin: 85, runtimeMax: 150 },
  long:   { runtimeMin: 140 },
  series: {},
};

export const DURATION_MIN_SCORE: Record<string, number> = {
  short:  6.0,
  medium: 6.0,
  long:   6.5,
  series: 6.5,
};
