/**
 * Svenska amorteringsregler (LTV-trappan från apr 2026).
 * Skuldkvotstillägget är borttaget — endast belåningsgrad styr lagkrav.
 *
 * LTV > 70%  → 2 %/år
 * LTV 50–70% → 1 %/år
 * LTV < 50%  → 0 % lagkrav
 */
export type LtvBand = "none" | "one" | "two" | "over85";

export function amortPctFromLtv(ltv: number): number {
  if (ltv > 0.7) return 0.02;
  if (ltv > 0.5) return 0.01;
  return 0;
}

export function ltvBand(ltv: number): LtvBand {
  if (ltv > 0.85) return "over85";
  if (ltv > 0.7) return "two";
  if (ltv > 0.5) return "one";
  return "none";
}

export function bandLabel(band: LtvBand, lang: "sv" | "en" = "sv"): string {
  const text: Record<LtvBand, { sv: string; en: string }> = {
    over85: {
      sv: "Över 85 % — banken nekar ofta eller ställer extra krav",
      en: "Above 85% — banks often decline or add requirements",
    },
    two: {
      sv: "2 % amorteringskrav gäller",
      en: "2% minimum amortisation applies",
    },
    one: {
      sv: "1 % amorteringskrav gäller",
      en: "1% minimum amortisation applies",
    },
    none: {
      sv: "Inget lagkrav på amortering",
      en: "No minimum amortisation required",
    },
  };
  return text[band][lang];
}

export interface BakeInInput {
  mortgage: number;
  mortgageRate: number;
  personal: number;
  personalRate: number;
  homeValue: number;
  bakeAmount: number;
  mortgageYears?: number;
  personalMonths?: number;
  /** YYYY-MM som scenariernas slutdatum räknas från. */
  startDate?: string;
  /**
   * Vad användaren faktiskt betalar idag. Utan dem antas lagkravet på
   * amortering för bolånet och en 10-årig annuitet för blancolånet, vilket
   * sällan är vad någon betalar — och då jämför "betala som idag" mot något
   * annat än idag.
   */
  mortgageMonthlyPayment?: number;
  personalMonthlyPayment?: number;
}

export interface BakeInScenario {
  /** Vad användaren betalar per månad i det här scenariot. */
  monthlyPayment: number;
  /** Skillnad mot dagens månadskostnad. Negativt = billigare per månad. */
  monthlyDelta: number;
  months: number;
  debtFreeDate: string;
  /** Går skulden att betala av inom taket? */
  feasible: boolean;
  totalInterest: number;
  /**
   * Skillnad mot dagens ränta. `null` när jämförelsen inte är meningsfull —
   * antingen för att scenariot inte går ihop eller för att dagens betalning
   * inte gör det. Att svara med en siffra ändå ger fel tecken.
   */
  interestSavedGross: number | null;
  interestSavedNet: number | null;
}

export interface BakeInResult {
  bake: number;
  personalLeft: number;
  newMortgage: number;
  ltvBefore: number;
  ltvAfter: number;
  bandBefore: LtvBand;
  bandAfter: LtvBand;
  amortBefore: number;
  amortAfter: number;
  amortKrBefore: number;
  amortKrAfter: number;
  amortKrDelta: number;
  interestMortMonthBefore: number;
  interestMortMonthAfter: number;
  personalMonthBefore: number;
  personalMonthAfter: number;
  monthBefore: number;
  monthAfter: number;
  monthDelta: number;
  totalIntBefore: number;
  totalIntAfter: number;
  interestSavedGross: number;
  interestSavedNet: number;
  warningLtv: boolean;
  /** Nyckel för varningen, så att vyn kan skriva den på användarens språk. */
  warning: "over85" | "crosses70" | null;
  warningText: string | null;
  summaryLine: string;

  /** Dagens läge, som scenarierna mäts mot. */
  todayMonthly: number;
  todayMonths: number;
  todayDebtFreeDate: string;
  /** Går dagens upplägg över huvud taget ihop? */
  todayFeasible: boolean;
  /**
   * Inbakningen har två helt olika utfall beroende på vad du gör med
   * pengarna du frigör. Att bara visa ett av dem gör affären antingen
   * bättre eller sämre än den är.
   */
  scenarios: {
    /** Fortsätt betala lika mycket per månad — bli klar tidigare. */
    keepPaying: BakeInScenario;
    /** Betala bara det som krävs — lägre månadskostnad, längre tid. */
    minimumPayment: BakeInScenario;
  };
}

