import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BingeMatch — Votre guide cinématographique intelligent",
  description: "Découvrez films, séries et animés personnalisés grâce à l'intelligence artificielle.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "BingeMatch",
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
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
