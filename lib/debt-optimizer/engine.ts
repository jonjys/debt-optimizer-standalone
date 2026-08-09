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

  // 1. Grundscenario: Betala BARA den ordinarie nuvarande månadskostnaden (currentMonthlyPayment)
  const baseResult = simulatePayoffs(loans, 0, strategy, false);

  // 2. Optimerat scenario: Använd toppat belopp (targetMonthlyPayment) + extra budget
  const optimizedResult = simulatePayoffs(loans, monthlyExtraBudget, strategy, true);

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
  strategy: "avalanche" | "snowball",
  useTopUp: boolean
) {
  let activeLoans = originalLoans.map((l) => ({
    ...l,
    currentBalance: l.balance,
  }));

  let totalInterest = 0;
  let months = 0;
  const milestones: PayoffMilestone[] = [];
  const maxMonths = 600; // Max 50 år som säkerhet

  while (activeLoans.some((l) => l.currentBalance > 0) && months < maxMonths) {
    months++;
    let currentExtra = extraBudget;

    // 1. Ordinarie / Toppade inbetalningar per lån
    for (const loan of activeLoans) {
      if (loan.currentBalance <= 0) continue;

      const monthlyRate = loan.interestRate / 100 / 12;
      const monthlyInterest = loan.currentBalance * monthlyRate;
      totalInterest += monthlyInterest;
      loan.currentBalance += monthlyInterest;

      // Bestäm hur mycket som betalas denna månad
      let basePayment = loan.currentMonthlyPayment || 0;
      
      // Om användaren valt att toppa upp och angivit ett högre målbelopp
      if (useTopUp && loan.targetMonthlyPayment && loan.targetMonthlyPayment > basePayment) {
        basePayment = loan.targetMonthlyPayment;
      }

      // Om betalningen är för låg för att ens täcka räntan, tvinga täckning + minsta amortering
      if (basePayment <= monthlyInterest) {
        basePayment = monthlyInterest + Math.max(loan.currentBalance * 0.005, 100);
      }

      const payment = Math.min(loan.currentBalance, basePayment);
      loan.currentBalance -= payment;

      if (loan.currentBalance <= 0) {
        recordMilestone(milestones, loan, months, totalInterest);
      }
    }

    // 2. Fördela extra budget på fokuslånet (endast i det optimerade scenariot)
    const remainingLoans = activeLoans.filter((l) => l.currentBalance > 0);
    if (useTopUp && remainingLoans.length > 0 && currentExtra > 0) {
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
