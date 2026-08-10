import {
  Loan,
  StrategyInput,
  CalculationResult,
  LoanResult,
  PayoffStrategy,
} from "./types";

function getDateFromOffset(startYearMonth: string, monthOffset: number): string {
  const [yearStr, monthStr] = startYearMonth.split("-");
  let year = parseInt(yearStr, 10) || 2026;
  let month = (parseInt(monthStr, 10) || 8) - 1 + monthOffset;
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function dateGte(a: string, b: string): boolean {
  if (!b) return true;
  return a >= b;
}

function emptyResult(): CalculationResult {
  return {
    totalOriginalInterest: 0,
    totalNewInterest: 0,
    totalInterestSaved: 0,
    originalFreedomDate: "-",
    newFreedomDate: "-",
    totalMonthsSaved: 0,
    firstDebtPaidDate: "-",
    loanResults: [],
  };
}

function sortLoans(loans: Loan[], strategy: PayoffStrategy): Loan[] {
  const copy = [...loans];
  if (strategy === "avalanche") return copy.sort((a, b) => b.interestRate - a.interestRate);
  if (strategy === "snowball") return copy.sort((a, b) => a.balance - b.balance);
  return copy;
}

function monthPayment(
  loan: Loan,
  balance: number,
  dateStr: string,
  startDate: string
): { payment: number; interest: number } {
  const r = loan.interestRate / 12;
  const interest = balance * r;

  if (loan.paymentStyle === "fixed_amort") {
    const scheduled = loan.currentMonthlyPayment + interest;
    let total = scheduled;
    if (
      loan.targetMonthlyEnabled &&
      loan.targetMonthlyTotal &&
      dateGte(dateStr, loan.targetMonthlyFrom || startDate)
    ) {
      total = Math.max(scheduled, loan.targetMonthlyTotal);
    }
    return { payment: Math.min(balance + interest, total), interest };
  }

  // Annuity: min + optional own extra + optional cascade extra (independent)
  let total = loan.currentMonthlyPayment;
  if (
    loan.extraMonthlyEnabled &&
    (loan.extraMonthly || 0) > 0 &&
    dateGte(dateStr, loan.extraMonthlyFrom || startDate)
  ) {
    total += loan.extraMonthly || 0;
  }
  if (
    loan.cascadeExtraEnabled &&
    (loan.cascadeExtraAmount || 0) > 0 &&
    dateGte(dateStr, loan.cascadeExtraFrom || startDate)
  ) {
    total += loan.cascadeExtraAmount || 0;
  }
  return { payment: Math.min(balance + interest, total), interest };
}

export function calculateExcelStrategy(input: StrategyInput): CalculationResult {
  const {
    loans,
    oneTimePayments = [],
    startDate,
    strategy = "cascade",
  } = input;

  if (!loans || loans.length === 0) return emptyResult();

  let maxOriginalMonths = 0;
  let totalOrigInterest = 0;
  const origResults: Record<string, { months: number; interest: number }> = {};

  loans.forEach((loan) => {
    let balance = loan.balance;
    let months = 0;
    let interestSum = 0;
    while (balance > 0.5 && months < 600) {
      months++;
      const r = loan.interestRate / 12;
      const interest = balance * r;
      interestSum += interest;
      balance += interest;
      let pay: number;
      if (loan.paymentStyle === "fixed_amort") {
        pay = Math.min(balance, loan.currentMonthlyPayment + interest);
      } else {
        pay = Math.min(balance, loan.currentMonthlyPayment);
      }
      balance -= pay;
    }
    origResults[loan.id] = { months, interest: Math.round(interestSum) };
    if (months > maxOriginalMonths) maxOriginalMonths = months;
    totalOrigInterest += interestSum;
  });

  const ordered = sortLoans(loans, strategy);

  type Active = Loan & {
    currentBalance: number;
    totalInterestPaid: number;
    isPaidOff: boolean;
    paidOffMonth: number;
  };

  const active: Active[] = ordered.map((l) => ({
    ...l,
    currentBalance: l.balance,
    totalInterestPaid: 0,
    isPaidOff: false,
    paidOffMonth: 0,
  }));

  const oneTimeMap = new Map<string, { amount: number; loanId?: string }[]>();
  oneTimePayments.forEach((p) => {
    if (p.amount > 0 && p.date) {
      const list = oneTimeMap.get(p.date) || [];
      list.push({ amount: p.amount, loanId: p.loanId });
      oneTimeMap.set(p.date, list);
    }
  });

  let currentMonth = 0;
  let maxNewMonths = 0;
  let totalNewInterest = 0;
  let firstPaidMonth = 0;

  while (active.some((l) => !l.isPaidOff) && currentMonth < 600) {
    currentMonth++;
    const dateStr = getDateFromOffset(startDate, currentMonth - 1);
    const priorityIdx = active.findIndex((l) => !l.isPaidOff);

    for (let i = 0; i < active.length; i++) {
      const loan = active[i];
      if (loan.isPaidOff) continue;

      const { payment: basePay, interest } = monthPayment(
        loan,
        loan.currentBalance,
        dateStr,
        startDate
      );
      loan.totalInterestPaid += interest;
      loan.currentBalance += interest;

      let payment = basePay;

      const ots = oneTimeMap.get(dateStr);
      if (ots) {
        for (const ot of ots) {
          if (ot.loanId === loan.id || (!ot.loanId && i === priorityIdx)) {
            payment += ot.amount;
          }
        }
        if (i === priorityIdx) oneTimeMap.delete(dateStr);
      }

      const actual = Math.min(loan.currentBalance, payment);
      loan.currentBalance -= actual;

      if (loan.currentBalance <= 0.5) {
        loan.currentBalance = 0;
        loan.isPaidOff = true;
        loan.paidOffMonth = currentMonth;
        if (!firstPaidMonth) firstPaidMonth = currentMonth;
      }
    }
  }

  const loanResults: LoanResult[] = ordered.map((l, orderIdx) => {
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
      payoffOrder: orderIdx + 1,
    };
  });

  return {
    totalOriginalInterest: Math.round(totalOrigInterest),
    totalNewInterest: Math.round(totalNewInterest),
    totalInterestSaved: Math.round(Math.max(0, totalOrigInterest - totalNewInterest)),
    originalFreedomDate: getDateFromOffset(startDate, maxOriginalMonths),
    newFreedomDate: getDateFromOffset(startDate, maxNewMonths),
    totalMonthsSaved: Math.max(0, maxOriginalMonths - maxNewMonths),
    firstDebtPaidDate: firstPaidMonth
      ? getDateFromOffset(startDate, firstPaidMonth)
      : "-",
    loanResults,
  };
}