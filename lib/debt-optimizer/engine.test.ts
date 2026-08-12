import { describe, it, expect } from "vitest";
import { calculateExcelStrategy, emptyResult } from "./engine";
import type { Loan, StrategyInput } from "./types";

function mkLoan(over: Partial<Loan> & Pick<Loan, "id">): Loan {
  return {
    name: over.id,
    loanType: "Annuitet",
    paymentStyle: "annuity",
    balance: 0,
    interestRate: 0,
    currentMonthlyPayment: 0,
    ...over,
  };
}

function run(loans: Loan[], over: Partial<StrategyInput> = {}) {
  return calculateExcelStrategy({
    loans,
    oneTimePayments: [],
    startDate: "2026-01",
    strategy: "cascade",
    ...over,
  });
}

describe("Basic amortization", () => {
  it("pays down a flat-payment loan to zero over the expected number of months", () => {
    const r = run([mkLoan({ id: "a", balance: 10000, interestRate: 0.05, currentMonthlyPayment: 1000 })]);
    expect(r.loanResults[0].isFullyAmortizing).toBe(true);
    expect(r.loanResults[0].payoffOrder).toBe(1);
  });
});

describe("Interest calculation", () => {
  it("computes month-1 interest as balance * annualRate/12", () => {
    // 2000 @ 12%/yr => monthly rate 1% => interest month 1 = 20kr exactly
    const r = run([mkLoan({ id: "a", balance: 2000, interestRate: 0.12, currentMonthlyPayment: 5000 })]);
    expect(r.loanResults[0].newTotalInterest).toBe(20);
  });
});

describe("Final payment capping", () => {
  it("caps the last payment to remaining balance + interest, never overpays", () => {
    // balance 2000, payment 5000/mo => must finish in 1 month paying only 2020, not 5000
    const r = run([mkLoan({ id: "a", balance: 2000, interestRate: 0.12, currentMonthlyPayment: 5000 })]);
    const res = r.loanResults[0];
    expect(res.newEndDate).toBe("2026-02"); // 1 month after start
    expect(res.newTotalInterest).toBe(20);
  });
});

describe("Zero interest", () => {
  it("10000 kr @ 0% / 1000 kr/mo pays off in exactly 10 months with 0 interest (GOLDEN 3)", () => {
    const r = run([mkLoan({ id: "a", balance: 10000, interestRate: 0, currentMonthlyPayment: 1000 })]);
    const res = r.loanResults[0];
    expect(res.newEndDate).toBe("2026-11"); // 10 months after 2026-01
    expect(res.newTotalInterest).toBe(0);
  });
});

describe("Extra monthly payment", () => {
  it("extraMonthly speeds up payoff vs. the original (no-extra) baseline", () => {
    const r = run([
      mkLoan({
        id: "a", balance: 50000, interestRate: 0.08, currentMonthlyPayment: 1000,
        extraMonthlyEnabled: true, extraMonthly: 500, extraMonthlyFrom: "2026-01",
      }),
    ]);
    const res = r.loanResults[0];
    expect(res.monthsSaved).toBeGreaterThan(0);
    expect(res.newTotalInterest).toBeLessThan(res.originalTotalInterest);
  });

  it("extraMonthlyFrom gates the extra payment to start only from that month", () => {
    const withDelay = run([
      mkLoan({
        id: "a", balance: 50000, interestRate: 0.08, currentMonthlyPayment: 1000,
        extraMonthlyEnabled: true, extraMonthly: 500, extraMonthlyFrom: "2027-01",
      }),
    ]);
    const fromStart = run([
      mkLoan({
        id: "a", balance: 50000, interestRate: 0.08, currentMonthlyPayment: 1000,
        extraMonthlyEnabled: true, extraMonthly: 500, extraMonthlyFrom: "2026-01",
      }),
    ]);
    // Extra starting later can only help less than (or equal to) extra from day one.
    expect(fromStart.loanResults[0].newTotalInterest).toBeLessThanOrEqual(
      withDelay.loanResults[0].newTotalInterest
    );
  });
});

describe("Lump sum overflow", () => {
  it("a one-time payment larger than the remaining balance doesn't overpay or crash", () => {
    const r = calculateExcelStrategy({
      loans: [mkLoan({ id: "a", balance: 5000, interestRate: 0.05, currentMonthlyPayment: 500 })],
      oneTimePayments: [{ id: "x", date: "2026-01", amount: 100000, loanId: "a" }],
      startDate: "2026-01",
      strategy: "cascade",
    });
    const res = r.loanResults[0];
    expect(res.isFullyAmortizing).toBe(true);
    expect(res.newEndDate).toBe("2026-02"); // paid off same/next month, excess just absorbed
  });
});

