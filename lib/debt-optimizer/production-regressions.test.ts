import { describe, expect, it } from "vitest";
import { calculateBakeIn } from "./bake-in";
import {
  addMonths,
  MAX_MONTHS,
  simulatePlan,
  type PlanLoan,
} from "./canonical";
import type { PayoffStrategy } from "./types";

/**
 * Felen som fanns i appen när den var på väg att släppas. Varje test här
 * motsvarar något som faktiskt var trasigt för en användare — inte en
 * hypotes om vad som skulle kunna gå sönder.
 */

const START = "2026-08";

const loan = (over: Partial<PlanLoan> & { id: string }): PlanLoan => ({
  name: over.id,
  balance: 100_000,
  interestRate: 0.05,
  paymentStyle: "annuity",
  monthlyPayment: 2_000,
  ...over,
});

const run = (
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

describe("varje lån går att beskriva utan att hitta på ett datum", () => {
  it("ger endDate för varje betalt lån, aldrig NaN", () => {
    // Vyerna räknade tidigare fram datumet själva ur ett fält som inte fanns
    // (`finishesAt`), vilket gav Invalid Date och tog ner hela sidan.
    const result = run([
      loan({ id: "a", balance: 20_000, monthlyPayment: 2_000 }),
      loan({ id: "b", balance: 50_000, monthlyPayment: 1_500 }),
    ]);
    for (const row of result.loans) {
      expect(row.fullyPaid).toBe(true);
      expect(row.endDate).toMatch(/^\d{4}-\d{2}$/);
      expect(row.finishMonth).not.toBeNull();
    }
    expect(result.freedomDate).toMatch(/^\d{4}-\d{2}$/);
  });

  it("markerar ett lån som inte går att betala av utan att låtsas om ett datum", () => {
    const result = run([
      loan({ id: "drowning", balance: 100_000, interestRate: 0.2, monthlyPayment: 500 }),
    ]);
    expect(result.loans[0].fullyPaid).toBe(false);
    expect(result.loans[0].endDate).toBe("-");
    expect(result.fullyPaid).toBe(false);
    expect(result.freedomDate).toBe("-");
    expect(result.totalMonths).toBe(MAX_MONTHS);
  });

  it("håller ihop focusMonths och waitMonths med den faktiska livslängden", () => {
    const result = run([
      loan({ id: "first", balance: 30_000, monthlyPayment: 3_000 }),
      loan({ id: "second", balance: 60_000, monthlyPayment: 2_000 }),
    ]);
    for (const row of result.loans) {
      const alive = (row.finishMonth ?? MAX_MONTHS) + 1;
      expect(row.focusMonths + row.waitMonths).toBe(alive);
    }
  });
});

describe("frigjorda pengar", () => {
  it("rullar vidare det egna påslaget, inte bara grundbetalningen", () => {
    // Det extra man betalar varje månad försvann tidigare när lånet blev
    // klart, i stället för att gå vidare till nästa lån.
    const loans = [
      loan({
        id: "small",
        balance: 20_000,
        monthlyPayment: 2_000,
        extraMonthly: 3_000,
        extraMonthlyEnabled: true,
      }),
      loan({ id: "big", balance: 200_000, monthlyPayment: 3_000 }),
    ];
    const withExtra = run(loans);
    const withoutExtra = run(
      loans.map((l) => ({ ...l, extraMonthlyEnabled: false })),
    );
    expect(withExtra.totalMonths).toBeLessThan(withoutExtra.totalMonths);

    const big = withExtra.loans.find((l) => l.id === "big")!;
    const bigAlone = withoutExtra.loans.find((l) => l.id === "big")!;
    expect(big.finishMonth!).toBeLessThan(bigAlone.finishMonth!);
  });

  it("frigör amorteringen, inte amortering plus ränta, vid rak amortering", () => {
    // Vid rak amortering är räntedelen i praktiken borta när lånet är slut.
    // Att rulla vidare hela den ursprungliga månadskostnaden vore att flytta
    // pengar som inte finns.
    const balance = 120_000;
    const rate = 0.06;
    const principalPart = 2_000;
    const straight = loan({
      id: "straight",
      balance,
      interestRate: rate,
      paymentStyle: "fixed_amort",
      monthlyPayment: principalPart + (balance * rate) / 12,
    });
    const next = loan({ id: "next", balance: 300_000, monthlyPayment: 4_000 });

    const rolled = run([straight, next]);
    const straightRow = rolled.loans.find((l) => l.id === "straight")!;

    // Samma plan, men med den frigjorda amorteringen inlagd för hand som en
    // uttrycklig återinvestering från månaden efter att lånet är klart.
    const byHand = run(
      [
        straight,
        {
          ...next,
          reinvestment: {
            enabled: true,
            fromLoanId: "straight",
            amount: principalPart,
            startDate: addMonths(straightRow.endDate, 1),
          },
        },
      ],
      "custom",
      false,
    );

    expect(rolled.loans.find((l) => l.id === "next")!.finishMonth).toBe(
      byHand.loans.find((l) => l.id === "next")!.finishMonth,
    );
  });

  it("rollover och en manuell återinvestering flyttar inte samma pengar två gånger", () => {
    // Exempeldatan la in en återinvesteringsregel på exakt det belopp som
    // rollovern redan flyttade. Bolånet fick då 11 400 kr/mån i stället för
    // 5 700, och appen visade ett skuldfritt datum 6,5 år för tidigt.
    const source = loan({
      id: "source",
      balance: 180_000,
      interestRate: 0.085,
      monthlyPayment: 3_900,
      extraMonthly: 1_800,
      extraMonthlyEnabled: true,
    });
    const target = loan({
      id: "target",
      balance: 2_128_112,
      interestRate: 0.041,
      paymentStyle: "fixed_amort",
      monthlyPayment: 8_400,
      extraMonthly: 2_500,
      extraMonthlyEnabled: true,
    });

    const rolloverOnly = run([target, source]);
    const both = run([
      {
        ...target,
        reinvestment: {
          enabled: true,
          fromLoanId: "source",
          amount: 5_700,
          startDate: START,
        },
      },
      source,
    ]);

    // Med båda kanalerna igång blir planen orimligt mycket snabbare. Appen
    // ska aldrig mata in dem samtidigt.
    expect(both.totalMonths).toBeLessThan(rolloverOnly.totalMonths);
    expect(rolloverOnly.totalMonths).toBeGreaterThan(240);
  });

  it("rollover gör planen snabbare än utan rollover, aldrig långsammare", () => {
    const loans = [
      loan({ id: "a", balance: 40_000, monthlyPayment: 2_500 }),
      loan({ id: "b", balance: 90_000, monthlyPayment: 2_000 }),
    ];
    expect(run(loans, "custom", true).totalMonths).toBeLessThan(
      run(loans, "custom", false).totalMonths,
    );
  });
});

describe("alla vyer räknar på samma sätt", () => {
  it("samma lån och samma inställningar ger samma svar oavsett vem som frågar", () => {
    // Två flikar körde tidigare motorn med olika rollover-inställning, så
    // samma lån fick olika skuldfri-datum beroende på var man tittade.
    const loans = [
      loan({ id: "card", balance: 30_000, interestRate: 0.22, monthlyPayment: 1_200 }),
      loan({ id: "personal", balance: 150_000, interestRate: 0.08, monthlyPayment: 3_000 }),
    ];
    const a = run(loans, "custom", true);
    const b = run(loans, "custom", true);
    expect(a.freedomDate).toBe(b.freedomDate);
    expect(a.totalInterest).toBe(b.totalInterest);
  });

  it("avalanche kostar aldrig mer ränta än snowball", () => {
    const loans = [
      loan({ id: "big-cheap", balance: 400_000, interestRate: 0.03, monthlyPayment: 4_000 }),
      loan({ id: "small-expensive", balance: 30_000, interestRate: 0.24, monthlyPayment: 1_000 }),
    ];
    const avalanche = run(loans, "avalanche");
    const snowball = run(loans, "snowball");
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
  });
});

describe("ett lån med en inplanerad höjning skrivs inte av i förväg", () => {
  it("betalas av när höjningen slår till, trots att räntan inte täcks innan", () => {
    // Ett lån som inte kan amorteras just nu låstes tidigare för gott, även
    // när användaren hade en höjning inlagd längre fram.
    const result = run([
      loan({
        id: "later",
        balance: 50_000,
        interestRate: 0.12,
        monthlyPayment: 400,
        targetMonthlyTotal: 3_000,
        targetMonthlyEnabled: true,
        targetMonthlyFrom: "2027-08",
      }),
    ]);
    expect(result.loans[0].fullyPaid).toBe(true);
  });
});

describe("baka in i bolånet", () => {
  const base = {
    mortgage: 2_128_112,
    mortgageRate: 0.041,
    personal: 180_000,
    personalRate: 0.085,
    homeValue: 3_027_201,
    startDate: START,
  };

  it("de två scenarierna skiljer sig åt i månadskostnad", () => {
    // Båda scenarierna räknade tidigare fram samma månadsbelopp, så valet
    // mellan dem var meningslöst.
    const result = calculateBakeIn({ ...base, bakeAmount: 180_000 });
    expect(result.scenarios.minimumPayment.monthlyPayment).toBeLessThan(
      result.scenarios.keepPaying.monthlyPayment,
    );
  });

  it("att betala som idag ger ett tidigare datum än att sänka kostnaden", () => {
    const result = calculateBakeIn({ ...base, bakeAmount: 180_000 });
    expect(result.scenarios.keepPaying.months).toBeLessThan(
      result.scenarios.minimumPayment.months,
    );
    expect(result.scenarios.keepPaying.interestSavedGross!).toBeGreaterThan(
      result.scenarios.minimumPayment.interestSavedGross!,
    );
  });

  it("håller månadskostnaden oförändrad i keepPaying", () => {
    const result = calculateBakeIn({ ...base, bakeAmount: 180_000 });
    expect(result.scenarios.keepPaying.monthlyDelta).toBeCloseTo(0, 6);
  });

  it("ger ett riktigt datum, inte ett räknat på en tom nämnare", () => {
    const result = calculateBakeIn({ ...base, bakeAmount: 100_000 });
    for (const scenario of Object.values(result.scenarios)) {
      expect(scenario.feasible).toBe(true);
      expect(scenario.debtFreeDate).toMatch(/^\d{4}-\d{2}$/);
      expect(Number.isFinite(scenario.months)).toBe(true);
    }
  });

  it("scenariernas datum ändras inte med dagens datum", () => {
    // Slutdatumet räknades tidigare från `new Date()` medan resten av appen
    // utgår från planens startmånad. Två siffror i samma vy kom då ur olika
    // kalendrar.
    const a = calculateBakeIn({ ...base, bakeAmount: 50_000, startDate: "2026-08" });
    const b = calculateBakeIn({ ...base, bakeAmount: 50_000, startDate: "2030-01" });
    expect(a.scenarios.keepPaying.debtFreeDate).not.toBe(
      b.scenarios.keepPaying.debtFreeDate,
    );
    expect(a.scenarios.keepPaying.months).toBe(b.scenarios.keepPaying.months);
  });

  it("räknar blancoränta utan avdrag och bolåneränta med", () => {
    // Med samma avdragssats på båda sidor försvinner hela poängen med att
    // flytta skulden — eller så överdrivs den.
    const result = calculateBakeIn({ ...base, bakeAmount: 180_000 });
    expect(result.scenarios.keepPaying.interestSavedNet!).not.toBeCloseTo(
      result.scenarios.keepPaying.interestSavedGross!,
      0,
    );
  });

  it("säger ifrån när belåningsgraden passerar 85 %", () => {
    const result = calculateBakeIn({
      ...base,
      homeValue: 2_400_000,
      bakeAmount: 180_000,
    });
    expect(result.warningLtv).toBe(true);
    expect(result.warningText).toBeTruthy();
  });

  it("jämför mot vad användaren faktiskt betalar, inte mot en antagen annuitet", () => {
    // Baslinjen antog en 10-årig annuitet på blancolånet och enbart
    // lagkravet på bolånet. "Betala som idag" jämfördes då mot ett belopp
    // användaren aldrig betalat, och skilde sig från siffran i "Mina lån".
    const withRealPayments = calculateBakeIn({
      ...base,
      bakeAmount: 180_000,
      mortgageMonthlyPayment: 10_900,
      personalMonthlyPayment: 5_700,
    });
    expect(withRealPayments.todayMonthly).toBeCloseTo(16_600, 0);
    expect(withRealPayments.scenarios.keepPaying.monthlyPayment).toBeCloseTo(
      16_600,
      0,
    );
  });

  it("låter aldrig bolånets betalning underskrida lagkravet plus ränta", () => {
    const result = calculateBakeIn({
      ...base,
      bakeAmount: 0,
      mortgageMonthlyPayment: 100,
    });
    const legalMinimum =
      (base.mortgage * 0.02) / 12 + (base.mortgage * base.mortgageRate) / 12;
    expect(result.todayMonthly).toBeGreaterThanOrEqual(legalMinimum);
  });

  it("svarar 'går inte att jämföra' i stället för att vända tecknet", () => {
    // payOff returnerade noll ränta när betalningen inte täckte räntan. Den
    // nollan drog ner dagens totalkostnad så att en inbakning som sparade
    // pengar redovisades som en förlust.
    const result = calculateBakeIn({
      mortgage: 500_000,
      mortgageRate: 0.04,
      personal: 300_000,
      personalRate: 0.25,
      personalMonthlyPayment: 100,
      homeValue: 5_000_000,
      bakeAmount: 0,
      startDate: START,
    });
    expect(result.todayFeasible).toBe(false);
    expect(result.todayDebtFreeDate).toBe("-");
    expect(result.scenarios.keepPaying.interestSavedGross).toBeNull();
    expect(result.scenarios.keepPaying.interestSavedNet).toBeNull();
  });

  it("noll inbakat lämnar allt som det är", () => {
    const result = calculateBakeIn({ ...base, bakeAmount: 0 });
    expect(result.bake).toBe(0);
    expect(result.newMortgage).toBe(base.mortgage);
    expect(result.scenarios.keepPaying.monthlyDelta).toBeCloseTo(0, 6);
  });
});
