"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

// ── Mapping question → genres TMDB ────────────────────────────────────────────
// Chaque réponse mappe vers des genres movie et tv
// Utilisé dans page.tsx via answers.genreProfile
export const ANSWER_GENRE_MAP: Record<string, { movie: number[]; tv: number[] }> = {
  // Q1 — Soirée idéale
  "soiree_adrenale":   { movie: [28, 53, 12],      tv: [10759, 80]     },
  "soiree_larmes":     { movie: [18, 10749],        tv: [18, 10749]     },
  "soiree_rires":      { movie: [35, 10751],        tv: [35, 10751]     },
  "soiree_mystere":    { movie: [9648, 53, 80],     tv: [9648, 80]      },
  "soiree_wonder":     { movie: [878, 14, 16],      tv: [10765, 16]     },
  "soiree_frayeur":    { movie: [27, 53],           tv: [9648, 27]      },

  // Q2 — Personnage préféré
  "perso_hero":        { movie: [28, 12, 14],       tv: [10759, 10765]  },
  "perso_detective":   { movie: [80, 9648, 53],     tv: [80, 9648]      },
  "perso_antihero":    { movie: [80, 53, 18],       tv: [80, 18]        },
  "perso_scientifique":{ movie: [878, 99],          tv: [10765, 99]     },
  "perso_amoureux":    { movie: [10749, 18, 35],    tv: [10749, 18]     },
  "perso_survivant":   { movie: [27, 53, 28],       tv: [10759, 9648]   },

  // Q3 — Fin préférée
  "fin_happy":         { movie: [35, 10749, 12],    tv: [35, 10749]     },
  "fin_ouverte":       { movie: [878, 9648, 18],    tv: [10765, 9648]   },
  "fin_tragique":      { movie: [18, 36],           tv: [18]            },
  "fin_twist":         { movie: [9648, 53, 80],     tv: [9648, 80]      },
  "fin_cathartique":   { movie: [18, 10749, 27],    tv: [18, 27]        },

  // Q4 — Univers
  "univers_reel":      { movie: [18, 80, 99],       tv: [18, 80, 99]    },
  "univers_futur":     { movie: [878],              tv: [10765]         },
  "univers_passe":     { movie: [36, 12],           tv: [36, 10759]     },
  "univers_fantasy":   { movie: [14, 16],           tv: [10765, 16]     },
  "univers_quotidien": { movie: [35, 18, 10749],    tv: [35, 18]        },

  // Q5 — Rythme
  "rythme_rapide":     { movie: [28, 53, 12],       tv: [10759, 80]     },
  "rythme_lent":       { movie: [18, 99, 36],       tv: [18, 99]        },
  "rythme_equilibre":  { movie: [9648, 53, 18],     tv: [9648, 18]      },
  "rythme_imprévisible":{ movie: [27, 9648, 878],   tv: [9648, 10765]   },

  // Q6 — Emotion
  "emotion_adrenale":  { movie: [28, 53],           tv: [10759, 80]     },
  "emotion_reflexion": { movie: [878, 99, 18],      tv: [10765, 99]     },
  "emotion_evasion":   { movie: [14, 12, 16],       tv: [10765, 10759]  },
  "emotion_empathie":  { movie: [18, 10749],        tv: [18, 10749]     },
  "emotion_peur":      { movie: [27, 53],           tv: [27, 9648]      },
  "emotion_rire":      { movie: [35],               tv: [35]            },

  // Q7 — Contexte visuel
  "visuel_grandiose":  { movie: [12, 14, 878, 28],  tv: [10759, 10765]  },
  "visuel_intime":     { movie: [18, 10749, 35],    tv: [18, 10749]     },
  "visuel_sombre":     { movie: [27, 80, 53],       tv: [80, 9648]      },
  "visuel_coloré":     { movie: [16, 35, 14],       tv: [16, 35]        },
  "visuel_realiste":   { movie: [99, 18, 36],       tv: [99, 18]        },

  // Q8 — Durée / format
  "format_film_court": { movie: [35, 18],           tv: []              },
  "format_film_long":  { movie: [28, 12, 878, 14],  tv: []              },
  "format_serie_mini": { movie: [],                 tv: [18, 80, 9648]  },
  "format_serie_longue":{ movie: [],                tv: [10759, 10765]  },
  "format_anime":      { movie: [16],               tv: [16]            },
  "format_indiff":     { movie: [18, 28, 35],       tv: [18, 80, 35]    },
};

