import { describe, it, expect } from "vitest";
import { calculatePayoffSchedule } from "./engine";
import { calcWaterfall, projectPayoff, type WaterfallLoan } from "./waterfall";
import { calculateBakeIn, securedDeduction } from "./bake-in";
import type { Loan } from "./types";

/**
 * Regressionsskydd för de fyra P0-fel som hittades i granskningen av V8.
 * Varje describe-block motsvarar ett av dem och namnger felet, så att en
 * framtida omskrivning inte tyst kan återinföra det.
 */

const START = "2026-01";

function mkLoan(over: Partial<Loan> & Pick<Loan, "id">): Loan {
  return {
    name: over.id,
    loanType: "Annuitet",
    paymentStyle: "annuity",
    balance: 0,
    interestRate: 0,
    currentMonthlyPayment: 0,
    ...over,
  };
}

function mkWaterfallLoan(over: Partial<WaterfallLoan> & Pick<WaterfallLoan, "id">): WaterfallLoan {
  return {
    name: over.id,
    balance: 0,
    interestRate: 0,
    monthlyPayment: 0,
    paymentStyle: "annuity",
    ...over,
  };
}

describe("P0-1: en negativ refinansiering får aldrig presenteras som noll", () => {
  // Att baka in ett blancolån i bolånet kan kosta pengar i stället för att
  // spara dem. Tidigare föll varje icke-positivt utfall ner i "Dra slidern
  // för att se effekt", så en förlustaffär såg ut som en nollaffär.
  //
  // OBS om scenariot: modellen räknar bolånet över mortgageYears (30 år) men
  // blancolånet över personalMonths (10 år), och vid LTV under 50 % är
  // amorteringskravet 0 %. Därför blir även ett 9 %-blancolån en "förlust"
  // att baka in — den inbakade skulden räntelöper 30 år i stället för 10.
  // Se testet "modellens tecken beror på tidshorisonten" längst ned i det
  // här blocket: den avvägningen är ett produktbeslut, inte ett räknefel,
  // och testerna här låser bara fast ATT tecknet redovisas ärligt.
  const losingDeal = () =>
    calculateBakeIn({
      mortgage: 1_000_000,
      mortgageRate: 0.041,
      personal: 300_000,
      personalRate: 0.09,
      homeValue: 3_000_000,
      bakeAmount: 300_000,
    });

  it("skriver ut förlusten i klartext i stället för att dölja den", () => {
    const result = losingDeal();
    expect(result.interestSavedGross).toBeLessThan(0);
    expect(result.summaryLine).not.toBe("Dra slidern för att se effekt.");
    expect(result.summaryLine).toMatch(/kostar/i);
  });

  it("rundar aldrig av en förlust till noll i summeringen", () => {
    const result = losingDeal();
    expect(result.summaryLine).not.toMatch(/sparar/i);
    // Beloppet i texten måste vara skilt från noll.
    expect(Math.round(Math.abs(result.interestSavedGross))).toBeGreaterThan(0);
  });

  it("visar fortfarande neutraltexten när inget faktiskt bakas in", () => {
    const nothing = calculateBakeIn({
      mortgage: 2_000_000,
      mortgageRate: 0.041,
      personal: 400_000,
      personalRate: 0.09,
      homeValue: 3_000_000,
      bakeAmount: 0,
    });
    expect(nothing.bake).toBe(0);
    expect(nothing.summaryLine).toBe("Dra slidern för att se effekt.");
  });

  it("en verklig vinstaffär rapporteras fortfarande som vinst", () => {
    const winning = calculateBakeIn({
      mortgage: 1_000_000,
      mortgageRate: 0.041,
      personal: 300_000,
      personalRate: 0.3, // kreditkortsränta → vinst även över 30 års horisont
      homeValue: 3_000_000,
      bakeAmount: 300_000,
    });
    expect(winning.interestSavedGross).toBeGreaterThan(0);
    expect(winning.summaryLine).toMatch(/sparar/i);
  });

  it("modellens tecken beror på tidshorisonten — låst så att en ändring blir medveten", () => {
    // Detta test påstår INTE att beteendet är önskvärt. Det låser fast hur
    // känslig slutsatsen är för antagandena, så att ingen kan ändra
    // mortgageYears eller personalMonths utan att se konsekvensen.
    const at = (personalRate: number, mortgageYears?: number) =>
      calculateBakeIn({
        mortgage: 1_000_000,
        mortgageRate: 0.041,
        personal: 300_000,
        personalRate,
        homeValue: 3_000_000,
        bakeAmount: 300_000,
        mortgageYears,
      }).interestSavedGross;

    // Med olika horisonter (bolån 30 år, blancolån 10 år) ligger break-even
    // långt över bolåneräntan: ett 9 %-lån ser ut som en förlustaffär.
    expect(at(0.09)).toBeLessThan(0);
    expect(at(0.3)).toBeGreaterThan(0);

    // Med samma horisont för båda flyttar break-even ner mot bolåneräntan,
    // vilket är den ekonomiskt väntade brytpunkten.
    expect(at(0.09, 10)).toBeGreaterThan(0);
    expect(at(0.02, 10)).toBeLessThan(0);
  });
});