describe("Snowball order", () => {
  it("orders loans smallest-balance-first regardless of input order", () => {
    const r = run(
      [
        mkLoan({ id: "big", balance: 30000, interestRate: 0.10, currentMonthlyPayment: 800 }),
        mkLoan({ id: "small", balance: 5000, interestRate: 0.03, currentMonthlyPayment: 300 }),
      ],
      { strategy: "snowball" }
    );
    const order = r.loanResults.sort((a, b) => a.payoffOrder - b.payoffOrder).map((x) => x.id);
    expect(order).toEqual(["small", "big"]);
  });
});

describe("Avalanche order", () => {
  it("orders loans highest-rate-first regardless of input order", () => {
    const r = run(
      [
        mkLoan({ id: "lowrate", balance: 20000, interestRate: 0.03, currentMonthlyPayment: 500 }),
        mkLoan({ id: "highrate", balance: 5000, interestRate: 0.15, currentMonthlyPayment: 300 }),
      ],
      { strategy: "avalanche" }
    );
    const order = r.loanResults.sort((a, b) => a.payoffOrder - b.payoffOrder).map((x) => x.id);
    expect(order).toEqual(["highrate", "lowrate"]);
  });

  it("GOLDEN 4: avalanche (5k@15% + 20k@3%) produces lower total interest than snowball", () => {
    const loans = () => [
      mkLoan({ id: "x", balance: 5000, interestRate: 0.15, currentMonthlyPayment: 800 }),
      mkLoan({ id: "y", balance: 20000, interestRate: 0.03, currentMonthlyPayment: 500 }),
    ];
    const avalanche = run(loans(), { strategy: "avalanche" });
    const snowball = run(loans(), { strategy: "snowball" });
    expect(avalanche.totalNewInterest).toBeLessThanOrEqual(snowball.totalNewInterest);
  });
});

describe("Cascade auto-roll", () => {
  it("GOLDEN 5: once loan A is paid off, its full payment rolls onto loan B automatically", () => {
    const r = run(
      [
        mkLoan({ id: "a", balance: 3000, interestRate: 0.05, currentMonthlyPayment: 1000 }), // pays off in ~3 months
        mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 }),
      ],
      { strategy: "cascade" }
    );
    const a = r.loanResults.find((x) => x.id === "a")!;
    const b = r.loanResults.find((x) => x.id === "b")!;
    expect(a.isFullyAmortizing).toBe(true);
    // B must pay off faster than it would alone at 500/mo (50000/500 = 100mo)
    const bAlone = run([mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 })]);
    expect(b.newTotalInterest).toBeLessThan(bAlone.loanResults[0].newTotalInterest);
  });

  it("no separate cascade checkbox needed: the roll happens automatically for cascade/avalanche/snowball alike", () => {
    const loans = () => [
      mkLoan({ id: "a", balance: 3000, interestRate: 0.05, currentMonthlyPayment: 1000 }),
      mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 }),
    ];
    for (const strategy of ["cascade", "avalanche", "snowball"] as const) {
      const r = run(loans(), { strategy });
      const b = r.loanResults.find((x) => x.id === "b")!;
      expect(b.newTotalInterest).toBeLessThan(
        run([mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 })]).loanResults[0]
          .newTotalInterest
      );
    }
  });
});

describe("Multiple loans reconciliation", () => {
  it("totalInterestSaved always equals the sum of each loan's own interestSaved (BUG-2b fix)", () => {
    const loans = [];
    for (let i = 0; i < 6; i++) {
      loans.push(
        mkLoan({
          id: "L" + i,
          balance: 10000 + i * 3333.33,
          interestRate: 0.03 + i * 0.011,
          currentMonthlyPayment: 400 + i * 37,
        })
      );
    }
    const r = run(loans, { strategy: "avalanche" });
    const sumSaved = r.loanResults.reduce((s, x) => s + x.interestSaved, 0);
    expect(r.totalInterestSaved).toBe(sumSaved);
  });
});

describe("Loan payoff detection", () => {
  it("marks a loan fully amortizing exactly when it reaches zero balance within the simulation window", () => {
    const r = run([mkLoan({ id: "a", balance: 1000, interestRate: 0.05, currentMonthlyPayment: 1000 })]);
    expect(r.loanResults[0].isFullyAmortizing).toBe(true);
  });
});

describe("Payoff date arithmetic", () => {
  it("GOLDEN 1: 100000 kr @ 10% / 10000 kr/mo pays off in 11 months with 4858 kr interest (corrected golden value)", () => {
    const r = run([mkLoan({ id: "a", balance: 100000, interestRate: 0.10, currentMonthlyPayment: 10000 })]);
    const res = r.loanResults[0];
    expect(res.newEndDate).toBe("2026-12"); // 11 months after 2026-01
    expect(res.newTotalInterest).toBe(4858);
  });

  it("GOLDEN 2: 2000 kr @ 12% / 5000 kr/mo pays off in 1 month with 20 kr interest", () => {
    const r = run([mkLoan({ id: "a", balance: 2000, interestRate: 0.12, currentMonthlyPayment: 5000 })]);
    const res = r.loanResults[0];
    expect(res.newEndDate).toBe("2026-02");
    expect(res.newTotalInterest).toBe(20);
  });

  it("wraps year boundaries correctly (Dec -> Jan)", () => {
    const r = run(
      [mkLoan({ id: "a", balance: 2000, interestRate: 0, currentMonthlyPayment: 1000 })],
      { startDate: "2026-12" }
    );
    expect(r.loanResults[0].newEndDate).toBe("2027-02");
  });
});