// ── Questions du quiz ─────────────────────────────────────────────────────────
const QUIZ_STEPS = [
  {
    id: "soiree",
    question: "C'est vendredi soir. Quelle est votre soirée idéale ?",
    subtitle: "Votre instinct révèle tout",
    type: "single",
    options: [
      { value: "soiree_adrenale",  emoji: "🏎️", label: "Soirée adrénaline",    desc: "On reste scotché, le cœur qui bat" },
      { value: "soiree_larmes",    emoji: "😭", label: "Soirée émotions",       desc: "Une belle histoire qui fait vibrer" },
      { value: "soiree_rires",     emoji: "😂", label: "Soirée bonne humeur",   desc: "On rit et on oublie tout" },
      { value: "soiree_mystere",   emoji: "🕵️", label: "Soirée enquête",        desc: "Un mystère à résoudre" },
      { value: "soiree_wonder",    emoji: "🌌", label: "Soirée émerveillement", desc: "Un autre monde, une autre réalité" },
      { value: "soiree_frayeur",   emoji: "👻", label: "Soirée frissons",       desc: "La peur délicieuse dans le noir" },
    ],
  },
  {
    id: "perso",
    question: "Quel personnage vous ressemble le plus ?",
    subtitle: "Choisissez celui qui vous attire instinctivement",
    type: "single",
    options: [
      { value: "perso_hero",         emoji: "🦸", label: "Le héros courageux",    desc: "Prêt à tout pour sauver les autres" },
      { value: "perso_detective",    emoji: "🔍", label: "Le détective brillant",  desc: "Observe, analyse, résout" },
      { value: "perso_antihero",     emoji: "🎭", label: "L'anti-héros ambigu",    desc: "Ni bon ni mauvais, fascinant" },
      { value: "perso_scientifique", emoji: "🔬", label: "Le génie visionnaire",   desc: "Comprend ce que personne ne voit" },
      { value: "perso_amoureux",     emoji: "💞", label: "L'âme romantique",       desc: "Les relations avant tout" },
      { value: "perso_survivant",    emoji: "🪓", label: "Le survivant tenace",    desc: "Fait face à l'impossible" },
    ],
  },
  {
    id: "fin",
    question: "Quelle fin de film vous marque le plus ?",
    subtitle: "Les fins révèlent vos attentes profondes",
    type: "single",
    options: [
      { value: "fin_happy",       emoji: "☀️", label: "Le happy end mérité",     desc: "Les bons gagnent, on sourit" },
      { value: "fin_ouverte",     emoji: "❓", label: "La fin ouverte",           desc: "On continue à y penser des jours" },
      { value: "fin_tragique",    emoji: "🥀", label: "La fin tragique",          desc: "Belle et douloureuse à la fois" },
      { value: "fin_twist",       emoji: "🌀", label: "Le twist final",           desc: "Tout est remis en question" },
      { value: "fin_cathartique", emoji: "💧", label: "La fin cathartique",       desc: "On pleure, mais on se sent libéré" },
    ],
  },
  {
    id: "univers",
    question: "Dans quel univers voulez-vous plonger ce soir ?",
    subtitle: "L'ambiance qui vous fait rêver",
    type: "single",
    options: [
      { value: "univers_reel",      emoji: "🏙️", label: "Le monde réel",        desc: "Des histoires humaines, crédibles" },
      { value: "univers_futur",     emoji: "🚀", label: "Le futur & l'espace",   desc: "Technologie, IA, exploration" },
      { value: "univers_passe",     emoji: "🏰", label: "Le passé & l'histoire", desc: "Époque révolue, costumes, batailles" },
      { value: "univers_fantasy",   emoji: "🧙", label: "Magie & fantasy",       desc: "Dragons, sorciers, mondes imaginaires" },
      { value: "univers_quotidien", emoji: "☕", label: "Le quotidien sublimé",  desc: "Des gens ordinaires, des émotions vraies" },
    ],
  },
  {
    id: "rythme",
    question: "Quel rythme narratif vous captive ?",
    subtitle: "La façon dont l'histoire avance",
    type: "single",
    options: [
      { value: "rythme_rapide",       emoji: "⚡", label: "Rapide & explosif",       desc: "Action, rebondissements, tension" },
      { value: "rythme_lent",         emoji: "🌊", label: "Lent & contemplatif",      desc: "Prend son temps, installe l'atmosphère" },
      { value: "rythme_equilibre",    emoji: "⚖️", label: "Équilibré & maîtrisé",     desc: "Ni trop vite, ni trop lent" },
      { value: "rythme_imprévisible", emoji: "🎲", label: "Imprévisible & déroutant", desc: "On ne sait jamais ce qui arrive" },
    ],
  },
  {
    id: "emotion",
    question: "Quelle sensation voulez-vous ressentir en regardant ?",
    subtitle: "L'émotion que vous cherchez vraiment",
    type: "single",
    options: [
      { value: "emotion_adrenale",  emoji: "💥", label: "Adrénaline pure",        desc: "Le cœur qui s'emballe" },
      { value: "emotion_reflexion", emoji: "🧠", label: "Stimulation mentale",    desc: "Ça fait réfléchir longtemps après" },
      { value: "emotion_evasion",   emoji: "🌈", label: "Évasion totale",         desc: "Oublier sa vie pendant 2h" },
      { value: "emotion_empathie",  emoji: "🤝", label: "Connexion humaine",      desc: "Se sentir compris, touché" },
      { value: "emotion_peur",      emoji: "😱", label: "Peur & tension",         desc: "L'angoisse qu'on aime détester" },
      { value: "emotion_rire",      emoji: "😄", label: "Légèreté & joie",        desc: "Juste se sentir bien" },
    ],
  },
  {
    id: "visuel",
    question: "Quelle esthétique visuelle vous attire ?",
    subtitle: "L'image qui vous donne envie de regarder",
    type: "single",
    options: [
      { value: "visuel_grandiose", emoji: "🎆", label: "Épique & grandiose",  desc: "Décors immenses, effets spectaculaires" },
      { value: "visuel_intime",    emoji: "🕯️", label: "Intime & minimaliste", desc: "Gros plans, émotions, simplicité" },
      { value: "visuel_sombre",    emoji: "🌑", label: "Sombre & atmosphérique", desc: "Ombre, tension, ambiance noire" },
      { value: "visuel_coloré",    emoji: "🎨", label: "Coloré & inventif",    desc: "Visuel unique, style marqué" },
      { value: "visuel_realiste",  emoji: "📷", label: "Réaliste & documentaire", desc: "Tourné comme la vraie vie" },
    ],
  },
  {
    id: "format",
    question: "Quel format correspond à votre soirée ?",
    subtitle: "On adapte nos suggestions à votre temps",
    type: "single",
    options: [
      { value: "format_film_court",  emoji: "⏱️", label: "Film court (< 1h30)",   desc: "Efficace, pas de temps à perdre" },
      { value: "format_film_long",   emoji: "🎬", label: "Grand film (2h+)",       desc: "Une vraie expérience cinéma" },
      { value: "format_serie_mini",  emoji: "📺", label: "Mini-série (6-10 épi.)", desc: "Une histoire complète à binge" },
      { value: "format_serie_longue",emoji: "🍿", label: "Série longue",           desc: "Plusieurs saisons, je m'installe" },
      { value: "format_anime",       emoji: "⛩️", label: "Animé",                  desc: "L'animation japonaise ou mondiale" },
      { value: "format_indiff",      emoji: "🎲", label: "Peu importe",            desc: "Surprenez-moi !" },
    ],
  },
];

