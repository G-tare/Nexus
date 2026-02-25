import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Bot — The Ultimate Discord Bot",
  description:
    "39 powerful modules, 700+ commands. Moderation, leveling, music, economy, fun, and more. The only Discord bot you'll ever need.",
  keywords: ["discord bot", "nexus bot", "moderation", "leveling", "music", "economy"],
  openGraph: {
    title: "Nexus Bot — The Ultimate Discord Bot",
    description: "39 powerful modules, 700+ commands. The only Discord bot you'll ever need.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
