import Big from "big.js";
import type { Loan, OneTimePayment, CalculationResult, LoanResult } from "./types";

type Strategy = "custom" | "avalanche" | "snowball";

interface StrategyInput {
  loans: Loan[];
  oneTimePayments: OneTimePayment[];
  startDate: string; // YYYY-MM
  strategy: Strategy;
}

/**
 * Termen (i månader) som fee-heuristiken jämför mot. Ett typiskt svenskt
 * blancolån löper på 15 år, så en faktura som ligger mer än 15 % över
 * annuiteten för den termen innehåller nästan alltid aviavgifter utöver
 * ränta och amortering.
 */
export const FEE_HEURISTIC_TERM_MONTHS = 180;

/** Annuitet (rak månadsbetalning) för ett lån — referensvärde, ingen simulering. */
export function referenceAnnuityPayment(
  balance: number,
  annualRate: number,
  months: number = FEE_HEURISTIC_TERM_MONTHS,
): number {
  if (!(balance > 0) || !(months > 0)) return 0;
  const r = annualRate / 12;
  if (r === 0) return balance / months;
  const growth = Math.pow(1 + r, months);
  return (balance * r * growth) / (growth - 1);
}

/**
 * Sant när månadsbeloppet ligger så långt över annuiteten att det rimligen
 * innehåller avgifter. Används för att varna användaren att hen skrivit in
 * fakturasumman i stället för ränta + amortering — avgifter får aldrig
 * räknas som betalning i kalkylen (P0).
 */
export function paymentLikelyIncludesFees(
  balance: number,
  annualRate: number,
  payment: number,
  months: number = FEE_HEURISTIC_TERM_MONTHS,
): boolean {
  const reference = referenceAnnuityPayment(balance, annualRate, months);
  return reference > 0 && payment > reference * 1.15;
}

/** Resultatet för en plan helt utan lån: inget kvar att betala av. */
export function emptyResult(startDate: string): CalculationResult {
  return {
    totalOriginalInterest: 0,
    totalNewInterest: 0,
    totalInterestSaved: 0,
    originalFreedomDate: startDate,
    newFreedomDate: startDate,
    totalMonthsSaved: 0,
    firstDebtPaidDate: startDate,
    loanResults: [],
  };
}

const NUMERIC_LOAN_FIELDS = [
  "balance",
  "interestRate",
  "currentMonthlyPayment",
  "targetMonthlyTotal",
  "extraMonthly",
  "feesMonthly",
] as const;

/**
 * Vaktar mot indata som annars tyst producerar nonsens-siffror. Den
 * vanligaste i praktiken är ränta angiven i procent (5.95) i stället för
 * decimalform (0.0595) — utan den här kontrollen räknar motorn glatt med
 * 595 % ränta och visar ett skuldfri-datum som aldrig inträffar.
 */
function validateLoan(loan: Loan): void {
  for (const field of NUMERIC_LOAN_FIELDS) {
    const value = loan[field];
    if (value === undefined || value === null) continue;
    if (!Number.isFinite(value)) {
      throw new Error(`Lån "${loan.id}": ${field} är NaN eller Infinity`);
    }
  }
  if (loan.reinvestment && !Number.isFinite(loan.reinvestment.amount)) {
    throw new Error(`Lån "${loan.id}": reinvestment.amount är NaN eller Infinity`);
  }
  if (loan.balance < 0) throw new Error(`Lån "${loan.id}": balance negativt`);
  if (loan.interestRate < 0) throw new Error(`Lån "${loan.id}": ränta negativ`);
  if (loan.interestRate > 1) {
    throw new Error(
      `Lån "${loan.id}": ränta >100% (${loan.interestRate}) — angavs den i procent i stället för decimalform?`,
    );
  }
  if (loan.currentMonthlyPayment < 0) {
    throw new Error(`Lån "${loan.id}": betalning negativ`);
  }
  if (loan.reinvestment && loan.reinvestment.amount < 0) {
    throw new Error(`Lån "${loan.id}": reinvestment.amount negativ`);
  }
}

