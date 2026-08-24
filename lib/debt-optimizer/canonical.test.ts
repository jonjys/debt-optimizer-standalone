import { describe, it, expect } from "vitest";
import {
  simulatePlan,
  simulateLoanAlone,
  addMonths,
  diffMonths,
  sortByStrategy,
} from "./canonical";

describe("canonical motor", () => {
  describe("addMonths", () => {
    it("adds months correctly", () => {
      expect(addMonths("2024-01", 1)).toBe("2024-02");
      expect(addMonths("2024-12", 1)).toBe("2025-01");
      expect(addMonths("2024-01", 12)).toBe("2025-01");
    });

    it("handles year boundaries", () => {
      expect(addMonths("2024-11", 3)).toBe("2025-02");
      expect(addMonths("2023-12", 2)).toBe("2024-02");
    });
  });

  describe("diffMonths", () => {
    it("calculates month difference", () => {
      expect(diffMonths("2024-01", "2024-02")).toBe(1);
      expect(diffMonths("2024-12", "2025-01")).toBe(1);
      expect(diffMonths("2024-01", "2024-12")).toBe(11);
      expect(diffMonths("2024-01", "2025-01")).toBe(12);
    });

    it("handles negative differences", () => {
      expect(diffMonths("2024-12", "2024-01")).toBe(-11);
      expect(diffMonths("2025-01", "2024-01")).toBe(-12);
    });
  });

  describe("sortByStrategy", () => {
    const loans = [
      { balance: 100000, interestRate: 0.03 },
      { balance: 50000, interestRate: 0.05 },
      { balance: 75000, interestRate: 0.04 },
    ];

    it("sorts by avalanche (highest rate first)", () => {
      const sorted = sortByStrategy(loans, "avalanche");
      expect(sorted[0].interestRate).toBe(0.05);
      expect(sorted[1].interestRate).toBe(0.04);
      expect(sorted[2].interestRate).toBe(0.03);
    });

    it("sorts by snowball (lowest balance first)", () => {
      const sorted = sortByStrategy(loans, "snowball");
      expect(sorted[0].balance).toBe(50000);
      expect(sorted[1].balance).toBe(75000);
      expect(sorted[2].balance).toBe(100000);
    });

    it("custom doesn't sort", () => {
      const sorted = sortByStrategy(loans, "custom");
      expect(sorted).toEqual(loans);
    });
  });

  describe("simulateLoanAlone baseline", () => {
    it("simulates a single loan without any extras", () => {
      const result = simulateLoanAlone(
        {
          id: "test",
          name: "Test Loan",
          balance: 100000,
          interestRate: 0.1,
          monthlyPayment: 10000,
          paymentStyle: "annuity",
        },
        "2024-01",
      );

      expect(result.fullyPaid).toBe(true);
      expect(result.id).toBe("test");
      expect(result.finishMonth).not.toBeNull();
      expect(result.totalInterest).toBeGreaterThan(0);
    });

    it("handles zero-balance loan", () => {
      const result = simulateLoanAlone(
        {
          id: "zero",
          name: "Zero Balance",
          balance: 0,
          interestRate: 0.05,
          monthlyPayment: 1000,
          paymentStyle: "annuity",
        },
        "2024-01",
      );

      expect(result.remainingBalance).toBe(0);
      expect(result.totalInterest).toBe(0);
      // A zero-balance loan has finishMonth=null because it was never actually paid off
      // (it started at zero)
    });

    it("reports stalled loan correctly", () => {
      const result = simulateLoanAlone(
        {
          id: "stalled",
          name: "Stalled Loan",
          balance: 100000,
          interestRate: 0.1,
          monthlyPayment: 500,
          paymentStyle: "annuity",
        },
        "2024-01",
      );

      expect(result.fullyPaid).toBe(false);
      expect(result.finishMonth).toBeNull();
      expect(result.remainingBalance).toBeGreaterThan(0);
    });
  });

  describe("simulatePlan with rollover=false", () => {
    it("runs each loan independently", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Loan 1",
            balance: 10000,
            interestRate: 0.1,
            monthlyPayment: 2000,
            paymentStyle: "annuity",
          },
          {
            id: "loan2",
            name: "Loan 2",
            balance: 10000,
            interestRate: 0.1,
            monthlyPayment: 2000,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(plan.loans).toHaveLength(2);
      expect(plan.loans[0].fullyPaid).toBe(true);
      expect(plan.loans[1].fullyPaid).toBe(true);
      // Both should finish at similar times since they run independently
      expect(Math.abs(plan.loans[0].finishMonth! - plan.loans[1].finishMonth!)).toBeLessThan(2);
    });
  });

  describe("simulatePlan with rollover=true", () => {
    it("rolls over freed payment to next loan", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Fast Loan",
            balance: 5000,
            interestRate: 0.05,
            monthlyPayment: 1000,
            paymentStyle: "annuity",
          },
          {
            id: "loan2",
            name: "Slow Loan",
            balance: 10000,
            interestRate: 0.05,
            monthlyPayment: 1000,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: true,
      });

      expect(plan.loans).toHaveLength(2);
      expect(plan.loans[0].fullyPaid).toBe(true);
      expect(plan.loans[1].fullyPaid).toBe(true);
      // With rollover, loan2 should finish faster than without
      expect(plan.loans[1].finishMonth!).toBeLessThan(11); // Without rollover would be ~10+ months
    });
  });

  describe("one-time payments", () => {
    it("applies targeted one-time payment to specific loan", () => {
      const planWithOtp = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Test Loan",
            balance: 10000,
            interestRate: 0.05,
            monthlyPayment: 500,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [
          {
            loanId: "loan1",
            date: "2024-01",
            amount: 5000,
          },
        ],
        rollover: false,
      });

      const planWithoutOtp = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Test Loan",
            balance: 10000,
            interestRate: 0.05,
            monthlyPayment: 500,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(planWithOtp.loans[0].finishMonth!).toBeLessThan(
        planWithoutOtp.loans[0].finishMonth!,
      );
      expect(planWithOtp.loans[0].totalInterest).toBeLessThan(
        planWithoutOtp.loans[0].totalInterest,
      );
    });

    it("one-time payment that clears entire loan ends it", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Small Loan",
            balance: 5000,
            interestRate: 0.05,
            monthlyPayment: 500,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [
          {
            loanId: "loan1",
            date: "2024-01",
            amount: 5500,
          },
        ],
        rollover: false,
      });

      expect(plan.loans[0].fullyPaid).toBe(true);
      expect(plan.loans[0].finishMonth).toBe(0);
      expect(plan.loans[0].totalInterest).toBeLessThan(50); // Just accrued interest from day 0
    });
  });

  describe("extra monthly payments", () => {
    it("accelerates payoff with extra monthly", () => {
      const planWithExtra = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Test Loan",
            balance: 20000,
            interestRate: 0.05,
            monthlyPayment: 500,
            paymentStyle: "annuity",
            extraMonthly: 500,
            extraMonthlyEnabled: true,
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      const planWithoutExtra = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Test Loan",
            balance: 20000,
            interestRate: 0.05,
            monthlyPayment: 500,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(planWithExtra.loans[0].finishMonth!).toBeLessThan(
        planWithoutExtra.loans[0].finishMonth!,
      );
    });
  });

  describe("fixed_amort payment style", () => {
    it("uses fixed principal calculation", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Fixed Amort Loan",
            balance: 100000,
            interestRate: 0.06,
            monthlyPayment: 5000,
            paymentStyle: "fixed_amort",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(plan.loans[0].fullyPaid).toBe(true);
      expect(plan.loans[0].totalInterest).toBeGreaterThan(0);
    });
  });

  describe("timeBoxMonths", () => {
    it("limits focus time then moves to next loan", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Boxed Loan",
            balance: 50000,
            interestRate: 0.05,
            monthlyPayment: 2000,
            paymentStyle: "annuity",
            timeBoxMonths: 12,
          },
          {
            id: "loan2",
            name: "Second Loan",
            balance: 50000,
            interestRate: 0.05,
            monthlyPayment: 2000,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: true,
      });

      expect(plan.loans).toHaveLength(2);
      expect(plan.loans[0].focusMonths).toBeLessThanOrEqual(12);
    });
  });

  describe("avalanche strategy", () => {
    it("pays high-rate loans first", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "low-rate",
            name: "Low Rate",
            balance: 10000,
            interestRate: 0.02,
            monthlyPayment: 500,
            paymentStyle: "annuity",
          },
          {
            id: "high-rate",
            name: "High Rate",
            balance: 10000,
            interestRate: 0.1,
            monthlyPayment: 500,
            paymentStyle: "annuity",
          },
        ],
        strategy: "avalanche",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: true,
      });

      // High rate loan should be paid first (order 1)
      const highRateLoan = plan.loans.find((l) => l.id === "high-rate");
      const lowRateLoan = plan.loans.find((l) => l.id === "low-rate");
      expect(highRateLoan!.order).toBe(1);
      expect(lowRateLoan!.order).toBe(2);
      // Both should be fully paid
      expect(highRateLoan!.fullyPaid).toBe(true);
      expect(lowRateLoan!.fullyPaid).toBe(true);
    });
  });

  describe("snowball strategy", () => {
    it("pays smallest-balance loans first", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "large",
            name: "Large Debt",
            balance: 50000,
            interestRate: 0.05,
            monthlyPayment: 1000,
            paymentStyle: "annuity",
          },
          {
            id: "small",
            name: "Small Debt",
            balance: 5000,
            interestRate: 0.05,
            monthlyPayment: 1000,
            paymentStyle: "annuity",
          },
        ],
        strategy: "snowball",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: true,
      });

      // Small balance should be in order 1 (paid first)
      const smallLoan = plan.loans.find((l) => l.id === "small");
      const largeLoan = plan.loans.find((l) => l.id === "large");
      expect(smallLoan!.order).toBe(1);
      expect(largeLoan!.order).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("handles empty loan list", () => {
      const plan = simulatePlan({
        loans: [],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(plan.loans).toHaveLength(0);
      expect(plan.fullyPaid).toBe(true);
      expect(plan.totalMonths).toBe(0);
      expect(plan.totalInterest).toBe(0);
    });

    it("handles very high interest rate", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "high-rate",
            name: "Very High Rate",
            balance: 5000,
            interestRate: 0.5, // 50% annual
            monthlyPayment: 1000,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(plan.loans[0].fullyPaid).toBe(true);
    });

    it("handles zero interest rate", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "zero-rate",
            name: "Zero Interest",
            balance: 10000,
            interestRate: 0,
            monthlyPayment: 1000,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(plan.loans[0].fullyPaid).toBe(true);
      expect(plan.loans[0].totalInterest).toBe(0);
      expect(plan.loans[0].finishMonth).toBe(9); // 10000 / 1000 = 10 months
    });

    it("reaches MAX_MONTHS for impossible loan", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "impossible",
            name: "Impossible Loan",
            balance: 1000000,
            interestRate: 0.1,
            monthlyPayment: 100,
            paymentStyle: "annuity",
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(plan.fullyPaid).toBe(false);
      expect(plan.totalMonths).toBe(600); // MAX_MONTHS
    });
  });

  describe("reinvestment", () => {
    it("adds manual reinvestment from another loan", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "source",
            name: "Source Loan",
            balance: 5000,
            interestRate: 0.05,
            monthlyPayment: 1000,
            paymentStyle: "annuity",
          },
          {
            id: "target",
            name: "Target Loan",
            balance: 10000,
            interestRate: 0.05,
            monthlyPayment: 500,
            paymentStyle: "annuity",
            reinvestment: {
              enabled: true,
              fromLoanId: "source",
              amount: 1000,
              startDate: "2024-06",
            },
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(plan.loans[0].fullyPaid).toBe(true);
      expect(plan.loans[1].fullyPaid).toBe(true);
    });
  });

  describe("targetMonthlyTotal", () => {
    it("maintains target total payment including interest", () => {
      const plan = simulatePlan({
        loans: [
          {
            id: "loan1",
            name: "Test Loan",
            balance: 50000,
            interestRate: 0.05,
            monthlyPayment: 1000,
            paymentStyle: "fixed_amort",
            targetMonthlyTotal: 2000,
            targetMonthlyEnabled: true,
          },
        ],
        strategy: "custom",
        startDate: "2024-01",
        oneTimePayments: [],
        rollover: false,
      });

      expect(plan.loans[0].fullyPaid).toBe(true);
    });
  });
});
