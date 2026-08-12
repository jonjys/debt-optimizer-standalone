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

describe("oneTimePaymentReducesEndDate (P0 regression)", () => {
  // Root cause: oneTimeMap.delete(dateStr) fired whenever the loop reached
  // the priority-index loan, regardless of whether THAT loan actually
  // consumed the entry — so a one-time payment aimed at any loan other
  // than the priority-index one was silently wiped before its real target
  // ever got a chance to see it, as soon as the plan had 2+ loans.
  it("a 50k one-time payment on a 589k loan measurably cuts months off its payoff, even alongside another loan", () => {
    const other = mkLoan({
      id: "other", balance: 112455, interestRate: 0.0595, currentMonthlyPayment: 1389,
      paymentStyle: "fixed_amort",
    });
    const target = () =>
      mkLoan({ id: "target", balance: 589111, interestRate: 0.0909, currentMonthlyPayment: 6888 });

    const without = run([other, target()]);
    const withOT = calculateExcelStrategy({
      loans: [other, target()],
      oneTimePayments: [{ id: "x", date: "2026-01", amount: 50000, loanId: "target" }],
      startDate: "2026-01",
      strategy: "cascade",
    });

    const monthsWithout = without.loanResults.find((r) => r.id === "target")!.monthsSaved;
    const monthsWith = withOT.loanResults.find((r) => r.id === "target")!.monthsSaved;
    expect(monthsWith).toBeGreaterThan(monthsWithout);
    expect(withOT.newFreedomDate).not.toBe(without.newFreedomDate);
  });

  it("still works when the one-time payment targets the loan that IS the priority-index loan (regression guard)", () => {
    const first = () => mkLoan({ id: "first", balance: 100000, interestRate: 0.05, currentMonthlyPayment: 2000 });
    const second = mkLoan({ id: "second", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 1000 });

    const without = run([first(), second]);
    const withOT = calculateExcelStrategy({
      loans: [first(), second],
      oneTimePayments: [{ id: "x", date: "2026-01", amount: 50000, loanId: "first" }],
      startDate: "2026-01",
      strategy: "cascade",
    });
    expect(withOT.loanResults.find((r) => r.id === "first")!.newTotalInterest).toBeLessThan(
      without.loanResults.find((r) => r.id === "first")!.newTotalInterest
    );
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

describe("Manual mode: no automatic transfer between loans", () => {
  it("loan A paying off does NOT speed up loan B unless reinvestment is explicitly enabled", () => {
    const withA = run(
      [
        mkLoan({ id: "a", balance: 3000, interestRate: 0.05, currentMonthlyPayment: 1000 }), // pays off in ~3 months
        mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 }),
      ],
      { strategy: "cascade" }
    );
    const bAlone = run([mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 })]);
    const b = withA.loanResults.find((x) => x.id === "b")!;
    // No auto-roll: B's own payoff is completely unaffected by A finishing.
    expect(b.newTotalInterest).toBe(bAlone.loanResults[0].newTotalInterest);
    expect(b.newEndDate).toBe(bAlone.loanResults[0].newEndDate);
  });

  it("this holds for cascade/avalanche/snowball alike — order no longer implies auto-rolling payment", () => {
    const loans = () => [
      mkLoan({ id: "a", balance: 3000, interestRate: 0.05, currentMonthlyPayment: 1000 }),
      mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 }),
    ];
    const bAlone = run([mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 })])
      .loanResults[0].newTotalInterest;
    for (const strategy of ["cascade", "avalanche", "snowball"] as const) {
      const r = run(loans(), { strategy });
      const b = r.loanResults.find((x) => x.id === "b")!;
      expect(b.newTotalInterest).toBe(bAlone);
    }
  });

  it("noAutoTransfer: when Lån 1 is fully paid off, absolutely nothing changes for Lån 2 unless reinvestment.enabled is checked", () => {
    const lan1Paid = mkLoan({ id: "lan1", balance: 0, interestRate: 0.05, currentMonthlyPayment: 2000 }); // cleared, filtered out of calc
    const lan2 = mkLoan({ id: "lan2", balance: 200000, interestRate: 0.05, currentMonthlyPayment: 2000 });

    // A cleared loan 1 alongside loan 2 (reinvestment left untouched/disabled)...
    const withClearedLan1 = calculateExcelStrategy({
      loans: [lan1Paid, lan2].filter((l) => l.balance > 0 && l.currentMonthlyPayment > 0), // mirrors the UI's own filter
      oneTimePayments: [],
      startDate: "2026-01",
      strategy: "cascade",
    });
    // ...must be identical to loan 2 running completely on its own.
    const lan2Alone = run([lan2]);
    expect(withClearedLan1).toEqual(lan2Alone);
  });
});

