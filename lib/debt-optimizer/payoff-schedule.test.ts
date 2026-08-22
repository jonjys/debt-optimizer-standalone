import { describe, expect, it } from "vitest";
import { calculatePayoffSchedule } from "./engine";
import type { Loan } from "./types";

const straightLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "personal",
  name: "Blancolån / Privat",
  loanType: "Rak amortering",
  paymentStyle: "fixed_amort",
  balance: 112_000,
  interestRate: 0.3,
  currentMonthlyPayment: 8_400,
  extraMonthly: 0,
  extraMonthlyEnabled: false,
  ...overrides,
});

const calculate = (loan: Loan) =>
  calculatePayoffSchedule({
    loans: [loan],
    oneTimePayments: [],
    startDate: "2026-08",
    strategy: "avalanche",
  });

describe("single high-rate straight-line loan", () => {
  it("treats the entered monthly cost as principal plus first-month interest", () => {
    const result = calculate(straightLoan());
    const loan = result.loanResults[0];

    expect(loan.isFullyAmortizing).toBe(true);
    expect(loan.newEndDate).toBe("2028-03");
    expect(loan.newTotalInterest).toBe(29_400);
    expect(result.newFreedomDate).toBe("2028-03");
  });

  it("returns no payoff date when the monthly cost does not cover interest", () => {
    const result = calculate(straightLoan({ currentMonthlyPayment: 2_800 }));

    expect(result.loanResults[0].isFullyAmortizing).toBe(false);
    expect(result.loanResults[0].newEndDate).toBe("-");
    expect(result.newFreedomDate).toBe("-");
  });

  it("caps schedules beyond 600 months instead of reporting an early payoff", () => {
    const result = calculate(
      straightLoan({
        balance: 1_000_000,
        interestRate: 0,
        currentMonthlyPayment: 1_000,
      }),
    );

    expect(result.loanResults[0].isFullyAmortizing).toBe(false);
    expect(result.newFreedomDate).toBe("-");
  });
});
