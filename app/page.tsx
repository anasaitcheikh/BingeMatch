"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  MediaItem,
  MOOD_TO_GENRES, VIBE_EXCLUDE, VIBE_SORT, VIBE_MIN_VOTES,
  ERA_YEARS, DURATION_RUNTIME, DURATION_MIN_SCORE,
} from "@/lib/tmdb";
import Navbar from "@/components/Navbar";
import HomeView from "@/components/HomeView";
import QuizView from "@/components/QuizView";
import AnalysisView from "@/components/AnalysisView";
import ResultsView from "@/components/ResultsView";
import LoadingScreen from "@/components/LoadingScreen";

// ── Helpers ───────────────────────────────────────────────────────────────────

function dedup(items: MediaItem[], excludeIds: Set<number>): MediaItem[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id) || excludeIds.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildDiscoverUrl(
  mediaType: "movie" | "tv",
  opts: {
    genres?: number[];
    excludeGenres?: number[];
    sortBy?: string;
    minVotes?: number;
    minScore?: number;
    yearFrom?: number;
    yearTo?: number;
    runtimeMin?: number;
    runtimeMax?: number;
    page?: number;
  }
): string {
  const p = new URLSearchParams({ action: "discover", mediaType });
  if (opts.genres?.length) p.set("genres", opts.genres.join(","));
  if (opts.excludeGenres?.length) p.set("excludeGenres", opts.excludeGenres.join(","));
  if (opts.sortBy) p.set("sortBy", opts.sortBy);
  if (opts.minVotes) p.set("minVotes", String(opts.minVotes));
  if (opts.minScore) p.set("minScore", String(opts.minScore));
  if (opts.yearFrom) p.set("yearFrom", String(opts.yearFrom));
  if (opts.yearTo) p.set("yearTo", String(opts.yearTo));
  if (opts.runtimeMin) p.set("runtimeMin", String(opts.runtimeMin));
  if (opts.runtimeMax) p.set("runtimeMax", String(opts.runtimeMax));
  if (opts.page) p.set("page", String(opts.page));
  return `/api/tmdb?${p.toString()}`;
}

async function fetchJson(url: string): Promise<{ results: MediaItem[] }> {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch {
    return { results: [] };
  }
}

// ── Scoring function for quiz results ────────────────────────────────────────
function scoreItem(
  item: MediaItem,
  targetGenres: number[],
  excludeGenres: number[],
  minScore: number
): number {
  if (!item.poster_path) return -1;
  if (item.vote_average < minScore) return -1;
  if ((item.vote_count ?? 0) < 50) return -1;

  const genres = item.genre_ids || [];
  if (excludeGenres.some((g) => genres.includes(g))) return -1;

  let score = item.vote_average * 10; // base: 0–100
  const genreMatches = genres.filter((g) => targetGenres.includes(g)).length;
  score += genreMatches * 15; // bonus per matching genre
  score += Math.min((item.vote_count ?? 0) / 1000, 10); // popularity bonus (capped)

  return score;
}

