import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CineAI — Votre guide cinématographique intelligent",
  description: "Découvrez films, séries et animés personnalisés grâce à l'intelligence artificielle.",
  openGraph: {
    title: "CineAI",
    description: "Recommandations personnalisées de films, séries et animés",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
