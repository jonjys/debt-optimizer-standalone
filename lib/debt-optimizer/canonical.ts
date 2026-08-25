import Big from "big.js";
import type { LoanPaymentStyle, OneTimePayment, PayoffStrategy } from "./types";

/**
 * Den kanoniska räknemotorn. All ekonomi i appen går genom simulatePlan() —
 * "Mina lån", "Vad är bäst?" och "Flytta till bolånet" ska aldrig kunna ge
 * två olika svar på samma fråga.
 *
 * Tidigare fanns två motorer med olika semantik: en som rullade vidare
 * frigjorda betalningar automatiskt och en som aldrig gjorde det. På en
 * blygsam plan (kreditkort + blancolån) skilde de 2 893 kr i totalränta,
 * beroende på vilken flik användaren råkade öppna.
 *
 * Skillnaden är nu en uttrycklig inställning i indata (`rollover`) i stället
 * för en egenskap hos vilken funktion man råkar anropa:
 *
 *   rollover: true  — när ett lån är klart går dess månadsbelopp vidare till
 *                     nästa lån i ordningen. Det är vad appen lovar
 *                     användaren i klartext, och därför vad vyerna använder.
 *   rollover: false — varje lån lever sitt eget liv. Används för baslinjen
 *                     ("vad hade hänt utan plan?") och för den uttryckligen
 *                     manuella återinvesteringen.
 *
 * Alla belopp räknas med Big.js. Avrundning sker en gång, när ett tal lämnar
 * motorn — aldrig mitt i en simulering och aldrig tillbaka in i loopen.
 */

export const MAX_MONTHS = 600;

export interface PlanLoan {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  paymentStyle: LoanPaymentStyle;
  /** Bas: ränta + amortering. Aviavgifter ingår ALDRIG (P0). */
  monthlyPayment: number;
  /**
   * Rak amortering: den fasta amorteringsdelen. Anges den används den rakt av.
   * Utan den härleds den ur monthlyPayment minus ingående ränta, vilket gör
   * att en räntejustering tyst flyttar amorteringen.
   */
  monthlyPrincipal?: number;
  targetMonthlyTotal?: number;
  targetMonthlyEnabled?: boolean;
  targetMonthlyFrom?: string;
  extraMonthly?: number;
  extraMonthlyEnabled?: boolean;
  extraMonthlyFrom?: string;
  reinvestment?: {
    enabled: boolean;
    fromLoanId: string;
    amount: number;
    startDate: string;
  };
  /** Ge lånet fokus i högst så här många månader, lämna sedan över. */
  timeBoxMonths?: number;
}

export interface PlanInput {
  loans: PlanLoan[];
  strategy: PayoffStrategy;
  startDate: string;
  oneTimePayments: OneTimePayment[];
  rollover: boolean;
}

export interface PlanLoanResult {
  id: string;
  name: string;
  /** 1-baserad plats i avbetalningsordningen. */
  order: number;
  totalInterest: number;
  remainingBalance: number;
  fullyPaid: boolean;
  /** 0-baserat månadsindex då lånet blev klart, annars null. */
  finishMonth: number | null;
  endDate: string;
  focusMonths: number;
  waitMonths: number;
}

export interface PlanResult {
  loans: PlanLoanResult[];
  totalInterest: number;
  /** Antal månader tills sista lånet är klart. MAX_MONTHS om planen inte går ihop. */
  totalMonths: number;
  fullyPaid: boolean;
  freedomDate: string;
  firstPaidDate: string;
}