/**
 * Ränteavdrag beror på om lånet har säkerhet eller inte.
 *
 * Bolån och andra lån med säkerhet: 30 % avdrag upp till takbeloppet i
 * ränteutgifter per år, 21 % på överskjutande del.
 *
 * Blancolån och annan konsumtionskredit utan säkerhet: avdraget trappas ned
 * och försvinner. Satsen ligger i en egen konstant just för att den ändras
 * mellan åren — den ska stämmas av mot Skatteverket inför varje årsskifte,
 * inte antas.
 *
 * Poängen med att skilja dem åt: när ett blancolån bakas in i bolånet
 * flyttas räntan från en icke avdragsgill skuld till en avdragsgill. Räknar
 * man med samma avdragssats på båda sidor försvinner exakt den effekt som
 * gör inbakningen värd att göra — eller så överdrivs den.
 */
export const SECURED_DEDUCTION_RATE = 0.3;
export const SECURED_DEDUCTION_RATE_ABOVE_CAP = 0.21;
export const SECURED_DEDUCTION_CAP_PER_YEAR = 100_000;
/** Avdrag för lån utan säkerhet. Nedtrappat — verifiera mot aktuellt taxeringsår. */
export const UNSECURED_DEDUCTION_RATE = 0;

/** Skattelättnaden på en årlig ränteutgift för ett lån MED säkerhet. */
export function securedDeduction(annualInterest: number): number {
  if (!(annualInterest > 0)) return 0;
  const belowCap = Math.min(annualInterest, SECURED_DEDUCTION_CAP_PER_YEAR);
  const aboveCap = Math.max(0, annualInterest - SECURED_DEDUCTION_CAP_PER_YEAR);
  return (
    belowCap * SECURED_DEDUCTION_RATE + aboveCap * SECURED_DEDUCTION_RATE_ABOVE_CAP
  );
}

/** Ränta efter skatt för ett lån med säkerhet, över `years` år. */
function securedAfterTax(totalInterest: number, years: number): number {
  if (!(years > 0)) return totalInterest;
  const perYear = totalInterest / years;
  return (perYear - securedDeduction(perYear)) * years;
}

/** Ränta efter skatt för ett lån utan säkerhet. */
function unsecuredAfterTax(totalInterest: number): number {
  return totalInterest * (1 - UNSECURED_DEDUCTION_RATE);
}

