"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  MediaItem, KeywordItem,
  MOOD_TO_GENRES, VIBE_EXCLUDE, VIBE_SORT, VIBE_MIN_VOTES,
  ERA_YEARS, DURATION_RUNTIME, DURATION_MIN_SCORE,
} from "@/lib/tmdb";
import { ANSWER_GENRE_MAP } from "@/components/QuizView";
import Navbar from "@/components/Navbar";
import HomeView from "@/components/HomeView";
import QuizView from "@/components/QuizView";
import AnalysisView from "@/components/AnalysisView";
import ResultsView from "@/components/ResultsView";
import LoadingScreen from "@/components/LoadingScreen";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

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
    minVotes: String(opts.minVotes ?? 100),
    minScore: String(opts.minScore ?? 5.5),
    page: String(opts.page ?? 1),
  });
  if (opts.genre)            p.set("genres", String(opts.genre));
  if (opts.keywords?.length) p.set("keywords", opts.keywords.join(","));
  if (opts.yearFrom)         p.set("yearFrom", String(opts.yearFrom));
  if (opts.yearTo)           p.set("yearTo", String(opts.yearTo));
  if (opts.runtimeMin)       p.set("runtimeMin", String(opts.runtimeMin));
  if (opts.runtimeMax)       p.set("runtimeMax", String(opts.runtimeMax));
  return `/api/tmdb?${p.toString()}`;
}

// ── QUIZ SCORING ──────────────────────────────────────────────────────────────
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
  if (reqMatches === 0) return 0;
  const bonusMatches = genres.filter((g) => bonusGenres.includes(g)).length;
  const genreScore  = (reqMatches * 2 + bonusMatches) / (requiredGenres.length * 2 + 1) * 60;
  const ratingScore = ((item.vote_average - minScore) / (10 - minScore)) * 30;
  const popScore    = Math.min((item.vote_count ?? 0) / 1000, 10);
  return genreScore + ratingScore + popScore;
}

