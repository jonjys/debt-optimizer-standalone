import type { Loan } from "./types";

/**
 * Generic, illustrative loan presets shown in the app's "Ladda exempel"
 * dropdown. NO real customer or personal data — this file ships to
 * production and is safe for any CFO/user to see. Real test fixtures
 * (e.g. the founder's own historical loan data) live under
 * test/fixtures/ and are never imported into the production bundle.
 */
export interface LoanPreset {
  id: string;
  label: string;
  description: string;
  loans: Loan[];
}

const DEFAULT_MONTH = "2026-08";

export const LOAN_PRESETS: LoanPreset[] = [
  {
    id: "sme",
    label: "SME-exempel",
    description: "Rörelsekredit + investeringslån",
    loans: [
      {
        id: "sme-rorelsekredit",
        name: "Rörelsekredit",
        loanType: "Annuitet",
        paymentStyle: "annuity",
        balance: 150000,
        interestRate: 0.065,
        // Kept under the fee-inclusion heuristic's threshold (~1728 kr for
        // this balance/rate) — a faster payoff is realistic for a real
        // rörelsekredit, but would trip the demo's own advisory warning.
        currentMonthlyPayment: 1600,
        extraMonthly: 0,
        extraMonthlyEnabled: false,
        extraMonthlyFrom: DEFAULT_MONTH,
      },
      {
        id: "sme-investeringslan",
        name: "Investeringslån",
        loanType: "Annuitet",
        paymentStyle: "annuity",
        balance: 400000,
        interestRate: 0.082,
        currentMonthlyPayment: 5000,
        extraMonthly: 0,
        extraMonthlyEnabled: false,
        extraMonthlyFrom: DEFAULT_MONTH,
      },
    ],
  },
  {
    id: "private",
    label: "Privatperson",
    description: "Bolån + blancolån",
    loans: [
      {
        id: "priv-bolan",
        name: "Bolån",
        loanType: "Rak amortering",
        paymentStyle: "fixed_amort",
        balance: 2000000,
        interestRate: 0.041,
        // 2.5%/år amortering (~4167 kr/mån) — 1% (1667/mo) is a real
        // legal minimum in Sweden but takes ~100 years to fully amortize
        // in this app's flat (non-LTV-stepped) model, which blows past
        // the 600-month simulation cap and shows a false "never pays off"
        // warning. 2.5% keeps the demo realistic AND inside the window.
        currentMonthlyPayment: 4167,
        extraMonthly: 0,
        extraMonthlyEnabled: false,
        extraMonthlyFrom: DEFAULT_MONTH,
      },
      {
        id: "priv-blancolan",
        name: "Blancolån",
        loanType: "Annuitet",
        paymentStyle: "annuity",
        balance: 180000,
        interestRate: 0.115,
        // Kept comfortably under the fee-inclusion heuristic's threshold
        // (reference annuity * 1.15 ≈ 2656 kr for this balance/rate) so the
        // demo preset doesn't trip its own "looks like it includes fees"
        // warning.
        currentMonthlyPayment: 2400,
        extraMonthly: 0,
        extraMonthlyEnabled: false,
        extraMonthlyFrom: DEFAULT_MONTH,
      },
    ],
  },
  {
    id: "empty",
    label: "Tom mall",
    description: "Fyll i själv",
    loans: [
      {
        id: "empty-loan-1",
        name: "Lån 1",
        loanType: "Rak amortering",
        paymentStyle: "fixed_amort",
        balance: 0,
        interestRate: 0.05,
        currentMonthlyPayment: 0,
        targetMonthlyTotal: 0,
        targetMonthlyEnabled: false,
        targetMonthlyFrom: DEFAULT_MONTH,
        extraMonthly: 0,
        extraMonthlyEnabled: false,
        extraMonthlyFrom: DEFAULT_MONTH,
      },
      {
        id: "empty-loan-2",
        name: "Lån 2",
        loanType: "Annuitet",
        paymentStyle: "annuity",
        balance: 0,
        interestRate: 0.08,
        currentMonthlyPayment: 0,
        extraMonthly: 0,
        extraMonthlyEnabled: false,
        extraMonthlyFrom: DEFAULT_MONTH,
      },
    ],
  },
];
