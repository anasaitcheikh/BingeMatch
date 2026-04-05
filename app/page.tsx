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

// ── SCORING — genre match est LE critère principal ────────────────────────────
//
// Logique :
//   - Un item sans AU MOINS UN genre cible → score 0 (éliminé)
//   - Chaque genre cible présent → +40 pts  (dominant)
//   - vote_average → max +20 pts            (secondaire)
//   - popularité   → max +5 pts             (tie-breaker)
//
function scoreQuizItem(
  item: MediaItem,
  requiredGenres: number[],   // genres qui DOIVENT matcher (au moins 1)
  bonusGenres: number[],      // genres supplémentaires qui donnent un bonus
  hardExclude: number[],      // genres qui éliminent totalement l'item
  minScore: number
): number {
  if (!item.poster_path) return 0;
  if (item.vote_average < minScore) return 0;
  if ((item.vote_count ?? 0) < 50) return 0;

  const genres = item.genre_ids || [];

  // Hard exclusion : si l'item a un genre interdit → éliminé
  if (hardExclude.some((g) => genres.includes(g))) return 0;

  // OBLIGATOIRE : au moins 1 genre cible doit être présent
  const requiredMatches = genres.filter((g) => requiredGenres.includes(g)).length;
  if (requiredMatches === 0) return 0;

  // Score genre (dominant) : 40 pts par genre requis matchant
  let score = requiredMatches * 40;

  // Bonus genres (thèmes supplémentaires) : 15 pts chacun
  const bonusMatches = genres.filter((g) => bonusGenres.includes(g)).length;
  score += bonusMatches * 15;

  // Note TMDB (secondaire, max 20 pts)
  score += ((item.vote_average - minScore) / (10 - minScore)) * 20;

  // Popularité en tie-breaker (max 5 pts)
  score += Math.min((item.vote_count ?? 0) / 2000, 5);

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
  const mediaType: "movie" | "tv" =
    rawMediaType === "tv" || duration === "series" ? "tv" : "movie";

  // Genres obligatoires (humeur principale)
  const requiredGenres = MOOD_TO_GENRES[mood]?.[mediaType] || MOOD_TO_GENRES.action[mediaType];

  // Genres bonus (thèmes choisis dans le quiz, sans les requis)
  const bonusGenres = themes
    .flatMap((t) => MOOD_TO_GENRES[t]?.[mediaType] || [])
    .filter((g) => !requiredGenres.includes(g));

  // Genres à exclure durement (vibe incompatible)
  const hardExclude = VIBE_EXCLUDE[vibe]?.[mediaType] || [];

  const sortBy = VIBE_SORT[vibe] || "vote_average.desc";
  const minVotes = VIBE_MIN_VOTES[vibe] || 300;
  const minScore = DURATION_MIN_SCORE[duration] || 6.0;
  const eraYears = ERA_YEARS[era] || {};
  const runtime = mediaType === "movie" ? DURATION_RUNTIME[duration] : undefined;

  const raw: MediaItem[] = [];

  if (isAnime) {
    const [a1, a2] = await Promise.all([
      fetchJson("/api/tmdb?action=anime"),
      fetchJson(buildDiscoverUrl("tv", {
        genres: [16],
        excludeGenres: [10762, 10763],
        sortBy: "vote_average.desc",
        minVotes: 300,
        minScore: 7.0,
        ...eraYears,
      })),
    ]);
    raw.push(...(a1.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));
    raw.push(...(a2.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));
  } else {
    // Fetch 1 : genres requis stricts (TMDB doit retourner des items avec ces genres)
    // Fetch 2 : page 2 des mêmes
    // Fetch 3 : genre requis + bonus genres combinés
    // Fetch 4 : requiredGenres seuls mais trié par popularité (pour diversité)
    const [f1, f2, f3, f4] = await Promise.all([
      fetchJson(buildDiscoverUrl(mediaType, {
        genres: requiredGenres.slice(0, 2), // TMDB filtre par AND si plusieurs → garder 1-2 max
        excludeGenres: hardExclude,
        sortBy,
        minVotes,
        minScore,
        ...eraYears,
        ...(runtime || {}),
      })),
      fetchJson(buildDiscoverUrl(mediaType, {
        genres: requiredGenres.slice(0, 2),
        excludeGenres: hardExclude,
        sortBy,
        minVotes,
        minScore,
        ...eraYears,
        ...(runtime || {}),
        page: 2,
      })),
      fetchJson(buildDiscoverUrl(mediaType, {
        genres: [...requiredGenres.slice(0, 1), ...bonusGenres.slice(0, 1)],
        excludeGenres: hardExclude,
        sortBy: "vote_average.desc",
        minVotes: Math.floor(minVotes * 0.6),
        minScore,
        ...eraYears,
        ...(runtime || {}),
      })),
      fetchJson(buildDiscoverUrl(mediaType, {
        genres: requiredGenres.slice(0, 1),
        excludeGenres: hardExclude,
        sortBy: "popularity.desc",
        minVotes: 100,
        minScore: minScore - 0.5,
        ...eraYears,
      })),
    ]);

    raw.push(
      ...(f1.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType })),
      ...(f2.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType })),
      ...(f3.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType })),
      ...(f4.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType })),
    );
  }

  // Score — le genre match prime TOUJOURS
  const scored = raw
    .map((item) => ({
      item,
      score: scoreQuizItem(item, requiredGenres, bonusGenres, hardExclude, minScore - 0.5),
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

  // Profil de genre pondéré (position dans la liste + note de l'item)
  const genreWeights = new Map<number, number>();
  const mediaTypeCount = { movie: 0, tv: 0 };

  watchedItems.forEach((item) => {
    const influence = item.vote_average || 7;
    (item.genre_ids || []).forEach((gid, idx) => {
      const w = influence * Math.pow(0.7, idx); // décroissance exponentielle
      genreWeights.set(gid, (genreWeights.get(gid) || 0) + w);
    });
    const isTV = item.media_type === "tv" || (!item.title && !!item.name);
    if (isTV) mediaTypeCount.tv++;
    else mediaTypeCount.movie++;
  });

  const sortedGenres = Array.from(genreWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const topGenres = sortedGenres.slice(0, 4);   // genres dominants
  const top1Genre = sortedGenres.slice(0, 1);   // genre #1 (obligatoire pour certains fetches)

  const dominantType: "movie" | "tv" =
    mediaTypeCount.tv > mediaTypeCount.movie ? "tv" : "movie";

  const avgScore =
    watchedItems.reduce((s, i) => s + i.vote_average, 0) / watchedItems.length;
  const minScore = Math.max(5.5, avgScore - 1.8);

  const raw: MediaItem[] = [];

  // Fetch 1 : recommendations TMDB pour chaque item (meilleur signal)
  // Fetch 2 : similar TMDB pour chaque item
  const recPromises = watchedItems.slice(0, 5).flatMap((item) => {
    const type: "movie" | "tv" =
      item.media_type === "tv" || (!item.title && !!item.name) ? "tv" : "movie";
    return [
      fetchJson(`/api/tmdb?action=recommendations&mediaType=${type}&id=${item.id}`)
        .then((d) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: type }))),
      fetchJson(`/api/tmdb?action=similar&mediaType=${type}&id=${item.id}`)
        .then((d) => (d.results || []).slice(0, 8).map((r: MediaItem) => ({ ...r, media_type: type }))),
    ];
  });

  const recResults = await Promise.all(recPromises);
  recResults.forEach((arr) => raw.push(...arr));

  // Fetch 3-5 : discover avec genres pondérés
  const [disc1, disc2, disc3] = await Promise.all([
    fetchJson(buildDiscoverUrl(dominantType, {
      genres: topGenres.slice(0, 2),
      sortBy: "vote_average.desc",
      minVotes: 400,
      minScore,
    })),
    fetchJson(buildDiscoverUrl(dominantType, {
      genres: top1Genre,
      sortBy: "popularity.desc",
      minVotes: 150,
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
  raw.push(
    ...(disc1.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType })),
    ...(disc2.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType })),
    ...(disc3.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType })),
  );

  // Scoring — genre match prime
  const maxWeight = Math.max(...Array.from(genreWeights.values()), 1);

  const scored = raw
    .filter((item) => item.poster_path && item.vote_average >= minScore && !watchedIds.has(item.id))
    .map((item) => {
      const genres = item.genre_ids || [];

      // Genre score (dominant) : jusqu'à 100 pts selon correspondance avec le profil
      let genreScore = 0;
      genres.forEach((gid) => {
        genreScore += ((genreWeights.get(gid) || 0) / maxWeight) * 50;
      });

      // Si aucun genre ne matche du tout → élimination
      if (genreScore === 0) return { item, score: 0 };

      // Note (secondaire, max 20 pts)
      const ratingScore = ((item.vote_average - minScore) / (10 - minScore)) * 20;

      // Popularité tie-breaker (max 5 pts)
      const popScore = Math.min((item.vote_count ?? 0) / 2000, 5);

      return { item, score: genreScore + ratingScore + popScore };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return dedup(scored.map((x) => x.item), watchedIds).slice(0, 24);
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App() {
  const { currentView, setView, setRecommendations, setRecommendationSource, addToHistory } =
    useAppStore();
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
