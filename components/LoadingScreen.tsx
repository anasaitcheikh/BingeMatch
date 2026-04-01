"use client";

export default function LoadingScreen({ message = "Analyse en cours..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Orbs */}
      <div className="orb w-96 h-96 bg-accent/20 -top-20 -left-20" />
      <div className="orb w-80 h-80 bg-neon/20 -bottom-20 -right-20" />

      <div className="relative text-center max-w-lg">
        {/* Spinning rings */}
        <div className="relative w-32 h-32 mx-auto mb-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/5" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: "#e63946", animationDuration: "1.2s" }}
          />
          <div
            className="absolute inset-3 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: "#7b2fff", animationDuration: "1.8s", animationDirection: "reverse" }}
          />
          <div
            className="absolute inset-6 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: "#06d6a0", animationDuration: "0.9s" }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">🎬</div>
        </div>

        <h2
          className="text-4xl font-bold text-white mb-4"
          style={{ fontFamily: "var(--font-display, 'Bebas Neue'), sans-serif", letterSpacing: "0.05em" }}
        >
          {message}
        </h2>

        <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-neon animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-cyan animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>

        <div className="mt-8 space-y-2">
          {[
            "Analyse de vos préférences...",
            "Parcours de la base de données...",
            "Calcul des correspondances...",
            "Finalisation de votre sélection...",
          ].map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-3 text-sm text-white/30 justify-center"
              style={{ animationDelay: `${i * 0.5}s` }}
            >
              <span className="text-cyan text-xs">✓</span>
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
