"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MediaItem } from "./tmdb";

export type AppView = "home" | "quiz" | "analysis" | "results";

export interface QuizAnswers {
  mood?: string;
  vibe?: string;
  duration?: string;
  era?: string;
  themes?: string[];
  intensity?: string;
  mediaType?: string;
}

export interface LikedItem {
  id: number;
  title: string;
  poster_path: string | null;
  media_type: string;
  vote_average: number;
}

interface AppStore {
  // Navigation
  currentView: AppView;
  setView: (view: AppView) => void;

  // Quiz
  quizAnswers: QuizAnswers;
  setQuizAnswer: (key: keyof QuizAnswers, value: string | string[]) => void;
  resetQuiz: () => void;
  quizStep: number;
  setQuizStep: (step: number) => void;

  // Watched content
  watchedItems: MediaItem[];
  addWatchedItem: (item: MediaItem) => void;
  removeWatchedItem: (id: number) => void;

  // Recommendations
  recommendations: MediaItem[];
  setRecommendations: (items: MediaItem[]) => void;
  recommendationSource: "quiz" | "analysis" | null;
  setRecommendationSource: (source: "quiz" | "analysis") => void;

  // Liked / Disliked
  likedItems: LikedItem[];
  dislikedIds: number[];
  toggleLike: (item: LikedItem) => void;
  toggleDislike: (id: number) => void;

  // History
  historyEntries: { date: string; items: MediaItem[]; source: string }[];
  addToHistory: (items: MediaItem[], source: string) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      currentView: "home",
      setView: (view) => set({ currentView: view }),

      quizAnswers: {},
      setQuizAnswer: (key, value) =>
        set((s) => ({ quizAnswers: { ...s.quizAnswers, [key]: value } })),
      resetQuiz: () => set({ quizAnswers: {}, quizStep: 0 }),
      quizStep: 0,
      setQuizStep: (step) => set({ quizStep: step }),

      watchedItems: [],
      addWatchedItem: (item) =>
        set((s) => {
          if (s.watchedItems.find((w) => w.id === item.id)) return s;
          return { watchedItems: [...s.watchedItems, item] };
        }),
      removeWatchedItem: (id) =>
        set((s) => ({ watchedItems: s.watchedItems.filter((w) => w.id !== id) })),

      recommendations: [],
      setRecommendations: (items) => set({ recommendations: items }),
      recommendationSource: null,
      setRecommendationSource: (source) => set({ recommendationSource: source }),

      likedItems: [],
      dislikedIds: [],
      toggleLike: (item) =>
        set((s) => {
          const exists = s.likedItems.find((l) => l.id === item.id);
          return {
            likedItems: exists
              ? s.likedItems.filter((l) => l.id !== item.id)
              : [...s.likedItems, item],
          };
        }),
      toggleDislike: (id) =>
        set((s) => ({
          dislikedIds: s.dislikedIds.includes(id)
            ? s.dislikedIds.filter((d) => d !== id)
            : [...s.dislikedIds, id],
        })),

      historyEntries: [],
      addToHistory: (items, source) =>
        set((s) => ({
          historyEntries: [
            { date: new Date().toISOString(), items, source },
            ...s.historyEntries.slice(0, 9),
          ],
        })),

      searchQuery: "",
      setSearchQuery: (q) => set({ searchQuery: q }),
    }),
    {
      name: "cineai-storage",
      partialize: (s) => ({
        likedItems: s.likedItems,
        dislikedIds: s.dislikedIds,
        watchedItems: s.watchedItems,
        historyEntries: s.historyEntries,
      }),
    }
  )
);
