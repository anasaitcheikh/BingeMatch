"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  MediaItem, KeywordItem,
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

async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch {
    return { results: [] };
  }
}

function discoverUrl(
  mediaType: "movie" | "tv",
  opts: {
    genre?: number;
    keywords?: number[];
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
  const p = new URLSearchParams({
    action: "discover",
    mediaType,
    sortBy: opts.sortBy || "vote_average.desc",
    minVotes: String(opts.minVotes ?? 150),
    minScore: String(opts.minScore ?? 6.0),
    page: String(opts.page ?? 1),
  });
  if (opts.genre)          p.set("genres", String(opts.genre));
  if (opts.keywords?.length) p.set("keywords", opts.keywords.join(","));
  if (opts.yearFrom)       p.set("yearFrom", String(opts.yearFrom));
  if (opts.yearTo)         p.set("yearTo", String(opts.yearTo));
  if (opts.runtimeMin)     p.set("runtimeMin", String(opts.runtimeMin));
  if (opts.runtimeMax)     p.set("runtimeMax", String(opts.runtimeMax));
  return `/api/tmdb?${p.toString()}`;
}

// ── SCORING quiz : genre match prime sur la note ─────────────────────────────
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
  if (hardExclude.some((g) => genres.includes(g))) return 0;

  const reqMatches = genres.filter((g) => requiredGenres.includes(g)).length;
  if (reqMatches === 0) return 0; // ← pas de genre requis = éliminé

  const bonusMatches = genres.filter((g) => bonusGenres.includes(g)).length;

  // Genre : 60%,  Note : 30%,  Popularité : 10%
  const genreScore  = (reqMatches * 2 + bonusMatches) / (requiredGenres.length * 2 + 1) * 60;
  const ratingScore = ((item.vote_average - minScore) / (10 - minScore)) * 30;
  const popScore    = Math.min((item.vote_count ?? 0) / 1000, 10);

  return genreScore + ratingScore + popScore;
}