function validateInput(input: StrategyInput): void {
  for (const loan of input.loans) validateLoan(loan);
  for (const otp of input.oneTimePayments) {
    if (!Number.isFinite(otp.amount)) {
      throw new Error(`Engångsbetalning "${otp.id}": belopp är NaN eller Infinity`);
    }
    if (otp.amount < 0) {
      throw new Error(`Engångsbetalning "${otp.id}": belopp negativt`);
    }
  }
}

function addMonths(ym: string, add: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + add, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function diffMonths(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

// Sveriges rak amortering + annuitet med Big.js överallt
function simulateOneLoan(
  loan: Loan,
  startDate: string,
  extraReinvestPerMonth: Big, // från klart annat lån
  oneTimeMap: Map<string, Big>
): { endDate: string; totalInterest: Big; months: number; fully: boolean; schedule: { date: string; payment: Big; interest: Big; principal: Big; balance: Big }[] } {
  let balance = new Big(loan.balance);
  let totalInterest = new Big(0);
  const schedule: any[] = [];
  const maxMonths = 600;
  const monthlyRate = new Big(loan.interestRate).div(12);
  // The UI asks for today's total monthly cost. For straight-line principal,
  // derive month-one principal once, then keep that principal fixed while the
  // interest portion declines.
  const fixedPrincipal = new Big(loan.currentMonthlyPayment).minus(
    new Big(loan.balance).times(monthlyRate)
  );

  for (let i = 0; i < maxMonths; i++) {
    if (balance.lte(0)) break;
    const curDate = addMonths(startDate, i);

    // engångsbetalning denna månad?
    const otp = oneTimeMap.get(curDate);
    if (otp && otp.gt(0)) {
      if (otp.gte(balance)) {
        balance = new Big(0);
        schedule.push({ date: curDate, payment: otp, interest: new Big(0), principal: otp, balance });
        break;
      } else {
        balance = balance.minus(otp);
      }
    }

    // ränta denna månad
    const interest = balance.times(monthlyRate);
    totalInterest = totalInterest.plus(interest);

    let principal = new Big(0);
    let payment = new Big(0);

    if (loan.paymentStyle === "fixed_amort") {
      if (fixedPrincipal.lte(0)) {
        return { endDate: "-", totalInterest, months: maxMonths, fully: false, schedule };
      }
      const baseAmort = fixedPrincipal;

      // 1. Räkna ordinarie total = amort + ränta
      const regularTotal = baseAmort.plus(interest);

      // 2. Om användaren satt "Betala totalt X per månad" ex 2000
      let targetExtra = new Big(0);
      if (loan.targetMonthlyEnabled && loan.targetMonthlyTotal && loan.targetMonthlyTotal > 0) {
        const target = new Big(loan.targetMonthlyTotal);
        // kolla från-datum
        const fromOk = !loan.targetMonthlyFrom || diffMonths(loan.targetMonthlyFrom, curDate) >= 0;
        if (fromOk && target.gt(regularTotal)) {
          targetExtra = target.minus(regularTotal);
        }
      }

      // 3. Extra amortering/mån ex 500
      let extraMonthly = new Big(0);
      if (loan.extraMonthlyEnabled && loan.extraMonthly && loan.extraMonthly > 0) {
        const fromOk = !loan.extraMonthlyFrom || diffMonths(loan.extraMonthlyFrom, curDate) >= 0;
        if (fromOk) extraMonthly = new Big(loan.extraMonthly);
      }

      principal = baseAmort.plus(targetExtra).plus(extraMonthly).plus(extraReinvestPerMonth);
      payment = interest.plus(principal);

      // cap: betala inte mer än skuld + ränta
      if (principal.gt(balance)) {
        principal = balance;
        payment = interest.plus(principal);
      }

      balance = balance.minus(principal);
    } else {
      // ANNUIET - Nordax 6887.77
      let basePayment = new Big(loan.currentMonthlyPayment);

      let targetExtra = new Big(0);
      if (loan.targetMonthlyEnabled && loan.targetMonthlyTotal && loan.targetMonthlyTotal > 0) {
        const fromOk = !loan.targetMonthlyFrom || diffMonths(loan.targetMonthlyFrom, curDate) >= 0;
        if (fromOk) {
          const target = new Big(loan.targetMonthlyTotal);
          if (target.gt(basePayment)) targetExtra = target.minus(basePayment);
        }
      }

      let extraMonthly = new Big(0);
      if (loan.extraMonthlyEnabled && loan.extraMonthly && loan.extraMonthly > 0) {
        const fromOk = !loan.extraMonthlyFrom || diffMonths(loan.extraMonthlyFrom, curDate) >= 0;
        if (fromOk) extraMonthly = new Big(loan.extraMonthly);
      }

      payment = basePayment.plus(targetExtra).plus(extraMonthly).plus(extraReinvestPerMonth);
      principal = payment.minus(interest);
      if (principal.lte(0)) {
        // betalar inte ens räntan - lån växer, avbryt
        return { endDate: "-", totalInterest, months: maxMonths, fully: false, schedule };
      }
      if (principal.gt(balance)) {
        principal = balance;
        payment = interest.plus(principal);
      }
      balance = balance.minus(principal);
    }

    schedule.push({ date: curDate, payment, interest, principal, balance: balance.gt(0) ? balance : new Big(0) });
    if (balance.lte(0)) break;
  }

  const last = schedule[schedule.length - 1];
  // Samma tolerans och samma tomt-schema-regel som i den aktiva simuleringen
  // i calculatePayoffSchedule — baslinjen och det nya utfallet måste bedöma
  // "är lånet klart?" identiskt, annars blir monthsSaved och interestSaved
  // jämförelser mellan två olika definitioner.
  const fully = last ? last.balance.lt(0.01) : balance.lte(0);
  const endDate = fully ? (last ? last.date : startDate) : "-";
  return { endDate, totalInterest, months: schedule.length, fully, schedule };
}

export function calculatePayoffSchedule(input: StrategyInput): CalculationResult {
  validateInput(input);
  if (input.loans.length === 0) return emptyResult(input.startDate);

  // Sortera enligt strategi för ordning
  const sortedLoans = [...input.loans];
  if (input.strategy === "avalanche") {
    sortedLoans.sort((a, b) => b.interestRate - a.interestRate);
  } else if (input.strategy === "snowball") {
    sortedLoans.sort((a, b) => a.balance - b.balance);
  }
  // custom = behåll ordning

  // Bygg karta för engångsbetalningar per lån
  const otpGlobal = new Map<string, Big>(); // om utan loanId -> alla? vi fördelar senare
  const otpPerLoan = new Map<string, Map<string, Big>>();
  for (const otp of input.oneTimePayments) {
    if (otp.loanId) {
      if (!otpPerLoan.has(otp.loanId)) otpPerLoan.set(otp.loanId, new Map());
      const m = otpPerLoan.get(otp.loanId)!;
      m.set(otp.date, (m.get(otp.date) || new Big(0)).plus(otp.amount));
    } else {
      otpGlobal.set(otp.date, (otpGlobal.get(otp.date) || new Big(0)).plus(otp.amount));
    }
  }

  // Simulera varje lån fristående först för att få original-slutdatum (utan extra/reinvest)
  // Original = bara base utan target/extra/reinvest/one-time
  const originalResults = new Map<string, { endDate: string; totalInterest: Big }>();
  for (const loan of input.loans) {
    const cleanLoan: Loan = {
      ...loan,
      targetMonthlyEnabled: false,
      extraMonthlyEnabled: false,
      reinvestment: undefined,
    };
    const res = simulateOneLoan(cleanLoan, input.startDate, new Big(0), new Map());
    originalResults.set(loan.id, { endDate: res.endDate, totalInterest: res.totalInterest });
  }

  // Nu nya med allt aktiverat, plus kaskad om reinvestment enabled
  // Vi behöver veta när ett lån blir klart för att frigöra pengar
  const loanResults: LoanResult[] = [];
  const finishedDates = new Map<string, string>();

  // Återinvesteringskedjan löses genom att simulera i payoff-ordning: när ett
  // lån blir klart registreras dess slutdatum i finishedDates, och lån längre
  // ner i ordningen som pekar hit får sitt tillskott från och med då. Därför
  // är detta ordningsberoende — ett lån kan bara återinvestera från ett lån
  // som ligger FÖRE det i ordningen.
  let totalOriginalInterest = new Big(0);
  let totalNewInterest = new Big(0);
  let globalFreedomOriginal = input.startDate;
  let globalFreedomNew = input.startDate;
  let originalFullyAmortizing = true;
  let newFullyAmortizing = true;

  // Beräkna total original interest och datum
  for (const [id, r] of originalResults) {
    totalOriginalInterest = totalOriginalInterest.plus(r.totalInterest);
    if (r.endDate === "-") originalFullyAmortizing = false;
    if (r.endDate !== "-" && diffMonths(globalFreedomOriginal, r.endDate) > 0) {
      globalFreedomOriginal = r.endDate;
    }
  }

  for (let idx = 0; idx < sortedLoans.length; idx++) {
    const loan = sortedLoans[idx];

    // Bygg oneTime map för detta lån
    const combinedOtp = new Map<string, Big>();
    const perLoan = otpPerLoan.get(loan.id);
    if (perLoan) for (const [d, a] of perLoan) combinedOtp.set(d, (combinedOtp.get(d) || new Big(0)).plus(a));
    // globala otp fördelas? vi lägger ej till automatiskt, bara om loanId saknas fördelas på första lånet? För enkelhet: lägg global på alla
    for (const [d, a] of otpGlobal) combinedOtp.set(d, (combinedOtp.get(d) || new Big(0)).plus(a));

    // Custom simulate som hanterar reinvest startdatum
    const res = (() => {
      let balance = new Big(loan.balance);
      let totalInterest = new Big(0);
      const monthlyRate = new Big(loan.interestRate).div(12);
      const maxMonths = 600;
      const schedule: any[] = [];
      const fixedPrincipal = new Big(loan.currentMonthlyPayment).minus(
        new Big(loan.balance).times(monthlyRate)
      );
      
      for (let i = 0; i < maxMonths; i++) {
        if (balance.lte(0)) break;
        const curDate = addMonths(input.startDate, i);

        const otp = combinedOtp.get(curDate);
        if (otp && otp.gt(0)) {
          if (otp.gte(balance)) {
            // Engångsbetalningen löser hela lånet. Raden MÅSTE skrivas till
            // schemat innan vi bryter — annars är sista raden föregående
            // månad med skuld kvar, och lånet rapporteras som "-" (blir
            // aldrig skuldfritt) trots att det just betalades av.
            const settled = balance;
            balance = new Big(0);
            schedule.push({
              date: curDate,
              payment: settled,
              interest: new Big(0),
              principal: settled,
              balance,
            });
            break;
          } else {
            balance = balance.minus(otp);
          }
        }

        const interest = balance.times(monthlyRate);
        totalInterest = totalInterest.plus(interest);

        let principal = new Big(0);
        let payment = new Big(0);
        let curReinvest = new Big(0);

        if (loan.reinvestment?.enabled && loan.reinvestment.fromLoanId) {
          const fromId = loan.reinvestment.fromLoanId;
          const finDate = finishedDates.get(fromId);
          if (finDate) {
            const startFrom = loan.reinvestment.startDate ? (diffMonths(finDate, loan.reinvestment.startDate) > 0 ? loan.reinvestment.startDate : finDate) : finDate;
            if (diffMonths(startFrom, curDate) >= 0) {
              curReinvest = new Big(loan.reinvestment.amount);
            }
          }
        }

        if (loan.paymentStyle === "fixed_amort") {
          if (fixedPrincipal.lte(0)) {
            return { endDate: "-", totalInterest, months: maxMonths, fully: false, schedule };
          }
          const baseAmort = fixedPrincipal;
          const regularTotal = baseAmort.plus(interest);
          let targetExtra = new Big(0);
          if (loan.targetMonthlyEnabled && loan.targetMonthlyTotal) {
            const fromOk = !loan.targetMonthlyFrom || diffMonths(loan.targetMonthlyFrom, curDate) >= 0;
            if (fromOk) {
              const target = new Big(loan.targetMonthlyTotal);
              if (target.gt(regularTotal)) targetExtra = target.minus(regularTotal);
            }
          }
          let extraMonthly = new Big(0);
          if (loan.extraMonthlyEnabled && loan.extraMonthly) {
            const fromOk = !loan.extraMonthlyFrom || diffMonths(loan.extraMonthlyFrom, curDate) >= 0;
            if (fromOk) extraMonthly = new Big(loan.extraMonthly);
          }
          principal = baseAmort.plus(targetExtra).plus(extraMonthly).plus(curReinvest);
          if (principal.gt(balance)) principal = balance;
          payment = interest.plus(principal);
          balance = balance.minus(principal);
        } else {
          const basePayment = new Big(loan.currentMonthlyPayment);
          let targetExtra = new Big(0);
          if (loan.targetMonthlyEnabled && loan.targetMonthlyTotal) {
            const fromOk = !loan.targetMonthlyFrom || diffMonths(loan.targetMonthlyFrom, curDate) >= 0;
            if (fromOk) {
              const target = new Big(loan.targetMonthlyTotal);
              if (target.gt(basePayment)) targetExtra = target.minus(basePayment);
            }
          }
          let extraMonthly = new Big(0);
          if (loan.extraMonthlyEnabled && loan.extraMonthly) {
            const fromOk = !loan.extraMonthlyFrom || diffMonths(loan.extraMonthlyFrom, curDate) >= 0;
            if (fromOk) extraMonthly = new Big(loan.extraMonthly);
          }
          payment = basePayment.plus(targetExtra).plus(extraMonthly).plus(curReinvest);
          principal = payment.minus(interest);
          if (principal.lte(0)) return { endDate: "-", totalInterest, months: maxMonths, fully: false, schedule };
          if (principal.gt(balance)) {
            principal = balance;
            payment = interest.plus(principal);
          }
          balance = balance.minus(principal);
        }
        schedule.push({ date: curDate, payment, interest, principal, balance });
        if (balance.lte(0)) break;
      }
      const last = schedule[schedule.length - 1];
      // Tomt schema = lånet hade redan noll i saldo och behövde aldrig
      // simuleras. Det är skuldfritt från start, inte "blir aldrig klart".
      const fully = last ? last.balance.lt(0.01) : balance.lte(0);
      const endDate = fully ? (last ? last.date : input.startDate) : "-";
      return { endDate, totalInterest, months: schedule.length, fully, schedule };
    })();

    if (res.endDate !== "-") finishedDates.set(loan.id, res.endDate);
    else newFullyAmortizing = false;
    const orig = originalResults.get(loan.id)!;

    totalNewInterest = totalNewInterest.plus(res.totalInterest);
    if (res.endDate !== "-" && diffMonths(globalFreedomNew, res.endDate) > 0) {
      globalFreedomNew = res.endDate;
    }

    const monthsSaved = orig.endDate !== "-" && res.endDate !== "-" ? diffMonths(res.endDate, orig.endDate) : 0;

    loanResults.push({
      id: loan.id,
      name: loan.name,
      originalEndDate: orig.endDate,
      originalTotalInterest: Number(orig.totalInterest.round(0).toString()),
      newEndDate: res.endDate,
      newTotalInterest: Number(res.totalInterest.round(0).toString()),
      interestSaved: Number(orig.totalInterest.minus(res.totalInterest).round(0).toString()),
      monthsSaved: monthsSaved > 0 ? monthsSaved : 0,
      payoffOrder: idx + 1,
      isFullyAmortizing: res.fully,
    });
  }

  // Tidigaste lån som blir klart (används för "första skulden betald").
  let earliest: string | null = null;
  for (const lr of loanResults) {
    if (lr.newEndDate === "-") continue;
    if (!earliest || diffMonths(lr.newEndDate, earliest) < 0) earliest = lr.newEndDate;
  }

  if (!originalFullyAmortizing) globalFreedomOriginal = "-";
  if (!newFullyAmortizing) globalFreedomNew = "-";

  const totalMonthsSaved =
    globalFreedomOriginal !== "-" && globalFreedomNew !== "-"
      ? diffMonths(globalFreedomNew, globalFreedomOriginal)
      : 0;

  return {
    totalOriginalInterest: Number(totalOriginalInterest.round(0).toString()),
    totalNewInterest: Number(totalNewInterest.round(0).toString()),
    totalInterestSaved: Number(totalOriginalInterest.minus(totalNewInterest).round(0).toString()),
    originalFreedomDate: globalFreedomOriginal,
    newFreedomDate: globalFreedomNew,
    totalMonthsSaved: totalMonthsSaved > 0 ? totalMonthsSaved : 0,
    firstDebtPaidDate: earliest || globalFreedomNew,
    loanResults: loanResults.sort((a, b) => a.payoffOrder - b.payoffOrder),
  };
}

