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

async function fetchJson(url: string): Promise<{ results: MediaItem[] }> {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch {
    return { results: [] };
  }
}

// Construit une URL discover avec UN SEUL genre (évite le AND de TMDB)
function discoverUrl(
  mediaType: "movie" | "tv",
  genre: number,
  opts: {
    sortBy?: string;
    minVotes?: number;
    minScore?: number;
    yearFrom?: number;
    yearTo?: number;
    runtimeMin?: number;
    runtimeMax?: number;
    page?: number;
  } = {}
): string {
  const p = new URLSearchParams({
    action: "discover",
    mediaType,
    genres: String(genre),
    sortBy: opts.sortBy || "vote_average.desc",
    minVotes: String(opts.minVotes ?? 200),
    minScore: String(opts.minScore ?? 6.0),
    page: String(opts.page ?? 1),
  });
  if (opts.yearFrom) p.set("yearFrom", String(opts.yearFrom));
  if (opts.yearTo) p.set("yearTo", String(opts.yearTo));
  if (opts.runtimeMin) p.set("runtimeMin", String(opts.runtimeMin));
  if (opts.runtimeMax) p.set("runtimeMax", String(opts.runtimeMax));
  return `/api/tmdb?${p.toString()}`;
}

// ── SCORING côté client ───────────────────────────────────────────────────────
// Règle n°1 : au moins 1 genre requis doit être présent → sinon éliminé
// Règle n°2 : genre match pèse 60%, note pèse 30%, popularité 10%
function scoreQuizItem(
  item: MediaItem,
  requiredGenres: number[],
  bonusGenres: number[],
  hardExclude: number[],
  minScore: number
): number {
  if (!item.poster_path) return 0;
  if (item.vote_average < minScore) return 0;

  const genres = item.genre_ids || [];

  // Genres interdits → élimination
  if (hardExclude.some((g) => genres.includes(g))) return 0;

  // Au moins 1 genre requis → sinon éliminé
  const reqMatches = genres.filter((g) => requiredGenres.includes(g)).length;
  if (reqMatches === 0) return 0;

  // Genre score (60 pts max)
  const totalPossible = requiredGenres.length + bonusGenres.length;
  const bonusMatches = genres.filter((g) => bonusGenres.includes(g)).length;
  const genreScore = ((reqMatches * 2 + bonusMatches) / (totalPossible * 2 + 1)) * 60;

  // Note score (30 pts max) — normalisée entre minScore et 10
  const ratingScore = ((item.vote_average - minScore) / (10 - minScore)) * 30;

  // Popularité (10 pts max)
  const popScore = Math.min((item.vote_count ?? 0) / 1000, 10);

  return genreScore + ratingScore + popScore;
}

