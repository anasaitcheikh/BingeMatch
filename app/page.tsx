"use client";

import { useState } from "react";
import { useAppStore, QuizAnswers } from "@/lib/store";
import { MediaItem, MOOD_TO_GENRES } from "@/lib/tmdb";
import Navbar from "@/components/Navbar";
import HomeView from "@/components/HomeView";
import QuizView from "@/components/QuizView";
import AnalysisView from "@/components/AnalysisView";
import ResultsView from "@/components/ResultsView";
import LoadingScreen from "@/components/LoadingScreen";

export default function App() {
  const { currentView, setView, setRecommendations, setRecommendationSource, addToHistory } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Analyse en cours...");

  // ── Quiz completion → fetch recommendations ──────────────────────
  const handleQuizComplete = async (answers: Record<string, string | string[]>) => {
    setLoading(true);
    setLoadingMsg("Composition de votre sélection personnalisée...");

    try {
      const mood = (answers.mood as string) || "action";
      const themes = (answers.themes as string[]) || [];
      const mediaType = answers.mediaType === "anime" ? "tv" : (answers.mediaType as "movie" | "tv") || "movie";

      // Collect genre IDs from mood + themes
      const moodGenres = MOOD_TO_GENRES[mood] || MOOD_TO_GENRES.action;
      const themeGenres = themes.flatMap((t) => MOOD_TO_GENRES[t]?.[mediaType === "tv" ? "tv" : "movie"] || []);
      const allGenres = [...new Set([...moodGenres[mediaType === "tv" ? "tv" : "movie"], ...themeGenres])];

      const endpoint = answers.mediaType === "anime"
        ? "/api/tmdb?action=anime"
        : `/api/tmdb?action=discover&mediaType=${mediaType}&genres=${allGenres.join(",")}`;

      const res = await fetch(endpoint);
      const data = await res.json();

      // Also fetch a second page for variety
      let results: MediaItem[] = data.results || [];

      if (results.length < 10 && allGenres.length > 0) {
        const res2 = await fetch(`/api/tmdb?action=discover&mediaType=${mediaType}&genres=${allGenres.slice(0, 2).join(",")}&page=2`);
        const data2 = await res2.json();
        results = [...results, ...(data2.results || [])];
      }

      // Filter and sort
      const filtered = results
        .filter((item: MediaItem) => item.poster_path && item.vote_average >= 6)
        .sort((a: MediaItem, b: MediaItem) => b.vote_average - a.vote_average)
        .slice(0, 20)
        .map((item: MediaItem) => ({ ...item, media_type: item.media_type || mediaType }));

      setRecommendations(filtered);
      setRecommendationSource("quiz");
      addToHistory(filtered, "quiz");
      setView("results");
    } catch (err) {
      console.error("Quiz recommendation error:", err);
      // Fallback: show trending
      const fallback = await fetch("/api/tmdb?action=trending").then((r) => r.json());
      setRecommendations(fallback.results?.slice(0, 20) || []);
      setRecommendationSource("quiz");
      setView("results");
    } finally {
      setLoading(false);
    }
  };

  // ── Analysis completion → find similar content ────────────────────
  const handleAnalysisComplete = async (watchedItems: MediaItem[]) => {
    setLoading(true);
    setLoadingMsg("Analyse de vos préférences...");

    try {
      // Collect all genre IDs from watched items
      const genreMap = new Map<number, number>();
      const mediaTypes = { movie: 0, tv: 0 };

      watchedItems.forEach((item) => {
        (item.genre_ids || []).forEach((id) => {
          genreMap.set(id, (genreMap.get(id) || 0) + 1);
        });
        if (item.media_type === "tv" || item.name) mediaTypes.tv++;
        else mediaTypes.movie++;
      });

      // Top genres
      const topGenres = Array.from(genreMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => id);

      const dominantType = mediaTypes.tv > mediaTypes.movie ? "tv" : "movie";

      // Fetch similar for top 3 watched items + discover by top genres
      const results: MediaItem[] = [];

      setLoadingMsg("Recherche de contenus similaires...");

      // Similar items
      for (const item of watchedItems.slice(0, 3)) {
        const type = item.media_type === "tv" || item.name ? "tv" : "movie";
        const res = await fetch(`/api/tmdb?action=similar&mediaType=${type}&id=${item.id}`);
        const data = await res.json();
        results.push(...(data.results || []).slice(0, 5).map((r: MediaItem) => ({ ...r, media_type: type })));
      }

      // Discover by genres
      if (topGenres.length > 0) {
        const res = await fetch(`/api/tmdb?action=discover&mediaType=${dominantType}&genres=${topGenres.join(",")}`);
        const data = await res.json();
        results.push(...(data.results || []).slice(0, 10).map((r: MediaItem) => ({ ...r, media_type: dominantType })));
      }

      // Deduplicate, filter out already watched, sort
      const watchedIds = new Set(watchedItems.map((w) => w.id));
      const seen = new Set<number>();
      const final = results
        .filter((item) => {
          if (seen.has(item.id) || watchedIds.has(item.id)) return false;
          seen.add(item.id);
          return item.poster_path && item.vote_average >= 6;
        })
        .sort((a, b) => b.vote_average - a.vote_average)
        .slice(0, 20);

      setRecommendations(final);
      setRecommendationSource("analysis");
      addToHistory(final, "analysis");
      setView("results");
    } catch (err) {
      console.error("Analysis error:", err);
      const fallback = await fetch("/api/tmdb?action=trending").then((r) => r.json());
      setRecommendations(fallback.results?.slice(0, 20) || []);
      setRecommendationSource("analysis");
      setView("results");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setView("home");
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
          {currentView === "results" && <ResultsView onReset={handleReset} />}
        </>
      )}
    </>
  );
}
