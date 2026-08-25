"use client";

import {
  bandLabel,
  calculateBakeIn,
  type BakeInResult,
} from "@/lib/debt-optimizer/bake-in";
import {
  simulatePlan,
  type PlanLoan,
  type PlanLoanResult,
  type PlanResult,
} from "@/lib/debt-optimizer/canonical";
import type {
  CalculationResult,
  Loan,
  PayoffStrategy,
} from "@/lib/debt-optimizer/types";
import {
  CreditLoanMetrics,
  LeasingLoanFields,
  SortableLoanCard,
  TimeBoxControl,
  type LeasingTerms,
  type TimeBox,
} from "@/components/LoanCard";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Big from "big.js";
import {
  ArrowRight,
  ArrowRightLeft,
  Check,
  Home,
  Landmark,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  WalletCards,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Lang = "en" | "sv";
type Tab = "today" | "compare" | "refinance";
type LoanKind =
  | "mortgage"
  | "personal"
  | "car"
  | "student"
  | "credit"
  | "installment"
  | "leasing"
  | "family"
  | "other";
type AmortKind = "fixed_amort" | "annuity" | "fixed_cost" | "interest_free";
const LOAN_KINDS: Record<
  LoanKind,
  {
    icon: string;
    en: string;
    sv: string;
    rate: number;
    helpEn: string;
    helpSv: string;
  }
> = {
  mortgage: {
    icon: "🏠",
    en: "Mortgage",
    sv: "Bolån",
    rate: 0.041,
    helpEn: "Usually 3–6% — enter your current variable rate",
    helpSv: "Vanligt 3–6 % — sätt din rörliga ränta",
  },
  personal: {
    icon: "💳",
    en: "Personal loan / Private",
    sv: "Blancolån / Privat",
    rate: 0.085,
    helpEn: "Usually 5–25% — enter the rate in your agreement",
    helpSv: "Vanligt 5–25 % — sätt din avtalade ränta",
  },
  car: {
    icon: "🚗",
    en: "Car loan",
    sv: "Billån",
    rate: 0.065,
    helpEn: "Vehicle financing",
    helpSv: "Finansiering med bilen som säkerhet",
  },
  student: {
    icon: "🎓",
    en: "Student loan",
    sv: "CSN",
    rate: 0.015,
    helpEn: "Low rate, special write-off rules",
    helpSv: "Låg ränta och särskilda avskrivningsregler",
  },
  credit: {
    icon: "💸",
    en: "Credit card",
    sv: "Kreditkort",
    rate: 0.23,
    helpEn: "High interest — prioritize this",
    helpSv: "Hög ränta — prioritera denna",
  },
  installment: {
    icon: "📦",
    en: "Installment",
    sv: "Avbetalning",
    rate: 0,
    helpEn: "Check when the 0% promotion ends",
    helpSv: "Kontrollera när 0%-kampanjen slutar",
  },
  leasing: {
    icon: "🚙",
    en: "Leasing",
    sv: "Leasing",
    rate: 0,
    helpEn: "Fixed monthly cost, no interest",
    helpSv: "Fast månadskostnad utan ränta",
  },
  family: {
    icon: "👨‍👩‍👧",
    en: "Family loan",
    sv: "Inom familj",
    rate: 0.025,
    helpEn: "No credit check—put the agreement in writing",
    helpSv: "Ingen UC, men skriv skuldebrev och dokumentera räntan",
  },
  other: {
    icon: "🏷️",
    en: "Other",
    sv: "Annat",
    rate: 0.05,
    helpEn: "Custom debt or recurring cost",
    helpSv: "Eget lån eller återkommande kostnad",
  },
};

/**
 * Från 2026 är ränteavdraget slopat för lån utan säkerhet — blancolån,
 * kreditkort och avbetalning. Bolån och andra lån med pant behåller avdraget.
 * CSN-ränta har aldrig varit avdragsgill.
 *
 * Skillnaden är inte kosmetisk: med 30 % avdrag pålagt på ett kreditkort med
 * 23 % ränta ser det ut som 16 %, och då kan appen råda någon att spara i
 * stället för att betala av. Stäm av mot Skatteverket inför varje årsskifte.
 */
const DEDUCTIBLE_KINDS: ReadonlySet<LoanKind> = new Set<LoanKind>([
  "mortgage",
  "car",
]);
const isDeductible = (kind: LoanKind | undefined) =>
  kind ? DEDUCTIBLE_KINDS.has(kind) : false;

const DEFAULT_LEASING_TERMS: LeasingTerms = {
  company: "Toyota Corolla",
  monthlyCost: 4_039,
  months: 36,
  buyPrice: 195_000,
  downPayment: 25_000,
  residualValue: 120_000,
  buyRate: 4.1,
  rateIncrease: 0.1,
};

const START = "2026-08";
const COPY = {
  en: {
    tabs: { today: "Today", compare: "Compare", refinance: "Refinance" },
    title: "Stop paying interest. Start building freedom.",
    sub: "See your exact debt-free date and saved interest. Local. Private. Free.",
    start: "Build my plan",
    demo: "View example",
    private: "Your data never leaves this device",
    plan: "Your plan",
    hint: "Tune the numbers. We’ll handle the math.",
    add: "Add debt",
    balance: "Balance",
    rate: "Interest",
    payment: "Monthly payment",
    extra: "Extra monthly",
    free: "DEBT-FREE",
    earlier: "earlier",
    saved: "Interest saved",
    reinvest: "Reinvest freed payments",
    total: "Total debt",
    monthly: "Monthly outflow",
    reset: "Reset plan",
    when: "When",
    paid: "is paid off",
    none: "No reinvest",
    amount: "Amount to transfer",
    payoff: "Payoff order",
    compareTitle: "Two strategies. One clear winner.",
    compareSub: "Same debts and payments—different priorities.",
    months: "months",
    totalInterest: "Total interest",
    winner: "saves",
    refinanceTitle: "Bake personal loans into mortgage",
    refinanceSub:
      "See the trade-off between lower interest and a higher loan-to-value ratio.",
    property: "Property value",
    mortgage: "Current mortgage",
    personal: "Personal loans",
    baked: "Amount to bake in",
    newLtv: "New LTV",
    newMonthly: "New monthly payment",
    newDate: "New debt-free date",
    denied: "Banks often deny above 85%",
  },
  sv: {
    tabs: { today: "Idag", compare: "Jämför", refinance: "Baka in" },
    title: "Sluta betala ränta. Börja bygga frihet.",
    sub: "Se exakt när du blir skuldfri och hur mycket ränta du sparar. Lokalt. Privat. Gratis.",
    start: "Bygg min plan",
    demo: "Se exempel",
    private: "Din data lämnar aldrig den här enheten",
    plan: "Din plan",
    hint: "Justera siffrorna. Vi sköter matematiken.",
    add: "Lägg till lån",
    balance: "Saldo",
    rate: "Ränta",
    payment: "Månadsbetalning",
    extra: "Extra per månad",
    free: "SKULDFRI",
    earlier: "tidigare",
    saved: "Sparad ränta",
    reinvest: "Återinvestera frigjorda betalningar",
    total: "Total skuld",
    monthly: "Per månad",
    reset: "Nollställ plan",
    when: "När",
    paid: "är återbetalt",
    none: "Ingen återinvestering",
    amount: "Belopp att flytta",
    payoff: "Återbetalningsordning",
    compareTitle: "Två strategier. En tydlig vinnare.",
    compareSub: "Samma lån och betalningar—olika prioritering.",
    months: "månader",
    totalInterest: "Total ränta",
    winner: "sparar",
    refinanceTitle: "Baka in blancolån i bolån",
    refinanceSub: "Se avvägningen mellan lägre ränta och högre belåningsgrad.",
    property: "Bostadens värde",
    mortgage: "Nuvarande bolån",
    personal: "Blancolån totalt",
    baked: "Belopp att baka in",
    newLtv: "Ny belåningsgrad",
    newMonthly: "Ny månadsbetalning",
    newDate: "Nytt skuldfri-datum",
    denied: "Banker nekar ofta över 85%",
  },
};
/** Alla texter finns på båda språken och har samma form. */
type Copy = (typeof COPY)["sv"];

const TAB_LABELS = {
  en: {
    today: "My debts",
    compare: "What is best?",
    refinance: "Move to mortgage",
  },
  sv: {
    today: "Mina lån",
    compare: "Vad är bäst?",
    refinance: "Flytta till bolånet",
  },
};
// TAB_LABELS är sanningen för flikarnas namn — COPY.tabs speglar den.
// (Tidigare kopierades bara `compare` över, så `today`/`refinance` i
// TAB_LABELS var död kod och headern visade de gamla namnen.)
Object.assign(COPY.en.tabs, TAB_LABELS.en);
Object.assign(COPY.sv.tabs, TAB_LABELS.sv);

const initialLoans: Loan[] = [
  {
    id: "mortgage",
    name: "Mortgage",
    loanType: "Rak amortering",
    paymentStyle: "fixed_amort",
    balance: 2_128_112,
    interestRate: 0.041,
    currentMonthlyPayment: 8_400,
    extraMonthly: 2_500,
    extraMonthlyEnabled: true,
    extraMonthlyFrom: START,
  },
  {
    id: "personal",
    name: "Personal loan",
    loanType: "Annuitet",
    paymentStyle: "annuity",
    balance: 180_000,
    interestRate: 0.085,
    currentMonthlyPayment: 3_900,
    extraMonthly: 1_800,
    extraMonthlyEnabled: true,
    extraMonthlyFrom: START,
  },
];

const number = (n: number, lang: Lang) =>
  Math.round(n).toLocaleString(lang === "sv" ? "sv-SE" : "en-US");
const money = (n: number, lang: Lang, compact = false) => {
  const safe = Number.isFinite(n) ? n : 0;
  if (compact) {
    const sign = safe < 0 ? "−" : "";
    const abs = Math.abs(safe);
    const decimal = lang === "sv" ? "," : ".";
    if (abs >= 1_000_000)
      return `${sign}${(abs / 1_000_000).toFixed(1).replace(".", decimal)} mkr`;
    if (abs >= 10_000)
      return `${sign}${number(Math.round(abs / 1000), lang)} tkr`;
  }
  return new Intl.NumberFormat(lang === "sv" ? "sv-SE" : "en-US", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(Math.round(safe));
};
// Ett ogiltigt datum får aldrig ta ner hela sidan. Intl.DateTimeFormat kastar
// RangeError på Invalid Date, och eftersom skuldfri-datumet renderas i varje
// vy räckte ett enda NaN för att ge vit skärm i stället för en tom siffra.
const month = (ym: string | undefined | null, lang: Lang) => {
  if (!ym || ym === "-") return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "—";
  const date = new Date(y, m - 1);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "sv" ? "sv-SE" : "en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
};

/**
 * Vad som faktiskt frigörs varje månad när lånet är slut. Speglar `clear()` i
 * canonical.ts: vid rak amortering försvinner räntedelen på vägen, så det som
 * blir kvar att flytta vidare är amorteringen plus det egna påslaget.
 */
function freedMonthly(loan: Loan) {
  const extra = loan.extraMonthlyEnabled === false ? 0 : loan.extraMonthly || 0;
  if (loan.paymentStyle !== "fixed_amort")
    return loan.currentMonthlyPayment + extra;
  const interest = (loan.balance * loan.interestRate) / 12;
  return Math.max(0, loan.currentMonthlyPayment - interest) + extra;
}

/** Hur lånet faktiskt betalas av, i klartext. */
function describePace(loan: PlanLoanResult, lang: Lang) {
  const sv = lang === "sv";
  if (!loan.fullyPaid)
    return sv
      ? "Betalningen räcker inte — skulden blir kvar"
      : "The payment is not enough — this debt remains";
  if (loan.focusMonths === 0)
    return sv
      ? `${loan.waitMonths} mån med sin egen månadskostnad`
      : `${loan.waitMonths} months on its own payment`;
  if (loan.waitMonths === 0)
    return sv
      ? `${loan.focusMonths} mån med full kraft från start`
      : `${loan.focusMonths} months at full force from the start`;
  return sv
    ? `${loan.waitMonths} mån med egen betalning, sedan ${loan.focusMonths} mån med full kraft`
    : `${loan.waitMonths} months on its own, then ${loan.focusMonths} at full force`;
}
const duration = (n: number, lang: Lang) =>
  `${Math.floor(n / 12)}${lang === "sv" ? " år " : "y "}${n % 12}${lang === "sv" ? " mån" : "m"}`;
const addMonths = (ym: string, count: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + count);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthsFromStart = (ym?: string) => {
  if (!ym || ym === "-") return 0;
  const [startYear, startMonth] = START.split("-").map(Number);
  const [endYear, endMonth] = ym.split("-").map(Number);
  return Math.max(1, (endYear - startYear) * 12 + endMonth - startMonth + 1);
};

function CountUp({ value, lang }: { value: number; lang: Lang }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 900, 1);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{money(shown, lang)}</>;
}

// Adapter to convert canonical PlanResult to legacy CalculationResult format
function planResultToCalculationResult(
  plan: PlanResult,
  baseline: PlanResult,
): CalculationResult {
  const firstPaidMonths = plan.loans
    .filter((l) => l.fullyPaid && l.finishMonth !== null)
    .map((l) => l.finishMonth as number);

  // Create a map of baseline results by loan ID for easy lookup
  const baselineMap = new Map(baseline.loans.map((l) => [l.id, l]));

  return {
    totalOriginalInterest: baseline.totalInterest,
    totalNewInterest: plan.totalInterest,
    totalInterestSaved: baseline.totalInterest - plan.totalInterest,
    originalFreedomDate: baseline.freedomDate,
    newFreedomDate: plan.freedomDate,
    totalMonthsSaved: Math.max(
      0,
      (baseline.fullyPaid ? baseline.totalMonths : 600) -
        (plan.fullyPaid ? plan.totalMonths : 600),
    ),
    firstDebtPaidDate:
      firstPaidMonths.length > 0
        ? addMonths(START, Math.min(...firstPaidMonths))
        : "-",
    loanResults: plan.loans.map((l) => {
      const baselineLoan = baselineMap.get(l.id);
      const baselineEndDate = baselineLoan?.endDate || "-";
      const baselineInterest = baselineLoan?.totalInterest || 0;

      return {
        id: l.id,
        name: l.name,
        originalEndDate: baselineEndDate,
        originalTotalInterest: baselineInterest,
        newEndDate: l.endDate,
        newTotalInterest: l.totalInterest,
        interestSaved: baselineInterest - l.totalInterest,
        monthsSaved: Math.max(
          0,
          (baselineLoan?.finishMonth ?? 600) - (l.finishMonth ?? 600),
        ),
        payoffOrder: l.order,
        isFullyAmortizing: l.fullyPaid,
      };
    }),
  };
}

export default function Page() {
  const [lang, setLang] = useState<Lang>("sv");
  const [tab, setTab] = useState<Tab>("today");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [started, setStarted] = useState(false);
  const [loanKinds, setLoanKinds] = useState<Record<string, LoanKind>>({
    mortgage: "mortgage",
    personal: "personal",
  });
  const [amortKinds, setAmortKinds] = useState<Record<string, AmortKind>>({
    mortgage: "fixed_amort",
    personal: "annuity",
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    personal: true,
  });
  const [fearRate, setFearRate] = useState(0.1);
  const [income, setIncome] = useState(0);
  const [leasingTerms, setLeasingTerms] = useState<
    Record<string, LeasingTerms>
  >({});
  const [timeBoxes, setTimeBoxes] = useState<Record<string, TimeBox>>({});
  const [propertyValue, setPropertyValue] = useState(3_027_201);
  const [mortgageValue, setMortgageValue] = useState(2_128_112);
  const [bakeAmount, setBakeAmount] = useState(180_000);
  const [toast, setToast] = useState<string | null>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const t = COPY[lang];

  useEffect(() => {
    const saved = localStorage.getItem("debtkill-lang");
    if (saved === "en" || saved === "sv") {
      setLang(saved);
      return;
    }
    // Ingen sparad preferens: svenska är default (CSN, blancolån och
    // Elgiganten-avbetalning är svenska begrepp), men en besökare med ett
    // icke-svenskt språk i webbläsaren får engelska.
    if (!navigator.language?.toLowerCase().startsWith("sv")) setLang("en");
  }, []);
  useEffect(() => {
    setLoans((current) =>
      current.map((loan) => {
        const kind = loanKinds[loan.id];
        return kind && kind !== "other"
          ? { ...loan, name: LOAN_KINDS[kind][lang] }
          : loan;
      }),
    );
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const debtLoans = useMemo(
    () => loans.filter((loan) => loanKinds[loan.id] !== "leasing"),
    [loanKinds, loans],
  );
  /**
   * Ett enda underlag för alla vyer. Tidigare byggde "Mina lån" sin plan med
   * rollover påslaget och "Vad är bäst?" med rollover avslaget — samma lån gav
   * då olika skuldfri-datum beroende på vilken flik man öppnade. Nu kommer
   * varje siffra i appen ur samma lista och samma motor.
   */
  const planLoans = useMemo<PlanLoan[]>(
    () =>
      debtLoans.map((loan) => ({
        id: loan.id,
        name: loan.name,
        balance: loan.balance,
        interestRate: loan.interestRate,
        // Grundbetalning och eget påslag hålls isär: motorn lägger på det
        // extra själv. Summeras de här räknas påslaget två gånger.
        monthlyPayment: loan.currentMonthlyPayment,
        paymentStyle: loan.paymentStyle,
        extraMonthly: loan.extraMonthly,
        extraMonthlyEnabled: loan.extraMonthlyEnabled,
        timeBoxMonths: timeBoxes[loan.id]?.enabled
          ? timeBoxes[loan.id].months
          : undefined,
      })),
    [debtLoans, timeBoxes],
  );
  const runPlan = useCallback(
    (order: PayoffStrategy) =>
      simulatePlan({
        // Tidsgränsen är en manuell prioritering och hör bara hemma i
        // användarens egen ordning — inte i de räknade alternativen.
        loans:
          order === "custom"
            ? planLoans
            : planLoans.map((loan) => ({ ...loan, timeBoxMonths: undefined })),
        strategy: order,
        startDate: START,
        oneTimePayments: [],
        rollover: true,
      }),
    [planLoans],
  );
  const plan = useMemo(() => runPlan("custom"), [runPlan]);
  const avalanchePlan = useMemo(() => runPlan("avalanche"), [runPlan]);
  const snowballPlan = useMemo(() => runPlan("snowball"), [runPlan]);
  /**
   * Baslinjen är "om du inte gjorde någonting": varje lån betalas med sin egen
   * grundbetalning, utan påslag, utan återinvestering och utan att frigjorda
   * pengar rullar vidare. Det är den enda ärliga referensen för "sparad ränta".
   */
  const baseline = useMemo(
    () =>
      simulatePlan({
        loans: planLoans.map((loan) => ({
          ...loan,
          extraMonthlyEnabled: false,
          targetMonthlyEnabled: false,
          reinvestment: undefined,
          timeBoxMonths: undefined,
        })),
        strategy: "custom",
        startDate: START,
        oneTimePayments: [],
        rollover: false,
      }),
    [planLoans],
  );
  const result = useMemo(
    () => (debtLoans.length ? planResultToCalculationResult(plan, baseline) : null),
    [debtLoans.length, plan, baseline],
  );
  const personalTotal = debtLoans
    .filter((x) => loanKinds[x.id] === "personal")
    .reduce((sum, x) => sum + x.balance, 0);
  const setPersonalTotal = (value: number) => {
    const safe = Math.min(10_000_000, Math.max(0, value));
    const target = loans.find((x) => loanKinds[x.id] === "personal");
    if (target) {
      setLoans((current) =>
        current.map((x) => (x.id === target.id ? { ...x, balance: safe } : x)),
      );
      return;
    }
    const personal = {
      ...initialLoans[1],
      name: lang === "sv" ? "Blancolån" : "Personal loan",
      balance: safe,
    };
    setLoanKinds((current) => ({ ...current, personal: "personal" }));
    setAmortKinds((current) => ({ ...current, personal: "annuity" }));
    setLoans((current) => [...current, personal]);
  };
  const refinanceMortgage = debtLoans.find(
    (loan) => loanKinds[loan.id] === "mortgage",
  );
  const refinancePersonal = debtLoans.find(
    (loan) => loanKinds[loan.id] === "personal",
  );
  const bake = useMemo(
    () =>
      calculateBakeIn({
        mortgage: mortgageValue,
        mortgageRate: refinanceMortgage?.interestRate || 0.041,
        personal: personalTotal,
        personalRate: refinancePersonal?.interestRate || 0.085,
        homeValue: propertyValue,
        bakeAmount,
      }),
    [
      mortgageValue,
      propertyValue,
      personalTotal,
      bakeAmount,
      refinanceMortgage?.interestRate,
      refinancePersonal?.interestRate,
    ],
  );
  const total = debtLoans.reduce((sum, x) => sum + x.balance, 0);
  // Månadskostnaden gäller samma lån som skulden ovan. Leasing räknas inte in
  // i någon av dem — det är en jämförelsepost, inte en skuld i planen.
  const monthlyTotal = debtLoans.reduce(
    (sum, x) => sum + x.currentMonthlyPayment + (x.extraMonthly || 0),
    0,
  );

  const setLanguage = (next: Lang) => {
    setLang(next);
    localStorage.setItem("debtkill-lang", next);
  };
  const updateLoan = (id: string, key: keyof Loan, value: number) =>
    setLoans((current) =>
      current.map((x) => (x.id === id ? { ...x, [key]: value } : x)),
    );
  const addDebt = () => {
    const id = crypto.randomUUID();
    setLoanKinds((k) => ({ ...k, [id]: "other" }));
    setAmortKinds((k) => ({ ...k, [id]: "annuity" }));
    setLoans((current) => {
      if (current.length === 0) {
        setToast(
          lang === "sv"
            ? "🎉 Bra! Lägg till fler eller klicka Fyll exempel"
            : "🎉 Nice! Add more or load the sample",
        );
        window.setTimeout(() => setToast(null), 3200);
      }
      return [
        ...current,
        {
          id,
          name:
            lang === "sv"
              ? `Lån ${current.length + 1}`
              : `Debt ${current.length + 1}`,
          loanType: "Annuitet",
          paymentStyle: "annuity",
          balance: 100_000,
          interestRate: 0.05,
          currentMonthlyPayment: 2_500,
          extraMonthly: 0,
          extraMonthlyEnabled: true,
          extraMonthlyFrom: START,
        },
      ];
    });
  };
  const scrollToApp = () =>
    requestAnimationFrame(() =>
      appRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  const startFree = () => {
    if (!loans.length) {
      const first = {
        ...initialLoans[0],
        name: lang === "sv" ? "Bolån" : "Mortgage",
        extraMonthly: 0,
      };
      setLoans([first]);
      setLoanKinds({ mortgage: "mortgage" });
      setAmortKinds({ mortgage: "fixed_amort" });
      setToast(
        lang === "sv"
          ? "🎉 Bra! Lägg till fler eller klicka Fyll exempel"
          : "🎉 Nice! Add more or load the sample",
      );
      window.setTimeout(() => setToast(null), 3200);
    }
    setStarted(true);
    scrollToApp();
  };
  const fillSample = () => {
    setLoans(
      initialLoans.map((loan) => ({
        ...loan,
        name:
          loan.id === "mortgage"
            ? lang === "sv"
              ? "Bolån"
              : "Mortgage"
            : LOAN_KINDS.personal[lang],
      })),
    );
    setLoanKinds({ mortgage: "mortgage", personal: "personal" });
    setAmortKinds({ mortgage: "fixed_amort", personal: "annuity" });
    setExpanded({ personal: true });
    setLeasingTerms({});
    setTimeBoxes({});
    setStarted(true);
    setToast(
      lang === "sv"
        ? "Exempellån inlästa · Återinvestering aktiv"
        : "Sample debts loaded · Reinvest demo active",
    );
    window.setTimeout(() => setToast(null), 3200);
    scrollToApp();
  };
  return (
    <div className="min-h-screen bg-[#06060A] text-white selection:bg-blue-500/30">
      <Header lang={lang} tab={tab} setTab={setTab} setLang={setLanguage} />
      {!started && (
        <Landing lang={lang} onStart={startFree} onSample={fillSample} />
      )}
      {loans.length > 0 && (
        <div ref={appRef} className="scroll-mt-20">
          <button
            onClick={() => setStarted(false)}
            className="ml-5 mt-5 text-xs text-white/65 hover:text-white md:ml-10"
          >
            ← {lang === "sv" ? "Tillbaka" : "Back"}
          </button>
          {tab === "today" && (
            <TodayV5
              lang={lang}
              loans={loans}
              setLoans={setLoans}
              t={t}
              result={result}
              updateLoan={updateLoan}
              total={total}
              monthlyTotal={monthlyTotal}
              addDebt={addDebt}
              loanKinds={loanKinds}
              setLoanKinds={setLoanKinds}
              amortKinds={amortKinds}
              setAmortKinds={setAmortKinds}
              expanded={expanded}
              setExpanded={setExpanded}
              fearRate={fearRate}
              setFearRate={setFearRate}
              income={income}
              setIncome={setIncome}
              leasingTerms={leasingTerms}
              setLeasingTerms={setLeasingTerms}
              timeBoxes={timeBoxes}
              setTimeBoxes={setTimeBoxes}
              plan={plan}
              avalanchePlan={avalanchePlan}
            />
          )}
          {tab === "compare" && (
            <BestView
              lang={lang}
              t={t}
              plan={plan}
              avalanchePlan={avalanchePlan}
              snowballPlan={snowballPlan}
              loans={debtLoans}
              setLoans={setLoans}
            />
          )}
          {tab === "refinance" && (
            <RefinanceV5
              lang={lang}
              t={t}
              bake={bake}
              bakeAmount={bakeAmount}
              setBakeAmount={setBakeAmount}
              propertyValue={propertyValue}
              setPropertyValue={setPropertyValue}
              mortgageValue={mortgageValue}
              setMortgageValue={setMortgageValue}
              personalTotal={personalTotal}
              setPersonalTotal={setPersonalTotal}
            />
          )}
          <MobileBar
            lang={lang}
            t={t}
            tab={tab}
            setTab={setTab}
            plan={plan}
            hasDebts={debtLoans.length > 0}
          />
        </div>
      )}
      {toast && (
        <div
          role="status"
          className="fixed bottom-28 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-5 py-3 text-center text-sm font-medium text-emerald-300 shadow-2xl backdrop-blur-xl md:bottom-6 md:w-auto"
        >
          {toast}
        </div>
      )}
      <footer className="mx-auto max-w-[1280px] px-5 pb-28 pt-8 text-center text-[12px] text-white/55 md:pb-8">
        <p>
          {lang === "sv"
            ? "All matematik körs i din webbläsare. Ingen spårning. Ingen kostnad. Byggd med Big.js. 🇸🇪"
            : "All math runs in your browser. No tracking. No cost. Built with Big.js. 🇸🇪"}
        </p>
        <span className="mt-3 inline-flex rounded-full border border-white/[.06] px-3 py-1.5 text-white/65">
          Coming soon on Product Hunt
        </span>
      </footer>
    </div>
  );
}

function Header({
  lang,
  tab,
  setTab,
  setLang,
}: {
  lang: Lang;
  tab: Tab;
  setTab: (t: Tab) => void;
  setLang: (l: Lang) => void;
}) {
  const t = COPY[lang];
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.06] bg-[#06060A]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 md:px-10">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-blue-400 to-blue-700 shadow-[0_0_20px_rgba(59,130,246,.3)]">
            <TrendingDown size={18} />
          </span>
          <b>DebtKill</b>
        </div>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 rounded-full border border-white/[.06] bg-white/[.025] p-1 md:flex">
          {(Object.keys(t.tabs) as Tab[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full px-5 py-2 text-xs transition ${tab === key ? "bg-white/10 text-white" : "text-white/65 hover:text-white/70"}`}
            >
              {t.tabs[key]}
            </button>
          ))}
        </nav>
        <div className="rounded-full border border-white/[.07] p-1 text-[12px] font-semibold">
          {(["en", "sv"] as Lang[]).map((x) => (
            <button
              key={x}
              onClick={() => setLang(x)}
              className={`rounded-full px-3 py-1.5 ${lang === x ? "bg-white/10" : "text-white/55"}`}
            >
              {x.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}


function ResultSidebar({
  lang,
  t,
  loans,
  plan,
  avalanchePlan,
  monthlyTotal,
}: {
  lang: Lang;
  t: Copy;
  loans: Loan[];
  plan: PlanResult;
  avalanchePlan: PlanResult;
  monthlyTotal?: number;
}) {
  const sv = lang === "sv";
  const hasDebts = loans.length > 0;
  const freedomDate = plan.fullyPaid ? plan.freedomDate : "-";
  const payoffMonths = plan.fullyPaid ? plan.totalMonths : 0;
  // Hur mycket den billigaste ordningen skulle spara jämfört med den ordning
  // användaren själv har satt. Båda körs med samma motor och samma pengar —
  // det enda som skiljer är i vilken ordning lånen får full kraft.
  const monthsSaved =
    plan.fullyPaid && avalanchePlan.fullyPaid
      ? Math.max(0, plan.totalMonths - avalanchePlan.totalMonths)
      : 0;
  const interestSavedByAvalanche = Math.max(
    0,
    plan.totalInterest - avalanchePlan.totalInterest,
  );
  const canCompareOrder = loans.length > 1;
  return (
    <aside className="space-y-3">
      <div className="relative min-h-[120px] overflow-hidden rounded-xl border border-blue-400/20 bg-blue-500/[.09] p-4 shadow-[inset_0_0_45px_rgba(59,130,246,.08)] backdrop-blur-xl">
        <div className="flex justify-between text-[12px] font-bold tracking-[.18em] text-blue-300">
          {t.free}
          <ShieldCheck size={17} />
        </div>
        <div className="mt-3 text-[38px] font-semibold leading-none tracking-[-.05em]">
          {month(freedomDate, lang)}
        </div>
        {freedomDate === "-" ? (
          <span
            className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${hasDebts ? "bg-red-400/10 text-red-300" : "bg-white/[.06] text-white/65"}`}
          >
            {hasDebts
              ? sv
                ? "Betalningen är för låg"
                : "Payment is too low"
              : sv
                ? "Lägg till ett lån"
                : "Add a debt"}
          </span>
        ) : (
          <span className="mt-4 inline-flex rounded-full bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-200">
            {duration(payoffMonths, lang)}{" "}
            {sv ? "till skuldfri" : "to debt-free"}
          </span>
        )}
      </div>
      <div className="card p-6">
        <span className="text-sm text-white/65">
          {sv ? "Total ränta" : "Total interest"}
        </span>
        <div className="mt-4 text-4xl font-semibold">
          <CountUp value={plan.totalInterest} lang={lang} />
        </div>
        {typeof monthlyTotal === "number" ? (
          <p className="mt-3 text-xs text-white/65">
            {sv ? "Total månadskostnad" : "Total monthly outflow"}:{" "}
            {money(monthlyTotal, lang)}
          </p>
        ) : null}
      </div>
      {canCompareOrder ? (
        <div className="card p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[.14em] text-white/65">
            {sv
              ? "Din ordning vs billigaste vägen"
              : "Your order vs the cheapest route"}
          </div>
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-blue-400/15 bg-blue-500/[.06] p-3">
              <div className="flex items-center justify-between gap-3">
                <b>{sv ? "Din ordning" : "Your order"}</b>
                <span>{plan.fullyPaid ? month(plan.freedomDate, lang) : "—"}</span>
              </div>
              <p className="mt-1 text-white/65">
                {sv ? "Ränta" : "Interest"} {money(plan.totalInterest, lang)}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[.06] p-3">
              <div className="flex items-center justify-between gap-3">
                <b>{sv ? "Billigaste vägen" : "Cheapest route"}</b>
                <span>
                  {avalanchePlan.fullyPaid
                    ? month(avalanchePlan.freedomDate, lang)
                    : "—"}
                </span>
              </div>
              <p className="mt-1 text-white/65">
                {sv
                  ? "Högsta räntan först · Ränta"
                  : "Highest rate first · Interest"}{" "}
                {money(avalanchePlan.totalInterest, lang)}
              </p>
              <p className="mt-2 font-medium text-emerald-300">
                {interestSavedByAvalanche > 0
                  ? `${sv ? "Sparar" : "Saves"} ${money(interestSavedByAvalanche, lang)}`
                  : sv
                    ? "Din ordning är redan lika billig"
                    : "Your order is already just as inexpensive"}
                {monthsSaved > 0
                  ? ` · ${duration(monthsSaved, lang)} ${sv ? "snabbare" : "faster"}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="card p-5">
        <div className="mb-2 text-xs text-white/65">{t.payoff}</div>
        {plan.loans.map((x) => (
          <div
            key={x.id}
            className="border-b border-white/[.05] py-3 last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/5 text-xs">
                {x.order}
              </span>
              <span className="flex-1 truncate text-xs">{x.name}</span>
              <span
                className={
                  x.fullyPaid
                    ? "shrink-0 text-xs text-emerald-400"
                    : "shrink-0 text-xs text-orange-300"
                }
              >
                {x.fullyPaid ? (
                  <>
                    <Check size={12} className="inline" />{" "}
                    {month(x.endDate, lang)}
                  </>
                ) : sv ? (
                  "Över 50 år"
                ) : (
                  "Over 50 years"
                )}
              </span>
            </div>
            <div className="ml-9 mt-1 text-[12px] text-white/55">
              {describePace(x, lang)}
            </div>
            {/* Vart de frigjorda pengarna tar vägen läses ur planen, inte ur
                en egen lista vid sidan av. Tidigare fanns en separat
                återinvesteringsregel som lade samma belopp en gång till
                ovanpå det som redan rullade vidare.

                Mottagaren är det första lånet i ordningen som fortfarande har
                skuld kvar när det här blir klart — inte nästa i listan, som
                mycket väl kan vara betalt sedan länge. */}
            {(() => {
              const source = loans.find((l) => l.id === x.id);
              if (!x.fullyPaid || !source || x.finishMonth === null) return null;
              const receiver = plan.loans.find(
                (row) =>
                  row.id !== x.id &&
                  (row.finishMonth === null || row.finishMonth > x.finishMonth!),
              );
              const freed = freedMonthly(source);
              if (!receiver || freed <= 0) return null;
              return (
                <div className="ml-9 mt-2 flex items-center gap-1 text-[12px] text-blue-300">
                  <ArrowRight size={11} className="shrink-0" />
                  <span className="truncate">
                    {number(freed, lang)} kr/{sv ? "mån" : "mo"} → {receiver.name}
                  </span>
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </aside>
  );
}



function Landing({
  lang,
  onStart,
  onSample,
}: {
  lang: Lang;
  onStart: () => void;
  onSample: () => void;
}) {
  const sv = lang === "sv";
  return (
    <main className="relative mx-auto flex min-h-[60vh] max-w-[1180px] items-center justify-center overflow-hidden px-5 py-20 text-center md:min-h-[680px] md:px-10">
      <div className="pointer-events-none absolute left-1/2 top-[44%] h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blue-500/20 via-violet-500/10 to-emerald-400/15 blur-[60px]" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-white/[.06] px-4 py-1.5 text-[12px] tracking-[.4px] text-white/55">
          <LockKeyhole size={12} className="shrink-0" />
          {sv
            ? "Ingen registrering · Helt privat · Fungerar offline"
            : "No signup · Fully private · Works offline"}
        </div>
        <h1 className="max-w-[760px] text-[34px] font-bold leading-[1.08] tracking-[-.045em] sm:text-[42px] md:text-[56px] md:leading-[1.05]">
          {sv ? "Se exakt när dina skulder är " : "See exactly when your debts are "}
          <span className="relative inline-block -rotate-1 rounded-[12px] bg-gradient-to-r from-[#3B82F6] to-[#10B981] px-3 py-0 text-white shadow-[0_14px_40px_rgba(16,185,129,.15)]">
            {sv ? "borta" : "gone"}
          </span>
        </h1>
        <p className="mt-6 max-w-[640px] text-[17px] leading-7 text-white/60 md:mt-7 md:text-[18px] md:leading-8">
          {sv
            ? "Dina siffror, din ordning, ditt datum. Vilket lån som helst och vilken ränta som helst — allt räknas ut i din webbläsare."
            : "Your numbers, your order, your date. Any loan at any rate — all calculated in your browser."}
        </p>
        <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <button
            onClick={onStart}
            className="inline-flex h-13 min-h-[52px] w-full items-center justify-center rounded-xl bg-white px-7 text-base font-semibold text-[#06060A] shadow-[0_0_35px_rgba(59,130,246,.25)] transition hover:-translate-y-0.5 hover:shadow-2xl sm:w-auto"
          >
            {sv ? "Lägg till ditt första lån" : "Add your first loan"}
          </button>
          <button
            id="fill-sample"
            onClick={onSample}
            className="inline-flex min-h-[52px] w-full items-center justify-center rounded-xl border border-white/[.12] px-6 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[.05] sm:w-auto"
          >
            {sv ? "Fyll exempel" : "Fill sample data"}
          </button>
        </div>
        <div className="mt-10 max-w-[420px] text-[11px] font-medium uppercase tracking-[1.6px] text-white/45 md:mt-12 md:max-w-none md:text-[12px]">
          {sv
            ? "Bolån · Blancolån · Kreditkort · Billån · CSN · Leasing · Avbetalning"
            : "Mortgage · Personal · Credit card · Car · Student · Leasing · Instalments"}
        </div>
      </div>
    </main>
  );
}
function Title({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-[.14em] text-blue-400">
          {eyebrow}
        </span>
        <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-[-.04em] sm:text-3xl md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/65">{sub}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  suffix,
  decimal,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (n: number) => void;
  suffix?: string;
  decimal?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className="block rounded-xl border border-white/[.06] bg-black/15 px-3 py-2 transition focus-within:border-blue-400/30">
      <small className="block truncate text-[10px] uppercase tracking-[.12em] text-white/50">
        {label}
      </small>
      <span className="flex items-baseline gap-1">
        <input
          spellCheck={false}
          readOnly={readOnly}
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const parsed = Number(
              e.target.value
                .replace(/\s/g, "")
                .replace(",", ".")
                .replace(/[^0-9.-]/g, ""),
            );
            onChange(
              Number.isFinite(parsed)
                ? Math.min(10_000_000, Math.max(0, parsed))
                : 0,
            );
          }}
          className="w-full min-w-0 bg-transparent py-0.5 text-[17px] tabular-nums outline-none read-only:text-white/65"
        />
        {suffix ? (
          <span className="shrink-0 text-xs text-white/50">{suffix}</span>
        ) : null}
      </span>
    </label>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[.06] bg-black/15 px-3 py-2.5">
      <small className="block truncate text-[10px] uppercase tracking-[.12em] text-white/50">
        {label}
      </small>
      <b className="mt-0.5 block text-lg tabular-nums">{value}</b>
    </div>
  );
}
/**
 * Mobilens navigering. Flikarna låg tidigare bara i headern bakom `md:flex`,
 * så på telefon gick det inte att nå "Vad är bäst?" eller "Flytta till
 * bolånet" över huvud taget.
 */
function MobileBar({
  lang,
  t,
  tab,
  setTab,
  plan,
  hasDebts,
}: {
  lang: Lang;
  t: Copy;
  tab: Tab;
  setTab: (t: Tab) => void;
  plan: PlanResult;
  hasDebts: boolean;
}) {
  const icons: Record<Tab, React.ReactNode> = {
    today: <WalletCards size={17} />,
    compare: <ArrowRightLeft size={17} />,
    refinance: <Home size={17} />,
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0B0B11]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      {hasDebts && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[.06] px-4 py-2 text-[11px]">
          <span className="text-white/55">
            {t.free}{" "}
            <b className="text-white">
              {plan.fullyPaid ? month(plan.freedomDate, lang) : "—"}
            </b>
          </span>
          <span className="text-white/55">
            {lang === "sv" ? "Ränta" : "Interest"}{" "}
            <b className="text-white">{money(plan.totalInterest, lang, true)}</b>
          </span>
        </div>
      )}
      <nav className="grid grid-cols-3">
        {(Object.keys(t.tabs) as Tab[]).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
              tab === key ? "text-blue-300" : "text-white/50"
            }`}
          >
            {icons[key]}
            {t.tabs[key]}
          </button>
        ))}
      </nav>
    </div>
  );
}

function BestView({
  lang,
  t,
  plan,
  avalanchePlan,
  snowballPlan,
  loans,
  setLoans,
}: {
  lang: Lang;
  t: Copy;
  plan: PlanResult;
  avalanchePlan: PlanResult;
  snowballPlan: PlanResult;
  loans: Loan[];
  setLoans: (fn: (current: Loan[]) => Loan[]) => void;
}) {
  const sv = lang === "sv";
  const routes = [
    {
      key: "snowball",
      icon: "\u26a1",
      title: sv ? "Minsta skulden först" : "Smallest debt first",
      text: sv
        ? "Ett lån försvinner snabbt. Bra om du behöver se att det rör sig."
        : "One debt disappears fast. Good if you need to see progress.",
      result: snowballPlan,
    },
    {
      key: "avalanche",
      icon: "\ud83d\udcb0",
      title: sv ? "Dyraste räntan först" : "Highest rate first",
      text: sv
        ? "Lägst total ränta. Kan kännas långsamt i början."
        : "Lowest total interest. Can feel slow at the start.",
      result: avalanchePlan,
    },
    {
      key: "custom",
      icon: "\u270b",
      title: sv ? "Din egen ordning" : "Your own order",
      text: sv
        ? "Ordningen du dragit i Mina lån."
        : "The order you dragged in My debts.",
      result: plan,
    },
  ];
  // Vinnaren utses av siffrorna, inte i förväg. Tidigare stod det alltid att
  // "Dyraste först" sparar pengar, även när den inte gjorde det.
  const payable = routes.filter((r) => r.result.fullyPaid);
  const best = payable.reduce<(typeof routes)[number] | null>(
    (winner, route) =>
      !winner || route.result.totalInterest < winner.result.totalInterest
        ? route
        : winner,
    null,
  );
  const worst = payable.reduce<(typeof routes)[number] | null>(
    (loser, route) =>
      !loser || route.result.totalInterest > loser.result.totalInterest
        ? route
        : loser,
    null,
  );
  const spread =
    best && worst ? worst.result.totalInterest - best.result.totalInterest : 0;
  // Med två lån där det minsta också har högsta räntan blir "minsta först" och
  // "dyrast först" samma ordning. Då finns ingen vinnare att utse, och att peka
  // ut den som råkar ligga först i listan vore påhittat.
  const winners = best
    ? payable.filter((r) => r.result.totalInterest === best.result.totalInterest)
    : [];
  const hasSingleWinner = winners.length === 1 && spread > 0;
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 pb-40 md:px-8 md:py-10 md:pb-16">
      <Title
        eyebrow={t.tabs.compare}
        title={sv ? "Vad är bäst för dig?" : "What works best for you?"}
        sub={
          sv
            ? "Samma lån och samma pengar \u2014 bara olika ordning att betala av dem i."
            : "Same debts, same money \u2014 only the order changes."
        }
      />
      {loans.length < 2 ? (
        <p className="card p-5 text-sm text-white/65">
          {sv
            ? "L\u00e4gg till minst tv\u00e5 l\u00e5n f\u00f6r att kunna j\u00e4mf\u00f6ra ordningar."
            : "Add at least two debts to compare orders."}
        </p>
      ) : (
        <>
          <div
            className={`mb-5 inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${
              spread > 0
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/[.05] text-white/70"
            }`}
          >
            {hasSingleWinner && best
              ? sv
                ? `\u2b50 ${best.title} \u00e4r billigast \u2014 upp till ${money(spread, lang)} mindre i r\u00e4nta`
                : `\u2b50 ${best.title} is cheapest \u2014 up to ${money(spread, lang)} less interest`
              : spread > 0
                ? sv
                  ? `Flera ordningar \u00e4r lika billiga \u2014 upp till ${money(spread, lang)} mindre i r\u00e4nta \u00e4n den dyraste`
                  : `Several orders tie for cheapest \u2014 up to ${money(spread, lang)} less interest than the costliest`
                : sv
                  ? "Alla ordningar kostar lika mycket med de h\u00e4r l\u00e5nen"
                  : "Every order costs the same with these debts"}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {routes.map((route) => (
              <RouteCard
                key={route.key}
                lang={lang}
                icon={route.icon}
                title={route.title}
                text={route.text}
                result={route.result}
                best={Boolean(
                  spread > 0 &&
                    best &&
                    route.result.fullyPaid &&
                    route.result.totalInterest === best.result.totalInterest,
                )}
                extraInterest={
                  best && route.result.fullyPaid
                    ? route.result.totalInterest - best.result.totalInterest
                    : 0
                }
              />
            ))}
          </div>
          <div className="card mt-3 p-5">
            <h2 className="font-semibold">
              {sv ? "Din ordning" : "Your order"}
            </h2>
            <p className="mt-1 text-xs text-white/65">
              {sv
                ? "Översta lånet får alla frigjorda pengar först."
                : "The top debt receives every freed payment first."}
            </p>
            <ol className="mt-4 space-y-2">
              {loans.map((loan, i) => (
                <li
                  key={loan.id}
                  className="flex items-center gap-2 rounded-xl border border-white/[.06] bg-black/15 p-2 pl-3 text-sm"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/5 text-xs">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{loan.name}</span>
                  <span className="shrink-0 text-xs text-white/55">
                    {(loan.interestRate * 100)
                      .toFixed(1)
                      .replace(".", sv ? "," : ".")}{" "}
                    %
                  </span>
                  {/* Knappar i stället för dra-och-släpp: den här listan
                      använde HTML5-drag, som inte fungerar med touch alls.
                      På telefon gick ordningen alltså inte att ändra. */}
                  <span className="flex shrink-0 gap-1">
                    <MoveButton
                      disabled={i === 0}
                      label={sv ? `Flytta ${loan.name} uppåt` : `Move ${loan.name} up`}
                      onClick={() => setLoans((c) => swap(c, i, i - 1))}
                    >
                      ↑
                    </MoveButton>
                    <MoveButton
                      disabled={i === loans.length - 1}
                      label={sv ? `Flytta ${loan.name} nedåt` : `Move ${loan.name} down`}
                      onClick={() => setLoans((c) => swap(c, i, i + 1))}
                    >
                      ↓
                    </MoveButton>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </main>
  );
}

/** Byter plats på två lån i listan. */
function swap(loans: Loan[], from: number, to: number) {
  if (to < 0 || to >= loans.length) return loans;
  const next = [...loans];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function MoveButton({
  disabled,
  label,
  onClick,
  children,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-lg border border-white/[.08] bg-white/[.04] text-sm transition hover:bg-white/[.1] disabled:opacity-25 disabled:hover:bg-white/[.04]"
    >
      {children}
    </button>
  );
}

function RouteCard({
  lang,
  icon,
  title,
  text,
  result,
  best,
  extraInterest,
}: {
  lang: Lang;
  icon: string;
  title: string;
  text: string;
  result: PlanResult;
  best: boolean;
  extraInterest: number;
}) {
  const sv = lang === "sv";
  return (
    <div
      className={`card flex flex-col p-5 ${best ? "border-emerald-400/30 bg-emerald-500/[.04]" : ""}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        {best && (
          <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] font-bold tracking-wide text-emerald-300">
            {sv ? "BILLIGAST" : "CHEAPEST"}
          </span>
        )}
      </div>
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mt-1 flex-1 text-xs leading-5 text-white/65">{text}</p>
      <dl className="mt-4 space-y-1.5 border-t border-white/[.06] pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-white/55">{sv ? "Skuldfri" : "Debt-free"}</dt>
          <dd className="font-medium">
            {result.fullyPaid ? month(result.freedomDate, lang) : "\u2014"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/55">{sv ? "Total ränta" : "Total interest"}</dt>
          <dd className="font-medium">{money(result.totalInterest, lang)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-orange-300 md:min-h-[1.125rem]">
        {result.fullyPaid && extraInterest > 0
          ? `+${money(extraInterest, lang)} ${sv ? "mer i ränta än billigaste" : "more interest than the cheapest"}`
          : ""}
      </p>
    </div>
  );
}

function Choice({
  icon,
  title,
  text,
  date,
  best,
}: {
  icon: string;
  title: string;
  text: string;
  date: string;
  best?: boolean;
}) {
  return (
    <div className={`card p-4 ${best ? "border-emerald-400/25" : ""}`}>
      <div className="flex justify-between text-2xl">
        <span>{icon}</span>
        {best && (
          <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[12px] font-bold text-emerald-300">
            BEST
          </span>
        )}
      </div>
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-white/65">{text}</p>
      <p className="mt-5 text-sm text-white/60">{date}</p>
    </div>
  );
}
function FamilyLoanFields({
  lang,
  rate,
  setRate,
}: {
  lang: Lang;
  rate: number;
  setRate: (v: number) => void;
}) {
  const [agreement, setAgreement] = useState(true),
    sv = lang === "sv";
  return (
    <div className="ml-0 mt-3 rounded-xl border border-yellow-400/15 bg-yellow-400/[.05] p-3 md:ml-14">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={
            sv
              ? "Rimlig ränta? (Skatteverket kräver minst X%)"
              : "Reasonable interest?"
          }
          value={(rate * 100).toFixed(1).replace(".", sv ? "," : ".")}
          suffix="%"
          decimal
          onChange={(v) => setRate(Math.min(0.1, Math.max(0, v / 100)))}
        />
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={agreement}
            onChange={(e) => setAgreement(e.target.checked)}
            className="accent-blue-500"
          />
          {sv
            ? "Skriv skuldebrev? (mall)"
            : "Create a promissory note? (template)"}
        </label>
      </div>
      {rate < 0.01 && (
        <p className="mt-3 rounded-lg bg-yellow-400/10 p-2 text-xs text-yellow-200">
          ⚠️{" "}
          {sv
            ? "Under 1% — Skatteverket kan klassa som gåva. Sätt minst marknadsränta + 1% eller 2,5% för att vara safe."
            : "Below 1% may be treated as a gift. Use a documented market-based rate."}
        </p>
      )}
      <p className="mt-2 text-[12px] text-white/65">
        {sv
          ? "Inom familj: Ingen UC, men skriv papper. Räntan är avdragsgill om ni skriver skuldebrev. Under 1,5% kan ses som gåva av Skatteverket."
          : "Family loan: no credit check, but document it. Interest may be deductible with a written agreement."}
      </p>
    </div>
  );
}
function SavingsVsPayoff({
  lang,
  loanRate,
  loanName,
  deductible,
}: {
  lang: Lang;
  loanRate: number;
  loanName: string;
  deductible: boolean;
}) {
  const [cash, setCash] = useState(50000),
    [saveRate, setSaveRate] = useState(0.01),
    [debtRate, setDebtRate] = useState(loanRate),
    [deduction, setDeduction] = useState(deductible),
    sv = lang === "sv";
  // Följer lånet man jämför mot: byter användaren lån ska rutan följa med.
  useEffect(() => setDeduction(deductible), [deductible]);
  const { save, pay, diff, max } = useMemo(() => {
    const cashValue = new Big(Math.max(0, cash));
    const saveValue = cashValue
      .times(Math.max(0, saveRate))
      .times("0.7");
    const effectiveDebtRate = new Big(Math.max(0, debtRate)).times(
      deduction ? "0.7" : "1",
    );
    const payValue = cashValue.times(effectiveDebtRate);
    const saveNumber = Number(saveValue.toString());
    const payNumber = Number(payValue.toString());
    return {
      save: saveNumber,
      pay: payNumber,
      diff: Number(payValue.minus(saveValue).toString()),
      max: Math.max(saveNumber, payNumber, 1),
    };
  }, [cash, saveRate, debtRate, deduction]);
  useEffect(() => setDebtRate(loanRate), [loanRate]);
  return (
    <div className="card rounded-xl p-4">
      <b>{sv ? "Ska jag amortera eller spara?" : "Save or pay off?"} 🤔</b>
      <p className="mt-1 text-[11px] text-white/45">
        {sv ? "Jämför mot" : "Compared against"} {loanName}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field
          label={sv ? "Sparpengar" : "Savings"}
          value={number(cash, lang)}
          onChange={setCash}
        />
        <Field
          label={sv ? "Sparkonto ränta" : "Savings rate"}
          value={(saveRate * 100)
            .toFixed(1)
            .replace(".", sv ? "," : ".")}
          suffix=" %"
          decimal
          onChange={(v) => setSaveRate(v / 100)}
        />
        <Field
          label={sv ? "Lånets ränta" : "Loan rate"}
          value={(debtRate * 100)
            .toFixed(1)
            .replace(".", sv ? "," : ".")}
          suffix=" %"
          decimal
          onChange={(v) => setDebtRate(v / 100)}
        />
        <label className="flex items-center gap-2 rounded-2xl border border-white/[.06] bg-black/10 p-3 text-[12px] text-white/65">
          <input
            type="checkbox"
            checked={deduction}
            onChange={(e) => setDeduction(e.target.checked)}
            className="h-4 w-4 shrink-0 accent-blue-500"
          />
          <span className="min-w-0">
            {sv ? "Ränteavdrag" : "Deduction"}
            {!deductible && (
              <span className="mt-0.5 block text-[11px] text-white/45">
                {sv
                  ? "Gäller inte lån utan säkerhet"
                  : "Not for unsecured debt"}
              </span>
            )}
          </span>
        </label>
      </div>
      <div className="mt-4 space-y-2 text-[12px]">
        <Bar
          lang={lang}
          label={sv ? "Spara" : "Save"}
          value={save}
          max={max}
          color="#3B82F6"
        />
        <Bar
          lang={lang}
          label={sv ? "Amortera" : "Pay off"}
          value={pay}
          max={max}
          color="#10B981"
        />
      </div>
      <div
        className={`mt-4 rounded-full px-3 py-2 text-center text-xs font-semibold ${diff >= 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-blue-400/10 text-blue-300"}`}
      >
        ✅{" "}
        {diff >= 0
          ? sv
            ? `Betala av lånet — ${money(diff, lang)}/år bättre`
            : `Pay off — ${money(diff, lang)}/year better`
          : sv
            ? `Spara — ${money(-diff, lang)}/år bättre`
            : `Save — ${money(-diff, lang)}/year better`}
      </div>
      <p className="mt-2 text-center text-[12px] text-white/55">
        {sv ? "Cirka på 5 år" : "Roughly over 5 years"}:{" "}
        {money(Math.abs(diff) * 5, lang)} {sv ? "skillnad" : "difference"}
      </p>
    </div>
  );
}
function Bar({
  lang,
  label,
  value,
  max,
  color,
}: {
  lang: Lang;
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between gap-3">
        <span>{label}</span>
        <span className="tabular-nums">
          {number(value, lang)} {lang === "sv" ? "kr/år" : "kr/yr"}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-white/5">
        <div
          className="h-full rounded-full"
          style={{ width: `${(value / max) * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

function TodayV5(p: any) {
  const lang: Lang = p.lang;
  const {
      loans,
      setLoans,
      t,
      result,
      updateLoan,
      monthlyTotal,
      addDebt,
      loanKinds,
      setLoanKinds,
      amortKinds,
      setAmortKinds,
      expanded,
      setExpanded,
      fearRate,
      setFearRate,
      income,
      setIncome,
      leasingTerms,
      setLeasingTerms,
      timeBoxes,
      setTimeBoxes,
      plan,
      avalanchePlan,
    } = p,
    sv = lang === "sv";
  const debtPlanLoans = useMemo<Loan[]>(
    () =>
      loans.filter((loan: Loan) => loanKinds[loan.id] !== "leasing"),
    [loanKinds, loans],
  );
  const mortgage =
    debtPlanLoans.find((x: Loan) => loanKinds[x.id] === "mortgage") ||
    debtPlanLoans[0];
  const highestRateLoan = debtPlanLoans.reduce<Loan | null>(
    (highest, loan) =>
      !highest || loan.interestRate > highest.interestRate ? loan : highest,
    null,
  );
  // Stresstestet måste räknas med samma motor och samma spelregler som
  // huvudplanen, annars jämförs två olika verkligheter. Enda skillnaden är
  // bolåneräntan.
  const stressed = useMemo<PlanResult | null>(
    () =>
      mortgage
        ? simulatePlan({
            loans: (plan as PlanResult).loans.map((row) => {
              const source = debtPlanLoans.find((x: Loan) => x.id === row.id)!;
              return {
                id: source.id,
                name: source.name,
                balance: source.balance,
                interestRate:
                  source.id === mortgage.id
                    ? source.interestRate + fearRate / 100
                    : source.interestRate,
                monthlyPayment: source.currentMonthlyPayment,
                paymentStyle: source.paymentStyle,
                extraMonthly: source.extraMonthly,
                extraMonthlyEnabled: source.extraMonthlyEnabled,
              };
            }),
            strategy: "custom",
            startDate: START,
            oneTimePayments: [],
            rollover: true,
          })
        : null,
    [debtPlanLoans, mortgage, fearRate, plan],
  );
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setLoans((current: Loan[]) => {
      const oldIndex = current.findIndex((loan) => loan.id === active.id);
      const newIndex = current.findIndex((loan) => loan.id === over.id);
      return oldIndex < 0 || newIndex < 0
        ? current
        : arrayMove(current, oldIndex, newIndex);
    });
  };
  const changeKind = (loan: Loan, kind: LoanKind) => {
    const m = LOAN_KINDS[kind],
      a: AmortKind =
        kind === "mortgage"
          ? "fixed_amort"
          : kind === "leasing"
            ? "fixed_cost"
            : "annuity";
    setLoanKinds((x: any) => ({ ...x, [loan.id]: kind }));
    setAmortKinds((x: any) => ({ ...x, [loan.id]: a }));
    if (kind === "leasing") {
      setLeasingTerms((current: Record<string, LeasingTerms>) => ({
        ...current,
        [loan.id]: current[loan.id] || DEFAULT_LEASING_TERMS,
      }));
    }
    setLoans((all: Loan[]) =>
      all.map((x) =>
        x.id === loan.id
          ? {
              ...x,
              name: m[lang as Lang],
              currentMonthlyPayment:
                kind === "leasing"
                  ? leasingTerms[loan.id]?.monthlyCost ||
                    DEFAULT_LEASING_TERMS.monthlyCost
                  : x.currentMonthlyPayment,
              paymentStyle: a === "fixed_amort" ? "fixed_amort" : "annuity",
              loanType: a === "fixed_amort" ? "Rak amortering" : "Annuitet",
            }
          : x,
      ),
    );
  };
  const changeAmort = (loan: Loan, a: AmortKind) => {
    setAmortKinds((x: any) => ({ ...x, [loan.id]: a }));
    updateLoan(
      loan.id,
      "paymentStyle",
      a === "fixed_amort" ? "fixed_amort" : "annuity",
    );
  };
  const addPreset = (kind: LoanKind) => {
    const id = crypto.randomUUID();
    const presets: Record<LoanKind, Partial<Loan>> = {
      mortgage: {
        balance: 2_128_112,
        interestRate: 0.041,
        currentMonthlyPayment: 8_400,
        paymentStyle: "fixed_amort",
        loanType: "Rak amortering",
      },
      personal: {
        balance: 180_000,
        interestRate: 0.085,
        currentMonthlyPayment: 3_900,
      },
      leasing: {
        balance: 0,
        interestRate: 0,
        currentMonthlyPayment: DEFAULT_LEASING_TERMS.monthlyCost,
      },
      family: {
        balance: 50_000,
        interestRate: 0.025,
        currentMonthlyPayment: 1_000,
      },
      installment: {
        balance: 24_000,
        interestRate: 0,
        currentMonthlyPayment: 1_000,
      },
      car: {},
      student: {},
      credit: {
        balance: 7_554,
        interestRate: 0.23,
        currentMonthlyPayment: 425,
      },
      other: {},
    };
    const meta = LOAN_KINDS[kind];
    setLoanKinds((x: any) => ({ ...x, [id]: kind }));
    if (kind === "leasing") {
      setLeasingTerms((current: Record<string, LeasingTerms>) => ({
        ...current,
        [id]: { ...DEFAULT_LEASING_TERMS },
      }));
    }
    setAmortKinds((x: any) => ({
      ...x,
      [id]:
        kind === "mortgage"
          ? "fixed_amort"
          : kind === "leasing"
            ? "fixed_cost"
            : "annuity",
    }));
    setLoans((current: Loan[]) => [
      ...current,
      {
        id,
        name: meta[lang],
        loanType: "Annuitet",
        paymentStyle: "annuity",
        balance: 100_000,
        interestRate: meta.rate,
        currentMonthlyPayment: 2_500,
        extraMonthly: 0,
        extraMonthlyEnabled: true,
        extraMonthlyFrom: START,
        ...presets[kind],
      },
    ]);
  };
  return (
    <main className="mx-auto grid max-w-[1280px] gap-3 px-4 py-6 pb-40 md:px-8 md:py-8 md:pb-16 lg:grid-cols-[1fr_360px] lg:items-start">
      <section className="order-2 min-w-0 lg:order-none lg:col-start-1 lg:row-span-2">
        <Title
          eyebrow={sv ? "Räkna på vad som helst" : "Calculate anything"}
          title={t.plan}
          sub={
            sv
              ? "Lån, leasing eller avbetalning — jämför på samma villkor."
              : "Loans, leasing or installments—compare on equal terms."
          }
          action={
            <button onClick={addDebt} className="button w-full md:w-auto">
              <Plus size={14} />
              {t.add}
            </button>
          }
        />
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {(
            [
              "mortgage",
              "personal",
              "credit",
              "leasing",
              "family",
              "installment",
            ] as LoanKind[]
          ).map((kind) => (
            <button
              key={kind}
              onClick={() => addPreset(kind)}
              className="pill shrink-0 whitespace-nowrap"
            >
              +{" "}
              {kind === "leasing"
                ? "Leasing"
                : kind === "family"
                ? sv
                  ? "Inom familj 50k"
                  : "Family loan 50k"
                : kind === "installment"
                  ? sv
                    ? "Avbetalning Elgiganten"
                    : "Store installment"
                  : LOAN_KINDS[kind][lang]}
            </button>
          ))}
        </div>
        <p className="mb-3 text-xs text-white/65">
          {sv
            ? "Dra lånen för att välja i vilken ordning du betalar av dem. Det översta lånet betalas av först — när det är klart går pengarna vidare till nästa."
            : "Drag your debts to choose the order you pay them off. The top one is paid first — when it's done, that money rolls into the next."}
        </p>
        <DndContext
          sensors={dragSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={loans.map((loan: Loan) => loan.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {loans.map((loan: Loan) => {
                const kind: LoanKind = loanKinds[loan.id] || "other";
                const meta = LOAN_KINDS[kind];
                const advanced = expanded[loan.id];
                const planLoan = (plan as PlanResult).loans.find(
                  (item) => item.id === loan.id,
                );
                const leasing =
                  leasingTerms[loan.id] || DEFAULT_LEASING_TERMS;
                const timeBox = timeBoxes[loan.id] || {
                  enabled: false,
                  months: 60,
                };
                return (
                  <SortableLoanCard
                    key={loan.id}
                    id={loan.id}
                    disabled={kind === "leasing"}
                    label={`${sv ? "Flytta" : "Move"} ${loan.name}`}
                  >
                    <article className="card relative p-4">
                      <div className="flex gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[.05] text-xl">
                          {meta.icon}
                        </span>
                        <div className="grid min-w-0 flex-1 gap-2 pr-9 sm:grid-cols-2 sm:pr-10">
                          <Select
                            label={sv ? "Typ av lån" : "Loan type"}
                            value={kind}
                            onChange={(value) =>
                              changeKind(loan, value as LoanKind)
                            }
                          >
                            {(Object.keys(LOAN_KINDS) as LoanKind[]).map(
                              (option) => (
                                <option key={option} value={option}>
                                  {LOAN_KINDS[option].icon}{" "}
                                  {LOAN_KINDS[option][lang]}
                                </option>
                              ),
                            )}
                          </Select>
                          {kind !== "leasing" ? (
                            <label>
                              <small className="label">
                                {sv ? "Namn" : "Name"}
                              </small>
                              <input
                                spellCheck={false}
                                value={loan.name}
                                onChange={(event) =>
                                  setLoans((current: Loan[]) =>
                                    current.map((item) =>
                                      item.id === loan.id
                                        ? { ...item, name: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                className="input"
                              />
                            </label>
                          ) : (
                            <div className="rounded-xl border border-white/[.05] bg-white/[.025] p-3 text-xs text-white/65">
                              {sv
                                ? "Jämförelse — påverkar inte skuldfri-datum"
                                : "Comparison — does not affect debt-free date"}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`${sv ? "Ta bort" : "Remove"} ${loan.name}`}
                          onClick={() => {
                            setLoans((current: Loan[]) =>
                              current.filter((item) => item.id !== loan.id),
                            );
                            setLeasingTerms(
                              (current: Record<string, LeasingTerms>) => {
                                const next = { ...current };
                                delete next[loan.id];
                                return next;
                              },
                            );
                            setTimeBoxes((current: Record<string, TimeBox>) => {
                              const next = { ...current };
                              delete next[loan.id];
                              return next;
                            });
                          }}
                          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/[.06] hover:text-white"
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <p
                        className={`mt-2 text-[12px] sm:ml-14 ${kind === "credit" ? "text-red-400" : "text-white/55"}`}
                      >
                        {meta[sv ? "helpSv" : "helpEn"]}
                      </p>

                      {kind === "leasing" ? (
                        <LeasingLoanFields
                          lang={lang}
                          value={leasing}
                          onChange={(next) => {
                            setLeasingTerms(
                              (current: Record<string, LeasingTerms>) => ({
                                ...current,
                                [loan.id]: next,
                              }),
                            );
                            updateLoan(
                              loan.id,
                              "currentMonthlyPayment",
                              next.monthlyCost,
                            );
                          }}
                        />
                      ) : (
                        <>
                          {kind === "family" ? (
                            <FamilyLoanFields
                              lang={lang}
                              rate={loan.interestRate}
                              setRate={(value) =>
                                updateLoan(loan.id, "interestRate", value)
                              }
                            />
                          ) : null}
                          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <Field
                              label={t.balance}
                              value={number(loan.balance, lang)}
                              onChange={(value) =>
                                updateLoan(loan.id, "balance", value)
                              }
                            />
                            <div>
                              <Field
                                label={t.rate}
                                value={(loan.interestRate * 100)
                                  .toFixed(1)
                                  .replace(".", sv ? "," : ".")}
                                suffix=" %"
                                decimal
                                onChange={(value) => {
                                  const minimum =
                                    kind === "mortgage" || kind === "personal"
                                      ? 0.1
                                      : 0;
                                  const maximum =
                                    kind === "mortgage"
                                      ? 15
                                      : kind === "personal"
                                        ? 30
                                        : 100;
                                  updateLoan(
                                    loan.id,
                                    "interestRate",
                                    Math.min(maximum, Math.max(minimum, value)) /
                                      100,
                                  );
                                }}
                              />
                              {kind === "mortgage" || kind === "personal" ? (
                                <p className="mt-1 px-1 text-[11px] text-white/45">
                                  {kind === "mortgage" ? "0,1–15 %" : "0,1–30 %"}
                                </p>
                              ) : null}
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <Field
                                label={sv ? "Månadskostnad" : "Monthly cost"}
                                value={number(loan.currentMonthlyPayment, lang)}
                                onChange={(value) =>
                                  updateLoan(
                                    loan.id,
                                    "currentMonthlyPayment",
                                    value,
                                  )
                                }
                              />
                            </div>
                          </div>

                          {kind === "credit" ? (
                            <CreditLoanMetrics
                              lang={lang}
                              balance={loan.balance}
                              interestRate={loan.interestRate}
                              monthlyPayment={loan.currentMonthlyPayment}
                              paymentStyle={loan.paymentStyle}
                            />
                          ) : loan.currentMonthlyPayment <=
                            (loan.balance * loan.interestRate) / 12 ? (
                            <p className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
                              ⚠️{" "}
                              {sv
                                ? "Månadskostnaden täcker inte räntan. Skulden växer."
                                : "The monthly payment does not cover interest. This debt grows."}
                            </p>
                          ) : planLoan && !planLoan.fullyPaid ? (
                            <p className="mt-3 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 text-xs text-orange-200">
                              ⚠️{" "}
                              {sv
                                ? "Planen tar längre än 50 år. Höj månadsbetalningen."
                                : "This plan takes longer than 50 years. Increase the monthly payment."}
                            </p>
                          ) : null}

                          {planLoan ? (
                            <div className="mt-3 rounded-xl border border-blue-400/15 bg-blue-500/[.06] px-3 py-2 text-xs text-blue-200">
                              {planLoan.fullyPaid
                                ? `${sv ? "Klart" : "Done"} ${month(planLoan.endDate, lang)} · ${describePace(planLoan, lang)}`
                                : sv
                                  ? "Inte skuldfri inom 50 år med nuvarande betalning"
                                  : "Not debt-free within 50 years at this payment"}
                            </div>
                          ) : null}

                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((current: Record<string, boolean>) => ({
                                ...current,
                                [loan.id]: !advanced,
                              }))
                            }
                            className="mt-4 text-xs text-blue-300"
                          >
                            {advanced
                              ? sv
                                ? "Visa färre inställningar ↑"
                                : "Show fewer settings ↑"
                              : sv
                                ? "Fler inställningar ↓"
                                : "More settings ↓"}
                          </button>
                          {advanced ? (
                            <div className="mt-4 space-y-4 rounded-2xl border border-white/[.05] bg-black/10 p-4">
                              <div className="max-w-sm">
                                <Select
                                  label={
                                    sv ? "Hur betalar du?" : "How do you pay?"
                                  }
                                  value={amortKinds[loan.id] || "annuity"}
                                  onChange={(value) =>
                                    changeAmort(loan, value as AmortKind)
                                  }
                                >
                                  <option value="fixed_amort">
                                    {sv
                                      ? "Rak amortering"
                                      : "Straight-line principal"}
                                  </option>
                                  <option value="annuity">
                                    {sv ? "Annuitet" : "Annuity"}
                                  </option>
                                  <option value="interest_free">
                                    {sv
                                      ? "Räntefritt / Amorteringsfritt"
                                      : "Interest-free / Payment holiday"}
                                  </option>
                                </Select>
                                <p className="mt-2 text-[12px] text-white/65">
                                  {sv
                                    ? "Rak amortering: du betalar av lika mycket varje månad, och räntan sjunker efter hand — så månadskostnaden blir lägre med tiden. Annuitet: du betalar exakt lika mycket varje månad hela vägen."
                                    : "Straight-line: you pay off the same amount each month and the interest shrinks over time, so the monthly cost drops. Annuity: you pay exactly the same amount every month throughout."}
                                </p>
                              </div>

                              <TimeBoxControl
                                lang={lang}
                                value={timeBox}
                                onChange={(next) =>
                                  setTimeBoxes(
                                    (current: Record<string, TimeBox>) => ({
                                      ...current,
                                      [loan.id]: next,
                                    }),
                                  )
                                }
                              />

                              <div>
                                <Field
                                  label={t.extra}
                                  value={number(loan.extraMonthly || 0, lang)}
                                  onChange={(value) =>
                                    updateLoan(loan.id, "extraMonthly", value)
                                  }
                                />
                                <p className="mt-3 text-xs text-white/65">
                                  {sv
                                    ? `När lånet är klart flyttas ${number(freedMonthly(loan), lang)} kr/mån automatiskt till nästa lån i ordningen.`
                                    : `When this is paid off, SEK ${number(freedMonthly(loan), lang)}/month rolls into the next debt in line.`}
                                </p>
                                <p className="mt-2 text-xs text-white/65">
                                  {sv
                                    ? "Du betalar totalt"
                                    : "You pay a total of"}{" "}
                                  <b className="text-white">
                                    {money(
                                      loan.balance +
                                        (planLoan?.totalInterest || 0),
                                      lang,
                                    )}
                                  </b>{" "}
                                  · {sv ? "varav" : "including"}{" "}
                                  {money(planLoan?.totalInterest || 0, lang)}{" "}
                                  {sv ? "ränta" : "interest"}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </article>
                  </SortableLoanCard>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </section>
      <div className="order-1 min-w-0 lg:order-none lg:col-start-2 lg:row-start-1">
        <ResultSidebar
          lang={lang}
          t={t}
          loans={debtPlanLoans}
          plan={plan}
          avalanchePlan={avalanchePlan}
          monthlyTotal={monthlyTotal}
        />
      </div>
      <aside className="order-3 min-w-0 space-y-3 lg:order-none lg:col-start-2 lg:row-start-2">
        {highestRateLoan ? (
          <SavingsVsPayoff
            lang={lang}
            loanRate={highestRateLoan.interestRate}
            loanName={highestRateLoan.name}
            deductible={isDeductible(loanKinds[highestRateLoan.id])}
          />
        ) : null}
        {mortgage && stressed ? (
          <Fear
            lang={lang}
            rate={fearRate}
            setRate={setFearRate}
            mortgage={mortgage}
            plan={plan}
            stressed={stressed}
            income={income}
            setIncome={setIncome}
            monthly={monthlyTotal}
          />
        ) : null}
      </aside>
    </main>
  );
}
function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label>
      <small className="label">{label}</small>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      >
        {children}
      </select>
    </label>
  );
}
function Fear({
  lang,
  rate,
  setRate,
  mortgage,
  plan,
  stressed,
  income,
  setIncome,
  monthly,
}: {
  lang: Lang;
  rate: number;
  setRate: (n: number) => void;
  mortgage: Loan;
  plan: PlanResult;
  stressed: PlanResult;
  income: number;
  setIncome: (n: number) => void;
  monthly: number;
}) {
  const [incomeDrop, setIncomeDrop] = useState(20);
  const sv = lang === "sv",
    monthlyShock = (mortgage.balance * (rate / 100)) / 12,
    // Båda sidor kommer ur samma motor, så skillnaden är ren ränteeffekt.
    interestShock = Math.max(0, stressed.totalInterest - plan.totalInterest),
    monthsShock =
      stressed.fullyPaid && plan.fullyPaid
        ? Math.max(0, stressed.totalMonths - plan.totalMonths)
        : 0;
  return (
    <div className="card rounded-xl p-3">
      <div className="flex items-center justify-between">
        <b>{sv ? "Tänk om räntan stiger" : "What if rates rise"}</b>
        <input
          type="number"
          min="0.1"
          max="20"
          step="0.1"
          value={rate}
          onChange={(e) =>
            setRate(Math.min(20, Math.max(0.1, +e.target.value)))
          }
          className="h-8 w-20 rounded-lg border border-white/10 bg-black/20 px-2 text-right text-xs text-orange-300 outline-none"
        />
      </div>
      <p className="mt-4 text-xs text-white/65">
        {sv ? "Om räntan går upp" : "If rates increase"} +{rate}%
      </p>
      <input
        type="range"
        min="0.1"
        max="20"
        step="0.1"
        value={rate}
        onChange={(e) => setRate(+e.target.value)}
        className="mt-3 w-full accent-orange-500"
      />
      <div className="mt-3 flex gap-2">
        {[0.5, 2, 5, 10].map((n) => (
          <button
            key={n}
            onClick={() => setRate(n)}
            className={`pill ${rate === n ? "active" : ""}`}
          >
            +{n.toFixed(n < 1 ? 1 : 0)}%
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-orange-500/10 p-3 text-xs text-orange-200">
        {(mortgage.interestRate * 100).toFixed(1)}% →{" "}
        {((mortgage.interestRate + rate / 100) * 100).toFixed(1)}% ·{" "}
        <b>
          +{money(monthlyShock, lang)}/{sv ? "mån" : "mo"}
        </b>
        <br />+{money(interestShock, lang)}{" "}
        {sv ? "mer i ränta totalt" : "more interest in total"}
        {stressed.fullyPaid ? (
          <>
            {" · "}
            {sv ? "skuldfri" : "debt-free"} {month(stressed.freedomDate, lang)}
            {monthsShock > 0
              ? ` (${duration(monthsShock, lang)} ${sv ? "senare" : "later"})`
              : ""}
          </>
        ) : null}
      </div>
      <label className="mt-4 block text-xs text-white/65">
        {sv ? "Nettoinkomst (valfritt)" : "Net income (optional)"}
        <input
          spellCheck={false}
          type="number"
          value={income || ""}
          onChange={(e) => setIncome(+e.target.value)}
          className="input mt-2"
        />
      </label>
      <label className="mt-3 block text-xs text-white/65">
        {sv ? "Om inkomsten går ner" : "If income drops"} {incomeDrop}%
        <input
          type="range"
          min="10"
          max="50"
          step="5"
          value={incomeDrop}
          onChange={(e) => setIncomeDrop(+e.target.value)}
          className="mt-2 w-full accent-red-500"
        />
      </label>
      {income > 0 && monthly / income > 0.6 && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {sv
            ? "Utgifterna är över 60% av inkomsten. Klarar du 20% lägre inkomst?"
            : "Outflow exceeds 60% of income. Could you handle a 20% income drop?"}
        </p>
      )}
    </div>
  );
}
function RefinanceV5({
  lang,
  t,
  bake,
  bakeAmount,
  setBakeAmount,
  propertyValue,
  setPropertyValue,
  mortgageValue,
  setMortgageValue,
  personalTotal,
  setPersonalTotal,
}: {
  lang: Lang;
  t: Copy;
  bake: BakeInResult;
  bakeAmount: number;
  setBakeAmount: (n: number) => void;
  propertyValue: number;
  setPropertyValue: (n: number) => void;
  mortgageValue: number;
  setMortgageValue: (n: number) => void;
  personalTotal: number;
  setPersonalTotal: (n: number) => void;
}) {
  const sv = lang === "sv";
  const [choice, setChoice] = useState<"keepPaying" | "minimumPayment">(
    "keepPaying",
  );
  const scenario = bake.scenarios[choice];
  const color =
    bake.ltvAfter < 0.7 ? "#22C55E" : bake.ltvAfter <= 0.85 ? "#EAB308" : "#EF4444";
  const sliderMax = Math.max(1, personalTotal);
  const monthsEarlier = scenario.feasible
    ? Math.max(0, bake.todayMonths - scenario.months)
    : 0;
  return (
    <main className="mx-auto max-w-[1120px] px-4 py-6 pb-40 md:px-8 md:py-10 md:pb-16">
      <Title
        eyebrow={t.tabs.refinance}
        title={t.refinanceTitle}
        sub={t.refinanceSub}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <div className="card p-5 md:p-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field
              label={t.property}
              value={number(propertyValue, lang)}
              onChange={setPropertyValue}
            />
            <Field
              label={t.mortgage}
              value={number(mortgageValue, lang)}
              onChange={setMortgageValue}
            />
            <div className="col-span-2 sm:col-span-1">
              <Field
                label={t.personal}
                value={number(personalTotal, lang)}
                onChange={(n) =>
                  setPersonalTotal(Math.min(10_000_000, Math.max(0, n)))
                }
              />
            </div>
          </div>

          <div className="mt-6 flex items-end gap-2">
            <div className="flex-1">
              <Field
                label={t.baked}
                value={number(bakeAmount, lang)}
                onChange={(n) => setBakeAmount(Math.min(sliderMax, Math.max(0, n)))}
              />
            </div>
            <button
              onClick={() => setBakeAmount(personalTotal)}
              className="button shrink-0 self-stretch px-4 py-0"
            >
              {sv ? "Allt" : "All"}
            </button>
          </div>
          <input
            type="range"
            aria-label={t.baked}
            min={0}
            max={sliderMax}
            step={1000}
            value={Math.min(bakeAmount, sliderMax)}
            onChange={(e) => setBakeAmount(Number(e.target.value))}
            className="range mt-4 w-full"
            style={
              {
                "--fill": `${(Math.min(bakeAmount, sliderMax) / sliderMax) * 100}%`,
              } as React.CSSProperties
            }
          />
          <p className="mt-2 text-sm text-white/65">
            {sv ? "Baka in" : "Bake in"}{" "}
            {personalTotal ? Math.round((bake.bake / personalTotal) * 100) : 0}% ={" "}
            <b className="text-white">{money(bake.bake, lang)}</b>
          </p>

          <div className="mt-6 rounded-2xl border border-white/[.06] bg-black/20 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white/65">{t.newLtv}</span>
              <b className="text-3xl md:text-4xl" style={{ color }}>
                {(bake.ltvAfter * 100).toFixed(1)}%
              </b>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(bake.ltvAfter * 100, 100)}%`,
                  background: color,
                }}
              />
            </div>
            <p className="mt-3 text-xs text-white/55">
              {bandLabel(bake.bandAfter, lang)}
              {bake.amortKrDelta > 1
                ? ` \u00b7 ${sv ? "amortering" : "amortisation"} +${money(bake.amortKrDelta, lang)}/${sv ? "m\u00e5n" : "mo"}`
                : ""}
            </p>
          </div>
          {bake.warningText && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" />
              <span>{bake.warningText}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="card p-5">
            <div className="text-xs font-semibold uppercase tracking-[.14em] text-white/55">
              {sv ? "Vad g\u00f6r du med pengarna?" : "What do you do with the money?"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  {
                    key: "keepPaying" as const,
                    label: sv ? "Betala som idag" : "Keep paying",
                  },
                  {
                    key: "minimumPayment" as const,
                    label: sv ? "S\u00e4nk kostnaden" : "Lower the cost",
                  },
                ]
              ).map((option) => (
                <button
                  key={option.key}
                  onClick={() => setChoice(option.key)}
                  aria-pressed={choice === option.key}
                  className={`min-h-[44px] rounded-xl px-3 text-xs font-medium transition ${
                    choice === option.key
                      ? "bg-white/[.14] text-white"
                      : "bg-white/[.04] text-white/60 hover:bg-white/[.08]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-white/65">
              {choice === "keepPaying"
                ? sv
                  ? "Du forts\u00e4tter betala lika mycket varje m\u00e5nad. Det som blir \u00f6ver n\u00e4r blancol\u00e5net krympt g\u00e5r till bol\u00e5net."
                  : "You keep paying the same each month. What is left over goes to the mortgage."
                : sv
                  ? "Du s\u00e4nker till lagkravet p\u00e5 amortering plus r\u00e4nta. Billigare i m\u00e5naden \u2014 dyrare totalt."
                  : "You drop to the required amortisation plus interest. Cheaper monthly \u2014 more expensive in total."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="card p-5">
              <span className="text-sm text-white/65">{t.newMonthly}</span>
              <div className="mt-2 text-3xl font-semibold">
                {money(scenario.monthlyPayment, lang)}
              </div>
              <p
                className={`mt-2 text-xs ${scenario.monthlyDelta <= 0 ? "text-emerald-400" : "text-orange-400"}`}
              >
                {scenario.monthlyDelta === 0
                  ? sv
                    ? "Samma som idag"
                    : "Same as today"
                  : `${scenario.monthlyDelta < 0 ? "\u2212" : "+"}${money(Math.abs(scenario.monthlyDelta), lang)} / ${sv ? "m\u00e5n" : "mo"}`}
              </p>
            </div>
            <div className="card p-5">
              <span className="text-sm text-white/65">{t.newDate}</span>
              <div className="mt-2 text-3xl font-semibold">
                {scenario.feasible ? month(scenario.debtFreeDate, lang) : "\u2014"}
              </div>
              <p className="mt-2 text-xs text-white/55">
                {!scenario.feasible
                  ? sv
                    ? "Betalningen t\u00e4cker inte r\u00e4ntan"
                    : "The payment does not cover the interest"
                  : monthsEarlier > 0
                    ? `${duration(monthsEarlier, lang)} ${sv ? "tidigare \u00e4n idag" : "earlier than today"}`
                    : sv
                      ? `Idag: ${month(bake.todayDebtFreeDate, lang)}`
                      : `Today: ${month(bake.todayDebtFreeDate, lang)}`}
              </p>
            </div>
          </div>

          <div className="card p-5">
            <span className="text-sm text-white/65">
              {scenario.interestSavedNet >= 0
                ? sv
                  ? "Sparad r\u00e4nta efter avdrag"
                  : "Interest saved after deduction"
                : sv
                  ? "Extra r\u00e4nta efter avdrag"
                  : "Extra interest after deduction"}
            </span>
            <div
              className={`mt-2 text-3xl font-semibold ${scenario.interestSavedNet >= 0 ? "text-emerald-300" : "text-orange-300"}`}
            >
              {scenario.feasible ? (
                <CountUp value={Math.abs(scenario.interestSavedNet)} lang={lang} />
              ) : (
                "\u2014"
              )}
            </div>
            <p className="mt-3 text-xs leading-5 text-white/55">
              {sv
                ? "Bol\u00e5ner\u00e4nta \u00e4r avdragsgill, blancor\u00e4nta i praktiken inte. Siffran \u00e4r r\u00e4knad per l\u00e5netyp."
                : "Mortgage interest is deductible, unsecured interest in practice is not. Calculated per loan type."}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
