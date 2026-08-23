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

export function bandLabel(band: LtvBand): string {
  switch (band) {
    case "over85":
      return "Över 85% — bank nekar ofta / extra krav";
    case "two":
      return "2% amorteringskrav gäller";
    case "one":
      return "1% amorteringskrav gäller";
    default:
      return "Inget lagkrav på amortering";
  }
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
  warningText: string | null;
  summaryLine: string;
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

  const personalMonthBefore = annuity(input.personal, input.personalRate, personalMonths);
  const personalMonthAfter = annuity(personalLeft, input.personalRate, personalMonths);

  const monthBefore = amortKrBefore + interestMortMonthBefore + personalMonthBefore;
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
  let warningText: string | null = null;
  if (ltvAfter > 0.85) {
    warningText = "Banken kräver ofta extra amortering eller nekar belåning över 85%";
  } else if (ltvAfter > 0.7 && ltvBefore <= 0.7) {
    warningText = "LTV korsar 70% — amorteringskravet hoppar till 2%/år på hela bolånet";
  }

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
    warningText,
    summaryLine,
  };
}