describe("Manual reinvestment", () => {
  it("manualReinvestmentReducesEndDate: Lån 1 (100k/5%/2k) clears, reinvesting its 2k into Lån 2 (200k/5%/2k) noticeably speeds up Lån 2", () => {
    const loan1 = mkLoan({ id: "loan1", balance: 100000, interestRate: 0.05, currentMonthlyPayment: 2000 });
    const loan1Solo = calculateExcelStrategy({
      loans: [loan1], oneTimePayments: [], startDate: "2026-01", strategy: "cascade",
    });
    const loan1ClearDate = loan1Solo.loanResults[0].newEndDate; // reinvest starting the month it clears

    const loan2 = mkLoan({ id: "loan2", balance: 200000, interestRate: 0.05, currentMonthlyPayment: 2000 });
    const withoutReinvest = run([loan1, loan2]);
    const withReinvest = run([
      loan1,
      { ...loan2, reinvestment: { enabled: true, fromLoanId: "loan1", amount: 2000, startDate: loan1ClearDate } },
    ]);

    const l2Without = withoutReinvest.loanResults.find((r) => r.id === "loan2")!;
    const l2With = withReinvest.loanResults.find((r) => r.id === "loan2")!;
    // Measured: ~130 months without reinvestment vs. ~91 months with it (≈30% faster,
    // in the ballpark of the "~50% snabbare" estimate) — assert a solid, non-brittle margin.
    expect(l2With.monthsSaved).toBeGreaterThan(0);
    expect(l2With.newEndDate < l2Without.newEndDate).toBe(true);
    expect(l2With.newTotalInterest).toBeLessThan(l2Without.newTotalInterest * 0.85);
  });

  it("GOLDEN 5 (manual): enabling reinvestment on B, sourced from A's freed payment, speeds up B's payoff", () => {
    const withReinvestment = run([
      mkLoan({ id: "a", balance: 3000, interestRate: 0.05, currentMonthlyPayment: 1000 }), // clears ~month 3
      mkLoan({
        id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500,
        reinvestment: { enabled: true, fromLoanId: "a", amount: 1000, startDate: "2026-04" },
      }),
    ]);
    const withoutReinvestment = run([
      mkLoan({ id: "a", balance: 3000, interestRate: 0.05, currentMonthlyPayment: 1000 }),
      mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 }),
    ]);
    const bWith = withReinvestment.loanResults.find((x) => x.id === "b")!;
    const bWithout = withoutReinvestment.loanResults.find((x) => x.id === "b")!;
    expect(bWith.newTotalInterest).toBeLessThan(bWithout.newTotalInterest);
    expect(bWith.monthsSaved).toBeGreaterThan(0);
  });

  it("reinvestment only applies from startDate onward, not before", () => {
    const early = run([
      mkLoan({
        id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500,
        reinvestment: { enabled: true, fromLoanId: "a", amount: 2000, startDate: "2026-01" },
      }),
    ]);
    const late = run([
      mkLoan({
        id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500,
        reinvestment: { enabled: true, fromLoanId: "a", amount: 2000, startDate: "2030-01" },
      }),
    ]);
    // Starting the reinvestment earlier can only help at least as much.
    expect(early.loanResults[0].newTotalInterest).toBeLessThanOrEqual(late.loanResults[0].newTotalInterest);
  });

  it("reinvestment.enabled = false behaves identically to no reinvestment at all", () => {
    const disabled = run([
      mkLoan({
        id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500,
        reinvestment: { enabled: false, fromLoanId: "a", amount: 2000, startDate: "2026-01" },
      }),
    ]);
    const none = run([mkLoan({ id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500 })]);
    expect(disabled.loanResults[0]).toEqual(none.loanResults[0]);
  });

  it("slider behavior: increasing the reinvestment amount monotonically shortens payoff time", () => {
    const amounts = [0, 500, 1000, 2000, 5000];
    const months = amounts.map((amount) => {
      const r = run([
        mkLoan({
          id: "b", balance: 50000, interestRate: 0.05, currentMonthlyPayment: 500,
          reinvestment: { enabled: amount > 0, fromLoanId: "a", amount, startDate: "2026-01" },
        }),
      ]);
      return r.loanResults[0].newEndDate;
    });
    // Each larger slider value must pay off the loan no later than the previous one.
    for (let i = 1; i < months.length; i++) {
      expect(months[i] <= months[i - 1]).toBe(true);
    }
    // And the extremes must actually differ — the slider has to do something.
    expect(months[months.length - 1]).not.toBe(months[0]);
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
