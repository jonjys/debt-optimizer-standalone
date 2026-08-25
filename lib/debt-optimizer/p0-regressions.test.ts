import { describe, it, expect } from "vitest";
import { calculateBakeIn, securedDeduction } from "./bake-in";
import { MAX_MONTHS, simulatePlan, type PlanLoan } from "./canonical";
import type { PayoffStrategy } from "./types";

/**
 * Regressionsskydd för de fyra P0-fel som hittades i granskningen av V8.
 * Varje describe-block motsvarar ett av dem och namnger felet, så att en
 * framtida omskrivning inte tyst kan återinföra det.
 */

const START = "2026-01";

function mkLoan(over: Partial<PlanLoan> & Pick<PlanLoan, "id">): PlanLoan {
  return {
    name: over.id,
    paymentStyle: "annuity",
    balance: 0,
    interestRate: 0,
    monthlyPayment: 0,
    ...over,
  };
}

const plan = (
  loans: PlanLoan[],
  strategy: PayoffStrategy = "custom",
  rollover = true,
) =>
  simulatePlan({
    loans,
    strategy,
    startDate: START,
    oneTimePayments: [],
    rollover,
  });

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


describe("P0-2: en plan får aldrig påstå 'skuldfri' när skuld återstår", () => {
  it("fullyPaid kräver att varje enskilt lån är på noll", () => {
    // Utan rollover finns inga frigjorda pengar som kan rädda lånet som
    // drunknar, och då får planen inte kallas skuldfri.
    const result = plan(
      [
        mkLoan({ id: "ok", balance: 20_000, interestRate: 0.05, monthlyPayment: 2_000 }),
        mkLoan({
          id: "drowning",
          balance: 900_000,
          interestRate: 0.24,
          monthlyPayment: 900,
        }),
      ],
      "custom",
      false,
    );
    expect(result.loans.find((l) => l.id === "drowning")!.fullyPaid).toBe(false);
    expect(result.fullyPaid).toBe(false);
    expect(result.freedomDate).toBe("-");
  });

  it("rollover kan rädda ett lån som inte klarar sig självt", () => {
    // Samma lån som ovan, men nu går de frigjorda pengarna vidare. Att då
    // rapportera det som olösligt vore lika fel som motsatsen.
    const loans = [
      mkLoan({ id: "ok", balance: 20_000, interestRate: 0.05, monthlyPayment: 2_000 }),
      mkLoan({
        id: "rescued",
        balance: 90_000,
        interestRate: 0.24,
        monthlyPayment: 900,
      }),
    ];
    expect(plan(loans, "custom", true).fullyPaid).toBe(true);
    expect(plan(loans, "custom", false).fullyPaid).toBe(false);
  });

  it("ett lån som inte kan amorteras drar ner hela planen", () => {
    const result = plan([
      mkLoan({ id: "stuck", balance: 50_000, interestRate: 0.3, monthlyPayment: 100 }),
    ]);
    expect(result.fullyPaid).toBe(false);
    expect(result.totalMonths).toBe(MAX_MONTHS);
  });

  it("ett avbetalat lån rapporteras aldrig som 'blir aldrig klart'", () => {
    const result = plan([
      mkLoan({ id: "fine", balance: 12_000, interestRate: 0.05, monthlyPayment: 1_500 }),
    ]);
    expect(result.loans[0].fullyPaid).toBe(true);
    expect(result.loans[0].endDate).not.toBe("-");
    expect(result.totalMonths).toBeLessThan(MAX_MONTHS);
  });

  it("ett lån utan saldo räknas som klart, inte som olöst", () => {
    const result = plan([
      mkLoan({ id: "empty", balance: 0, interestRate: 0.05, monthlyPayment: 500 }),
    ]);
    expect(result.fullyPaid).toBe(true);
  });
});