describe("P0-2: payoff får aldrig påstå 'skuldfri' när skuld återstår", () => {
  it("waterfall: fullyPaid=true kräver att varje enskilt lån är på noll", () => {
    const plans: WaterfallLoan[][] = [
      [mkWaterfallLoan({ id: "a", balance: 50_000, interestRate: 0.05, monthlyPayment: 1_500 })],
      [
        mkWaterfallLoan({ id: "a", balance: 50_000, interestRate: 0.05, monthlyPayment: 1_500 }),
        mkWaterfallLoan({ id: "b", balance: 200_000, interestRate: 0.09, monthlyPayment: 2_500 }),
      ],
      // Ett lån vars betalning inte täcker räntan — planen kan aldrig bli klar.
      [
        mkWaterfallLoan({ id: "a", balance: 10_000, interestRate: 0.05, monthlyPayment: 1_000 }),
        mkWaterfallLoan({ id: "drowning", balance: 500_000, interestRate: 0.2, monthlyPayment: 500 }),
      ],
    ];
    for (const plan of plans) {
      const result = calcWaterfall(plan);
      if (result.fullyPaid) {
        for (const loan of result.loans) {
          expect(loan.remainingBalance).toBe(0);
          expect(loan.fullyPaid).toBe(true);
        }
      }
    }
  });

  it("waterfall: ett lån som inte kan amorteras drar ner hela planen", () => {
    const result = calcWaterfall([
      mkWaterfallLoan({ id: "ok", balance: 10_000, interestRate: 0.05, monthlyPayment: 1_000 }),
      mkWaterfallLoan({ id: "drowning", balance: 500_000, interestRate: 0.2, monthlyPayment: 500 }),
    ]);
    expect(result.fullyPaid).toBe(false);
    expect(result.loans.find((l) => l.id === "drowning")!.fullyPaid).toBe(false);
  });

  it("engine: newFreedomDate är '-' så snart något lån inte blir klart", () => {
    const r = calculatePayoffSchedule({
      loans: [
        mkLoan({ id: "ok", balance: 10_000, interestRate: 0.05, currentMonthlyPayment: 1_000 }),
        mkLoan({ id: "drowning", balance: 500_000, interestRate: 0.2, currentMonthlyPayment: 500 }),
      ],
      oneTimePayments: [],
      startDate: START,
      strategy: "custom",
    });
    expect(r.newFreedomDate).toBe("-");
    expect(r.loanResults.find((l) => l.id === "drowning")!.isFullyAmortizing).toBe(false);
  });

  it("engine: ett avbetalat lån rapporteras aldrig som 'blir aldrig klart'", () => {
    const r = calculatePayoffSchedule({
      loans: [mkLoan({ id: "a", balance: 100_000, interestRate: 0.05, currentMonthlyPayment: 2_000 })],
      oneTimePayments: [{ id: "x", date: "2026-03", amount: 200_000, loanId: "a" }],
      startDate: START,
      strategy: "custom",
    });
    expect(r.loanResults[0].isFullyAmortizing).toBe(true);
    expect(r.loanResults[0].newEndDate).not.toBe("-");
    expect(r.newFreedomDate).not.toBe("-");
  });

  it("projectPayoff: months=600 innebär alltid fullyPaid=false", () => {
    const drowning = projectPayoff(
      mkWaterfallLoan({ id: "d", balance: 500_000, interestRate: 0.2, monthlyPayment: 500 }),
    );
    expect(drowning.fullyPaid).toBe(false);
    expect(drowning.remainingBalance).toBeGreaterThan(0);
  });
});

