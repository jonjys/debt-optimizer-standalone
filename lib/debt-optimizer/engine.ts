// lib/debt-optimizer/engine.ts
import { Loan, CalculationInput, CalculationResult, Milestone } from "./types";

export function calculateDebtStrategy(input: CalculationInput): CalculationResult {
  const { loans, monthlyExtraBudget, extraBudgetStartMonthOffset, strategy, startDate = new Date() } = input;

  if (!loans || loans.length === 0) {
    return {
      freedomDate: "-",
      totalMonths: 0,
      totalInterestPaid: 0,
      totalSavings: 0,
      monthsSaved: 0,
      milestones: [],
    };
  }

  // 1. Beräkna baslinje (utan extra inbetalningar) för att kunna mäta besparing
  const baseline = runSimulation(loans, 0, 1, "avalanche", false);

  // 2. Beräkna optimerad strategi med kaskad/överskott
  const optimized = runSimulation(
    loans,
    monthlyExtraBudget,
    extraBudgetStartMonthOffset,
    strategy,
    true
  );

  const freedomDateObj = new Date(startDate);
  freedomDateObj.setMonth(freedomDateObj.getMonth() + optimized.totalMonths);
  const freedomDateStr = `${freedomDateObj.getFullYear()}-${String(freedomDateObj.getMonth() + 1).padStart(2, "0")}`;

  const monthsSaved = Math.max(0, baseline.totalMonths - optimized.totalMonths);
  const totalSavings = Math.max(0, baseline.totalInterestPaid - optimized.totalInterestPaid);

  return {
    freedomDate: freedomDateStr,
    totalMonths: optimized.totalMonths,
    totalInterestPaid: Math.round(optimized.totalInterestPaid),
    totalSavings: Math.round(totalSavings),
    monthsSaved,
    milestones: optimized.milestones,
  };
}

function runSimulation(
  initialLoans: Loan[],
  extraBudget: number,
  extraStartMonth: number,
  strategy: "avalanche" | "snowball",
  enableCascade: boolean
) {
  let activeLoans = initialLoans.map((l) => ({
    ...l,
    currentBalance: l.balance,
    totalInterestPaid: 0,
    isPaidOff: false,
    payoffMonth: 0,
  }));

  let currentMonth = 0;
  const maxMonths = 600;
  const milestones: Milestone[] = [];

  while (activeLoans.some((l) => !l.isPaidOff) && currentMonth < maxMonths) {
    currentMonth++;

    // 1. Räkna ut månadens ränta
    for (const loan of activeLoans) {
      if (!loan.isPaidOff) {
        const monthlyInterest = (loan.currentBalance * (loan.interestRate / 100)) / 12;
        loan.totalInterestPaid += monthlyInterest;
        loan.currentBalance += monthlyInterest;
      }
    }

    // 2. Samla ihop extra potten (extra budget + avbetalade lån)
    let extraPool = currentMonth >= extraStartMonth ? extraBudget : 0;

    if (enableCascade) {
      for (const loan of activeLoans) {
        if (loan.isPaidOff) {
          const freedAmount = Math.max(loan.targetMonthlyPayment || 0, loan.currentMonthlyPayment);
          extraPool += freedAmount;
        }
      }
    }

    // 3. Dra ordinarie inbetalning
    for (const loan of activeLoans) {
      if (!loan.isPaidOff) {
        const targetPayment = loan.targetMonthlyPayment && loan.targetMonthlyPayment > loan.currentMonthlyPayment
          ? loan.targetMonthlyPayment
          : loan.currentMonthlyPayment;

        const startOffset = loan.topUpStartMonthOffset || 1;
        const actualPayment = currentMonth >= startOffset ? targetPayment : loan.currentMonthlyPayment;

        const payment = Math.min(loan.currentBalance, actualPayment);
        loan.currentBalance -= payment;

        if (loan.currentBalance <= 0.01) {
          loan.currentBalance = 0;
          loan.isPaidOff = true;
          loan.payoffMonth = currentMonth;
        }
      }
    }

    // 4. Lägg hela överskottspotten på prioritetslånet enligt valt system
    let remainingLoans = activeLoans.filter((l) => !l.isPaidOff);
    if (remainingLoans.length > 0 && extraPool > 0) {
      remainingLoans.sort((a, b) => {
        if (strategy === "avalanche") {
          return b.interestRate - a.interestRate;
        } else {
          return a.currentBalance - b.currentBalance;
        }
      });

      let targetLoan = remainingLoans[0];
      const extraPayment = Math.min(targetLoan.currentBalance, extraPool);
      targetLoan.currentBalance -= extraPayment;

      if (targetLoan.currentBalance <= 0.01) {
        targetLoan.currentBalance = 0;
        targetLoan.isPaidOff = true;
        targetLoan.payoffMonth = currentMonth;
      }
    }
  }

  activeLoans.forEach((l) => {
    const payoffDateObj = new Date();
    payoffDateObj.setMonth(payoffDateObj.getMonth() + l.payoffMonth);
    const dateStr = `${payoffDateObj.getFullYear()}-${String(payoffDateObj.getMonth() + 1).padStart(2, "0")}`;

    milestones.push({
      loanId: l.id,
      loanName: l.name,
      payoffDate: dateStr,
      monthsToPayoff: l.payoffMonth,
      totalInterestPaid: Math.round(l.totalInterestPaid),
    });
  });

  const totalInterestPaid = activeLoans.reduce((sum, l) => sum + l.totalInterestPaid, 0);

  return {
    totalMonths: currentMonth,
    totalInterestPaid,
    milestones,
  };
}
