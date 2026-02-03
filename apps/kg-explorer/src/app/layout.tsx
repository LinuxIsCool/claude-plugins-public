import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navigation } from "@/components/kg";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KG Explorer | Knowledge Graph Singularity Research",
  description:
    "Explore 378 knowledge graph repositories compiled by 22 specialized agents. WebUI v1 of the recursive improvement system.",
  keywords: [
    "knowledge graphs",
    "AI",
    "singularity",
    "GraphRAG",
    "graph databases",
    "machine learning",
  ],
  authors: [{ name: "KG Singularity Research Project" }],
  openGraph: {
    title: "KG Explorer",
    description: "Knowledge Graph Singularity Research Platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-cosmos-gradient`}
      >
        {/* Background effects */}
        <div className="fixed inset-0 starfield opacity-20 pointer-events-none" />
        <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-nebula-glow opacity-30 pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-stellar-burst opacity-20 pointer-events-none" />

        {/* Main content */}
        <div className="relative z-10 flex flex-col min-h-screen">
          <Navigation />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border/40 py-6 mt-auto">
            <div className="container mx-auto px-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                <div>
                  Compiled by 22 specialized agents | Singularity Research
                  Project
                </div>
                <div className="flex items-center gap-4">
                  <span>378 Repositories</span>
                  <span>9 Tiers</span>
                  <span>4 Frontiers</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