function annuity(balance: number, annualRate: number, months: number): number {
  if (balance <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return balance / months;
  return (balance * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function mortgageInterestEstimate(
  principal: number,
  annualRate: number,
  amortPct: number,
  years: number
): number {
  const annualAmort = principal * amortPct;
  const endBal = Math.max(0, principal - annualAmort * years);
  const avgBal = (principal + endBal) / 2;
  return avgBal * annualRate * years;
}

export const MAX_SCENARIO_MONTHS = 600;

/**
 * Betala av ett lån med en fast månadskostnad. Returnerar `feasible: false`
 * när betalningen inte ens täcker räntan — då växer skulden, och att svara
 * med ett antal månader ändå hade varit att hitta på ett datum.
 */
function payOff(
  balance: number,
  annualRate: number,
  monthlyPayment: number
): { months: number; totalInterest: number; feasible: boolean } {
  if (balance <= 0) return { months: 0, totalInterest: 0, feasible: true };
  const monthlyRate = annualRate / 12;
  if (monthlyPayment <= balance * monthlyRate)
    // Räntan täcks inte, så skulden växer. Noll ränta hade varit det mest
    // missvisande svaret av alla: den siffran drog ner dagens totalkostnad
    // och vände tecknet på hela besparingen.
    return {
      months: MAX_SCENARIO_MONTHS,
      totalInterest: Number.POSITIVE_INFINITY,
      feasible: false,
    };
  let remaining = balance;
  let interest = 0;
  let months = 0;
  while (remaining > 0 && months < MAX_SCENARIO_MONTHS) {
    const due = remaining * monthlyRate;
    interest += due;
    remaining = remaining + due - monthlyPayment;
    months += 1;
  }
  return {
    months,
    totalInterest: interest,
    feasible: remaining <= 0,
  };
}

function addMonthsTo(ym: string, count: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + count, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function calculateBakeIn(input: BakeInInput): BakeInResult {
  const years = input.mortgageYears ?? 30;
  const personalMonths = input.personalMonths ?? 120;
  const bake = Math.min(Math.max(0, input.bakeAmount), input.personal);
  const personalLeft = input.personal - bake;
  const newMortgage = input.mortgage + bake;

  const ltvBefore = input.homeValue > 0 ? input.mortgage / input.homeValue : 0;
  const ltvAfter = input.homeValue > 0 ? newMortgage / input.homeValue : 0;

  const amortBefore = amortPctFromLtv(ltvBefore);
  const amortAfter = amortPctFromLtv(ltvAfter);
  const bandBefore = ltvBand(ltvBefore);
  const bandAfter = ltvBand(ltvAfter);

  const amortKrBefore = (input.mortgage * amortBefore) / 12;
  const amortKrAfter = (newMortgage * amortAfter) / 12;
  const amortKrDelta = amortKrAfter - amortKrBefore;

  const interestMortMonthBefore = (input.mortgage * input.mortgageRate) / 12;
  const interestMortMonthAfter = (newMortgage * input.mortgageRate) / 12;

  // Dagens betalning på blancolånet är den användaren angett. Faller vi
  // tillbaka på en 10-årig annuitet jämförs "betala som idag" mot ett belopp
  // användaren aldrig betalat.
  const personalMonthBefore =
    input.personalMonthlyPayment && input.personalMonthlyPayment > 0
      ? input.personalMonthlyPayment
      : annuity(input.personal, input.personalRate, personalMonths);
  // Efter inbakningen krymper blancolånet. Betalningen skalas ned i samma
  // takt, men aldrig under vad som krävs för att den ska kunna betalas av.
  const personalMonthAfter =
    input.personal > 0
      ? (personalMonthBefore * personalLeft) / input.personal
      : 0;

  const mortgageMonthBefore =
    input.mortgageMonthlyPayment && input.mortgageMonthlyPayment > 0
      ? Math.max(
          input.mortgageMonthlyPayment,
          amortKrBefore + interestMortMonthBefore,
        )
      : amortKrBefore + interestMortMonthBefore;

  const monthBefore = mortgageMonthBefore + personalMonthBefore;
  const monthAfter = amortKrAfter + interestMortMonthAfter + personalMonthAfter;

  const mortIntBefore = mortgageInterestEstimate(input.mortgage, input.mortgageRate, amortBefore, years);
  const mortIntAfter = mortgageInterestEstimate(newMortgage, input.mortgageRate, amortAfter, years);
  const persIntBefore = Math.max(0, personalMonthBefore * personalMonths - input.personal);
  const persIntAfter = Math.max(0, personalMonthAfter * personalMonths - personalLeft);

  const totalIntBefore = mortIntBefore + persIntBefore;
  const totalIntAfter = mortIntAfter + persIntAfter;
  const interestSavedGross = totalIntBefore - totalIntAfter;

  // Netto räknas per lånetyp, inte som en klumpsumma: bolåneräntan är
  // avdragsgill, blancoräntan (i praktiken) inte. Att baka in flyttar ränta
  // mellan de två — det är hela poängen med affären, och den effekten
  // försvinner om man lägger samma avdragssats på båda sidor.
  const netBefore =
    securedAfterTax(mortIntBefore, years) + unsecuredAfterTax(persIntBefore);
  const netAfter =
    securedAfterTax(mortIntAfter, years) + unsecuredAfterTax(persIntAfter);
  const interestSavedNet = netBefore - netAfter;

  const warningLtv = ltvAfter > 0.85;
  // Texten byggs i vyn: den här filen vet ingenting om vilket språk
  // användaren läser på, och en svensk mening mitt i den engelska vyn är
  // lika fel som en felaktig siffra.
  const warning: BakeInResult["warning"] =
    ltvAfter > 0.85
      ? "over85"
      : ltvAfter > 0.7 && ltvBefore <= 0.7
        ? "crosses70"
        : null;
  const warningText =
    warning === "over85"
      ? "Banken kräver ofta extra amortering eller nekar belåning över 85%"
      : warning === "crosses70"
        ? "LTV korsar 70% — amorteringskravet hoppar till 2%/år på hela bolånet"
        : null;

  const fmt = (n: number) => Math.round(n).toLocaleString("sv-SE");
  // En förlust MÅSTE skrivas ut som en förlust. Tidigare föll allt som inte
  // var en vinst ner i "Dra slidern för att se effekt", så en inbakning som
  // kostade pengar — vilket händer så fort belåningsgraden passerar en
  // amorteringströskel — såg ut som att den inte gjorde någonting alls.
  const summaryLine =
    bake <= 0
      ? "Dra slidern för att se effekt."
      : interestSavedGross > 0
        ? `Baka in ${fmt(bake)} kr → sparar ca ${fmt(interestSavedGross)} kr brutto (${fmt(interestSavedNet)} kr efter ränteavdrag). Månad ${fmt(monthBefore)} → ${fmt(monthAfter)} kr.`
        : interestSavedGross < 0
          ? `Baka in ${fmt(bake)} kr → kostar dig ca ${fmt(Math.abs(interestSavedGross))} kr mer i ränta (${fmt(Math.abs(interestSavedNet))} kr efter ränteavdrag). Månad ${fmt(monthBefore)} → ${fmt(monthAfter)} kr.`
          : `Baka in ${fmt(bake)} kr → varken sparar eller kostar något i ränta. Månad ${fmt(monthBefore)} → ${fmt(monthAfter)} kr.`;

  /**
   * Två scenarier, för att inbakningen har två helt olika utfall beroende på
   * vad du gör med pengarna den frigör:
   *
   *   keepPaying      — du fortsätter betala samma summa varje månad. Det som
   *                     blir över när blancolånet krympt går till bolånet, och
   *                     du blir klar tidigare.
   *   minimumPayment  — du sänker till lägsta tillåtna: lagkravet på
   *                     amortering plus ränta på bolånet, och annuiteten på
   *                     det blancolån som är kvar. Billigare i månaden,
   *                     dyrare totalt.
   */
  const startDate = input.startDate ?? "2026-08";
  const scenarioFrom = (
    mortgagePayment: number,
    personalPayment: number
  ): BakeInScenario => {
    const onMortgage = payOff(newMortgage, input.mortgageRate, mortgagePayment);
    const onPersonal = payOff(personalLeft, input.personalRate, personalPayment);
    const feasible = onMortgage.feasible && onPersonal.feasible;
    const months = Math.max(onMortgage.months, onPersonal.months);
    const totalInterest = onMortgage.totalInterest + onPersonal.totalInterest;
    // Avdragstaket gäller per år, så räntan måste slås ut över det egna
    // lånets löptid. Med den kombinerade löptiden ser årsräntan lägre ut än
    // den är och avdraget överskattas.
    const netAfterTax =
      securedAfterTax(
        onMortgage.totalInterest,
        Math.max(1, onMortgage.months / 12),
      ) + unsecuredAfterTax(onPersonal.totalInterest);
    const monthlyPayment = mortgagePayment + personalPayment;
    // En jämförelse kräver att båda sidor går att räkna. Går dagens upplägg
    // inte ihop finns ingen ränta att jämföra mot.
    const comparable = feasible && todayFeasible;
    return {
      monthlyPayment,
      monthlyDelta: monthlyPayment - monthBefore,
      months,
      debtFreeDate: feasible ? addMonthsTo(startDate, months - 1) : "-",
      feasible,
      totalInterest,
      interestSavedGross: comparable ? todayTotalInterest - totalInterest : null,
      interestSavedNet: comparable ? todayNet - netAfterTax : null,
    };
  };

  // Dagens läge räknat med exakt samma metod som scenarierna, så att
  // "sparad ränta" jämför två tal som är framtagna på samma sätt.
  const todayOnMortgage = payOff(
    input.mortgage,
    input.mortgageRate,
    mortgageMonthBefore
  );
  const todayOnPersonal = payOff(
    input.personal,
    input.personalRate,
    personalMonthBefore
  );
  const todayFeasible = todayOnMortgage.feasible && todayOnPersonal.feasible;
  const todayMonths = Math.max(todayOnMortgage.months, todayOnPersonal.months);
  const todayTotalInterest =
    todayOnMortgage.totalInterest + todayOnPersonal.totalInterest;
  const todayNet =
    securedAfterTax(
      todayOnMortgage.totalInterest,
      Math.max(1, todayOnMortgage.months / 12)
    ) + unsecuredAfterTax(todayOnPersonal.totalInterest);

  const minimumMortgagePayment = amortKrAfter + interestMortMonthAfter;
  const minimumPayment = scenarioFrom(minimumMortgagePayment, personalMonthAfter);
  // Samma plånbok som idag: allt som inte går till blancolånet går till bolånet.
  const keepPaying = scenarioFrom(
    Math.max(minimumMortgagePayment, monthBefore - personalMonthAfter),
    personalMonthAfter
  );

  return {
    bake,
    personalLeft,
    newMortgage,
    ltvBefore,
    ltvAfter,
    bandBefore,
    bandAfter,
    amortBefore,
    amortAfter,
    amortKrBefore,
    amortKrAfter,
    amortKrDelta,
    interestMortMonthBefore,
    interestMortMonthAfter,
    personalMonthBefore,
    personalMonthAfter,
    monthBefore,
    monthAfter,
    monthDelta: monthAfter - monthBefore,
    totalIntBefore,
    totalIntAfter,
    interestSavedGross,
    interestSavedNet,
    warningLtv,
    warning,
    warningText,
    summaryLine,
    todayMonthly: monthBefore,
    todayMonths,
    todayFeasible,
    todayDebtFreeDate: todayFeasible
      ? addMonthsTo(startDate, todayMonths - 1)
      : "-",
    scenarios: { keepPaying, minimumPayment },
  };
}
