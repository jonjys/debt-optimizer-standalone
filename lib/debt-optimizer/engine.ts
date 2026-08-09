// lib/debt-optimizer/engine.ts
import { Loan, StrategyInput, CalculationResult, LoanResult } from "./types";

export function calculateExcelStrategy(input: StrategyInput): CalculationResult {
  const { loans, oneTimePaymentAmount, oneTimePaymentDate, startDate } = input;

  if (!loans || loans.length === 0) {
    return {
      totalOriginalInterest: 0,
      totalNewInterest: 0,
      totalInterestSaved: 0,
      originalFreedomDate: "-",
      newFreedomDate: "-",
      totalMonthsSaved: 0,
      loanResults: [],
    };
  }

  // Sortera lån (Det mindre lånet betalas först)
  const sortedLoans = [...loans].sort((a, b) => a.balance - b.balance);

  // 1. Simulera Original (Utan extra amortering)
  let maxOriginalMonths = 0;
  let totalOrigInterest = 0;
  const origResults: Record<string, { months: number; interest: number }> = {};

  sortedLoans.forEach((loan) => {
    let balance = loan.balance;
    let months = 0;
    let interestSum = 0;

    while (balance > 0.01 && months < 600) {
      months++;
      const monthlyInterest = (balance * loan.interestRate) / 12;
      interestSum += monthlyInterest;
      balance += monthlyInterest;

      const payment = Math.min(balance, loan.currentMonthlyPayment);
      balance -= payment;
    }

    origResults[loan.id] = { months, interest: Math.round(interestSum) };
    if (months > maxOriginalMonths) maxOriginalMonths = months;
    totalOrigInterest += interestSum;
  });

  // 2. Simulera Ny Strategi (Med Toppa upp, Engångsbelopp & Kaskad)
  let currentMonth = 0;
  let maxNewMonths = 0;
  let totalNewInterest = 0;

  let activeLoans = sortedLoans.map((l) => ({
    ...l,
    currentBalance: l.balance,
    totalInterestPaid: 0,
    isPaidOff: false,
    paidOffMonth: 0,
  }));

  while (activeLoans.some((l) => !l.isPaidOff) && currentMonth < 600) {
    currentMonth++;
    const currentDateStr = getDateFromOffset(startDate, currentMonth - 1);

    // Krolla om första lånet precis blev klart
    const firstLoanPaidOff = activeLoans[0].isPaidOff;

    for (let i = 0; i < activeLoans.length; i++) {
      const loan = activeLoans[i];
      if (loan.isPaidOff) continue;

      // Månadens ränta
      const monthlyInterest = (loan.currentBalance * loan.interestRate) / 12;
      loan.totalInterestPaid += monthlyInterest;
      loan.currentBalance += monthlyInterest;

      // Beräkna hur mycket som ska betalas denna månad
      let payment = loan.currentMonthlyPayment;

      // Om det är lån 1 och har ett målbelopp (Toppa upp till t.ex. 2000 kr)
      if (i === 0 && loan.targetMonthlyPayment && loan.targetMonthlyPayment > loan.currentMonthlyPayment) {
        payment = loan.targetMonthlyPayment;
      }

      // Extra amortering från start (t.ex. för Nordax)
      if (loan.extraPaymentFromStart) {
        payment += loan.extraPaymentFromStart;
      }

      // Om första lånet är avbetalat -> flytta över kaskad/överskott till nästa lån
      if (i > 0 && firstLoanPaidOff) {
        const freedAmount = activeLoans[0].targetMonthlyPayment || activeLoans[0].currentMonthlyPayment;
        payment += freedAmount;
        if (loan.extraPaymentAfterFreed) {
          payment += loan.extraPaymentAfterFreed;
        }
      }

      // Engångsinbetalning vid specifikt datum (t.ex. skatteåterbäring)
      if (oneTimePaymentAmount > 0 && currentDateStr === oneTimePaymentDate && i === 0) {
        payment += oneTimePaymentAmount;
      }

      const actualPayment = Math.min(loan.currentBalance, payment);
      loan.currentBalance -= actualPayment;

      if (loan.currentBalance <= 0.01) {
        loan.currentBalance = 0;
        loan.isPaidOff = true;
        loan.paidOffMonth = currentMonth;
      }
    }
  }

  // Sammanställ per lån
  const loanResults: LoanResult[] = sortedLoans.map((l) => {
    const orig = origResults[l.id];
    const newSim = activeLoans.find((a) => a.id === l.id)!;
    const newMonths = newSim.paidOffMonth;
    const newInterest = Math.round(newSim.totalInterestPaid);

    if (newMonths > maxNewMonths) maxNewMonths = newMonths;
    totalNewInterest += newSim.totalInterestPaid;

    return {
      id: l.id,
      name: l.name,
      originalEndDate: getDateFromOffset(startDate, orig.months),
      originalTotalInterest: orig.interest,
      newEndDate: getDateFromOffset(startDate, newMonths),
      newTotalInterest: newInterest,
      interestSaved: Math.max(0, orig.interest - newInterest),
      monthsSaved: Math.max(0, orig.months - newMonths),
    };
  });

  return {
    totalOriginalInterest: Math.round(totalOrigInterest),
    totalNewInterest: Math.round(totalNewInterest),
    totalInterestSaved: Math.round(Math.max(0, totalOrigInterest - totalNewInterest)),
    originalFreedomDate: getDateFromOffset(startDate, maxOriginalMonths),
    newFreedomDate: getDateFromOffset(startDate, maxNewMonths),
    totalMonthsSaved: Math.max(0, maxOriginalMonths - maxNewMonths),
    loanResults,
  };
}

function getDateFromOffset(startYearMonth: string, monthOffset: number): string {
  const [yearStr, monthStr] = startYearMonth.split("-");
  let year = parseInt(yearStr, 10) || 2026;
  let month = (parseInt(monthStr, 10) || 8) - 1 + monthOffset;

  year += Math.floor(month / 12);
  month = (month % 12) + 1;

  return `${year}-${String(month).padStart(2, "0")}`;
}
