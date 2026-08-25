import "./globals.css";
import type { Metadata, Viewport } from "next";

// Inga löften om en tidsram vi inte kan veta. Hur snabbt någon blir skuldfri
// beror på deras lån, räntor och vad de faktiskt betalar — appen räknar ut
// det, den lovar det inte i förväg.
export const metadata: Metadata = {
  // Måste peka på den domän sidan faktiskt ligger på, annars byggs
  // og:image-URL:en mot fel värd och delningen visar ingen bild.
  metadataBase: new URL("https://debtoptimize.se"),
  title: "DebtOptimize — se ditt skuldfria datum | Skuldkalkylator",
  description:
    "Räkna på bolån, blancolån, kreditkort, billån, CSN, leasing och avbetalning. Se ditt skuldfria datum och vad räntan kostar. Allt i din webbläsare.",
  applicationName: "DebtOptimize",
  keywords: [
    "skuldkalkylator",
    "amortera",
    "bolån",
    "blancolån",
    "ränteavdrag",
    "amorteringskrav",
    "skuldfri",
  ],
  openGraph: {
    title: "DebtOptimize — se ditt skuldfria datum",
    description:
      "Gratis och privat skuldkalkylator för alla typer av lån. Allt räknas i din webbläsare.",
    type: "website",
    locale: "sv_SE",
    siteName: "DebtOptimize",
    url: "https://debtoptimize.se",
    images: [
      {
        // PNG, inte SVG: Facebook, LinkedIn, X och iMessage renderar inte
        // SVG som delningsbild — då syns ingen bild alls.
        url: "/og-debtoptimize.png",
        width: 1200,
        height: 630,
        alt: "DebtOptimize — se exakt när dina skulder är borta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DebtOptimize",
    description: "Se ditt skuldfria datum. Gratis, privat, i webbläsaren.",
    images: ["/og-debtoptimize.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06060A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" className="dark">
      <body className="min-h-screen bg-[#06060A] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
