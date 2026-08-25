import "./globals.css";
import type { Metadata, Viewport } from "next";

// Inga löften om en tidsram vi inte kan veta. Hur snabbt någon blir skuldfri
// beror på deras lån, räntor och vad de faktiskt betalar — appen räknar ut
// det, den lovar det inte i förväg.
export const metadata: Metadata = {
  metadataBase: new URL("https://debt-optimizer-standalone.vercel.app"),
  title: "DebtKill — se ditt skuldfria datum | Skuldkalkylator",
  description:
    "Räkna på bolån, blancolån, kreditkort, billån, CSN, leasing och avbetalning. Se ditt skuldfria datum och vad räntan kostar. Allt i din webbläsare.",
  openGraph: {
    title: "DebtKill — se ditt skuldfria datum",
    description:
      "Gratis och privat skuldkalkylator för alla typer av lån. Allt räknas i din webbläsare.",
    type: "website",
    locale: "sv_SE",
    siteName: "DebtKill",
    images: [
      {
        url: "/og-debtkill.svg",
        width: 1200,
        height: 630,
        alt: "DebtKill — skuldkalkylator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DebtKill",
    description: "Se ditt skuldfria datum. Gratis, privat, i webbläsaren.",
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