describe("P0-3: ränteavdrag beror på säkerhet, inte på en klumpsats", () => {
  it("avdraget för lån med säkerhet trappas ned över takbeloppet", () => {
    // Under taket: full sats.
    expect(securedDeduction(50_000)).toBeCloseTo(50_000 * 0.3, 6);
    // Exakt på taket.
    expect(securedDeduction(100_000)).toBeCloseTo(100_000 * 0.3, 6);
    // Över taket: den överskjutande delen får den lägre satsen.
    expect(securedDeduction(150_000)).toBeCloseTo(100_000 * 0.3 + 50_000 * 0.21, 6);
  });

  it("inget avdrag på noll eller negativ ränta", () => {
    expect(securedDeduction(0)).toBe(0);
    expect(securedDeduction(-100)).toBe(0);
  });

  it("nettobesparingen är inte längre bara brutto × 0,7", () => {
    // Den gamla formeln var interestSavedNet = interestSavedGross * 0.7,
    // vilket gav samma avdrag åt blancoränta som åt bolåneränta och därmed
    // sudda ut hela poängen med att flytta skulden mellan dem.
    const result = calculateBakeIn({
      mortgage: 1_000_000,
      mortgageRate: 0.041,
      personal: 300_000,
      personalRate: 0.14,
      homeValue: 3_000_000,
      bakeAmount: 300_000,
    });
    expect(result.interestSavedNet).not.toBeCloseTo(result.interestSavedGross * 0.7, 0);
  });

  it("netto och brutto har alltid samma tecken — en förlust blir inte en vinst efter skatt", () => {
    for (const personalRate of [0.02, 0.05, 0.09, 0.14, 0.2]) {
      const result = calculateBakeIn({
        mortgage: 2_000_000,
        mortgageRate: 0.041,
        personal: 400_000,
        personalRate,
        homeValue: 3_000_000,
        bakeAmount: 400_000,
      });
      if (result.interestSavedGross > 0) {
        expect(result.interestSavedNet).toBeGreaterThan(0);
      } else if (result.interestSavedGross < 0) {
        expect(result.interestSavedNet).toBeLessThan(0);
      }
    }
  });
});

describe("P0-4: rak amortering beräknas konsekvent", () => {
  it("väntefas och fokusfas använder samma amorteringsmodell", () => {
    // Lån 2 står i kö bakom lån 1 och betalar alltså under en väntefas
    // innan det får fokus. Ett rakt amorterat lån ska amortera samma
    // fasta belopp i båda faserna — tidigare bytte väntefasen tyst till
    // annuitetsberäkning när den fasta amorteringen inte var positiv.
    const soloMonths = projectPayoff(
      mkWaterfallLoan({
        id: "b",
        balance: 300_000,
        interestRate: 0.05,
        monthlyPayment: 4_000,
        paymentStyle: "fixed_amort",
      }),
    );
    const inQueue = calcWaterfall([
      mkWaterfallLoan({
        id: "a",
        balance: 20_000,
        interestRate: 0.05,
        monthlyPayment: 2_000,
        paymentStyle: "fixed_amort",
      }),
      mkWaterfallLoan({
        id: "b",
        balance: 300_000,
        interestRate: 0.05,
        monthlyPayment: 4_000,
        paymentStyle: "fixed_amort",
      }),
    ]);
    const b = inQueue.loans.find((l) => l.id === "b")!;
    // Med rollover kan lån B bara bli klart tidigare än ensamt, aldrig senare.
    expect(b.finishesAt).toBeLessThanOrEqual(soloMonths.months);
    expect(b.fullyPaid).toBe(true);
  });

  it("rak amortering överbetalar aldrig sista månaden", () => {
    const result = calcWaterfall([
      mkWaterfallLoan({
        id: "a",
        balance: 100_000,
        interestRate: 0.05,
        monthlyPayment: 9_000,
        paymentStyle: "fixed_amort",
      }),
    ]);
    expect(result.loans[0].remainingBalance).toBe(0);
    expect(result.loans[0].fullyPaid).toBe(true);
  });

  it("rak amortering vars månadskostnad inte täcker räntan blir aldrig klar — i båda motorerna", () => {
    const underwater = {
      id: "u",
      balance: 500_000,
      interestRate: 0.2,
      paymentStyle: "fixed_amort" as const,
    };
    const viaWaterfall = calcWaterfall([
      mkWaterfallLoan({ ...underwater, monthlyPayment: 500 }),
    ]);
    const viaEngine = calculatePayoffSchedule({
      loans: [mkLoan({ ...underwater, loanType: "Rak amortering", currentMonthlyPayment: 500 })],
      oneTimePayments: [],
      startDate: START,
      strategy: "custom",
    });
    expect(viaWaterfall.fullyPaid).toBe(false);
    expect(viaEngine.loanResults[0].isFullyAmortizing).toBe(false);
    expect(viaEngine.loanResults[0].newEndDate).toBe("-");
  });
});

