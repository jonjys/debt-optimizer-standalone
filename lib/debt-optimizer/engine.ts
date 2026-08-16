import Big from "big.js";
import type { Loan, OneTimePayment, CalculationResult, LoanResult } from "./types";

type Strategy = "custom" | "avalanche" | "snowball";

interface StrategyInput {
  loans: Loan[];
  oneTimePayments: OneTimePayment[];
  startDate: string; // YYYY-MM
  strategy: Strategy;
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
      const baseAmort = new Big(loan.currentMonthlyPayment); // 1389 för Nordea

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
  const fully = last ? last.balance.eq(0) : false;
  const endDate = fully ? last.date : "-";
  return { endDate, totalInterest, months: schedule.length, fully, schedule };
}

export function calculatePayoffSchedule(input: StrategyInput): CalculationResult {
  // Sortera enligt strategi för ordning
  let sortedLoans = [...input.loans];
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

  // För att lösa reinvest kedja: simulera i payoff-ordning
  let reinvestPools = new Map<string, Big>(); // loanId som är klar -> belopp som frigjorts per mån
  // vi kör loop per lån i ordning, när ett blir klart adderar vi dess betalning till poolen för nästa

  let totalOriginalInterest = new Big(0);
  let totalNewInterest = new Big(0);
  let globalFreedomOriginal = input.startDate;
  let globalFreedomNew = input.startDate;

  // Beräkna total original interest och datum
  for (const [id, r] of originalResults) {
    totalOriginalInterest = totalOriginalInterest.plus(r.totalInterest);
    if (r.endDate !== "-" && diffMonths(globalFreedomOriginal, r.endDate) > 0) {
      globalFreedomOriginal = r.endDate;
    }
  }

  for (let idx = 0; idx < sortedLoans.length; idx++) {
    const loan = sortedLoans[idx];

    // Samla extra från tidigare klart lån om reinvestment pekar hit
    let extraReinvest = new Big(0);
    if (loan.reinvestment?.enabled && loan.reinvestment.fromLoanId) {
      const fromId = loan.reinvestment.fromLoanId;
      const finished = finishedDates.get(fromId);
      if (finished) {
        const startRe = loan.reinvestment.startDate || finished;
        // vi kommer simulera från start, så vi behöver veta att efter finished/start ska extra läggas på
        // Förenkling: om nuvarande simulerad månad >= startRe, lägg till amount
        // Vi löser genom att skicka in 0 här och hantera inne i loopen via closure - för enkelhet: vi lägger beloppet som extraReinvestPerMonth men med datumcheck i simulateOneLoan
        // Här: vi använder loan.reinvestment.amount om finished finns, och låter simulateOneLoan kolla datum
        // Så vi skickar hela beloppet och simulateOneLoan har logik för datum
        // För att inte krångla: vi sätter extraReinvest = amount om startDate >= finished
        // Eftersom vi simulerar från input.startDate, måste vi veta när fromLoan är klart för att veta när extra börjar
        // Lösning: vi gör tvåfas - om reinvest enabled och fromLoan redan klart, så börjar extra från max(finished, reinvest.startDate)
        // Vi implementerar det genom att i simulateOneLoan loopa och kolla curDate >= start
        // Därför behöver vi skicka både amount och när det börjar gälla
      }
    }

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
      
      for (let i = 0; i < maxMonths; i++) {
        if (balance.lte(0)) break;
        const curDate = addMonths(input.startDate, i);

        const otp = combinedOtp.get(curDate);
        if (otp && otp.gt(0)) {
          if (otp.gte(balance)) {
            balance = new Big(0);
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
          const baseAmort = new Big(loan.currentMonthlyPayment);
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
      const fully = last ? last.balance.eq(0) || last.balance.lt(0.01) : false;
      const endDate = fully && last ? last.date : "-";
      return { endDate, totalInterest, months: schedule.length, fully, schedule };
    })();

    finishedDates.set(loan.id, res.endDate);
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

  // första klart
  let firstDebtPaidDate = globalFreedomNew;
  for (const lr of loanResults) {
    if (lr.newEndDate !== "-" && diffMonths(firstDebtPaidDate, lr.newEndDate) > 0 || firstDebtPaidDate === globalFreedomNew) {
      // hitta tidigaste
    }
  }
  // hitta tidigaste nya datum
  let earliest: string | null = null;
  for (const lr of loanResults) {
    if (lr.newEndDate === "-") continue;
    if (!earliest || diffMonths(lr.newEndDate, earliest) < 0) earliest = lr.newEndDate;
  }

  return {
    totalOriginalInterest: Number(totalOriginalInterest.round(0).toString()),
    totalNewInterest: Number(totalNewInterest.round(0).toString()),
    totalInterestSaved: Number(totalOriginalInterest.minus(totalNewInterest).round(0).toString()),
    originalFreedomDate: globalFreedomOriginal,
    newFreedomDate: globalFreedomNew,
    totalMonthsSaved: diffMonths(globalFreedomNew, globalFreedomOriginal) > 0 ? diffMonths(globalFreedomNew, globalFreedomOriginal) : 0,
    firstDebtPaidDate: earliest || globalFreedomNew,
    loanResults: loanResults.sort((a, b) => a.payoffOrder - b.payoffOrder),
  };
}

