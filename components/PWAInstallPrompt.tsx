"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if already dismissed recently
    const dismissedAt = localStorage.getItem("pwa-dismissed");
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
      return; // dismissed less than 7 days ago
    }

    // iOS detection
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    if (ios) {
      setIsIOS(true);
      setTimeout(() => setShowBanner(true), 3000);
      return;
    }

    // Android / Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem("pwa-dismissed", String(Date.now()));
  };

  if (!showBanner || isInstalled || dismissed) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 md:left-auto md:right-6 md:w-96">
      <div
        className="glass-strong rounded-2xl border border-white/10 p-5 shadow-2xl"
        style={{ boxShadow: "0 20px 60px rgba(230, 57, 70, 0.2)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-[#c1121f] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              BM
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Installer BingeMatch</p>
              <p className="text-white/40 text-xs">Accès rapide depuis votre écran d'accueil</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none mt-0.5"
          >
            ×
          </button>
        </div>

        {/* Benefits */}
        <div className="space-y-2 mb-5">
          {[
            { icon: "⚡", text: "Lancement instantané" },
            { icon: "📴", text: "Fonctionne hors-ligne" },
            { icon: "🔔", text: "Expérience plein écran" },
          ].map((b) => (
            <div key={b.text} className="flex items-center gap-2 text-xs text-white/50">
              <span>{b.icon}</span>
              <span>{b.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {isIOS ? (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-white/70 text-xs leading-relaxed text-center">
              Appuyez sur{" "}
              <span className="text-white font-semibold">
                <svg className="inline w-4 h-4 mb-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
                </svg>
                {" "}Partager
              </span>{" "}
              puis{" "}
              <span className="text-white font-semibold">Sur l'écran d'accueil</span>
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 rounded-xl text-sm text-white/50 border border-white/10 hover:border-white/20 transition-all"
            >
              Plus tard
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 btn-primary text-white text-sm font-semibold py-2.5 rounded-xl"
            >
              Installer →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
