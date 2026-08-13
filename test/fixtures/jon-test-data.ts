import type { Loan } from "@/lib/debt-optimizer/types";

/**
 * Founder's own real loan data. Test-fixture only — nothing under
 * components/ or app/ may import this. An earlier version wired this into
 * a dev-mode "Ladda JON-TEST" button gated by NODE_ENV, but that STILL
 * leaked the data into the production build: `next build` emits a real,
 * publicly-servable chunk file for every `import()` call reachable in the
 * module graph, regardless of whether the runtime code path that triggers
 * it is ever reached. Verified this by grepping `.next/static` and
 * `.next/server` output after a build — the balances and bank names showed
 * up in plain text in shipped chunk files. The only bulletproof fix is:
 * no reference to this file from any component, ever. If you need Jon's
 * real numbers for manual testing, paste them into the app UI by hand or
 * write a throwaway local script — don't wire this into the app again.
 *
 * NEVER import this from production code paths — it's personal financial
 * data (GDPR + bank secrecy). See lib/debt-optimizer/example-loans.ts for
 * the generic presets that are safe for the real "Ladda exempel" UI.
 */
export const JON_TEST_LOANS: Loan[] = [
  {
    id: "jon-test-1",
    name: "Nordea",
    loanType: "Rak amortering",
    paymentStyle: "fixed_amort",
    balance: 112455,
    interestRate: 0.0595,
    currentMonthlyPayment: 1389,
    targetMonthlyTotal: 2000,
    targetMonthlyEnabled: true,
    targetMonthlyFrom: "2026-08",
  },
  {
    id: "jon-test-2",
    name: "Nordax",
    loanType: "Annuitet",
    paymentStyle: "annuity",
    balance: 589111,
    interestRate: 0.0909,
    currentMonthlyPayment: 6888,
    extraMonthly: 500,
    extraMonthlyEnabled: true,
    extraMonthlyFrom: "2026-08",
  },
];