interface Props {
  onComplete: (answers: Record<string, string | string[]>) => void;
}

export default function QuizView({ onComplete }: Props) {
  const { quizStep, setQuizStep, quizAnswers, setQuizAnswer, resetQuiz } = useAppStore();
  const [transitioning, setTransitioning] = useState(false);

  const step = QUIZ_STEPS[quizStep];
  const progress = (quizStep / QUIZ_STEPS.length) * 100;

  const handleSelect = (value: string) => {
    setQuizAnswer(step.id as any, value);

    if (quizStep >= QUIZ_STEPS.length - 1) {
      const finalAnswers: Record<string, string | string[]> = {
        ...quizAnswers,
        [step.id]: value,
      };
      onComplete(finalAnswers);
      return;
    }

    setTransitioning(true);
    setTimeout(() => {
      setQuizStep(quizStep + 1);
      setTransitioning(false);
    }, 280);
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

  const cols = step.options.length <= 4 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-24">
      <div className="orb w-[500px] h-[500px] bg-neon/10 -top-40 -left-40" />
      <div className="orb w-[400px] h-[400px] bg-accent/10 -bottom-20 -right-20" />

      <div className="w-full max-w-2xl relative">

        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/40 text-sm">
              {quizStep + 1} <span className="text-white/20">/</span> {QUIZ_STEPS.length}
            </span>
            <button
              onClick={resetQuiz}
              className="text-white/25 hover:text-white/50 transition-colors text-xs"
            >
              Recommencer
            </button>
          </div>
          {/* Segmented progress bar */}
          <div className="flex gap-1.5">
            {QUIZ_STEPS.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: i < quizStep ? "100%" : i === quizStep ? "100%" : "0%",
                    background: i < quizStep
                      ? "rgba(230,57,70,0.5)"
                      : i === quizStep
                      ? "linear-gradient(90deg, #e63946, #f4a261)"
                      : "transparent",
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Question */}
        <div
          className={`transition-all duration-280 ${
            transitioning ? "opacity-0 translate-y-5" : "opacity-100 translate-y-0"
          }`}
        >
          <div className="mb-8">
            <p className="text-white/35 text-xs mb-3 tracking-widest uppercase font-medium">
              {step.subtitle}
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.03em" }}
            >
              {step.question}
            </h2>
          </div>

          {/* Options */}
          <div className={`grid gap-3 ${cols}`}>
            {step.options.map((opt, i) => {
              const isSelected = quizAnswers[step.id as keyof typeof quizAnswers] === opt.value;

              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`
                    relative rounded-2xl p-4 text-left transition-all duration-200
                    border group overflow-hidden
                    ${isSelected
                      ? "border-accent bg-accent/10 scale-[1.02]"
                      : "glass border-white/6 hover:border-white/20 hover:scale-[1.02]"
                    }
                  `}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  {/* Hover glow */}
                  {!isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/15 to-transparent" />
                  )}

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{opt.emoji}</span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white leading-tight mb-1">
                      {opt.label}
                    </p>
                    <p className="text-xs text-white/40 leading-snug">{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Back */}
          {quizStep > 0 && (
            <div className="mt-7 flex justify-center">
              <button
                onClick={handleBack}
                className="text-white/25 hover:text-white/55 transition-colors text-sm flex items-center gap-1.5"
              >
                ← Question précédente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
