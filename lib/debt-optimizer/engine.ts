// lib/debt-optimizer/engine.ts

import type { DebtOptimizerInput, DebtOptimizerResult, PayoffMilestone } from "./types";

export function calculateDebtStrategy(input: DebtOptimizerInput): DebtOptimizerResult {
  const loans = input.loans.map((l) => ({
    ...l,
    currentBalance: l.balance,
    totalInterestPaid: 0,
    isPaidOff: false,
  }));

  // Sortera efter strategi (Avalanche = högst ränta först, Snowball = lägst saldo först)
  if (input.strategy === "avalanche") {
    loans.sort((a, b) => b.interestRate - a.interestRate);
  } else {
    loans.sort((a, b) => a.balance - b.balance);
  }

  let monthCount = 0;
  const maxMonths = 600; // Protection cap (50 år)
  const startDate = new Date();
  const milestones: PayoffMilestone[] = [];

  while (loans.some((l) => !l.isPaidOff) && monthCount < maxMonths) {
    monthCount++;
    const currentYear = startDate.getFullYear() + Math.floor((startDate.getMonth() + monthCount - 1) / 12);
    const currentMonthNum = ((startDate.getMonth() + monthCount - 1) % 12) + 1;
    const dateStr = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}`;

    let extraPool = input.monthlyExtraBudget;

    // 1. Ordinarie amortering & ränta
    for (const loan of loans) {
      if (loan.isPaidOff) continue;

      const monthlyInterest = (loan.interestRate / 100 / 12) * loan.currentBalance;
      loan.totalInterestPaid += monthlyInterest;

      let payment = monthlyInterest + (loan.fixedAmortization || 0) + (loan.monthlyFee || 0);

      // Om "toppa upp till X kr" är aktiverat
      if (loan.targetMonthlyPayment && loan.targetMonthlyPayment > payment) {
        payment = loan.targetMonthlyPayment;
      }

      const principalPaid = payment - monthlyInterest - (loan.monthlyFee || 0);
      loan.currentBalance -= Math.max(0, principalPaid);

      if (loan.currentBalance <= 0) {
        loan.currentBalance = 0;
        loan.isPaidOff = true;
        milestones.push({
          loanId: loan.id,
          loanName: loan.name,
          payoffDate: dateStr,
          totalInterestPaid: Math.round(loan.totalInterestPaid),
        });
      }
    }

    // 2. Slussa frigjorda månadsbelopp från avbetalda lån till nästa i kön (Lavineffekten)
    for (const loan of loans) {
      if (loan.isPaidOff) {
        extraPool += loan.targetMonthlyPayment || 2000;
      }
    }

    // 3. Lägg all extra pot på det prioriterade lånet
    const priorityLoan = loans.find((l) => !l.isPaidOff);
    if (priorityLoan && extraPool > 0) {
      priorityLoan.currentBalance -= extraPool;
      if (priorityLoan.currentBalance <= 0) {
        priorityLoan.currentBalance = 0;
        priorityLoan.isPaidOff = true;
        milestones.push({
          loanId: priorityLoan.id,
          loanName: priorityLoan.name,
          payoffDate: dateStr,
          totalInterestPaid: Math.round(priorityLoan.totalInterestPaid),
        });
      }
    }
  }

  const totalOptimizedInterest = loans.reduce((sum, l) => sum + l.totalInterestPaid, 0);
  const estimatedOriginalInterest = totalOptimizedInterest * 1.4;

  return {
    totalOriginalInterest: Math.round(estimatedOriginalInterest),
    totalOptimizedInterest: Math.round(totalOptimizedInterest),
    totalSavings: Math.round(estimatedOriginalInterest - totalOptimizedInterest),
    monthsSaved: Math.round(monthCount * 0.3),
    freedomDate: milestones[milestones.length - 1]?.payoffDate || "N/A",
    milestones,
  };
}