// ── QUIZ ENGINE ───────────────────────────────────────────────────────────────
// Lit les 8 réponses psychologiques et les traduit en genres TMDB pondérés
async function buildQuizRecommendations(
  answers: Record<string, string | string[]>
): Promise<MediaItem[]> {

  // ── 1. Déterminer le format / media type ──────────────────────────────────
  const formatAnswer = answers.format as string || "format_indiff";
  const isAnime = formatAnswer === "format_anime";
  const isMovie = formatAnswer === "format_film_court" || formatAnswer === "format_film_long";
  const isSeries = formatAnswer === "format_serie_mini" || formatAnswer === "format_serie_longue";
  const mediaType: "movie" | "tv" = isSeries ? "tv" : isMovie ? "movie" : "movie";

  // ── 2. Durée / runtime selon le format ────────────────────────────────────
  let runtimeMin: number | undefined;
  let runtimeMax: number | undefined;
  let minVotes = 150;
  let minScore = 6.0;

  if (formatAnswer === "format_film_court") { runtimeMax = 95; }
  else if (formatAnswer === "format_film_long") { runtimeMin = 110; minVotes = 200; minScore = 6.5; }
  else if (formatAnswer === "format_serie_mini") { minScore = 6.5; }
  else if (formatAnswer === "format_serie_longue") { minScore = 7.0; minVotes = 300; }

  // ── 3. Agréger les genres depuis TOUTES les réponses ──────────────────────
  // Chaque réponse vote pour des genres — on compte les votes
  const genreVotes = new Map<number, number>();

  const questionKeys = ["soiree", "perso", "fin", "univers", "rythme", "emotion", "visuel"];
  questionKeys.forEach((key, questionIdx) => {
    const answerValue = answers[key] as string;
    if (!answerValue) return;
    const mapping = ANSWER_GENRE_MAP[answerValue];
    if (!mapping) return;

    const genres = mediaType === "tv" ? mapping.tv : mapping.movie;
    genres.forEach((gid, genreIdx) => {
      // Questions de début (soirée, personnage) pèsent plus — elles capturent l'intention principale
      const questionWeight = questionIdx <= 2 ? 3 : questionIdx <= 4 ? 2 : 1;
      // Premiers genres dans la liste pèsent plus
      const positionWeight = Math.pow(0.75, genreIdx);
      const vote = questionWeight * positionWeight;
      genreVotes.set(gid, (genreVotes.get(gid) || 0) + vote);
    });
  });

  // ── 4. Top genres par votes ───────────────────────────────────────────────
  const sortedGenres = Array.from(genreVotes.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const primaryGenres = sortedGenres.slice(0, 2);   // genres dominants
  const secondaryGenres = sortedGenres.slice(2, 5); // genres secondaires

  // Genres peu représentatifs à exclure (évite la pollution)
  // Ex: si quelqu'un veut du thriller/mystery, on exclut comédie pour enfants
  const hardExclude: number[] = [];
  const topGenreSet = new Set(sortedGenres.slice(0, 4));
  // Si drama/romance dominent → exclure horreur et action brute
  if (topGenreSet.has(18) || topGenreSet.has(10749)) {
    if (!topGenreSet.has(27)) hardExclude.push(27); // pas horreur
    if (!topGenreSet.has(28)) hardExclude.push(10751); // pas film famille
  }
  // Si action/aventure dominent → exclure romance pure
  if (topGenreSet.has(28) || topGenreSet.has(10759)) {
    if (!topGenreSet.has(10749)) hardExclude.push(10749);
  }

  // ── 5. Fetch parallèle : un fetch par genre principal ─────────────────────
  const raw: MediaItem[] = [];

  if (isAnime) {
    const [a1, a2] = await Promise.all([
      fetchJson("/api/tmdb?action=anime"),
      fetchJson(discoverUrl("tv", { genre: 16, sortBy: "vote_average.desc", minVotes: 200, minScore: 7.0 })),
    ]);
    raw.push(...(a1.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));
    raw.push(...(a2.results || []).map((r: MediaItem) => ({ ...r, media_type: "tv" })));
  } else {
    const allFetchGenres = [...primaryGenres, ...secondaryGenres.slice(0, 2)];
    const fetches = allFetchGenres.flatMap((gid) => [
      fetchJson(discoverUrl(mediaType, { genre: gid, sortBy: "vote_average.desc", minVotes, minScore, runtimeMin, runtimeMax, page: 1 })),
      fetchJson(discoverUrl(mediaType, { genre: gid, sortBy: "popularity.desc", minVotes: 80, minScore: minScore - 0.5, runtimeMin, runtimeMax, page: 1 })),
      fetchJson(discoverUrl(mediaType, { genre: gid, sortBy: "vote_average.desc", minVotes, minScore, runtimeMin, runtimeMax, page: 2 })),
    ]);
    const results = await Promise.all(fetches);
    results.forEach((d) => raw.push(...(d.results || []).map((r: MediaItem) => ({ ...r, media_type: mediaType }))));
  }

  // ── 6. Scoring pondéré par votes de genres ────────────────────────────────
  const maxVotes = Math.max(...Array.from(genreVotes.values()), 1);

  const scored = raw
    .filter((item) => item.poster_path && item.vote_average >= minScore - 0.5)
    .map((item) => {
      const genres = item.genre_ids || [];

      // Exclusion dure
      if (hardExclude.some((g) => genres.includes(g))) return { item, score: 0 };

      // Score genre : somme des votes normalisés pour chaque genre présent
      let genreScore = 0;
      genres.forEach((gid) => {
        genreScore += ((genreVotes.get(gid) || 0) / maxVotes) * 60;
      });
      if (genreScore === 0) return { item, score: 0 };

      // Note (secondaire, max 30 pts)
      const ratingScore = ((item.vote_average - (minScore - 0.5)) / (10 - (minScore - 0.5))) * 30;
      // Popularité tie-breaker (max 10 pts)
      const popScore = Math.min((item.vote_count ?? 0) / 1000, 10);

      return { item, score: genreScore + ratingScore + popScore };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const result = dedup(scored.map((x) => x.item), new Set()).slice(0, 24);

  // Fallback si résultats insuffisants
  if (result.length < 6 && primaryGenres.length > 0) {
    const fallback = await fetchJson(discoverUrl(mediaType, {
      genre: primaryGenres[0], sortBy: "popularity.desc", minVotes: 50, minScore: 5.5,
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
  const dominantType: "movie" | "tv" = (() => {
    let tv = 0, movie = 0;
    watchedItems.forEach((item) => {
      if (item.media_type === "tv" || (!item.title && !!item.name)) tv++; else movie++;
    });
    return tv > movie ? "tv" : "movie";
  })();

  const avgScore = watchedItems.reduce((s, i) => s + i.vote_average, 0) / watchedItems.length;
  const minScore = Math.max(5.5, avgScore - 2.0);

  // ── ÉTAPE 1 : Récupérer les keywords de CHAQUE item visionné ──────────────
  // C'est la clé : Suits → [lawyer, law firm, legal drama, ...]
  //                Breaking Bad → [drug dealer, chemistry, ...]
  // => 0 keywords en commun => Breaking Bad ne pourra jamais scorer
  const itemKeywords: Map<number, number[]> = new Map();

  await Promise.all(
    watchedItems.slice(0, 6).map(async (item) => {
      const type: "movie" | "tv" = item.media_type === "tv" || (!item.title && !!item.name) ? "tv" : "movie";
      const data = await fetchJson(`/api/tmdb?action=keywords&mediaType=${type}&id=${item.id}`);
      const kws: KeywordItem[] = data.keywords || [];
      itemKeywords.set(item.id, kws.map((k) => k.id));
    })
  );

  // ── ÉTAPE 2 : Construire les poids keywords (fréquence pondérée par note) ─
  const keywordWeights = new Map<number, number>();
  watchedItems.forEach((item) => {
    const influence = item.vote_average || 7;
    const kws = itemKeywords.get(item.id) || [];
    kws.forEach((kid, idx) => {
      // Décroissance : les premiers keywords sont plus représentatifs
      const w = influence * Math.pow(0.85, idx);
      keywordWeights.set(kid, (keywordWeights.get(kid) || 0) + w);
    });
  });

  // Keywords qui apparaissent dans PLUSIEURS items visionnés = très représentatifs
  const sharedKeywords = Array.from(keywordWeights.entries())
    .filter(([, w]) => w > (watchedItems[0]?.vote_average || 7)) // aparaît dans 2+ items
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id]) => id);

  const topKeywords = Array.from(keywordWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id);

  // ── ÉTAPE 3 : Poids genres ─────────────────────────────────────────────────
  const genreWeights = new Map<number, number>();
  watchedItems.forEach((item) => {
    const influence = item.vote_average || 7;
    (item.genre_ids || []).forEach((gid, idx) => {
      genreWeights.set(gid, (genreWeights.get(gid) || 0) + influence * Math.pow(0.7, idx));
    });
  });
  const topGenres = Array.from(genreWeights.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
  const maxGenreWeight   = Math.max(...Array.from(genreWeights.values()), 1);
  const maxKeywordWeight = Math.max(...Array.from(keywordWeights.values()), 1);

  // ── ÉTAPE 4 : Sources de candidats ────────────────────────────────────────
  //
  // PRIORITÉ 1 : Discover par keywords partagés (le plus précis)
  //   → Pour Suits : trouve The Good Wife, Damages, Boston Legal, etc.
  //   → Exclut Breaking Bad car il n'a pas les keywords "lawyer", "law firm"
  //
  // PRIORITÉ 2 : recommendations/similar TMDB (bon mais trop large)
  //   → On les inclut mais avec un scoring plus strict
  //
  // PRIORITÉ 3 : Discover par genre (filet de sécurité)

  const fetchPromises: Promise<MediaItem[]>[] = [];

  // P1 : Keywords partagés (mode OR dans TMDB — au moins 1 keyword doit matcher)
  if (sharedKeywords.length > 0) {
    fetchPromises.push(
      fetchJson(discoverUrl(dominantType, { keywords: sharedKeywords.slice(0, 8), sortBy: "vote_average.desc", minVotes: 50, minScore }))
        .then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType, _source: "kw_shared" }))),
      fetchJson(discoverUrl(dominantType, { keywords: sharedKeywords.slice(0, 8), sortBy: "popularity.desc", minVotes: 30, minScore }))
        .then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType, _source: "kw_shared" }))),
    );
  }

  // P1b : Top keywords (plus large)
  if (topKeywords.length > 0) {
    fetchPromises.push(
      fetchJson(discoverUrl(dominantType, { keywords: topKeywords.slice(0, 10), sortBy: "vote_average.desc", minVotes: 50, minScore }))
        .then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType, _source: "kw_top" }))),
    );
  }

  // P2 : recommendations + similar TMDB
  watchedItems.slice(0, 4).forEach((item) => {
    const type: "movie" | "tv" = item.media_type === "tv" || (!item.title && !!item.name) ? "tv" : "movie";
    fetchPromises.push(
      fetchJson(`/api/tmdb?action=recommendations&mediaType=${type}&id=${item.id}`)
        .then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: type, _source: "tmdb_rec" }))),
      fetchJson(`/api/tmdb?action=similar&mediaType=${type}&id=${item.id}`)
        .then((d: any) => (d.results || []).slice(0, 8).map((r: MediaItem) => ({ ...r, media_type: type, _source: "tmdb_sim" }))),
    );
  });

  // P3 : Discover par genre (filet)
  topGenres.slice(0, 2).forEach((gid) => {
    fetchPromises.push(
      fetchJson(discoverUrl(dominantType, { genre: gid, sortBy: "vote_average.desc", minVotes: 200, minScore, page: 1 }))
        .then((d: any) => (d.results || []).map((r: MediaItem) => ({ ...r, media_type: dominantType, _source: "genre" }))),
    );
  });

  const allArrays = await Promise.all(fetchPromises);
  const raw: MediaItem[] = [];
  allArrays.forEach((arr) => { if (Array.isArray(arr)) raw.push(...arr); });

  // ── ÉTAPE 5 : Scoring keyword-first ───────────────────────────────────────
  //
  // Formule :
  //   keyword_score (50 pts max) — basé sur les keywords partagés avec les items visionnés
  //   genre_score   (30 pts max) — basé sur les genres
  //   note          (15 pts max) — secondaire
  //   popularité    ( 5 pts max) — tie-breaker
  //
  // Un item sans AUCUN keyword commun peut quand même passer si genre_score > 0,
  // mais il sera toujours derrière un item avec des keywords communs.
  //
  // Breaking Bad : genre Drama+Crime = genre_score ~20, keyword_score = 0
  // The Good Wife : genre Drama+Crime = genre_score ~20, keyword "lawyer" = keyword_score ~40
  // → The Good Wife score ≈ 75,  Breaking Bad score ≈ 35  → Breaking Bad relégué

  const scored = raw
    .filter((item) => item.poster_path && item.vote_average >= minScore && !watchedIds.has(item.id))
    .map((item) => {
      const genres = (item.genre_ids || []);

      // Genre score
      let genreScore = 0;
      genres.forEach((gid) => {
        genreScore += ((genreWeights.get(gid) || 0) / maxGenreWeight) * 30;
      });

      // Keyword score — on n'a pas les keywords des résultats directement,
      // mais les items venant des fetches keyword (kw_shared, kw_top) ont déjà
      // été filtrés par TMDB pour avoir au moins un keyword cible.
      // On leur donne un bonus de source + score proportionnel aux genres communs.
      const source = (item as any)._source || "genre";
      let kwBonus = 0;
      if (source === "kw_shared") kwBonus = 50; // keywords partagés entre plusieurs items visionnés
      else if (source === "kw_top") kwBonus = 35; // keywords top mais peut-être pas partagés
      else if (source === "tmdb_rec") kwBonus = 20; // recommendations TMDB
      else if (source === "tmdb_sim") kwBonus = 15; // similar TMDB
      else kwBonus = 0; // genre discover seul → pas de bonus keyword

      // Éliminer si aucun signal (ni keyword ni genre)
      if (genreScore === 0 && kwBonus === 0) return { item, score: 0 };

      const ratingScore = ((item.vote_average - minScore) / (10 - minScore)) * 15;
      const popScore    = Math.min((item.vote_count ?? 0) / 2000, 5);

      return { item, score: kwBonus + genreScore + ratingScore + popScore };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return dedup(scored.map((x) => x.item), watchedIds).slice(0, 24);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { currentView, setView, setRecommendations, setRecommendationSource, addToHistory } = useAppStore();
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
      <PWAInstallPrompt />
    </>
  );
}
