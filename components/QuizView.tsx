"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { MOOD_TO_GENRES } from "@/lib/tmdb";

const QUIZ_STEPS = [
  {
    id: "mediaType",
    question: "Qu'est-ce que vous voulez regarder ?",
    subtitle: "Choisissez votre format préféré pour ce soir",
    type: "single",
    options: [
      { value: "movie", label: "Film", emoji: "🎬", desc: "Une histoire complète en 2h" },
      { value: "tv", label: "Série", emoji: "📺", desc: "Des épisodes à binge-watcher" },
      { value: "anime", label: "Animé", emoji: "⛩️", desc: "L'art japonais en mouvement" },
      { value: "all", label: "Surprise-moi", emoji: "🎲", desc: "Laissez-vous guider" },
    ],
  },
  {
    id: "mood",
    question: "Comment vous sentez-vous ce soir ?",
    subtitle: "Votre humeur guide nos recommandations",
    type: "single",
    options: [
      { value: "action", label: "Plein d'énergie", emoji: "⚡", desc: "Prêt à l'aventure" },
      { value: "comedy", label: "Envie de rire", emoji: "😂", desc: "Légèreté et bonne humeur" },
      { value: "drama", label: "Émotionnel", emoji: "💔", desc: "Une histoire qui touche" },
      { value: "horror", label: "Cherche des frissons", emoji: "👻", desc: "L'angoisse délicieuse" },
      { value: "scifi", label: "Curieux & pensif", emoji: "🌌", desc: "Voyager dans l'imaginaire" },
      { value: "romance", label: "Romantique", emoji: "🌹", desc: "Envie de tendresse" },
    ],
  },
  {
    id: "vibe",
    question: "Quelle ambiance recherchez-vous ?",
    subtitle: "L'atmosphère qui vous attire le plus",
    type: "single",
    options: [
      { value: "intense", label: "Intense & haletant", emoji: "🔥", desc: "Impossible de s'arrêter" },
      { value: "chill", label: "Relax & confortable", emoji: "☁️", desc: "Pour se détendre" },
      { value: "mind", label: "Cérébral & complexe", emoji: "🧠", desc: "Qui fait réfléchir" },
      { value: "fun", label: "Fun & léger", emoji: "🎉", desc: "Entertainment pur" },
    ],
  },
  {
    id: "duration",
    question: "Combien de temps avez-vous ?",
    subtitle: "On adapte nos suggestions à votre disponibilité",
    type: "single",
    options: [
      { value: "short", label: "Moins de 1h30", emoji: "⏰", desc: "Court mais percutant" },
      { value: "medium", label: "1h30 – 2h30", emoji: "🕐", desc: "Le format idéal" },
      { value: "long", label: "Un marathon", emoji: "🌙", desc: "La nuit est longue" },
      { value: "series", label: "Une saison entière", emoji: "📅", desc: "Je suis accro d'avance" },
    ],
  },
  {
    id: "themes",
    question: "Quels thèmes vous fascinent ?",
    subtitle: "Sélectionnez tout ce qui vous attire (plusieurs choix possibles)",
    type: "multi",
    options: [
      { value: "thriller", label: "Mystère & Suspense", emoji: "🔍" },
      { value: "fantasy", label: "Fantasy & Magie", emoji: "🧙" },
      { value: "scifi", label: "Espace & Futur", emoji: "🚀" },
      { value: "action", label: "Combats & Vitesse", emoji: "⚔️" },
      { value: "romance", label: "Amour & Relations", emoji: "💕" },
      { value: "drama", label: "Famille & Société", emoji: "🏠" },
      { value: "documentary", label: "Vrai & Réel", emoji: "📰" },
      { value: "horror", label: "Peur & Horreur", emoji: "🕷️" },
      { value: "comedy", label: "Humour & Comédie", emoji: "😄" },
      { value: "animation", label: "Animation & Art", emoji: "🎨" },
    ],
  },
  {
    id: "era",
    question: "Quelle époque vous inspire ?",
    subtitle: "Le style de narration qui vous convient",
    type: "single",
    options: [
      { value: "classic", label: "Classiques intemporels", emoji: "🏛️", desc: "Avant 2000" },
      { value: "modern", label: "Ère moderne", emoji: "🎞️", desc: "2000 – 2015" },
      { value: "recent", label: "Dernières sorties", emoji: "✨", desc: "2015 – aujourd'hui" },
      { value: "any", label: "Peu importe", emoji: "🎯", desc: "La qualité prime" },
    ],
  },
];

