import Big from "big.js";
import type { Loan, OneTimePayment, CalculationResult, LoanResult } from "./types";

type Strategy = "custom" | "avalanche" | "snowball";

interface StrategyInput {
  loans: Loan[];
  oneTimePayments: OneTimePayment[];
  startDate: string;
  strategy: Strategy;
}

function addMonths(ym: string, add: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + add, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function diffMonths(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export function calculatePayoffSchedule(input: StrategyInput): CalculationResult {
  let sortedLoans = [...input.loans];
  if (input.strategy === "avalanche") {
    sortedLoans.sort((a, b) => b.interestRate - a.interestRate);
  } else if (input.strategy === "snowball") {
    sortedLoans.sort((a, b) => a.balance - b.balance);
  }

  const otpGlobal = new Map<string, Big>();
  const otpPerLoan = new Map<string, Map<string, Big>>();
  input.oneTimePayments.forEach((otp) => {
    if (otp.loanId) {
      if (!otpPerLoan.has(otp.loanId)) otpPerLoan.set(otp.loanId, new Map());
      const m = otpPerLoan.get(otp.loanId)!;
      m.set(otp.date, (m.get(otp.date) || new Big(0)).plus(otp.amount));
    } else {
      otpGlobal.set(otp.date, (otpGlobal.get(otp.date) || new Big(0)).plus(otp.amount));
    }
  });

  const originalResults = new Map<string, { endDate: string; totalInterest: Big }>();
  input.loans.forEach((loan) => {
    const cleanLoan: Loan = {
      ...loan,
      targetMonthlyEnabled: false,
      extraMonthlyEnabled: false,
      reinvestment: undefined,
    };
    let balance = new Big(cleanLoan.balance);
    let totalInterest = new Big(0);
    const monthlyRate = new Big(cleanLoan.interestRate).div(12);
    let endDate = "-";
    for (let i = 0; i < 600; i++) {
      if (balance.lte(0)) break;
      const interest = balance.times(monthlyRate);
      totalInterest = totalInterest.plus(interest);
      let principal = new Big(0);
      if (cleanLoan.paymentStyle === "fixed_amort") {
        principal = new Big(cleanLoan.currentMonthlyPayment);
        if (principal.gt(balance)) principal = balance;
      } else {
        const payment = new Big(cleanLoan.currentMonthlyPayment);
        principal = payment.minus(interest);
        if (principal.lte(0)) { endDate = "-"; break; }
        if (principal.gt(balance)) principal = balance;
      }
      balance = balance.minus(principal);
      if (balance.lte(0)) { endDate = addMonths(input.startDate, i); break; }
    }
    if (endDate === "-" && balance.lte(0)) endDate = addMonths(input.startDate, 0);
    originalResults.set(loan.id, { endDate: endDate !== "-" ? endDate : addMonths(input.startDate, 600), totalInterest });
  });

  const finishedDates = new Map<string, string>();
  const loanResults: LoanResult[] = [];
  let totalOriginalInterest = new Big(0);
  let totalNewInterest = new Big(0);
  let globalFreedomOriginal = input.startDate;
  let globalFreedomNew = input.startDate;

  Array.from(originalResults.values()).forEach((r) => {
    totalOriginalInterest = totalOriginalInterest.plus(r.totalInterest);
    if (r.endDate !== "-" && diffMonths(globalFreedomOriginal, r.endDate) > 0) globalFreedomOriginal = r.endDate;
  });

  for (let idx = 0; idx < sortedLoans.length; idx++) {
    const loan = sortedLoans[idx];
    const combinedOtp = new Map<string, Big>();
    const perLoan = otpPerLoan.get(loan.id);
    if (perLoan) perLoan.forEach((a, d) => combinedOtp.set(d, (combinedOtp.get(d) || new Big(0)).plus(a)));
    otpGlobal.forEach((a, d) => combinedOtp.set(d, (combinedOtp.get(d) || new Big(0)).plus(a)));

    let balance = new Big(loan.balance);
    let totalInterest = new Big(0);
    const monthlyRate = new Big(loan.interestRate).div(12);
    let endDate = "-";
    let months = 0;

    for (let i = 0; i < 600; i++) {
      if (balance.lte(0)) break;
      const curDate = addMonths(input.startDate, i);
      const otp = combinedOtp.get(curDate);
      if (otp && otp.gt(0)) {
        if (otp.gte(balance)) { balance = new Big(0); endDate = curDate; months = i + 1; break; }
        else balance = balance.minus(otp);
      }
      const interest = balance.times(monthlyRate);
      totalInterest = totalInterest.plus(interest);
      let principal = new Big(0);
      let payment = new Big(0);
      let curReinvest = new Big(0);

      if (loan.reinvestment && loan.reinvestment.enabled && loan.reinvestment.fromLoanId) {
        const finDate = finishedDates.get(loan.reinvestment.fromLoanId);
        if (finDate) {
          const startFrom = loan.reinvestment.startDate && diffMonths(finDate, loan.reinvestment.startDate) > 0 ? loan.reinvestment.startDate : finDate;
          if (diffMonths(startFrom, curDate) >= 0) curReinvest = new Big(loan.reinvestment.amount);
        }
      }

      if (loan.paymentStyle === "fixed_amort") {
        const baseAmort = new Big(loan.currentMonthlyPayment);
        const regularTotal = baseAmort.plus(interest);
        let targetExtra = new Big(0);
        if (loan.targetMonthlyEnabled && loan.targetMonthlyTotal) {
          const fromOk = !loan.targetMonthlyFrom || diffMonths(loan.targetMonthlyFrom, curDate) >= 0;
          if (fromOk) {
            const target = new Big(loan.targetMonthlyTotal);
            if (target.gt(regularTotal)) targetExtra = target.minus(regularTotal);
          }
        }
        let extraMonthly = new Big(0);
        if (loan.extraMonthlyEnabled && loan.extraMonthly) {
          const fromOk = !loan.extraMonthlyFrom || diffMonths(loan.extraMonthlyFrom, curDate) >= 0;
          if (fromOk) extraMonthly = new Big(loan.extraMonthly);
        }
        principal = baseAmort.plus(targetExtra).plus(extraMonthly).plus(curReinvest);
        if (principal.gt(balance)) principal = balance;
        payment = interest.plus(principal);
        balance = balance.minus(principal);
      } else {
        const basePayment = new Big(loan.currentMonthlyPayment);
        let targetExtra = new Big(0);
        if (loan.targetMonthlyEnabled && loan.targetMonthlyTotal) {
          const fromOk = !loan.targetMonthlyFrom || diffMonths(loan.targetMonthlyFrom, curDate) >= 0;
          if (fromOk) {
            const target = new Big(loan.targetMonthlyTotal);
            if (target.gt(basePayment)) targetExtra = target.minus(basePayment);
          }
        }
        let extraMonthly = new Big(0);
        if (loan.extraMonthlyEnabled && loan.extraMonthly) {
          const fromOk = !loan.extraMonthlyFrom || diffMonths(loan.extraMonthlyFrom, curDate) >= 0;
          if (fromOk) extraMonthly = new Big(loan.extraMonthly);
        }
        payment = basePayment.plus(targetExtra).plus(extraMonthly).plus(curReinvest);
        principal = payment.minus(interest);
        if (principal.lte(0)) { endDate = "-"; break; }
        if (principal.gt(balance)) { principal = balance; payment = interest.plus(principal); }
        balance = balance.minus(principal);
      }
      months = i + 1;
      if (balance.lte(0)) { endDate = curDate; break; }
    }

    const fully = endDate !== "-";
    if (endDate !== "-") finishedDates.set(loan.id, endDate);
    const orig = originalResults.get(loan.id)!;
    totalNewInterest = totalNewInterest.plus(totalInterest);
    if (endDate !== "-" && diffMonths(globalFreedomNew, endDate) > 0) globalFreedomNew = endDate;

    const monthsSaved = orig.endDate !== "-" && endDate !== "-" ? diffMonths(endDate, orig.endDate) : 0;
    loanResults.push({
      id: loan.id,
      name: loan.name,
      originalEndDate: orig.endDate,
      originalTotalInterest: Number(orig.totalInterest.round(0).toString()),
      newEndDate: endDate,
      newTotalInterest: Number(totalInterest.round(0).toString()),
      interestSaved: Number(orig.totalInterest.minus(totalInterest).round(0).toString()),
      monthsSaved: monthsSaved > 0 ? monthsSaved : 0,
      payoffOrder: idx + 1,
      isFullyAmortizing: fully,
    });
  }

  let earliest: string | null = null;
  loanResults.forEach((lr) => {
    if (lr.newEndDate === "-") return;
    if (!earliest || diffMonths(lr.newEndDate, earliest) < 0) earliest = lr.newEndDate;
  });

  return {
    totalOriginalInterest: Number(totalOriginalInterest.round(0).toString()),
    totalNewInterest: Number(totalNewInterest.round(0).toString()),
    totalInterestSaved: Number(totalOriginalInterest.minus(totalNewInterest).round(0).toString()),
    originalFreedomDate: globalFreedomOriginal,
    newFreedomDate: globalFreedomNew,
    totalMonthsSaved: diffMonths(globalFreedomNew, globalFreedomOriginal) > 0 ? diffMonths(globalFreedomNew, globalFreedomOriginal) : 0,
    firstDebtPaidDate: earliest || globalFreedomNew,
    loanResults,
  };
}
