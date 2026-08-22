import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://debt-optimizer-standalone.vercel.app"),
  title: "DebtKill - Döda skulderna 4 år tidigare | Skuldfri-kalkylator",
  description:
    "Räkna på bolån, blancolån, leasing, inom familj. Ska du amortera eller spara? Allt i din webbläsare. Gratis, privat, offline.",
  openGraph: {
    title: "DebtKill - Döda skulderna 4 år tidigare",
    description: "Gratis och privat skuldfri-kalkylator för alla typer av lån.",
    type: "website",
    locale: "sv_SE",
    siteName: "DebtKill",
    images: [
      {
        url: "/og-debtkill.svg",
        width: 1200,
        height: 630,
        alt: "DebtKill - apr. 2038 - 390k sparad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DebtKill",
    description: "Döda skulderna 4 år tidigare.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
