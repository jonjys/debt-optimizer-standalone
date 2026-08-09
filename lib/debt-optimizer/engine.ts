// lib/debt-optimizer/engine.ts
import type { DebtOptimizerInput, DebtOptimizerResult, Loan, PayoffMilestone } from "./types";

export function calculateDebtStrategy(input: DebtOptimizerInput): DebtOptimizerResult {
  const { loans, monthlyExtraBudget, strategy } = input;

  if (!loans || loans.length === 0) {
    return {
      totalOriginalInterest: 0,
      totalOptimizedInterest: 0,
      totalSavings: 0,
      monthsSaved: 0,
      freedomDate: new Date().toISOString().slice(0, 7),
      milestones: [],
    };
  }

  // 1. Beräkna basscenario utan extra amortering
  const baseResult = simulatePayoffs(loans, 0, strategy);

  // 2. Beräkna optimerat scenario med extra månadsbudget
  const optimizedResult = simulatePayoffs(loans, monthlyExtraBudget, strategy);

  const totalSavings = Math.max(0, Math.round(baseResult.totalInterest - optimizedResult.totalInterest));
  const monthsSaved = Math.max(0, baseResult.totalMonths - optimizedResult.totalMonths);

  const freedomDateObj = new Date();
  freedomDateObj.setMonth(freedomDateObj.getMonth() + optimizedResult.totalMonths);
  const freedomDate = freedomDateObj.toISOString().slice(0, 7);

  return {
    totalOriginalInterest: Math.round(baseResult.totalInterest),
    totalOptimizedInterest: Math.round(optimizedResult.totalInterest),
    totalSavings,
    monthsSaved,
    freedomDate,
    milestones: optimizedResult.milestones,
  };
}

function simulatePayoffs(
  originalLoans: Loan[],
  extraBudget: number,
  strategy: "avalanche" | "snowball"
) {
  let activeLoans = originalLoans.map((l) => ({
    ...l,
    currentBalance: l.balance,
  }));

  let totalInterest = 0;
  let months = 0;
  const milestones: PayoffMilestone[] = [];
  const maxMonths = 1200; // 100 år max som säkerhet

  while (activeLoans.some((l) => l.currentBalance > 0) && months < maxMonths) {
    months++;
    let currentExtra = extraBudget;

    // 1. Beräkna ränta och hantera "toppa upp"-belopp för varje lån
    for (const loan of activeLoans) {
      if (loan.currentBalance <= 0) continue;

      const monthlyInterestRate = loan.interestRate / 100 / 12;
      const monthlyInterest = loan.currentBalance * monthlyInterestRate;
      totalInterest += monthlyInterest;
      loan.currentBalance += monthlyInterest;

      // "Toppa upp" logik: Om targetMonthlyPayment finns räknas amorteringen ut automatiskt
      let minPayment = 0;
      if (loan.targetMonthlyPayment && loan.targetMonthlyPayment > 0) {
        minPayment = loan.targetMonthlyPayment;
      } else if (loan.fixedAmortization && loan.fixedAmortization > 0) {
        minPayment = monthlyInterest + loan.fixedAmortization;
      } else {
        // Standard lägsta betalning (ränta + 1% av kapitalskulden)
        minPayment = monthlyInterest + Math.max(loan.currentBalance * 0.01, 100);
      }

      // Lägg till eventuella avgifter
      if (loan.monthlyFee) {
        minPayment += loan.monthlyFee;
      }

      const payment = Math.min(loan.currentBalance, minPayment);
      loan.currentBalance -= payment;

      if (loan.currentBalance <= 0) {
        recordMilestone(milestones, loan, months, totalInterest);
      }
    }

    // 2. Fördela extra budget på fokuslånet (Lavin eller Snöboll)
    const remainingLoans = activeLoans.filter((l) => l.currentBalance > 0);
    if (remainingLoans.length > 0 && currentExtra > 0) {
      if (strategy === "avalanche") {
        remainingLoans.sort((a, b) => b.interestRate - a.interestRate);
      } else {
        remainingLoans.sort((a, b) => a.currentBalance - b.currentBalance);
      }

      const focusLoan = remainingLoans[0];
      const extraPayment = Math.min(focusLoan.currentBalance, currentExtra);
      focusLoan.currentBalance -= extraPayment;

      if (focusLoan.currentBalance <= 0) {
        recordMilestone(milestones, focusLoan, months, totalInterest);
      }
    }
  }

  return {
    totalInterest,
    totalMonths: months,
    milestones,
  };
}

function recordMilestone(milestones: PayoffMilestone[], loan: any, months: number, interest: number) {
  if (!milestones.some((m) => m.loanId === loan.id)) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    milestones.push({
      loanId: loan.id,
      loanName: loan.name,
      payoffDate: d.toISOString().slice(0, 7),
      totalInterestPaid: Math.round(interest),
    });
  }
}