interface Props {
  onComplete: (answers: Record<string, string | string[]>) => void;
}

export default function QuizView({ onComplete }: Props) {
  const { quizStep, setQuizStep, quizAnswers, setQuizAnswer, resetQuiz } = useAppStore();
  const [transitioning, setTransitioning] = useState(false);
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);

  const step = QUIZ_STEPS[quizStep];
  const progress = ((quizStep) / QUIZ_STEPS.length) * 100;
  const isMulti = step?.type === "multi";

  const handleSelect = (value: string) => {
    if (isMulti) {
      setSelectedMulti((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    } else {
      advance(value);
    }
  };

  const advance = (value?: string) => {
    if (isMulti) {
      const themes = selectedMulti.length > 0 ? selectedMulti : ["action"];
      setQuizAnswer("themes", themes);
    } else if (value) {
      setQuizAnswer(step.id as any, value);
    }

    if (quizStep >= QUIZ_STEPS.length - 1) {
      // Build final answers and complete
      const finalAnswers: Record<string, string | string[]> = {
        ...quizAnswers,
        ...(isMulti ? { themes: selectedMulti.length > 0 ? selectedMulti : ["action"] } : { [step.id]: value! }),
      };
      onComplete(finalAnswers);
      return;
    }

    setTransitioning(true);
    setTimeout(() => {
      setQuizStep(quizStep + 1);
      setSelectedMulti([]);
      setTransitioning(false);
    }, 300);
  };

  const handleBack = () => {
    if (quizStep === 0) return;
    setTransitioning(true);
    setTimeout(() => {
      setQuizStep(quizStep - 1);
      setTransitioning(false);
    }, 200);
  };

  if (!step) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      {/* Background orbs */}
      <div className="orb w-[500px] h-[500px] bg-neon/10 -top-40 -left-40" />
      <div className="orb w-[400px] h-[400px] bg-accent/10 -bottom-20 -right-20" />

      <div className="w-full max-w-3xl relative">
        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="text-white/40">Question {quizStep + 1} / {QUIZ_STEPS.length}</span>
            <button onClick={() => { resetQuiz(); }} className="text-white/30 hover:text-white/60 transition-colors text-xs">
              Recommencer
            </button>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="progress-bar h-full rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Question */}
        <div
          className={`transition-all duration-300 ${
            transitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          }`}
        >
          <div className="text-center mb-10">
            <p className="text-white/40 text-sm mb-3 tracking-widest uppercase">{step.subtitle}</p>
            <h2
              className="text-4xl md:text-5xl font-bold text-white mb-2 leading-tight"
              style={{ fontFamily: "var(--font-display, 'Bebas Neue'), sans-serif", letterSpacing: "0.02em" }}
            >
              {step.question}
            </h2>
          </div>

          {/* Options */}
          <div
            className={`grid gap-3 ${
              step.options.length <= 4
                ? "grid-cols-2 md:grid-cols-2"
                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
            }`}
          >
            {step.options.map((opt, i) => {
              const isActive = isMulti
                ? selectedMulti.includes(opt.value)
                : quizAnswers[step.id as keyof typeof quizAnswers] === opt.value;

              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`glass rounded-2xl p-5 text-left transition-all duration-200 hover:scale-105 border ${
                    isActive
                      ? "border-accent bg-accent/10 glow-accent"
                      : "border-white/5 hover:border-white/20"
                  }`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <span className="text-3xl mb-3 block">{opt.emoji}</span>
                  <p className="text-sm font-semibold text-white mb-1">{opt.label}</p>
                  {"desc" in opt && (
                    <p className="text-xs text-white/40">{opt.desc}</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Multi-select confirm */}
          {isMulti && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => advance()}
                disabled={selectedMulti.length === 0}
                className={`btn-primary text-white font-medium px-10 py-3.5 rounded-full transition-all ${
                  selectedMulti.length === 0 ? "opacity-40 cursor-not-allowed" : ""
                }`}
              >
                Voir mes recommandations ({selectedMulti.length} choix) →
              </button>
            </div>
          )}

          {/* Back button */}
          {quizStep > 0 && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleBack}
                className="text-white/30 hover:text-white/60 transition-colors text-sm flex items-center gap-2"
              >
                ← Retour
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