// ── QUIZ ENGINE ───────────────────────────────────────────────────────────────
async function buildQuizRecommendations(
  answers: Record<string, string | string[]>
): Promise<MediaItem[]> {
  const mood     = (answers.mood as string)     || "action";
  const vibe     = (answers.vibe as string)     || "intense";
  const duration = (answers.duration as string) || "medium";
  const era      = (answers.era as string)      || "any";
  const themes   = (answers.themes as string[]) || [];
  const rawType  = answers.mediaType as string;

  const isAnime  = rawType === "anime";
  const mediaType: "movie" | "tv" =
    rawType === "tv" || duration === "series" ? "tv" : "movie";

  const requiredGenres = MOOD_TO_GENRES[mood]?.[mediaType] || MOOD_TO_GENRES.action[mediaType];
  const bonusGenres    = themes
    .flatMap((t) => MOOD_TO_GENRES[t]?.[mediaType] || [])
    .filter((g) => !requiredGenres.includes(g));
  const hardExclude    = VIBE_EXCLUDE[vibe]?.[mediaType] || [];

  const sortBy   = VIBE_SORT[vibe]     || "vote_average.desc";
  const minVotes = VIBE_MIN_VOTES[vibe] || 150;
  const minScore = DURATION_MIN_SCORE[duration] || 6.0;
  const era_y    = ERA_YEARS[era] || {};
  const runtime  = mediaType === "movie" ? DURATION_RUNTIME[duration] : {};

  const raw: MediaItem[] = [];

  if (isAnime) {
    const [a1, a2] = await Promise.all([
      fetchJson("/api/tmdb?action=anime"),
      fetchJson(discoverUrl("tv", 16, { sortBy: "vote_average.desc", minVotes: 200, minScore: 7.0, ...era_y })),
    ]);
    raw.push(...(a1.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));
    raw.push(...(a2.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));
  } else {
    // On lance UN fetch PAR genre requis (TMDB retourne tous les films avec CE genre)
    // puis on filtre côté client pour garder ceux qui ont vraiment le bon genre
    const fetchsPerGenre = requiredGenres.flatMap((genreId) => [
      fetchJson(discoverUrl(mediaType, genreId, { sortBy, minVotes, minScore, ...era_y, ...(runtime || {}), page: 1 })),
      fetchJson(discoverUrl(mediaType, genreId, { sortBy, minVotes, minScore, ...era_y, ...(runtime || {}), page: 2 })),
      fetchJson(discoverUrl(mediaType, genreId, { sortBy: "popularity.desc", minVotes: 100, minScore: minScore - 0.5, ...era_y, page: 1 })),
    ]);

    // Bonus genres aussi
    const bonusFetches = bonusGenres.slice(0, 3).map((genreId) =>
      fetchJson(discoverUrl(mediaType, genreId, { sortBy: "vote_average.desc", minVotes, minScore, ...era_y }))
    );

    const allResults = await Promise.all([...fetchsPerGenre, ...bonusFetches]);
    allResults.forEach((d, i) => {
      const isBonus = i >= fetchsPerGenre.length;
      const mapped = (d.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType }));
      // Les résultats bonus ont moins de poids mais on les inclut pour la diversité
      if (!isBonus || raw.length < 30) raw.push(...mapped);
    });
  }

  // Scoring côté client — genre match prime TOUJOURS
  const scored = raw
    .map((item) => ({
      item,
      score: scoreQuizItem(item, requiredGenres, bonusGenres, hardExclude, minScore - 0.5),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const result = dedup(scored.map((x) => x.item), new Set()).slice(0, 24);

  // Fallback si vraiment rien : juste les items avec le genre sans filtre strict
  if (result.length < 5 && requiredGenres.length > 0) {
    const fallback = await fetchJson(
      discoverUrl(mediaType, requiredGenres[0], { sortBy: "popularity.desc", minVotes: 50, minScore: 5.0, page: 1 })
    );
    const fb = (fallback.results || [])
      .map((r: MediaItem) => ({ ...r, media_type: mediaType }))
      .filter((r: MediaItem) => r.poster_path);
    return dedup([...result, ...fb], new Set()).slice(0, 24);
  }

  return result;
}

// ── ANALYSIS ENGINE ───────────────────────────────────────────────────────────
async function buildAnalysisRecommendations(
  watchedItems: MediaItem[]
): Promise<MediaItem[]> {
  const watchedIds = new Set(watchedItems.map((w) => w.id));

  // Profil de genre pondéré
  const genreWeights = new Map<number, number>();
  const mediaTypeCount = { movie: 0, tv: 0 };

  watchedItems.forEach((item) => {
    const influence = item.vote_average || 7;
    (item.genre_ids || []).forEach((gid, idx) => {
      const w = influence * Math.pow(0.7, idx);
      genreWeights.set(gid, (genreWeights.get(gid) || 0) + w);
    });
    const isTV = item.media_type === "tv" || (!item.title && !!item.name);
    if (isTV) mediaTypeCount.tv++;
    else mediaTypeCount.movie++;
  });

  const sortedGenres = Array.from(genreWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const topGenres    = sortedGenres.slice(0, 4);
  const dominantType: "movie" | "tv" =
    mediaTypeCount.tv > mediaTypeCount.movie ? "tv" : "movie";
  const avgScore     = watchedItems.reduce((s, i) => s + i.vote_average, 0) / watchedItems.length;
  const minScore     = Math.max(5.5, avgScore - 2.0);
  const maxWeight    = Math.max(...Array.from(genreWeights.values()), 1);

  const raw: MediaItem[] = [];

  // 1. TMDB recommendations + similar pour chaque item visionné
  const recPromises = watchedItems.slice(0, 5).flatMap((item) => {
    const type: "movie" | "tv" =
      item.media_type === "tv" || (!item.title && !!item.name) ? "tv" : "movie";
    return [
      fetchJson(`/api/tmdb?action=recommendations&mediaType=${type}&id=${item.id}`)
        .then((d) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: type }))),
      fetchJson(`/api/tmdb?action=similar&mediaType=${type}&id=${item.id}`)
        .then((d) => (d.results || []).slice(0, 10).map((r: MediaItem) => ({ ...r, media_type: type }))),
    ];
  });
  const recResults = await Promise.all(recPromises);
  recResults.forEach((arr) => raw.push(...arr));

  // 2. Discover UN genre à la fois pour les top genres
  const discoverPromises = topGenres.flatMap((gid) => [
    fetchJson(discoverUrl(dominantType, gid, { sortBy: "vote_average.desc", minVotes: 300, minScore, page: 1 }))
      .then((d) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType }))),
    fetchJson(discoverUrl(dominantType, gid, { sortBy: "popularity.desc", minVotes: 100, minScore, page: 1 }))
      .then((d) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType }))),
  ]);
  const discoverResults = await Promise.all(discoverPromises);
  discoverResults.forEach((arr) => raw.push(...arr));

  // Scoring — genre match prime
  const scored = raw
    .filter((item) => item.poster_path && item.vote_average >= minScore && !watchedIds.has(item.id))
    .map((item) => {
      const genres = item.genre_ids || [];
      let genreScore = 0;
      genres.forEach((gid) => {
        genreScore += ((genreWeights.get(gid) || 0) / maxWeight) * 60;
      });
      if (genreScore === 0) return { item, score: 0 };
      const ratingScore = ((item.vote_average - minScore) / (10 - minScore)) * 30;
      const popScore    = Math.min((item.vote_count ?? 0) / 2000, 10);
      return { item, score: genreScore + ratingScore + popScore };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return dedup(scored.map((x) => x.item), watchedIds).slice(0, 24);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { currentView, setView, setRecommendations, setRecommendationSource, addToHistory } =
    useAppStore();
  const [loading, setLoading]     = useState(false);
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
    } catch {
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
    } catch {
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
          {currentView === "home"     && <HomeView />}
          {currentView === "quiz"     && <QuizView onComplete={handleQuizComplete} />}
          {currentView === "analysis" && <AnalysisView onAnalyze={handleAnalysisComplete} />}
          {currentView === "results"  && <ResultsView onReset={() => setView("home")} />}
        </>
      )}
    </>
  );
}
