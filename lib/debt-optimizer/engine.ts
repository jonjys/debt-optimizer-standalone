// lib/debt-optimizer/engine.ts
import type { DebtOptimizerInput, DebtOptimizerResult, Loan, PayoffMilestone } from "./types";

export function calculateDebtStrategy(input: DebtOptimizerInput): DebtOptimizerResult {
  const { loans, monthlyExtraBudget, extraBudgetStartMonthOffset, strategy, startDate = new Date() } = input;

  if (!loans || loans.length === 0) {
    return {
      totalOriginalInterest: 0,
      totalOptimizedInterest: 0,
      totalSavings: 0,
      monthsSaved: 0,
      freedomDate: formatDate(startDate),
      milestones: [],
    };
  }

  // 1. Grundscenario: Ordinarie inbetalningar utan extra budget eller rollover-bonustoppning
  const baseResult = simulatePayoffs(loans, 0, 0, strategy, false, startDate);

  // 2. Optimerat scenario: Med toppning, valfritt startdatum och automatisk ROLLOVER (frigjorda pengar förs över)
  const optimizedResult = simulatePayoffs(loans, monthlyExtraBudget, extraBudgetStartMonthOffset, strategy, true, startDate);

  const totalSavings = Math.max(0, Math.round(baseResult.totalInterest - optimizedResult.totalInterest));
  const monthsSaved = Math.max(0, baseResult.totalMonths - optimizedResult.totalMonths);

  const freedomDateObj = new Date(startDate);
  freedomDateObj.setMonth(freedomDateObj.getMonth() + optimizedResult.totalMonths);
  const freedomDate = formatDate(freedomDateObj);

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
  extraStartOffset: number,
  strategy: "avalanche" | "snowball",
  useOptimizations: boolean,
  startDate: Date
) {
  let activeLoans = originalLoans.map((l) => ({
    ...l,
    currentBalance: l.balance,
    isPaidOff: false,
  }));

  let totalInterest = 0;
  let months = 0;
  const milestones: PayoffMilestone[] = [];
  const maxMonths = 600;

  while (activeLoans.some((l) => l.currentBalance > 0) && months < maxMonths) {
    months++;
    
    // Beräkna hur mycket frigjort utrymme från FÄRDIGBETALDA lån som rullas över (Snowball Rollover)
    let freedUpBudgetFromPaidLoans = 0;
    if (useOptimizations) {
      for (const l of activeLoans) {
        if (l.currentBalance <= 0) {
          const loanPayment = l.targetMonthlyPayment && l.targetMonthlyPayment > l.currentMonthlyPayment
            ? l.targetMonthlyPayment
            : l.currentMonthlyPayment;
          freedUpBudgetFromPaidLoans += loanPayment;
        }
      }
    }

    // Extra budget aktiveras från vald startmånad
    const activeExtraBudget = (useOptimizations && months >= extraStartOffset) ? extraBudget : 0;
    let poolForFocusLoan = activeExtraBudget + freedUpBudgetFromPaidLoans;

    // 1. Ordinarie / Toppade inbetalningar på alla aktiva lån
    for (const loan of activeLoans) {
      if (loan.currentBalance <= 0) continue;

      const monthlyRate = loan.interestRate / 100 / 12;
      const monthlyInterest = loan.currentBalance * monthlyRate;
      totalInterest += monthlyInterest;
      loan.currentBalance += monthlyInterest;

      let basePayment = loan.currentMonthlyPayment || 0;
      
      // Använd toppning om det är aktiverat och startmånaden har passerats
      if (useOptimizations && loan.targetMonthlyPayment && loan.targetMonthlyPayment > basePayment) {
        const topUpOffset = loan.topUpStartMonthOffset || 0;
        if (months >= topUpOffset) {
          basePayment = loan.targetMonthlyPayment;
        }
      }

      if (basePayment <= monthlyInterest) {
        basePayment = monthlyInterest + Math.max(loan.currentBalance * 0.005, 100);
      }

      const payment = Math.min(loan.currentBalance, basePayment);
      loan.currentBalance -= payment;

      if (loan.currentBalance <= 0 && !loan.isPaidOff) {
        loan.isPaidOff = true;
        recordMilestone(milestones, loan, months, totalInterest, startDate);
      }
    }

    // 2. Skicka all överbliven pott (extra budget + frigjort från Nordea) till prioritetslånet (Nordax)
    const remainingLoans = activeLoans.filter((l) => l.currentBalance > 0);
    if (useOptimizations && remainingLoans.length > 0 && poolForFocusLoan > 0) {
      if (strategy === "avalanche") {
        remainingLoans.sort((a, b) => b.interestRate - a.interestRate);
      } else {
        remainingLoans.sort((a, b) => a.currentBalance - b.currentBalance);
      }

      const focusLoan = remainingLoans[0];
      const extraPayment = Math.min(focusLoan.currentBalance, poolForFocusLoan);
      focusLoan.currentBalance -= extraPayment;

      if (focusLoan.currentBalance <= 0 && !focusLoan.isPaidOff) {
        focusLoan.isPaidOff = true;
        recordMilestone(milestones, focusLoan, months, totalInterest, startDate);
      }
    }
  }

  return {
    totalInterest,
    totalMonths: months,
    milestones,
  };
}

function recordMilestone(milestones: PayoffMilestone[], loan: any, months: number, interest: number, startDate: Date) {
  if (!milestones.some((m) => m.loanId === loan.id)) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + months);
    milestones.push({
      loanId: loan.id,
      loanName: loan.name,
      payoffDate: formatDate(d),
      totalInterestPaid: Math.round(interest),
    });
  }
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