// ── QUIZ RECOMMENDATION ENGINE ───────────────────────────────────────────────
async function buildQuizRecommendations(
  answers: Record<string, string | string[]>
): Promise<MediaItem[]> {
  const mood = (answers.mood as string) || "action";
  const vibe = (answers.vibe as string) || "intense";
  const duration = (answers.duration as string) || "medium";
  const era = (answers.era as string) || "any";
  const themes = (answers.themes as string[]) || [];
  const rawMediaType = answers.mediaType as string;

  const isAnime = rawMediaType === "anime";
  const isAll = rawMediaType === "all";
  const mediaType: "movie" | "tv" =
    rawMediaType === "tv" || (rawMediaType === "all" && duration === "series")
      ? "tv"
      : "movie";

  // Collect genres
  const moodGenreIds = MOOD_TO_GENRES[mood]?.[mediaType] || MOOD_TO_GENRES.action[mediaType];
  const themeGenreIds = themes.flatMap(
    (t) => MOOD_TO_GENRES[t]?.[mediaType] || []
  );
  const allTargetGenres = Array.from(new Set([...moodGenreIds, ...themeGenreIds]));
  const excludeGenreIds = VIBE_EXCLUDE[vibe]?.[mediaType] || [];
  const finalGenres = allTargetGenres.filter((g) => !excludeGenreIds.includes(g));

  const sortBy = VIBE_SORT[vibe] || "vote_average.desc";
  const minVotes = VIBE_MIN_VOTES[vibe] || 300;
  const minScore = DURATION_MIN_SCORE[duration] || 6.5;
  const eraYears = ERA_YEARS[era] || {};
  const runtime = mediaType === "movie" ? DURATION_RUNTIME[duration] : undefined;

  const results: MediaItem[] = [];

  if (isAnime) {
    // Anime: dedicated fetch with high quality bar
    const anime = await fetchJson("/api/tmdb?action=anime");
    results.push(...(anime.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));

    // Also search anime by mood genre
    const animeGenre = await fetchJson(
      buildDiscoverUrl("tv", {
        genres: [16, ...finalGenres.filter((g) => g !== 16)],
        excludeGenres: [10762, 10763], // no kids/news
        sortBy: "vote_average.desc",
        minVotes: 300,
        minScore: 7.0,
        ...eraYears,
      })
    );
    results.push(...(animeGenre.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));
  } else {
    // Primary fetch: top genres + all filters
    const primary = await fetchJson(
      buildDiscoverUrl(mediaType, {
        genres: finalGenres.slice(0, 3),
        excludeGenres: excludeGenreIds,
        sortBy,
        minVotes,
        minScore,
        ...eraYears,
        ...(runtime || {}),
      })
    );
    results.push(...(primary.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType })));

    // Secondary fetch: page 2 for variety
    const secondary = await fetchJson(
      buildDiscoverUrl(mediaType, {
        genres: finalGenres.slice(0, 3),
        excludeGenres: excludeGenreIds,
        sortBy,
        minVotes,
        minScore,
        ...eraYears,
        ...(runtime || {}),
        page: 2,
      })
    );
    results.push(...(secondary.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType })));

    // If "all", also grab the other media type
    if (isAll) {
      const otherType: "movie" | "tv" = mediaType === "movie" ? "tv" : "movie";
      const otherGenres = MOOD_TO_GENRES[mood]?.[otherType] || [];
      const other = await fetchJson(
        buildDiscoverUrl(otherType, {
          genres: otherGenres.slice(0, 2),
          sortBy,
          minVotes,
          minScore,
          ...eraYears,
        })
      );
      results.push(...(other.results || []).map((r: MediaItem) => ({ ...r, media_type: otherType })));
    }

    // Tertiary: mood-only (broader) if not enough results
    if (results.length < 20) {
      const broader = await fetchJson(
        buildDiscoverUrl(mediaType, {
          genres: moodGenreIds.slice(0, 2),
          sortBy: "vote_average.desc",
          minVotes: 200,
          minScore: 6.0,
          ...eraYears,
        })
      );
      results.push(...(broader.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType })));
    }
  }

  // Score and sort
  const scored = results
    .map((item) => ({
      item,
      score: scoreItem(item, allTargetGenres, excludeGenreIds, minScore - 0.5),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return dedup(scored.map((x) => x.item), new Set()).slice(0, 24);
}

// ── ANALYSIS RECOMMENDATION ENGINE ──────────────────────────────────────────
async function buildAnalysisRecommendations(
  watchedItems: MediaItem[]
): Promise<MediaItem[]> {
  const watchedIds = new Set(watchedItems.map((w) => w.id));

  // 1. Build a weighted genre profile
  const genreWeights = new Map<number, number>();
  const mediaTypeCount = { movie: 0, tv: 0 };

  watchedItems.forEach((item) => {
    const score = item.vote_average || 7; // higher-rated items influence more
    (item.genre_ids || []).forEach((gid, idx) => {
      // First genre gets full weight, subsequent ones get less
      const weight = score * (1 - idx * 0.15);
      genreWeights.set(gid, (genreWeights.get(gid) || 0) + weight);
    });
    const isTV = item.media_type === "tv" || (!item.title && !!item.name);
    if (isTV) mediaTypeCount.tv++;
    else mediaTypeCount.movie++;
  });

  const sortedGenres = Array.from(genreWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const topGenres = sortedGenres.slice(0, 5);
  const top2Genres = sortedGenres.slice(0, 2);

  // Determine dominant media type
  const dominantType: "movie" | "tv" =
    mediaTypeCount.tv > mediaTypeCount.movie ? "tv" : "movie";

  const avgScore = watchedItems.reduce((s, i) => s + i.vote_average, 0) / watchedItems.length;
  const minScore = Math.max(6.0, avgScore - 1.5); // bar relative to what they already liked

  const results: MediaItem[] = [];

  // 2. TMDB "recommendations" for each watched item (best quality signal)
  for (const item of watchedItems.slice(0, 5)) {
    const type = item.media_type === "tv" || (!item.title && !!item.name) ? "tv" : "movie";
    const [recs, similar] = await Promise.all([
      fetchJson(`/api/tmdb?action=recommendations&mediaType=${type}&id=${item.id}`),
      fetchJson(`/api/tmdb?action=similar&mediaType=${type}&id=${item.id}`),
    ]);
    const all = [...(recs.results || []), ...(similar.results || [])];
    results.push(...all.map((r: MediaItem) => ({ ...r, media_type: type })));
  }

  // 3. Discover by top genres (dominant type) — 3 fetches for variety
  const [disc1, disc2, disc3] = await Promise.all([
    fetchJson(buildDiscoverUrl(dominantType, {
      genres: topGenres.slice(0, 3),
      sortBy: "vote_average.desc",
      minVotes: 400,
      minScore,
    })),
    fetchJson(buildDiscoverUrl(dominantType, {
      genres: top2Genres,
      sortBy: "popularity.desc",
      minVotes: 200,
      minScore,
    })),
    fetchJson(buildDiscoverUrl(dominantType, {
      genres: topGenres.slice(0, 3),
      sortBy: "vote_average.desc",
      minVotes: 300,
      minScore,
      page: 2,
    })),
  ]);

  results.push(
    ...(disc1.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType })),
    ...(disc2.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType })),
    ...(disc3.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType })),
  );

  // 4. Cross-type: if they watch mostly movies, suggest some top series and vice versa
  const otherType: "movie" | "tv" = dominantType === "movie" ? "tv" : "movie";
  const crossGenres = topGenres
    .slice(0, 2)
    .filter((g) => [18, 28, 878, 14, 53, 35, 27].includes(g)); // genres that work on both
  if (crossGenres.length) {
    const cross = await fetchJson(buildDiscoverUrl(otherType, {
      genres: crossGenres,
      sortBy: "vote_average.desc",
      minVotes: 500,
      minScore: minScore + 0.5,
    }));
    results.push(...(cross.results || []).map((r: MediaItem) => ({ ...r, media_type: otherType })));
  }

  // 5. Score every result based on genre profile match
  const maxWeight = Math.max(...Array.from(genreWeights.values()), 1);

  const scored = results
    .filter((item) => item.poster_path && item.vote_average >= minScore)
    .map((item) => {
      if (watchedIds.has(item.id)) return { item, score: -1 };

      const genres = item.genre_ids || [];
      let score = item.vote_average * 8;

      // Genre match bonus
      genres.forEach((gid) => {
        const weight = genreWeights.get(gid) || 0;
        score += (weight / maxWeight) * 25;
      });

      // Popularity signal
      score += Math.min((item.vote_count ?? 0) / 500, 8);

      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return dedup(scored.map((x) => x.item), watchedIds).slice(0, 24);
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App() {
  const { currentView, setView, setRecommendations, setRecommendationSource, addToHistory } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Analyse en cours...");

  const handleQuizComplete = async (answers: Record<string, string | string[]>) => {
    setLoading(true);
    setLoadingMsg("Composition de votre sélection personnalisée...");
    try {
      const recs = await buildQuizRecommendations(answers);
      setRecommendations(recs);
      setRecommendationSource("quiz");
      addToHistory(recs, "quiz");
      setView("results");
    } catch (err) {
      console.error("Quiz error:", err);
      const fallback = await fetchJson("/api/tmdb?action=trending");
      setRecommendations((fallback.results || []).slice(0, 20));
      setRecommendationSource("quiz");
      setView("results");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalysisComplete = async (watchedItems: MediaItem[]) => {
    setLoading(true);
    setLoadingMsg("Analyse approfondie de vos goûts...");
    try {
      const recs = await buildAnalysisRecommendations(watchedItems);
      setRecommendations(recs);
      setRecommendationSource("analysis");
      addToHistory(recs, "analysis");
      setView("results");
    } catch (err) {
      console.error("Analysis error:", err);
      const fallback = await fetchJson("/api/tmdb?action=trending");
      setRecommendations((fallback.results || []).slice(0, 20));
      setRecommendationSource("analysis");
      setView("results");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      {loading ? (
        <LoadingScreen message={loadingMsg} />
      ) : (
        <>
          {currentView === "home" && <HomeView />}
          {currentView === "quiz" && <QuizView onComplete={handleQuizComplete} />}
          {currentView === "analysis" && <AnalysisView onAnalyze={handleAnalysisComplete} />}
          {currentView === "results" && <ResultsView onReset={() => setView("home")} />}
        </>
      )}
    </>
  );
}