export function addMonths(ym: string, add: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + add, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function diffMonths(from: string, to: string): number {
  const [ya, ma] = from.split("-").map(Number);
  const [yb, mb] = to.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** Sorterar lånen i den ordning de ska betalas av. */
export function sortByStrategy<T extends { interestRate: number; balance: number }>(
  loans: readonly T[],
  strategy: PayoffStrategy,
): T[] {
  const copy = [...loans];
  if (strategy === "avalanche") copy.sort((a, b) => b.interestRate - a.interestRate);
  else if (strategy === "snowball") copy.sort((a, b) => a.balance - b.balance);
  return copy;
}

interface LoanState {
  source: PlanLoan;
  order: number;
  balance: Big;
  monthlyRate: Big;
  basePayment: Big;
  /** Fast amorteringsdel för rak amortering, härledd ur ingående saldo. */
  fixedPrincipal: Big;
  interest: Big;
  focusMonths: number;
  aliveMonths: number;
  finishMonth: number | null;
  timeBoxUsed: boolean;
}

function createState(loan: PlanLoan, order: number): LoanState {
  const balance = new Big(Math.max(0, loan.balance));
  const monthlyRate = new Big(Math.max(0, loan.interestRate)).div(12);
  const statedPrincipal =
    loan.paymentStyle === "fixed_amort" &&
    typeof loan.monthlyPrincipal === "number" &&
    loan.monthlyPrincipal > 0
      ? new Big(loan.monthlyPrincipal)
      : null;
  // Med ett angivet amorteringsbelopp är månadskostnaden en följd av det plus
  // räntan, inte tvärtom.
  const basePayment = statedPrincipal
    ? statedPrincipal.plus(balance.times(monthlyRate))
    : new Big(Math.max(0, loan.monthlyPayment));
  return {
    source: loan,
    order,
    balance,
    monthlyRate,
    basePayment,
    fixedPrincipal: statedPrincipal ?? basePayment.minus(balance.times(monthlyRate)),
    interest: new Big(0),
    focusMonths: 0,
    aliveMonths: 0,
    finishMonth: null,
    timeBoxUsed: false,
  };
}

const activeFrom = (from: string | undefined, date: string) =>
  !from || diffMonths(from, date) >= 0;

/** Frivilliga påslag användaren själv styr: "betala totalt X" och "extra X". */
function voluntaryTopUp(state: LoanState, date: string, interest: Big): Big {
  const loan = state.source;
  let topUp = new Big(0);

  if (loan.targetMonthlyEnabled && loan.targetMonthlyTotal && loan.targetMonthlyTotal > 0) {
    if (activeFrom(loan.targetMonthlyFrom, date)) {
      const target = new Big(loan.targetMonthlyTotal);
      // Rak amortering: dagens ordinarie total är amortering + ränta, och
      // räntan sjunker — påslaget växer alltså så att totalen hålls konstant.
      const regular =
        loan.paymentStyle === "fixed_amort"
          ? state.fixedPrincipal.plus(interest)
          : state.basePayment;
      if (target.gt(regular)) topUp = topUp.plus(target.minus(regular));
    }
  }

  if (loan.extraMonthlyEnabled && loan.extraMonthly && loan.extraMonthly > 0) {
    if (activeFrom(loan.extraMonthlyFrom, date)) {
      topUp = topUp.plus(new Big(loan.extraMonthly));
    }
  }

  return topUp;
}

/** Manuell återinvestering: fast belopp hit när källånet är klart. */
function manualReinvestment(
  state: LoanState,
  date: string,
  finishedDates: Map<string, string>,
): Big {
  const rule = state.source.reinvestment;
  if (!rule?.enabled || !rule.fromLoanId || !(rule.amount > 0)) return new Big(0);
  const sourceFinished = finishedDates.get(rule.fromLoanId);
  if (!sourceFinished) return new Big(0);
  // Börjar tidigast när källånet faktiskt är klart, även om användaren satt
  // ett tidigare datum — pengarna finns inte innan dess.
  const startsAt =
    rule.startDate && diffMonths(sourceFinished, rule.startDate) > 0
      ? rule.startDate
      : sourceFinished;
  return diffMonths(startsAt, date) >= 0 ? new Big(rule.amount) : new Big(0);
}

function buildOneTimeMaps(payments: readonly OneTimePayment[]) {
  const perLoan = new Map<string, Map<string, Big>>();
  const unassigned = new Map<string, Big>();
  for (const otp of payments) {
    const amount = new Big(otp.amount);
    if (otp.loanId) {
      const forLoan = perLoan.get(otp.loanId) ?? new Map<string, Big>();
      forLoan.set(otp.date, (forLoan.get(otp.date) ?? new Big(0)).plus(amount));
      perLoan.set(otp.loanId, forLoan);
    } else {
      // Utan angivet lån går pengarna till det lån som har fokus. Tidigare
      // lades samma belopp på VARJE lån, vilket mångdubblade pengarna.
      unassigned.set(otp.date, (unassigned.get(otp.date) ?? new Big(0)).plus(amount));
    }
  }
  return { perLoan, unassigned };
}

export function simulatePlan(input: PlanInput): PlanResult {
  const ordered = sortByStrategy(input.loans, input.strategy);
  const states = ordered.map((loan, index) => createState(loan, index + 1));
  const { perLoan, unassigned } = buildOneTimeMaps(input.oneTimePayments);
  const finishedDates = new Map<string, string>();

  // Ett lån som redan står på noll är betalt, inte olöst. Utan det här
  // rapporterades en plan där något lån hade saldo 0 som "inte skuldfri".
  for (const state of states) {
    if (state.balance.lte(0)) {
      state.finishMonth = 0;
      finishedDates.set(state.source.id, input.startDate);
    }
  }

  /** Kö av lånindex som ännu inte är klara — kön styr vem som får rollover. */
  const queue = states.map((_, index) => index);
  let pool = new Big(0);
  let month = 0;

  const clear = (state: LoanState, at: number, date: string, topUp: Big) => {
    state.balance = new Big(0);
    state.finishMonth = at;
    finishedDates.set(state.source.id, date);
    if (!input.rollover) return;
    // Det som frigörs är hela den månadskostnad användaren slutar betala:
    // grundbetalningen plus eventuella egna påslag. Tidigare räknades bara
    // grundbetalningen, så "extra per månad" försvann i stället för att
    // rulla vidare — planen såg långsammare ut än den är.
    //
    // Vid rak amortering är basePayment amortering + räntan på ingående
    // saldo. Räntan är i praktiken borta när lånet är slut, så det som
    // faktiskt frigörs är amorteringsdelen plus påslaget.
    const freed =
      state.source.paymentStyle === "fixed_amort"
        ? state.fixedPrincipal.plus(topUp)
        : state.basePayment.plus(topUp);
    if (freed.gt(0)) pool = pool.plus(freed);
  };

  /**
   * Vad lånet kan amortera en given månad. `withPool` avgör om den frigjorda
   * poolen räknas med — det är samma uträkning som används både för att välja
   * fokuslån och för att faktiskt betala, så de kan aldrig gå isär.
   */
  const principalFor = (state: LoanState, date: string, interest: Big, withPool: boolean) => {
    const topUp = voluntaryTopUp(state, date, interest);
    const reinvest = manualReinvestment(state, date, finishedDates);
    const rollover = withPool ? pool : new Big(0);
    return state.source.paymentStyle === "fixed_amort"
      ? state.fixedPrincipal.plus(topUp).plus(reinvest).plus(rollover)
      : state.basePayment.plus(topUp).plus(reinvest).plus(rollover).minus(interest);
  };

  for (; month < MAX_MONTHS; month++) {
    const date = addMonths(input.startDate, month);

    // Klara lån lämnar kön.
    while (queue.length > 0 && states[queue[0]].balance.lte(0)) queue.shift();
    if (queue.length === 0) break;

    // Fokus går till det första lånet i kön som faktiskt kan amortera med
    // poolen. Ett lån vars betalning inte ens täcker räntan får inte lägga
    // beslag på pengarna — men det stängs inte ute för gott: om användaren
    // har en höjning inplanerad längre fram prövas det på nytt varje månad.
    let focusIndex = -1;
    for (const index of queue) {
      const candidate = states[index];
      if (candidate.balance.lte(0)) continue;
      const interest = candidate.balance.times(candidate.monthlyRate);
      if (principalFor(candidate, date, interest, true).gt(0)) {
        focusIndex = index;
        break;
      }
    }

    for (const state of states) {
      if (state.balance.lte(0)) continue;
      const isFocus = focusIndex >= 0 && states[focusIndex] === state;
      state.aliveMonths += 1;
      if (isFocus) state.focusMonths += 1;

      // 1. Engångsbetalningar först — de minskar saldot innan ränta beräknas.
      const targeted = perLoan.get(state.source.id)?.get(date);
      const drifting = isFocus ? unassigned.get(date) : undefined;
      let lump = new Big(0);
      if (targeted) lump = lump.plus(targeted);
      if (drifting) lump = lump.plus(drifting);
      if (lump.gt(0)) {
        if (lump.gte(state.balance)) {
          const wouldBeInterest = state.balance.times(state.monthlyRate);
          clear(state, month, date, voluntaryTopUp(state, date, wouldBeInterest));
          continue;
        }
        state.balance = state.balance.minus(lump);
      }

      // 2. Ränta på kvarvarande saldo.
      const interest = state.balance.times(state.monthlyRate);
      state.interest = state.interest.plus(interest);

      // 3. Amortering.
      const topUp = voluntaryTopUp(state, date, interest);
      const principal = principalFor(state, date, interest, isFocus);

      if (principal.lte(0)) {
        // Betalningen täcker inte ens räntan: skulden växer med mellanskillnaden.
        state.balance = state.balance.minus(principal);
        continue;
      }

      if (principal.gte(state.balance)) {
        clear(state, month, date, topUp);
        continue;
      }

      state.balance = state.balance.minus(principal);
    }

    // 4. Tidsgräns: har fokuslånet förbrukat sin box lämnar det över.
    if (focusIndex >= 0) {
      const focus = states[focusIndex];
      const box = focus.source.timeBoxMonths;
      if (
        !focus.timeBoxUsed &&
        box &&
        box > 0 &&
        focus.balance.gt(0) &&
        focus.focusMonths >= box
      ) {
        focus.timeBoxUsed = true;
        queue.splice(queue.indexOf(focusIndex), 1);
        queue.push(focusIndex);
      }
    }
  }

  const loans = states
    .map((state): PlanLoanResult => {
      const fullyPaid = state.finishMonth !== null;
      return {
        id: state.source.id,
        name: state.source.name,
        order: state.order,
        totalInterest: Number(state.interest.round(0).toString()),
        remainingBalance: Number(
          (state.balance.gt(0) ? state.balance : new Big(0)).round(0).toString(),
        ),
        fullyPaid,
        finishMonth: state.finishMonth,
        endDate: fullyPaid ? addMonths(input.startDate, state.finishMonth!) : "-",
        focusMonths: state.focusMonths,
        waitMonths: Math.max(0, state.aliveMonths - state.focusMonths),
      };
    })
    .sort((a, b) => a.order - b.order);

  const fullyPaid = loans.every((loan) => loan.fullyPaid);
  const finishMonths = loans
    .map((loan) => loan.finishMonth)
    .filter((m): m is number => m !== null);

  return {
    loans,
    totalInterest: loans.reduce((sum, loan) => sum + loan.totalInterest, 0),
    totalMonths: fullyPaid && finishMonths.length > 0 ? Math.max(...finishMonths) + 1 : fullyPaid ? 0 : MAX_MONTHS,
    fullyPaid,
    freedomDate:
      fullyPaid && finishMonths.length > 0
        ? addMonths(input.startDate, Math.max(...finishMonths))
        : "-",
    firstPaidDate:
      finishMonths.length > 0
        ? addMonths(input.startDate, Math.min(...finishMonths))
        : "-",
  };
}

/**
 * Kör ett enskilt lån helt för sig själv, utan påslag, återinvestering,
 * rollover eller engångsbetalningar. Det är baslinjen som "sparad ränta"
 * och "månader tidigare" mäts mot.
 */
export function simulateLoanAlone(loan: PlanLoan, startDate: string): PlanLoanResult {
  return simulatePlan({
    loans: [
      {
        ...loan,
        targetMonthlyEnabled: false,
        extraMonthlyEnabled: false,
        reinvestment: undefined,
        timeBoxMonths: undefined,
      },
    ],
    strategy: "custom",
    startDate,
    oneTimePayments: [],
    rollover: false,
  }).loans[0];
}