describe("P0-4: rak amortering beräknas konsekvent", () => {
  it("väntefas och fokusfas använder samma amorteringsmodell", () => {
    // Amorteringen får inte ändra karaktär bara för att lånet råkar ligga
    // först i kön och får rollover. Ett lån som ligger sist ska betalas av
    // med exakt samma amorteringsdel som när det ligger ensamt.
    const straight = mkLoan({
      id: "straight",
      balance: 120_000,
      interestRate: 0.06,
      paymentStyle: "fixed_amort",
      monthlyPayment: 2_000 + (120_000 * 0.06) / 12,
    });
    const alone = plan([straight]);
    const behindOthers = plan(
      [
        mkLoan({ id: "first", balance: 400_000, interestRate: 0.05, monthlyPayment: 3_000 }),
        straight,
      ],
      "custom",
      false,
    );
    expect(behindOthers.loans.find((l) => l.id === "straight")!.finishMonth).toBe(
      alone.loans[0].finishMonth,
    );
  });

  it("rak amortering överbetalar aldrig sista månaden", () => {
    const result = plan([
      mkLoan({
        id: "straight",
        balance: 10_000,
        interestRate: 0.05,
        paymentStyle: "fixed_amort",
        monthlyPayment: 3_000 + (10_000 * 0.05) / 12,
      }),
    ]);
    expect(result.loans[0].remainingBalance).toBe(0);
    expect(result.loans[0].fullyPaid).toBe(true);
  });

  it("rak amortering vars månadskostnad inte täcker räntan blir aldrig klar", () => {
    const result = plan([
      mkLoan({
        id: "underwater",
        balance: 200_000,
        interestRate: 0.1,
        paymentStyle: "fixed_amort",
        monthlyPayment: 500,
      }),
    ]);
    expect(result.loans[0].fullyPaid).toBe(false);
    expect(result.fullyPaid).toBe(false);
  });
});

describe("Vyernas siffror måste vara matematiskt förenliga", () => {
  const sample = () => [
    mkLoan({ id: "card", balance: 40_000, interestRate: 0.22, monthlyPayment: 1_500 }),
    mkLoan({ id: "personal", balance: 180_000, interestRate: 0.085, monthlyPayment: 3_900 }),
    mkLoan({ id: "mortgage", balance: 900_000, interestRate: 0.041, monthlyPayment: 6_000 }),
  ];

  it("'Vad är bäst?' jämför utfall från samma motor och samma lån", () => {
    const avalanche = plan(sample(), "avalanche");
    const snowball = plan(sample(), "snowball");
    expect(avalanche.loans.map((l) => l.id).sort()).toEqual(
      snowball.loans.map((l) => l.id).sort(),
    );
  });

  it("totalsummorna stämmer med delarna i varje strategi", () => {
    for (const strategy of ["custom", "avalanche", "snowball"] as const) {
      const result = plan(sample(), strategy);
      const sum = result.loans.reduce((total, l) => total + l.totalInterest, 0);
      expect(result.totalInterest).toBe(sum);
    }
  });

  it("strategival ändrar aldrig vilka lån som ingår, bara ordningen", () => {
    const custom = plan(sample(), "custom");
    const avalanche = plan(sample(), "avalanche");
    expect(custom.loans.length).toBe(avalanche.loans.length);
    expect(new Set(custom.loans.map((l) => l.id))).toEqual(
      new Set(avalanche.loans.map((l) => l.id)),
    );
  });

  it("skuldfri-datumet är aldrig tidigare än det sista lånet blir klart", () => {
    const result = plan(sample(), "avalanche");
    const last = Math.max(...result.loans.map((l) => l.finishMonth ?? 0));
    expect(result.totalMonths).toBe(last + 1);
  });

  it("avalanche sorterar efter ränta och snowball efter saldo", () => {
    const avalanche = plan(sample(), "avalanche");
    const snowball = plan(sample(), "snowball");
    expect(avalanche.loans.map((l) => l.id)).toEqual([
      "card",
      "personal",
      "mortgage",
    ]);
    expect(snowball.loans.map((l) => l.id)).toEqual([
      "card",
      "personal",
      "mortgage",
    ]);
  });
});
