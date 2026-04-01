"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";

export default function Navbar() {
  const { currentView, setView, likedItems } = useAppStore();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { id: "home", label: "Accueil" },
    { id: "quiz", label: "Test Psychologique" },
    { id: "analysis", label: "Mes Visionnages" },
  ] as const;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "glass-strong py-3" : "py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-2 group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-[#c1121f] flex items-center justify-center text-white font-bold text-sm group-hover:scale-110 transition-transform">
            C
          </div>
          <span
            className="text-2xl font-bold tracking-wider text-white"
            style={{ fontFamily: "var(--font-display, 'Bebas Neue'), sans-serif", letterSpacing: "0.05em" }}
          >
            CINE<span className="gradient-text-fire">AI</span>
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={`nav-link text-sm font-medium tracking-wide ${
                currentView === item.id ? "active text-white" : ""
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {likedItems.length > 0 && (
            <div className="hidden md:flex items-center gap-2 text-sm text-white/50">
              <span className="text-cyan">♥</span>
              <span>{likedItems.length} sauvegardé{likedItems.length > 1 ? "s" : ""}</span>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => setView("quiz")}
            className="hidden md:block btn-primary text-white text-sm font-medium px-5 py-2.5 rounded-full"
          >
            Commencer →
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden w-8 h-8 flex flex-col gap-1.5 items-center justify-center"
          >
            <span className={`w-5 h-0.5 bg-white transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`w-5 h-0.5 bg-white transition-all ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`w-5 h-0.5 bg-white transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden glass-strong mt-3 mx-4 rounded-2xl p-6 space-y-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setView(item.id as any); setMenuOpen(false); }}
              className={`block w-full text-left py-2 text-sm font-medium transition-colors ${
                currentView === item.id ? "text-accent" : "text-white/70 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => { setView("quiz"); setMenuOpen(false); }}
            className="btn-primary w-full text-white text-sm font-medium px-5 py-3 rounded-xl mt-4"
          >
            Commencer maintenant →
          </button>
        </div>
      )}
    </nav>
  );
}