describe("Total interest", () => {
  it("original (baseline) interest ignores extra/target top-ups", () => {
    const r = run([
      mkLoan({
        id: "a", balance: 50000, interestRate: 0.08, currentMonthlyPayment: 1000,
        extraMonthlyEnabled: true, extraMonthly: 2000, extraMonthlyFrom: "2026-01",
      }),
    ]);
    const withoutExtra = run([mkLoan({ id: "a", balance: 50000, interestRate: 0.08, currentMonthlyPayment: 1000 })]);
    expect(r.loanResults[0].originalTotalInterest).toBe(withoutExtra.loanResults[0].originalTotalInterest);
  });
});

describe("Interest savings", () => {
  it("interestSaved is never negative even if new somehow exceeds original", () => {
    const r = run([mkLoan({ id: "a", balance: 10000, interestRate: 0.05, currentMonthlyPayment: 500 })]);
    expect(r.loanResults[0].interestSaved).toBeGreaterThanOrEqual(0);
  });
});

describe("Edge cases: non-amortizing loan (BUG-1-NY regression)", () => {
  it("a loan whose payment never covers interest is reported as NOT fully amortizing, not as instantly paid off", () => {
    const r = run([mkLoan({ id: "a", balance: 100000, interestRate: 0.20, currentMonthlyPayment: 500 })]);
    const res = r.loanResults[0];
    expect(res.isFullyAmortizing).toBe(false);
    expect(res.newEndDate).toBe("-");
    expect(res.interestSaved).toBe(0);
  });

  it("the whole plan's newFreedomDate is also '-' when any loan never amortizes, not the start date", () => {
    const r = run([mkLoan({ id: "a", balance: 100000, interestRate: 0.20, currentMonthlyPayment: 500 })]);
    expect(r.newFreedomDate).toBe("-");
    expect(r.newFreedomDate).not.toBe("2026-01"); // the old bug: falsely "paid off at month 0"
  });
});

describe("Edge cases: invalid input validation (BUG-3 fix)", () => {
  it("throws on negative balance", () => {
    expect(() =>
      run([mkLoan({ id: "a", balance: -5000, interestRate: 0.05, currentMonthlyPayment: 1000 })])
    ).toThrow(/balance negativt/);
  });

  it("throws on negative interest rate", () => {
    expect(() =>
      run([mkLoan({ id: "a", balance: 10000, interestRate: -0.05, currentMonthlyPayment: 1000 })])
    ).toThrow(/ränta negativ/);
  });

  it("throws on interestRate stored as a percentage instead of a decimal (>100%)", () => {
    expect(() =>
      run([mkLoan({ id: "a", balance: 10000, interestRate: 5.95, currentMonthlyPayment: 1000 })])
    ).toThrow(/ränta >100%/);
  });

  it("throws on NaN/Infinity fields", () => {
    expect(() =>
      run([mkLoan({ id: "a", balance: 10000, interestRate: NaN, currentMonthlyPayment: 1000 })])
    ).toThrow(/NaN eller Infinity/);
    expect(() =>
      run([mkLoan({ id: "a", balance: 10000, interestRate: 0.05, currentMonthlyPayment: Infinity })])
    ).toThrow(/NaN eller Infinity/);
  });

  it("throws on negative monthly payment", () => {
    expect(() =>
      run([mkLoan({ id: "a", balance: 10000, interestRate: 0.05, currentMonthlyPayment: -100 })])
    ).toThrow(/betalning negativ/);
  });

  it("returns emptyResult (no throw) for an empty loan list", () => {
    expect(run([])).toEqual(emptyResult());
  });
});

describe("Determinism", () => {
  it("the same input produces byte-identical output across 100 runs", () => {
    const input: StrategyInput = {
      loans: [
        mkLoan({
          id: "a", balance: 112455, interestRate: 0.0595, currentMonthlyPayment: 1389,
          paymentStyle: "fixed_amort", targetMonthlyEnabled: true, targetMonthlyTotal: 2000,
          targetMonthlyFrom: "2026-08",
        }),
        mkLoan({
          id: "b", balance: 589111, interestRate: 0.0909, currentMonthlyPayment: 6888,
          extraMonthlyEnabled: true, extraMonthly: 500, extraMonthlyFrom: "2026-08",
        }),
      ],
      oneTimePayments: [{ id: "1", date: "2028-04", amount: 10000, loanId: "b" }],
      startDate: "2026-08",
      strategy: "cascade",
    };
    const first = calculateExcelStrategy(input);
    for (let i = 0; i < 100; i++) {
      expect(calculateExcelStrategy(input)).toEqual(first);
    }
  });
});
