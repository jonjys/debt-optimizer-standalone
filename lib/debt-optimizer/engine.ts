import { Loan, StrategyInput, CalculationResult, LoanResult, OneTimePayment } from "./types";

export function calculateExcelStrategy(input: StrategyInput): CalculationResult {
  const { loans, oneTimePayments = [], startDate } = input;

  if (!loans || loans.length === 0) {
    return emptyResult();
  }

  const sortedLoans = [...loans].sort((a, b) => a.balance - b.balance);

  // 1. Original simulation
  let maxOriginalMonths = 0;
  let totalOrigInterest = 0;
  const origResults: Record<string, { months: number; interest: number }> = {};

  sortedLoans.forEach((loan) => {
    let balance = loan.balance;
    let months = 0;
    let interestSum = 0;
    const r = loan.interestRate / 12;

    while (balance > 0.5 && months < 600) {
      months++;
      const interest = balance * r;
      interestSum += interest;
      balance += interest;
      const pay = Math.min(balance, loan.currentMonthlyPayment);
      balance -= pay;
    }

    origResults[loan.id] = { months, interest: Math.round(interestSum) };
    if (months > maxOriginalMonths) maxOriginalMonths = months;
    totalOrigInterest += interestSum;
  });

  // 2. Strategy simulation
  let currentMonth = 0;
  let maxNewMonths = 0;
  let totalNewInterest = 0;

  const active = sortedLoans.map((l) => ({
    ...l,
    currentBalance: l.balance,
    totalInterestPaid: 0,
    isPaidOff: false,
    paidOffMonth: 0,
  }));

  const oneTimeMap = new Map<string, number>();
  oneTimePayments.forEach((p) => {
    if (p.amount > 0 && p.date) {
      oneTimeMap.set(p.date, (oneTimeMap.get(p.date) || 0) + p.amount);
    }
  });

  while (active.some((l) => !l.isPaidOff) && currentMonth < 600) {
    currentMonth++;
    const dateStr = getDateFromOffset(startDate, currentMonth - 1);

    const firstPaidOff = active[0].isPaidOff;
    const freedAmount = firstPaidOff
      ? (active[0].targetMonthlyPayment || active[0].currentMonthlyPayment)
      : 0;

    for (let i = 0; i < active.length; i++) {
      const loan = active[i];
      if (loan.isPaidOff) continue;

      const r = loan.interestRate / 12;
      const interest = loan.currentBalance * r;
      loan.totalInterestPaid += interest;
      loan.currentBalance += interest;

      let payment = loan.currentMonthlyPayment;

      if (i === 0 && loan.targetMonthlyPayment && loan.targetMonthlyPayment > payment) {
        payment = loan.targetMonthlyPayment;
      }

      if (loan.extraPaymentFromStart) {
        payment += loan.extraPaymentFromStart;
      }

      if (i > 0 && firstPaidOff) {
        payment += freedAmount;
        if (loan.extraPaymentAfterFreed) {
          payment += loan.extraPaymentAfterFreed;
        }
      }

      if (i === 0 || active.slice(0, i).every((l) => l.isPaidOff)) {
        const ot = oneTimeMap.get(dateStr) || 0;
        if (ot > 0) {
          payment += ot;
          oneTimeMap.delete(dateStr);
        }
      }

      const actual = Math.min(loan.currentBalance, payment);
      loan.currentBalance -= actual;

      if (loan.currentBalance <= 0.5) {
        loan.currentBalance = 0;
        loan.isPaidOff = true;
        loan.paidOffMonth = currentMonth;
      }
    }
  }

  const loanResults: LoanResult[] = sortedLoans.map((l) => {
    const orig = origResults[l.id];
    const sim = active.find((a) => a.id === l.id)!;
    const newMonths = sim.paidOffMonth || 0;
    const newInterest = Math.round(sim.totalInterestPaid);

    if (newMonths > maxNewMonths) maxNewMonths = newMonths;
    totalNewInterest += sim.totalInterestPaid;

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
  month = ((month % 12) + 12) % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function emptyResult(): CalculationResult {
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