describe("Vyernas siffror måste vara matematiskt förenliga", () => {
  const plan: Loan[] = [
    mkLoan({ id: "kredit", balance: 60_000, interestRate: 0.23, currentMonthlyPayment: 2_500 }),
    mkLoan({ id: "blanco", balance: 180_000, interestRate: 0.085, currentMonthlyPayment: 3_900 }),
    mkLoan({
      id: "bolan",
      balance: 2_128_112,
      interestRate: 0.041,
      currentMonthlyPayment: 8_400,
      loanType: "Rak amortering",
      paymentStyle: "fixed_amort",
    }),
  ];

  const forStrategy = (strategy: "custom" | "avalanche" | "snowball") =>
    calculatePayoffSchedule({
      loans: plan,
      oneTimePayments: [],
      startDate: START,
      strategy,
    });

  it("'Vad är bäst?' jämför två utfall från samma motor och samma lån", () => {
    const avalanche = forStrategy("avalanche");
    const snowball = forStrategy("snowball");
    // Samma lån, samma betalningar — bara prioriteringen skiljer. Därför
    // måste båda innehålla exakt samma uppsättning lån.
    expect(avalanche.loanResults.map((l) => l.id).sort()).toEqual(
      snowball.loanResults.map((l) => l.id).sort(),
    );
    // Och avalanche får aldrig kosta mer ränta än snowball.
    expect(avalanche.totalNewInterest).toBeLessThanOrEqual(snowball.totalNewInterest);
  });

  it("totalsummorna stämmer med delarna i varje strategi", () => {
    for (const strategy of ["custom", "avalanche", "snowball"] as const) {
      const r = forStrategy(strategy);
      const sumNew = r.loanResults.reduce((s, l) => s + l.newTotalInterest, 0);
      const sumOriginal = r.loanResults.reduce((s, l) => s + l.originalTotalInterest, 0);
      expect(r.totalNewInterest).toBe(sumNew);
      expect(r.totalOriginalInterest).toBe(sumOriginal);
      expect(r.totalInterestSaved).toBe(sumOriginal - sumNew);
    }
  });

  it("strategival ändrar aldrig vilka lån som ingår, bara ordningen", () => {
    const ids = plan.map((l) => l.id).sort();
    for (const strategy of ["custom", "avalanche", "snowball"] as const) {
      const r = forStrategy(strategy);
      expect(r.loanResults.map((l) => l.id).sort()).toEqual(ids);
      // payoffOrder måste vara en komplett 1..n-sekvens utan luckor.
      expect(r.loanResults.map((l) => l.payoffOrder).sort((a, b) => a - b)).toEqual(
        plan.map((_, i) => i + 1),
      );
    }
  });

  it("skuldfri-datumet är aldrig tidigare än det sista lånet blir klart", () => {
    for (const strategy of ["custom", "avalanche", "snowball"] as const) {
      const r = forStrategy(strategy);
      if (r.newFreedomDate === "-") continue;
      for (const loan of r.loanResults) {
        expect(loan.newEndDate).not.toBe("-");
        expect(loan.newEndDate <= r.newFreedomDate).toBe(true);
      }
    }
  });

  it("waterfall och engine är eniga om vilka lån som går att betala av", () => {
    // De två motorerna räknar olika (waterfall rullar vidare frigjorda
    // betalningar, engine gör det bara vid uttrycklig återinvestering), så
    // beloppen får skilja sig. Men om engine — som är den försiktigare av
    // dem — får ett lån i mål, måste waterfall också klara det.
    const viaEngine = forStrategy("custom");
    const viaWaterfall = calcWaterfall(
      plan.map((loan) => ({
        id: loan.id,
        name: loan.name,
        balance: loan.balance,
        interestRate: loan.interestRate,
        monthlyPayment: loan.currentMonthlyPayment,
        paymentStyle: loan.paymentStyle,
      })),
    );
    for (const engineLoan of viaEngine.loanResults) {
      if (!engineLoan.isFullyAmortizing) continue;
      const waterfallLoan = viaWaterfall.loans.find((l) => l.id === engineLoan.id)!;
      expect(waterfallLoan.fullyPaid).toBe(true);
    }
  });
});
