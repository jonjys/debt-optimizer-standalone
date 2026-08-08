// app/layout.tsx
import React from "react";

export const metadata = {
  title: "Debt Optimizer",
  description: "Optimera dina skulder och avbetalningar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
