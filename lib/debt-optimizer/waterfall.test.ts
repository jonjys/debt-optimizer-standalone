import { describe, expect, it } from "vitest";
import { calcWaterfall, type WaterfallLoan } from "./waterfall";

const anchor: WaterfallLoan = {
  id: "one",
  name: "Lån 1",
  balance: 112_000,
  interestRate: 0.3,
  monthlyPayment: 8_400,
  paymentStyle: "fixed_amort",
};

const second: WaterfallLoan = {
  id: "two",
  name: "Lån 2",
  balance: 75_000,
  interestRate: 0.08,
  monthlyPayment: 1_500,
  paymentStyle: "annuity",
};

describe("waterfall anchor", () => {
  it("never changes loan one when a later loan is added", () => {
    const alone = calcWaterfall([anchor]);
    const together = calcWaterfall([anchor, second]);

    expect(alone.loans[0].independentMonths).toBe(20);
    expect(alone.totalInterest).toBe(29_400);
    expect(alone.fullyPaid).toBe(true);
    expect(together.loans[0].independentMonths).toBe(
      alone.loans[0].independentMonths,
    );
    expect(together.loans[0].finishesAt).toBe(alone.loans[0].finishesAt);
  });

  it("makes loan two wait for loan one before receiving rollover", () => {
    const result = calcWaterfall([anchor, second]);

    expect(result.loans[1].waitMonths).toBe(result.loans[0].finishesAt);
    expect(result.loans[1].finishesAt).toBeGreaterThan(
      result.loans[0].finishesAt,
    );
  });

  it("supports a time-boxed first focus phase", () => {
    const result = calcWaterfall([
      {
        ...anchor,
        balance: 400_000,
        interestRate: 0.041,
        monthlyPayment: 4_000,
        timeBoxMonths: 60,
      },
      second,
    ]);

    expect(result.loans[0].focusMonths).toBeGreaterThanOrEqual(60);
    expect(result.loans[1].waitMonths).toBe(60);
  });

  it("shows a real custom-order delta against avalanche", () => {
    const mortgage: WaterfallLoan = {
      id: "mortgage",
      name: "Bolån",
      balance: 2_128_112,
      interestRate: 0.041,
      monthlyPayment: 10_900,
      paymentStyle: "fixed_amort",
    };
    const personal: WaterfallLoan = {
      id: "personal",
      name: "Blancolån",
      balance: 180_000,
      interestRate: 0.085,
      monthlyPayment: 5_700,
      paymentStyle: "annuity",
    };

    const custom = calcWaterfall([mortgage, personal]);
    const avalanche = calcWaterfall([personal, mortgage]);

    expect(avalanche.totalMonths).toBeLessThan(custom.totalMonths);
    expect(avalanche.totalInterest).toBeLessThan(custom.totalInterest);
  });
});
