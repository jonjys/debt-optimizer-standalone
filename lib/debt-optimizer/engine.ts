import {
  Loan,
  StrategyInput,
  CalculationResult,
  LoanResult,
  PayoffStrategy,
} from "./types";

// Avrundningskonvention: Räkna internt i flyttal för maximal precision.
// Avrunda ENDAST vid visning, med Math.round() på slutsummor per lån och
// grand-total. Avrunda ALDRIG varje månad till öre — det introducerar
// kvantiseringsbrus. Testat empiriskt: 2M kr lån över 327 mån ger 0.02 kr
// diff mellan round-once vs round-monthly. Round-once är korrekt.

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

export function emptyResult(): CalculationResult {
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

export function sortLoans(loans: Loan[], strategy: PayoffStrategy): Loan[] {
  if (strategy === "avalanche")
    return [...loans].sort(
      (a, b) => b.interestRate - a.interestRate || a.id.localeCompare(b.id)
    );
  if (strategy === "snowball")
    return [...loans].sort(
      (a, b) => a.balance - b.balance || a.id.localeCompare(b.id)
    );
  return loans; // cascade = user's own order
}

/**
 * Validates a single loan's numeric fields. Returns a list of human-readable
 * error strings (empty = valid). Guards against negative/NaN/Infinity inputs
 * and an interestRate stored as a percentage (e.g. 5.95) instead of a
 * decimal (0.0595), which would otherwise silently compute 100x too much
 * interest.
 */
function validateLoan(loan: Loan): string[] {
  const errors: string[] = [];
  if (loan.balance < 0) errors.push(`balance negativt: ${loan.balance}`);
  if (loan.interestRate < 0) errors.push(`ränta negativ: ${loan.interestRate}`);
  if (loan.interestRate > 1)
    errors.push(`ränta >100%: ${loan.interestRate} - troligen fel format`);
  if (loan.currentMonthlyPayment < 0)
    errors.push(`betalning negativ: ${loan.currentMonthlyPayment}`);
  if (!isFinite(loan.balance)) errors.push(`balance är NaN eller Infinity`);
  if (!isFinite(loan.interestRate)) errors.push(`ränta är NaN eller Infinity`);
  if (!isFinite(loan.currentMonthlyPayment))
    errors.push(`betalning är NaN eller Infinity`);
  if (loan.reinvestment) {
    if (loan.reinvestment.amount < 0)
      errors.push(`återinvestering negativ: ${loan.reinvestment.amount}`);
    if (!isFinite(loan.reinvestment.amount))
      errors.push(`återinvestering är NaN eller Infinity`);
  }
  return errors;
}

function monthBasePayment(
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
      (loan.targetMonthlyTotal || 0) > 0 &&
      dateGte(dateStr, loan.targetMonthlyFrom || startDate)
    ) {
      total = Math.max(scheduled, loan.targetMonthlyTotal!);
    }
    // + optional extra on top of target/scheduled
    if (
      loan.extraMonthlyEnabled &&
      (loan.extraMonthly || 0) > 0 &&
      dateGte(dateStr, loan.extraMonthlyFrom || startDate)
    ) {
      total += loan.extraMonthly || 0;
    }
    // + optional manual reinvestment from another (cleared) loan
    if (
      loan.reinvestment?.enabled &&
      (loan.reinvestment.amount || 0) > 0 &&
      dateGte(dateStr, loan.reinvestment.startDate || startDate)
    ) {
      total += loan.reinvestment.amount || 0;
    }
    return { payment: Math.min(balance + interest, total), interest };
  }

  // annuity
  let total = loan.currentMonthlyPayment;
  if (
    loan.extraMonthlyEnabled &&
    (loan.extraMonthly || 0) > 0 &&
    dateGte(dateStr, loan.extraMonthlyFrom || startDate)
  ) {
    total += loan.extraMonthly || 0;
  }
  if (
    loan.reinvestment?.enabled &&
    (loan.reinvestment.amount || 0) > 0 &&
    dateGte(dateStr, loan.reinvestment.startDate || startDate)
  ) {
    total += loan.reinvestment.amount || 0;
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

  const validationErrors: string[] = [];
  loans.forEach((loan) => {
    const errors = validateLoan(loan);
    if (errors.length > 0) {
      validationErrors.push(`${loan.name || loan.id}: ${errors.join(", ")}`);
    }
  });
  if (validationErrors.length > 0) {
    throw new Error(`Ogiltiga lånevärden — ${validationErrors.join("; ")}`);
  }

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
      const pay =
        loan.paymentStyle === "fixed_amort"
          ? Math.min(balance, loan.currentMonthlyPayment + interest)
          : Math.min(balance, loan.currentMonthlyPayment);
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
    // -1 = "not paid off yet", distinct from a real month number, so a loan
    // that never amortizes (payment doesn't outpace interest, times out at
    // the 600-month cap) can't be mistaken for "paid off at month 0".
    paidOffMonth: -1,
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

    // Manual mode: no automatic transfer of payment between loans. Money
    // only moves from a cleared loan to another one when the user
    // explicitly enables reinvestment on that other loan (handled inside
    // monthBasePayment via loan.reinvestment). `priorityIdx` is kept only
    // as the fallback target for a one-time payment that wasn't assigned
    // to a specific loan.
    const priorityIdx = active.findIndex((l) => !l.isPaidOff);
    // Read once per month, applied against every loan below, then removed
    // after all loans have had a chance to match it — NOT as soon as the
    // priority-index loan is processed. Deleting on "i === priorityIdx"
    // discarded any one-time payment aimed at a loan later in the list
    // the moment the (unrelated) priority loan took its turn, silently
    // dropping the payment before its actual target ever saw it.
    const ots = oneTimeMap.get(dateStr);

    for (let i = 0; i < active.length; i++) {
      const loan = active[i];
      if (loan.isPaidOff) continue;

      const { payment: basePay, interest } = monthBasePayment(
        loan,
        loan.currentBalance,
        dateStr,
        startDate
      );
      loan.totalInterestPaid += interest;
      loan.currentBalance += interest;

      let payment = basePay;

      if (ots) {
        for (const ot of ots) {
          if (ot.loanId === loan.id || (!ot.loanId && i === priorityIdx)) {
            payment += ot.amount;
          }
        }
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

    if (ots) oneTimeMap.delete(dateStr);
  }

  let anyLoanNeverAmortizes = false;

  const loanResults: LoanResult[] = ordered.map((l, orderIdx) => {
    const orig = origResults[l.id];
    const sim = active.find((a) => a.id === l.id)!;
    const isFullyAmortizing = sim.paidOffMonth !== -1;
    const newInterest = Math.round(sim.totalInterestPaid);
    totalNewInterest += sim.totalInterestPaid;

    if (!isFullyAmortizing) {
      anyLoanNeverAmortizes = true;
      return {
        id: l.id,
        name: l.name,
        originalEndDate: getDateFromOffset(startDate, orig.months),
        originalTotalInterest: orig.interest,
        newEndDate: "-",
        newTotalInterest: newInterest,
        interestSaved: 0,
        monthsSaved: 0,
        payoffOrder: orderIdx + 1,
        isFullyAmortizing: false,
      };
    }

    const newMonths = sim.paidOffMonth;
    if (newMonths > maxNewMonths) maxNewMonths = newMonths;
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
      isFullyAmortizing: true,
    };
  });

  // Sum of the (already-rounded) per-loan figures the UI actually displays,
  // so the headline "sparad ränta" always reconciles exactly with the list
  // it's broken down into — no independent grand-total rounding drift.
  const totalInterestSaved = loanResults.reduce(
    (sum, loan) => sum + loan.interestSaved,
    0
  );

  return {
    totalOriginalInterest: Math.round(totalOrigInterest),
    totalNewInterest: Math.round(totalNewInterest),
    totalInterestSaved,
    originalFreedomDate: getDateFromOffset(startDate, maxOriginalMonths),
    // The plan isn't "debt-free" on any date if even one loan never
    // amortizes — same -1-style sentinel convention as emptyResult().
    newFreedomDate: anyLoanNeverAmortizes
      ? "-"
      : getDateFromOffset(startDate, maxNewMonths),
    totalMonthsSaved: anyLoanNeverAmortizes
      ? 0
      : Math.max(0, maxOriginalMonths - maxNewMonths),
    firstDebtPaidDate: firstPaidMonth
      ? getDateFromOffset(startDate, firstPaidMonth)
      : "-",
    loanResults,
  };
}
