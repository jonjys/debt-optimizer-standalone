import Big from "big.js";
import type { LoanPaymentStyle } from "./types";

const MAX_MONTHS = 600;

export interface WaterfallLoan {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  monthlyPayment: number;
  paymentStyle: LoanPaymentStyle;
  timeBoxMonths?: number;
}

export interface WaterfallLoanResult {
  id: string;
  name: string;
  isAnchor: boolean;
  independentMonths: number;
  waitMonths: number;
  focusMonths: number;
  finishesAt: number;
  interest: number;
  remainingBalance: number;
  fullyPaid: boolean;
}

export interface WaterfallResult {
  loans: WaterfallLoanResult[];
  totalMonths: number;
  totalInterest: number;
  fullyPaid: boolean;
}

interface LoanState {
  source: WaterfallLoan;
  balance: Big;
  monthlyRate: Big;
  payment: Big;
  fixedPrincipal: Big;
  interest: Big;
  lastMonth: number;
  firstFocusAt?: number;
  focusMonths: number;
  timeBoxUsed: boolean;
  finishAt?: number;
  stalled: boolean;
}

interface PhaseResult {
  monthsUsed: number;
  fullyPaid: boolean;
  stalled: boolean;
}

const createState = (loan: WaterfallLoan): LoanState => {
  const balance = new Big(Math.max(0, loan.balance));
  const monthlyRate = new Big(Math.max(0, loan.interestRate)).div(12);
  const payment = new Big(Math.max(0, loan.monthlyPayment));
  return {
    source: loan,
    balance,
    monthlyRate,
    payment,
    fixedPrincipal: payment.minus(balance.times(monthlyRate)),
    interest: new Big(0),
    lastMonth: 0,
    focusMonths: 0,
    timeBoxUsed: false,
    stalled: false,
  };
};

const advanceWaiting = (state: LoanState, months: number) => {
  for (let month = 0; month < months && state.balance.gt(0); month++) {
    const interest = state.balance.times(state.monthlyRate);
    state.interest = state.interest.plus(interest);
    const principal =
      state.source.paymentStyle === "fixed_amort" && state.fixedPrincipal.gt(0)
        ? state.fixedPrincipal
        : state.payment.minus(interest);
    state.balance = state.balance.minus(principal);
    if (state.balance.lt(0)) state.balance = new Big(0);
  }
};

const advanceFocus = (
  state: LoanState,
  months: number,
  rollover: Big,
): PhaseResult => {
  let monthsUsed = 0;
  for (; monthsUsed < months && state.balance.gt(0); monthsUsed++) {
    const interest = state.balance.times(state.monthlyRate);
    state.interest = state.interest.plus(interest);
    const principal =
      state.source.paymentStyle === "fixed_amort"
        ? state.fixedPrincipal.plus(rollover)
        : state.payment.plus(rollover).minus(interest);

    if (principal.lte(0)) {
      const shortage = interest.minus(state.payment.plus(rollover));
      if (shortage.gt(0)) state.balance = state.balance.plus(shortage);
      return { monthsUsed: monthsUsed + 1, fullyPaid: false, stalled: true };
    }

    state.balance = state.balance.minus(
      principal.lt(state.balance) ? principal : state.balance,
    );
  }

  return {
    monthsUsed,
    fullyPaid: state.balance.lte(0),
    stalled: false,
  };
};

export function projectPayoff(loan: WaterfallLoan): {
  months: number;
  interest: number;
  remainingBalance: number;
  fullyPaid: boolean;
} {
  const state = createState(loan);
  const phase = advanceFocus(state, MAX_MONTHS, new Big(0));
  return {
    months: phase.fullyPaid ? phase.monthsUsed : MAX_MONTHS,
    interest: Number(state.interest.toFixed(0)),
    remainingBalance: Number(
      (state.balance.gt(0) ? state.balance : new Big(0)).toFixed(0),
    ),
    fullyPaid: phase.fullyPaid,
  };
}

export function calcWaterfall(orderedLoans: WaterfallLoan[]): WaterfallResult {
  if (orderedLoans.length === 0) {
    return { loans: [], totalMonths: 0, totalInterest: 0, fullyPaid: true };
  }

  const states = orderedLoans.map(createState);
  const stateById = new Map(states.map((state) => [state.source.id, state]));
  const independent = new Map(
    orderedLoans.map((loan) => [loan.id, projectPayoff(loan)]),
  );
  const queue = states.map((state) => state.source.id);
  let currentMonth = 0;
  let rollover = new Big(0);
  let planStalled = false;

  while (queue.length > 0 && currentMonth < MAX_MONTHS) {
    const id = queue.shift()!;
    const state = stateById.get(id)!;
    const waitingMonths = Math.max(0, currentMonth - state.lastMonth);
    advanceWaiting(state, waitingMonths);
    state.lastMonth = currentMonth;
    state.firstFocusAt ??= currentMonth;

    if (state.balance.lte(0)) {
      state.finishAt = currentMonth;
      rollover = rollover.plus(state.payment);
      continue;
    }

    const hasTimeBox =
      !state.timeBoxUsed &&
      Boolean(state.source.timeBoxMonths && state.source.timeBoxMonths > 0);
    const phaseLimit = Math.min(
      MAX_MONTHS - currentMonth,
      hasTimeBox ? Math.max(1, state.source.timeBoxMonths!) : MAX_MONTHS,
    );
    const phase = advanceFocus(state, phaseLimit, rollover);
    state.focusMonths += phase.monthsUsed;
    currentMonth += phase.monthsUsed;
    state.lastMonth = currentMonth;

    if (phase.fullyPaid) {
      state.balance = new Big(0);
      state.finishAt = currentMonth;
      rollover = rollover.plus(state.payment);
      continue;
    }

    if (hasTimeBox) {
      state.timeBoxUsed = true;
      state.stalled = phase.stalled;
      queue.push(id);
      continue;
    }

    state.stalled = phase.stalled;
    planStalled = true;
    break;
  }

  const fullyPaid =
    !planStalled && states.every((state) => state.balance.lte(0));
  const totalMonths = fullyPaid
    ? Math.max(...states.map((state) => state.finishAt || 0))
    : MAX_MONTHS;
  const results = states.map((state, index): WaterfallLoanResult => {
    const solo = independent.get(state.source.id)!;
    const finishesAt = state.finishAt ?? MAX_MONTHS;
    return {
      id: state.source.id,
      name: state.source.name,
      isAnchor: index === 0,
      independentMonths: solo.months,
      waitMonths: Math.max(0, finishesAt - state.focusMonths),
      focusMonths: state.focusMonths,
      finishesAt,
      interest: Number(state.interest.toFixed(0)),
      remainingBalance: Number(
        (state.balance.gt(0) ? state.balance : new Big(0))
          .toFixed(0),
      ),
      fullyPaid: state.balance.lte(0),
    };
  });

  return {
    loans: results,
    totalMonths,
    totalInterest: results.reduce((sum, loan) => sum + loan.interest, 0),
    fullyPaid,
  };
}