// ── SCORING analyse : keywords + genres + note ───────────────────────────────
function scoreAnalysisItem(
  item: MediaItem,
  genreWeights: Map<number, number>,
  keywordWeights: Map<number, number>,
  maxGenreWeight: number,
  maxKeywordWeight: number,
  minScore: number,
  watchedIds: Set<number>
): number {
  if (!item.poster_path) return 0;
  if (item.vote_average < minScore) return 0;
  if (watchedIds.has(item.id)) return 0;

  const genres   = item.genre_ids   || [];
  const keywords = (item as any).keyword_ids as number[] || [];

  // Score genre (40 pts max)
  let genreScore = 0;
  genres.forEach((gid) => {
    genreScore += ((genreWeights.get(gid) || 0) / maxGenreWeight) * 40;
  });

  // Score keywords (40 pts max) — c'est ici que "avocat + corporatif" bat "drama générique"
  let kwScore = 0;
  keywords.forEach((kid) => {
    kwScore += ((keywordWeights.get(kid) || 0) / Math.max(maxKeywordWeight, 1)) * 40;
  });

  // Si ni genre ni keyword ne matchent → éliminé
  if (genreScore === 0 && kwScore === 0) return 0;

  // Note (15 pts max)
  const ratingScore = ((item.vote_average - minScore) / (10 - minScore)) * 15;
  // Popularité (5 pts max)
  const popScore = Math.min((item.vote_count ?? 0) / 2000, 5);

  return genreScore + kwScore + ratingScore + popScore;
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
  const hardExclude = VIBE_EXCLUDE[vibe]?.[mediaType] || [];

  const sortBy   = VIBE_SORT[vibe]      || "vote_average.desc";
  const minVotes = VIBE_MIN_VOTES[vibe] || 150;
  const minScore = DURATION_MIN_SCORE[duration] || 6.0;
  const era_y    = ERA_YEARS[era] || {};
  const runtime  = mediaType === "movie" ? DURATION_RUNTIME[duration] : {};

  const raw: MediaItem[] = [];

  if (isAnime) {
    const [a1, a2] = await Promise.all([
      fetchJson("/api/tmdb?action=anime"),
      fetchJson(discoverUrl("tv", { genre: 16, sortBy: "vote_average.desc", minVotes: 200, minScore: 7.0, ...era_y })),
    ]);
    raw.push(...(a1.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));
    raw.push(...(a2.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));
  } else {
    // Un fetch par genre requis (évite le AND de TMDB)
    const fetches = requiredGenres.flatMap((gid) => [
      fetchJson(discoverUrl(mediaType, { genre: gid, sortBy, minVotes, minScore, ...era_y, ...(runtime || {}), page: 1 })),
      fetchJson(discoverUrl(mediaType, { genre: gid, sortBy, minVotes, minScore, ...era_y, ...(runtime || {}), page: 2 })),
      fetchJson(discoverUrl(mediaType, { genre: gid, sortBy: "popularity.desc", minVotes: 80, minScore: minScore - 0.5, ...era_y, page: 1 })),
    ]);

    const bonusFetches = bonusGenres.slice(0, 2).map((gid) =>
      fetchJson(discoverUrl(mediaType, { genre: gid, sortBy: "vote_average.desc", minVotes, minScore, ...era_y }))
    );

    const results = await Promise.all([...fetches, ...bonusFetches]);
    results.forEach((d) => {
      raw.push(...(d.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType })));
    });
  }

  const scored = raw
    .map((item) => ({ item, score: scoreQuizItem(item, requiredGenres, bonusGenres, hardExclude, minScore - 0.5) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const result = dedup(scored.map((x) => x.item), new Set()).slice(0, 24);

  // Fallback si trop peu
  if (result.length < 6 && requiredGenres.length > 0) {
    const fallback = await fetchJson(discoverUrl(mediaType, {
      genre: requiredGenres[0], sortBy: "popularity.desc", minVotes: 50, minScore: 5.0,
    }));
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

  // ── 1. Construire le profil genre (pondéré par note + position) ─────────────
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

  // ── 2. Récupérer les KEYWORDS de chaque item visionné ──────────────────────
  //    C'est ici la vraie amélioration : "Suits" → keywords [avocat, cabinet d'avocats,
  //    droit des entreprises, Manhattan, ...] qui permettent de trouver The Good Wife
  const keywordWeights = new Map<number, number>();

  const kwPromises = watchedItems.slice(0, 6).map(async (item) => {
    const type: "movie" | "tv" =
      item.media_type === "tv" || (!item.title && !!item.name) ? "tv" : "movie";
    const influence = item.vote_average || 7;
    try {
      const data = await fetchJson(`/api/tmdb?action=keywords&mediaType=${type}&id=${item.id}`);
      const kws: KeywordItem[] = data.keywords || [];
      kws.forEach((kw, idx) => {
        // Les premiers keywords sont plus représentatifs
        const w = influence * Math.pow(0.8, idx);
        keywordWeights.set(kw.id, (keywordWeights.get(kw.id) || 0) + w);
      });
      return kws.map((k) => k.id);
    } catch {
      return [];
    }
  });

  const allKeywordArrays = await Promise.all(kwPromises);

  // ── 3. Top keywords pour le discover par keywords ───────────────────────────
  const topKeywords = Array.from(keywordWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12) // top 12 keywords
    .map(([id]) => id);

  const topGenres = Array.from(genreWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => id);

  const dominantType: "movie" | "tv" =
    mediaTypeCount.tv > mediaTypeCount.movie ? "tv" : "movie";

  const avgScore = watchedItems.reduce((s, i) => s + i.vote_average, 0) / watchedItems.length;
  const minScore = Math.max(5.5, avgScore - 2.0);

  const maxGenreWeight   = Math.max(...Array.from(genreWeights.values()), 1);
  const maxKeywordWeight = Math.max(...Array.from(keywordWeights.values()), 1);

  // ── 4. Fetches parallèles ───────────────────────────────────────────────────
  const raw: MediaItem[] = [];

  // A. TMDB recommendations + similar pour chaque item (meilleur signal direct)
  const directPromises = watchedItems.slice(0, 5).flatMap((item) => {
    const type: "movie" | "tv" =
      item.media_type === "tv" || (!item.title && !!item.name) ? "tv" : "movie";
    return [
      fetchJson(`/api/tmdb?action=recommendations&mediaType=${type}&id=${item.id}`)
        .then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: type }))),
      fetchJson(`/api/tmdb?action=similar&mediaType=${type}&id=${item.id}`)
        .then((d: any) => (d.results || []).slice(0, 10).map((r: MediaItem) => ({ ...r, media_type: type }))),
    ];
  });

  // B. Discover par keywords (le vrai différenciateur : "avocat" → The Good Wife, Lincoln Lawyer)
  const keywordFetches = topKeywords.length > 0 ? [
    fetchJson(discoverUrl(dominantType, {
      keywords: topKeywords.slice(0, 6),
      sortBy: "vote_average.desc",
      minVotes: 100,
      minScore,
    })).then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType }))),
    fetchJson(discoverUrl(dominantType, {
      keywords: topKeywords.slice(0, 6),
      sortBy: "popularity.desc",
      minVotes: 50,
      minScore,
    })).then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType }))),
    // Deuxième groupe de keywords pour plus de diversité
    topKeywords.length > 6 ? fetchJson(discoverUrl(dominantType, {
      keywords: topKeywords.slice(6, 12),
      sortBy: "vote_average.desc",
      minVotes: 100,
      minScore,
    })).then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType }))) : Promise.resolve([]),
  ] : [];

  // C. Discover par genres (filet de sécurité)
  const genreFetches = topGenres.slice(0, 2).flatMap((gid) => [
    fetchJson(discoverUrl(dominantType, {
      genre: gid, sortBy: "vote_average.desc", minVotes: 300, minScore, page: 1,
    })).then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType }))),
    fetchJson(discoverUrl(dominantType, {
      genre: gid, sortBy: "popularity.desc", minVotes: 100, minScore, page: 1,
    })).then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType }))),
  ]);

  const allFetches = await Promise.all([...directPromises, ...keywordFetches, ...genreFetches]);
  allFetches.forEach((arr) => {
    if (Array.isArray(arr)) raw.push(...arr);
  });

  // ── 5. Scoring : keywords + genres, la note ne départage qu'à la fin ────────
  const scored = raw
    .filter((item) => item.poster_path && item.vote_average >= minScore && !watchedIds.has(item.id))
    .map((item) => ({
      item,
      score: scoreAnalysisItem(
        item,
        genreWeights,
        keywordWeights,
        maxGenreWeight,
        maxKeywordWeight,
        minScore,
        watchedIds
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return dedup(scored.map((x) => x.item), watchedIds).slice(0, 24);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { currentView, setView, setRecommendations, setRecommendationSource, addToHistory } =
    useAppStore();
  const [loading, setLoading]       = useState(false);
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
