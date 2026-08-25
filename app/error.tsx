"use client";

import { useEffect } from "react";

/**
 * Ett enda ogiltigt datum räckte tidigare för att ta ner hela sidan till en
 * vit skärm. Felen som orsakade det är lagade, men en räknemotor som matas
 * med användarens egna siffror kommer alltid kunna hamna i ett läge ingen
 * tänkt på. Då är ett meddelande och en väg tillbaka bättre än ingenting.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Något gick fel i uträkningen
      </h1>
      <p className="mt-3 text-sm leading-6 text-white/60">
        Dina siffror finns kvar i webbläsaren och har inte skickats någonstans.
        Försök igen, eller ändra det värde du senast skrev in.
      </p>
      <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <button
          onClick={reset}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-[#06060A] transition hover:-translate-y-0.5"
        >
          Försök igen
        </button>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[.12] px-6 text-sm font-semibold transition hover:bg-white/[.05]"
        >
          Ladda om sidan
        </button>
      </div>
      {error.digest ? (
        <p className="mt-6 text-[11px] text-white/30">Fel-id: {error.digest}</p>
      ) : null}
    </main>
  );
}
