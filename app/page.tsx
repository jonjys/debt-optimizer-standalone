"use client";

import { calculateBakeIn } from "@/lib/debt-optimizer/bake-in";
import { calculatePayoffSchedule } from "@/lib/debt-optimizer/engine";
import type {
  CalculationResult,
  Loan,
  PayoffStrategy,
} from "@/lib/debt-optimizer/types";
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
type Reinvestment = {
  fromLoanId: string;
  toLoanId: string;
  amount: number;
  enabled: boolean;
};
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
    rate: 0.19,
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
    personal: "Personal loans total",
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
} as const;

const TAB_LABELS = {
  en: { today: "Today", compare: "What is best?", refinance: "Refinance" },
  sv: { today: "Idag", compare: "Vad är bäst?", refinance: "Baka in" },
} as const;
(COPY.en.tabs as { compare: string }).compare = TAB_LABELS.en.compare;
(COPY.sv.tabs as { compare: string }).compare = TAB_LABELS.sv.compare;

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
const money = (n: number, lang: Lang, compact = false) =>
  new Intl.NumberFormat(lang === "sv" ? "sv-SE" : "en-US", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(Number(n.toFixed(0)));
const month = (ym: string, lang: Lang) => {
  if (!ym || ym === "-") return "—";
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "sv" ? "sv-SE" : "en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1));
};
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

export default function Page() {
  const [lang, setLang] = useState<Lang>("en");
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
  const [leasingCompare, setLeasingCompare] = useState({
    enabled: false,
    description: "Toyota Corolla leasing",
    monthly: 5000,
    months: 36,
    cash: 280000,
    residual: 180000,
  });
  const [strategy, setStrategy] = useState<PayoffStrategy>("avalanche");
  const [reinvestments, setReinvestments] = useState<Reinvestment[]>([]);
  const [propertyValue, setPropertyValue] = useState(3_027_201);
  const [mortgageValue, setMortgageValue] = useState(2_128_112);
  const [bakeAmount, setBakeAmount] = useState(180_000);
  const [toast, setToast] = useState<string | null>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const t = COPY[lang];

  useEffect(() => {
    const saved = localStorage.getItem("debtkill-lang");
    if (saved === "en" || saved === "sv") setLang(saved);
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

  const withReinvestments = useCallback(
    (source: Loan[]) =>
      source.map((loan) => {
        const rule = reinvestments.find(
          (r) => r.enabled && r.toLoanId === loan.id,
        );
        return {
          ...loan,
          reinvestment: rule
            ? {
                enabled: true,
                fromLoanId: rule.fromLoanId,
                amount: rule.amount,
                startDate: START,
              }
            : undefined,
        };
      }),
    [reinvestments],
  );
  const calculate = useCallback(
    (s: PayoffStrategy) =>
      loans.length
        ? calculatePayoffSchedule({
            loans: withReinvestments(loans),
            oneTimePayments: [],
            startDate: START,
            strategy: s,
          })
        : null,
    [loans, withReinvestments],
  );
  const result = useMemo(() => calculate(strategy), [calculate, strategy]);
  const avalanche = useMemo(() => calculate("avalanche"), [calculate]);
  const snowball = useMemo(() => calculate("snowball"), [calculate]);
  const personalTotal = loans
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
  const bake = useMemo(
    () =>
      calculateBakeIn({
        mortgage: mortgageValue,
        mortgageRate: loans[0]?.interestRate || 0.041,
        personal: personalTotal,
        personalRate: loans[1]?.interestRate || 0.085,
        homeValue: propertyValue,
        bakeAmount,
      }),
    [mortgageValue, propertyValue, personalTotal, bakeAmount, loans],
  );
  const refinanceDate = addMonths(
    START,
    Math.min(
      480,
      Math.ceil(
        bake.newMortgage /
          Math.max(
            1,
            bake.amortKrAfter || loans[0]?.currentMonthlyPayment || 8400,
          ),
      ),
    ),
  );
  const total = loans.reduce((sum, x) => sum + x.balance, 0);
  const monthlyTotal = loans.reduce(
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
  const setRule = (from: Loan, toLoanId: string) =>
    setReinvestments((current) => [
      ...current.filter((r) => r.fromLoanId !== from.id),
      ...(toLoanId
        ? [
            {
              fromLoanId: from.id,
              toLoanId,
              amount: from.currentMonthlyPayment + (from.extraMonthly || 0),
              enabled: true,
            },
          ]
        : []),
    ]);
  const updateRuleAmount = (fromId: string, amount: number) =>
    setReinvestments((current) =>
      current.map((r) => (r.fromLoanId === fromId ? { ...r, amount } : r)),
    );
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
    setReinvestments([
      {
        fromLoanId: "personal",
        toLoanId: "mortgage",
        amount: 5_700,
        enabled: true,
      },
    ]);
    setStarted(true);
    setToast(
      lang === "sv"
        ? "Exempellån inlästa · Återinvestering aktiv"
        : "Sample debts loaded · Reinvest demo active",
    );
    window.setTimeout(() => setToast(null), 3200);
    scrollToApp();
  };
  const handlePdf = (file?: File) => {
    if (!file || file.type !== "application/pdf") {
      setToast(lang === "sv" ? "Välj en PDF-fil" : "Please choose a PDF file");
      window.setTimeout(() => setToast(null), 3200);
      return;
    }
    fillSample();
    setToast(
      lang === "sv"
        ? "PDF mottagen · exempeldata används tills tolkning är klar"
        : "PDF received · sample fallback loaded",
    );
  };

  return (
    <div className="min-h-screen bg-[#06060A] text-white selection:bg-blue-500/30 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] [background-size:24px_24px]">
      <Header lang={lang} tab={tab} setTab={setTab} setLang={setLanguage} />
      {!started && (
        <Landing lang={lang} onStart={startFree} onSample={fillSample} />
      )}
      {loans.length > 0 && (
        <div ref={appRef} className="scroll-mt-20">
          <button
            onClick={() => setStarted(false)}
            className="ml-5 mt-5 text-xs text-white/35 hover:text-white md:ml-10"
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
              strategy={strategy}
              setStrategy={setStrategy}
              reinvestments={reinvestments}
              setRule={setRule}
              updateRuleAmount={updateRuleAmount}
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
              leasingCompare={leasingCompare}
              setLeasingCompare={setLeasingCompare}
              onPdf={handlePdf}
            />
          )}
          {tab === "compare" && avalanche && snowball && (
            <BestView
              lang={lang}
              t={t}
              cheapest={avalanche}
              smallest={snowball}
              loans={loans}
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
              refinanceDate={refinanceDate}
            />
          )}
          <div className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-3 rounded-2xl border border-white/10 bg-[#101015]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden">
            <Mini
              label={t.free}
              value={month(result?.newFreedomDate || "-", lang)}
            />
            <Mini
              label={
                loans.length === 1
                  ? lang === "sv"
                    ? "Total ränta"
                    : "Total interest"
                  : t.saved
              }
              value={money(
                loans.length === 1
                  ? result?.totalNewInterest || 0
                  : result?.totalInterestSaved || 0,
                lang,
                true,
              )}
            />
            <button
              onClick={addDebt}
              className="grid place-items-center rounded-xl bg-blue-500 text-xs font-semibold"
            >
              <Plus size={16} />
              {t.add}
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-emerald-400/20 bg-emerald-500/15 px-5 py-3 text-sm font-medium text-emerald-300 shadow-2xl backdrop-blur-xl"
        >
          {toast}
        </div>
      )}
      <footer className="mx-auto max-w-[1280px] px-5 py-8 text-center text-[11px] text-white/25">
        <p>
          {lang === "sv"
            ? "All matematik körs i din webbläsare. Ingen spårning. Ingen kostnad. Byggd med Big.js. 🇸🇪"
            : "All math runs in your browser. No tracking. No cost. Built with Big.js. 🇸🇪"}
        </p>
        <span className="mt-3 inline-flex rounded-full border border-white/[.06] px-3 py-1.5 text-white/35">
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
          <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-1 text-[9px] font-bold tracking-widest text-blue-300">
            PRO
          </span>
        </div>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 rounded-full border border-white/[.06] bg-white/[.025] p-1 md:flex">
          {(Object.keys(t.tabs) as Tab[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full px-5 py-2 text-xs transition ${tab === key ? "bg-white/10 text-white" : "text-white/35 hover:text-white/70"}`}
            >
              {t.tabs[key]}
            </button>
          ))}
        </nav>
        <div className="rounded-full border border-white/[.07] p-1 text-[11px] font-semibold">
          {(["en", "sv"] as Lang[]).map((x) => (
            <button
              key={x}
              onClick={() => setLang(x)}
              className={`rounded-full px-3 py-1.5 ${lang === x ? "bg-white/10" : "text-white/30"}`}
            >
              {x.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function Today(p: any) {
  const {
    lang,
    loans,
    setLoans,
    t,
    result,
    strategy,
    setStrategy,
    reinvestments,
    setRule,
    updateRuleAmount,
    updateLoan,
    total,
    monthlyTotal,
    addDebt,
  } = p;
  return (
    <main className="mx-auto grid max-w-[1480px] gap-6 px-5 py-10 pb-28 md:px-10 lg:grid-cols-[1fr_390px]">
      <section>
        <Title
          eyebrow={t.tabs.today}
          title={t.plan}
          sub={t.hint}
          action={
            <button onClick={addDebt} className="button">
              <Plus size={14} />
              {t.add}
            </button>
          }
        />
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Stat label={t.total} value={money(total, lang)} />
          <Stat label={t.monthly} value={money(monthlyTotal, lang)} />
        </div>
        <div className="space-y-3">
          {loans.map((loan: Loan, i: number) => {
            const rule = reinvestments.find(
              (r: Reinvestment) => r.fromLoanId === loan.id,
            );
            const payoff = result?.loanResults.find(
              (r: any) => r.id === loan.id,
            );
            return (
              <article key={loan.id} className="card group p-6">
                <div className="mb-5 flex justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
                      {i ? <WalletCards size={18} /> : <Landmark size={18} />}
                    </span>
                    <input
                      value={loan.name}
                      onChange={(e) =>
                        setLoans((a: Loan[]) =>
                          a.map((x) =>
                            x.id === loan.id
                              ? { ...x, name: e.target.value }
                              : x,
                          ),
                        )
                      }
                      className="bg-transparent font-semibold outline-none"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setLoans((a: Loan[]) => a.filter((x) => x.id !== loan.id))
                    }
                  >
                    <X size={15} className="text-white/25" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field
                    label={t.balance}
                    value={number(loan.balance, lang)}
                    onChange={(v) => updateLoan(loan.id, "balance", v)}
                  />
                  <Field
                    label={t.rate}
                    value={Number(loan.interestRate * 100).toFixed(1)}
                    suffix="%"
                    decimal
                    onChange={(v) =>
                      updateLoan(loan.id, "interestRate", v / 100)
                    }
                  />
                  <Field
                    label={t.payment}
                    value={number(loan.currentMonthlyPayment, lang)}
                    onChange={(v) =>
                      updateLoan(loan.id, "currentMonthlyPayment", v)
                    }
                  />
                  <Field
                    label={t.extra}
                    value={number(loan.extraMonthly || 0, lang)}
                    onChange={(v) => updateLoan(loan.id, "extraMonthly", v)}
                  />
                </div>
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/[.05] bg-black/10 p-4 md:flex-row md:items-end">
                  <label className="flex-1 text-[11px] text-white/35">
                    {t.when} <b className="text-white/65">{loan.name}</b>{" "}
                    {month(payoff?.newEndDate || "-", lang)} {t.paid}
                    <select
                      value={rule?.toLoanId || ""}
                      onChange={(e) => setRule(loan, e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/[.07] bg-[#17171d] p-3 text-sm text-white outline-none"
                    >
                      <option value="">{t.none}</option>
                      {loans
                        .filter((x: Loan) => x.id !== loan.id)
                        .map((x: Loan) => (
                          <option key={x.id} value={x.id}>
                            {lang === "sv" ? "Lägg till " : "Add to "}
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {rule && (
                    <label className="w-full text-[11px] text-white/35 md:w-48">
                      {t.amount}
                      <div className="mt-2 flex items-center rounded-xl border border-white/[.07] bg-[#17171d] px-3">
                        <input
                          type="number"
                          value={rule.amount.toFixed(0)}
                          onChange={(e) =>
                            updateRuleAmount(loan.id, Number(e.target.value))
                          }
                          className="w-full bg-transparent py-3 text-sm text-white outline-none"
                        />
                        <span>SEK</span>
                      </div>
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(["avalanche", "snowball", "custom"] as PayoffStrategy[]).map(
            (x) => (
              <button
                key={x}
                onClick={() => setStrategy(x)}
                className={`pill capitalize ${strategy === x ? "active" : ""}`}
              >
                {x}
              </button>
            ),
          )}
          <button
            onClick={() => setLoans([])}
            className="ml-auto flex gap-2 p-2 text-xs text-white/30"
          >
            <RefreshCw size={13} />
            {t.reset}
          </button>
        </div>
      </section>
      <ResultSidebar
        lang={lang}
        t={t}
        result={result}
        loans={loans}
        reinvestments={reinvestments}
      />
    </main>
  );
}

function ResultSidebar({ lang, t, result, loans, reinvestments }: any) {
  const singleLoan = loans.length === 1;
  const monthsSaved = result?.totalMonthsSaved || 0;
  const payoffMonths = monthsFromStart(result?.newFreedomDate);
  const interestValue = singleLoan
    ? result?.totalNewInterest || 0
    : Math.max(0, result?.totalInterestSaved || 0);
  return (
    <aside className="space-y-3">
      <div className="relative min-h-[120px] overflow-hidden rounded-xl border border-blue-400/20 bg-blue-500/[.09] p-4 shadow-[inset_0_0_45px_rgba(59,130,246,.08)] backdrop-blur-xl">
        <div className="flex justify-between text-[10px] font-bold tracking-[.18em] text-blue-300">
          {t.free}
          <ShieldCheck size={17} />
        </div>
        <div className="mt-3 text-[38px] font-semibold leading-none tracking-[-.05em]">
          {month(result?.newFreedomDate || "-", lang)}
        </div>
        {monthsSaved > 0 ? (
          <span className="mt-4 inline-flex rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            {duration(monthsSaved, lang)} {t.earlier}
          </span>
        ) : result?.newFreedomDate === "-" ? (
          <span className="mt-4 inline-flex rounded-full bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-300">
            {lang === "sv" ? "Betalningen är för låg" : "Payment is too low"}
          </span>
        ) : payoffMonths > 0 ? (
          <span className="mt-4 inline-flex rounded-full bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-200">
            {duration(payoffMonths, lang)} {lang === "sv" ? "till skuldfri" : "to debt-free"}
          </span>
        ) : null}
      </div>
      <div className="card p-6">
        <span className="text-sm text-white/40">
          {singleLoan
            ? lang === "sv"
              ? "Total ränta"
              : "Total interest"
            : t.saved}
        </span>
        <div className="mt-4 text-4xl font-semibold">
          <CountUp value={interestValue} lang={lang} />
        </div>
      </div>
      <div className="card p-5">
        <div className="mb-2 text-xs text-white/35">{t.payoff}</div>
        {result?.loanResults.map((x: any) => (
          <div
            key={x.id}
            className="border-b border-white/[.05] py-3 last:border-0"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white/5 text-xs">
                {x.payoffOrder}
              </span>
              <span className="flex-1 text-xs">{x.name}</span>
              <span className="text-xs text-emerald-400">
                <Check size={12} className="inline" />{" "}
                {month(x.newEndDate, lang)}
              </span>
            </div>
            {reinvestments
              .filter(
                (r: Reinvestment) =>
                  r.fromLoanId === x.id &&
                  r.enabled &&
                  loans.some((loan: Loan) => loan.id === r.toLoanId),
              )
              .map((r: Reinvestment) => (
                <div
                  key={r.fromLoanId}
                  className="ml-9 mt-2 flex items-center gap-1 text-[10px] text-blue-300"
                >
                  <ArrowRight size={11} />
                  {number(r.amount, lang)} kr →{" "}
                  {loans.find((l: Loan) => l.id === r.toLoanId)?.name}
                </div>
              ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Compare({
  lang,
  t,
  avalanche,
  snowball,
}: {
  lang: Lang;
  t: any;
  avalanche: CalculationResult;
  snowball: CalculationResult;
}) {
  const diff = Math.abs(avalanche.totalNewInterest - snowball.totalNewInterest),
    winner =
      avalanche.totalNewInterest <= snowball.totalNewInterest
        ? "Avalanche"
        : "Snowball";
  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 pb-28 md:px-10">
      <Title
        eyebrow={t.tabs.compare}
        title={t.compareTitle}
        sub={t.compareSub}
      />
      <div className="mb-5 flex justify-center">
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-5 py-2 text-sm font-semibold text-emerald-300">
          {winner} {t.winner} {money(diff, lang)}
        </span>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <StrategyCard
          name="Avalanche"
          note="Highest rate first"
          color="#3B82F6"
          result={avalanche}
          lang={lang}
          t={t}
        />
        <StrategyCard
          name="Snowball"
          note="Lowest balance first"
          color="#F97316"
          result={snowball}
          lang={lang}
          t={t}
        />
      </div>
      <div className="card mt-5 p-6">
        <div className="mb-5 text-sm font-medium">Payoff timeline</div>
        <svg
          viewBox="0 0 900 220"
          className="h-auto w-full"
          role="img"
          aria-label="Payoff curves"
        >
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#3B82F6" stopOpacity=".25" />
              <stop offset="1" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 90, 140, 190].map((y) => (
            <line
              key={y}
              x1="20"
              x2="880"
              y1={y}
              y2={y}
              stroke="white"
              strokeOpacity=".06"
            />
          ))}
          <path
            d="M20 25 C210 35 330 60 450 95 S700 170 880 195 L880 210 L20 210Z"
            fill="url(#area)"
          />
          <path
            d="M20 25 C210 35 330 60 450 95 S700 170 880 195"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="4"
          />
          <path
            d="M20 25 C180 48 340 70 500 115 S740 175 880 195"
            fill="none"
            stroke="#F97316"
            strokeWidth="3"
            strokeDasharray="8 8"
          />
        </svg>
      </div>
    </main>
  );
}
function StrategyCard({ name, note, color, result, lang, t }: any) {
  const pct = Math.max(15, Math.min(92, 100 - result.totalMonthsSaved / 3));
  return (
    <div className="card p-7" style={{ boxShadow: `inset 0 1px 0 ${color}33` }}>
      <div className="flex justify-between">
        <div>
          <h2 className="text-xl font-semibold">{name}</h2>
          <p className="text-xs text-white/35">{note}</p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs"
          style={{ background: `${color}18`, color }}
        >
          {result.totalMonthsSaved} {t.months} saved
        </span>
      </div>
      <div
        className="mx-auto my-8 grid h-[200px] w-[200px] place-items-center rounded-full p-7"
        style={{
          background: `conic-gradient(${color} 0 ${pct}%,rgba(255,255,255,.06) ${pct}% 100%)`,
        }}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-[#101015] text-center">
          <div>
            <small className="text-white/30">{t.free}</small>
            <b className="mt-1 block text-xl">
              {month(result.newFreedomDate, lang)}
            </b>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label={t.months}
          value={String(
            result.loanResults.reduce(
              (m: number, x: any) => Math.max(m, x.monthsSaved),
              0,
            ),
          )}
        />
        <Stat
          label={t.totalInterest}
          value={money(result.totalNewInterest, lang, true)}
        />
        <Stat
          label={t.saved}
          value={money(result.totalInterestSaved, lang, true)}
        />
      </div>
    </div>
  );
}

function Refinance({
  lang,
  t,
  bake,
  bakePct,
  setBakePct,
  propertyValue,
  setPropertyValue,
  mortgageValue,
  setMortgageValue,
  personalTotal,
  refinanceDate,
}: any) {
  const color =
    bake.ltvAfter < 0.7
      ? "#22C55E"
      : bake.ltvAfter <= 0.85
        ? "#EAB308"
        : "#EF4444";
  return (
    <main className="mx-auto max-w-[1120px] px-5 py-10 pb-28 md:px-10">
      <Title
        eyebrow={t.tabs.refinance}
        title={t.refinanceTitle}
        sub={t.refinanceSub}
      />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="card p-7">
          <div className="grid gap-4 sm:grid-cols-3">
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
            <Field
              label={t.personal}
              value={number(personalTotal, lang)}
              onChange={() => {}}
              readOnly
            />
          </div>
          <div className="mt-10">
            <div className="mb-4 flex justify-between">
              <span className="text-sm text-white/45">{t.baked}</span>
              <b>{money(bake.bake, lang)}</b>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={bakePct}
              onChange={(e) => setBakePct(Number(e.target.value))}
              className="h-3 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 accent-white"
            />
            <div className="mt-3 flex justify-between text-xs text-white/25">
              <span>0%</span>
              <span>{bakePct}%</span>
              <span>100%</span>
            </div>
          </div>
          <div className="mt-9 rounded-[20px] border border-white/[.06] bg-black/15 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/40">{t.newLtv}</span>
              <b className="text-4xl" style={{ color }}>
                {(bake.ltvAfter * 100).toFixed(1)}%
              </b>
            </div>
            <div className="mt-5 h-2 rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(bake.ltvAfter * 100, 100)}%`,
                  background: color,
                  boxShadow: `0 0 18px ${color}77`,
                }}
              />
            </div>
          </div>
          {bake.warningLtv && (
            <div className="mt-5 flex items-center gap-3 rounded-[20px] border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-300">
              <ShieldAlert size={19} />
              {t.denied}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="card p-6">
            <span className="text-sm text-white/40">{t.newMonthly}</span>
            <div className="mt-3 text-4xl font-semibold">
              {money(bake.monthAfter, lang)}
            </div>
            <div
              className={`mt-2 text-xs ${bake.monthDelta <= 0 ? "text-emerald-400" : "text-orange-400"}`}
            >
              {bake.monthDelta <= 0 ? "−" : "+"}
              {money(Math.abs(bake.monthDelta), lang)} / month
            </div>
          </div>
          <div className="card p-6">
            <span className="text-sm text-white/40">{t.newDate}</span>
            <div className="mt-3 text-4xl font-semibold">
              {month(refinanceDate, lang)}
            </div>
          </div>
          <div className="card p-6">
            <span className="text-sm text-white/40">{t.saved}</span>
            <div className="mt-3 text-4xl font-semibold text-emerald-300">
              <CountUp value={Math.max(0, bake.interestSavedNet)} lang={lang} />
            </div>
            <p className="mt-3 text-xs leading-5 text-white/25">
              {bake.summaryLine}
            </p>
          </div>
        </div>
      </div>
    </main>
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
        <div className="mb-8 inline-flex h-7 items-center gap-2 rounded-full border border-white/[.08] bg-white/[.06] px-4 text-[12px] tracking-[.5px] text-white/55">
          <LockKeyhole size={12} />
          {sv
            ? "Ingen registrering · 100% privat · Fungerar offline · Matematik i webbläsaren"
            : "No signup · 100% private · Works offline · Math in browser"}
        </div>
        <h1 className="max-w-[760px] text-[36px] font-bold leading-[1.06] tracking-[-.05em] md:text-[56px] md:leading-[64px]">
          {sv
            ? "Skulder som kostar förmögenhet — "
            : "Debts that cost a fortune — "}
          <span className="relative inline-block -rotate-1 rounded-[12px] bg-gradient-to-r from-[#3B82F6] to-[#10B981] px-3 py-0 text-white shadow-[0_14px_40px_rgba(16,185,129,.15)]">
            {sv ? "borta" : "gone"}
          </span>
          {sv ? " på 4 år" : " in 4 years"}
        </h1>
        <p className="mt-7 max-w-[640px] text-[18px] leading-8 text-white/60">
          {sv
            ? "Vilket lån som helst. Vilken ränta som helst. Välj din väg och återinvestera det du frigör. Allt stannar i din webbläsare."
            : "Any loan. Any rate. Choose your path and reinvest what you free up. Everything stays in your browser."}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={onStart}
            className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-white px-7 text-base font-semibold text-[#06060A] shadow-[0_0_35px_rgba(59,130,246,.25)] transition hover:-translate-y-0.5 hover:shadow-2xl sm:w-auto"
          >
            {sv ? "+ Lägg till ditt första lån" : "+ Add your first loan"}
          </button>
          <button
            id="fill-sample"
            onClick={onSample}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/[.12] bg-transparent px-6 text-base font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[.05] sm:w-auto"
          >
            {sv ? "Fyll exempel" : "Fill sample data"}
          </button>
        </div>
        <div className="mt-12 text-[10px] font-medium uppercase tracking-[2px] text-white/30 md:text-xs">
          {sv
            ? "SEK · EUR · USD · LOKAL MATEMATIK · INGEN SPÅRNING · FUNGERAR OFFLINE"
            : "SEK · EUR · USD · LOCAL MATH · NO TRACKING · WORKS OFFLINE"}
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
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
          {eyebrow}
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-white/35">{sub}</p>
      </div>
      {action}
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
    <label className="rounded-2xl border border-white/[.06] bg-black/10 p-3">
      <small className="block uppercase tracking-wider text-white/25">
        {label}
      </small>
      <span className="mt-1 flex h-7 items-center">
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
          className="w-full bg-transparent text-base outline-none read-only:text-white/45"
        />
        <span className="text-xs text-white/25">{suffix}</span>
      </span>
    </label>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[.06] bg-black/10 p-4">
      <small className="uppercase tracking-wider text-white/25">{label}</small>
      <b className="mt-2 block text-lg">{value}</b>
    </div>
  );
}
function Preview({
  c,
  name,
  value,
  icon,
}: {
  c: string;
  name: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`absolute w-52 rounded-2xl border border-white/10 bg-white/[.07] p-4 shadow-2xl backdrop-blur-xl ${c}`}
    >
      <div className="flex justify-between text-xs text-white/45">
        {name}
        {icon}
      </div>
      <b className="mt-2 block text-lg">{value}</b>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 text-center">
      <small className="block text-[9px] text-white/30">{label}</small>
      <b className="text-xs">{value}</b>
    </div>
  );
}

function BestView({ lang, t, cheapest, smallest, loans, setLoans }: any) {
  const sv = lang === "sv",
    diff = Math.abs(cheapest.totalNewInterest - smallest.totalNewInterest);
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 md:px-10">
      <Title
        eyebrow={t.tabs.compare}
        title={sv ? "Vad är bäst för dig?" : "What works best for you?"}
        sub={
          sv
            ? "Välj mellan motivation, lägsta kostnad eller din egen ordning."
            : "Choose motivation, lowest cost, or your own order."
        }
      />
      <div className="mb-5 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300">
        💰 {sv ? "Sparar" : "Saves"} {money(diff, lang)}{" "}
        {sv ? "med Dyraste först" : "with Highest cost first"}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Choice
          icon="⚡"
          title={sv ? "Betala minsta först" : "Pay smallest first"}
          text={sv ? "Snabb vinst, motivation" : "Quick win and motivation"}
          date={month(smallest.newFreedomDate, lang)}
        />
        <Choice
          icon="💰"
          title={sv ? "Betala dyraste först" : "Pay highest cost first"}
          text={
            sv
              ? "Sparar mest, matematiskt bäst"
              : "Saves the most, mathematically best"
          }
          date={month(cheapest.newFreedomDate, lang)}
          best
        />
        <div className="card p-4">
          <div className="text-2xl">✋</div>
          <h2 className="mt-3 font-semibold">
            {sv
              ? "Egen ordning — dra för att ändra"
              : "Your order — drag to change"}
          </h2>
          <p className="mt-1 text-xs text-white/35">
            {sv
              ? "Du bestämmer vad som känns viktigast"
              : "You decide what matters most"}
          </p>
          <div className="mt-4 space-y-2">
            {loans.map((loan: Loan, i: number) => (
              <div
                key={loan.id}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/plain", String(i))
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const from = +e.dataTransfer.getData("text/plain");
                  setLoans((current: Loan[]) => {
                    const next = [...current],
                      [item] = next.splice(from, 1);
                    next.splice(i, 0, item);
                    return next;
                  });
                }}
                className="cursor-grab rounded-xl border border-white/[.06] bg-black/15 p-3 text-sm"
              >
                ⠿ {loan.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
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
          <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
            BEST
          </span>
        )}
      </div>
      <h2 className="mt-3 font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-white/35">{text}</p>
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
      <p className="mt-2 text-[11px] text-white/35">
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
}: {
  lang: Lang;
  loanRate: number;
  loanName: string;
}) {
  const [cash, setCash] = useState(50000),
    [saveRate, setSaveRate] = useState(0.01),
    [debtRate, setDebtRate] = useState(loanRate),
    [deduction, setDeduction] = useState(true),
    sv = lang === "sv",
    factor = deduction ? 0.7 : 1,
    save = cash * saveRate * 0.7,
    pay = cash * debtRate * factor,
    diff = pay - save,
    max = Math.max(save, pay, 1);
  useEffect(() => setDebtRate(loanRate), [loanRate]);
  return (
    <div className="card rounded-xl p-4">
      <b>{sv ? "Ska jag amortera eller spara?" : "Save or pay off?"} 🤔</b>
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
          label={`${sv ? "Lånets ränta" : "Loan rate"} · ${loanName}`}
          value={(debtRate * 100)
            .toFixed(1)
            .replace(".", sv ? "," : ".")}
          suffix=" %"
          decimal
          onChange={(v) => setDebtRate(v / 100)}
        />
        <label className="flex items-center gap-2 text-[11px] text-white/45">
          <input
            type="checkbox"
            checked={deduction}
            onChange={(e) => setDeduction(e.target.checked)}
          />
          {sv ? "Efter 30% ränteavdrag" : "After 30% deduction"}
        </label>
      </div>
      <div className="mt-4 space-y-2 text-[11px]">
        <Bar
          label={sv ? "Spara" : "Save"}
          value={save}
          max={max}
          color="#3B82F6"
        />
        <Bar
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
      <p className="mt-2 text-center text-[10px] text-white/30">
        {sv ? "På 5 år" : "Over 5 years"}: {money(Math.abs(diff) * 5, lang)}{" "}
        {sv ? "skillnad" : "difference"}
      </p>
    </div>
  );
}
function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{Math.round(value).toLocaleString()} kr/yr</span>
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
      strategy,
      setStrategy,
      reinvestments,
      setRule,
      updateRuleAmount,
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
      leasingCompare,
      setLeasingCompare,
      onPdf,
    } = p,
    sv = lang === "sv";
  const mortgage =
    loans.find((x: Loan) => loanKinds[x.id] === "mortgage") || loans[0];
  const highestRateLoan = loans.reduce((highest: Loan, loan: Loan) =>
    loan.interestRate > highest.interestRate ? loan : highest,
  );
  const stressed = useMemo(
    () =>
      calculatePayoffSchedule({
        loans: loans.map((x: Loan) =>
          x.id === mortgage.id
            ? { ...x, interestRate: x.interestRate + fearRate / 100 }
            : x,
        ),
        oneTimePayments: [],
        startDate: START,
        strategy,
      }),
    [loans, mortgage, fearRate, strategy],
  );
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
    setLoans((all: Loan[]) =>
      all.map((x) =>
        x.id === loan.id
          ? {
              ...x,
              name: m[lang as Lang],
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
    if (kind === "leasing") {
      setLeasingCompare({
        enabled: true,
        description: "Toyota Corolla leasing",
        monthly: 5000,
        months: 36,
        cash: 280000,
        residual: 180000,
      });
      return;
    }
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
        balance: 180_000,
        interestRate: 0,
        currentMonthlyPayment: 5_000,
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
      credit: {},
      other: {},
    };
    const meta = LOAN_KINDS[kind];
    setLoanKinds((x: any) => ({ ...x, [id]: kind }));
    setAmortKinds((x: any) => ({
      ...x,
      [id]: kind === "mortgage" ? "fixed_amort" : "annuity",
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
    <main className="mx-auto grid max-w-[1280px] gap-3 px-5 py-8 pb-28 md:px-8 lg:grid-cols-[1fr_360px]">
      <section>
        <Title
          eyebrow={sv ? "Räkna på vad som helst" : "Calculate anything"}
          title={t.plan}
          sub={
            sv
              ? "Lån, leasing eller avbetalning — jämför på samma villkor."
              : "Loans, leasing or installments—compare on equal terms."
          }
          action={
            <div className="flex gap-2">
              <label className="button cursor-pointer">
                📎 {sv ? "Bifoga lånebesked PDF" : "Attach loan PDF"}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => onPdf(e.target.files?.[0])}
                />
              </label>
              <button onClick={addDebt} className="button">
                <Plus size={14} />
                {t.add}
              </button>
            </div>
          }
        />
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              "mortgage",
              "personal",
              "family",
              "installment",
            ] as LoanKind[]
          ).map((kind) => (
            <button key={kind} onClick={() => addPreset(kind)} className="pill">
              +{" "}
              {kind === "family"
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
        <div className="space-y-3">
          {loans.map((loan: Loan) => {
            const kind: LoanKind = loanKinds[loan.id] || "other",
              meta = LOAN_KINDS[kind],
              rule = reinvestments.find(
                (r: Reinvestment) => r.fromLoanId === loan.id,
              ),
              payoff = result?.loanResults.find((r: any) => r.id === loan.id),
              advanced = expanded[loan.id];
            return (
              <article key={loan.id} className="card p-4">
                <div className="flex gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[.05] text-xl">
                    {meta.icon}
                  </span>
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <Select
                      label={sv ? "Typ av lån" : "Loan type"}
                      value={kind}
                      onChange={(v) => changeKind(loan, v as LoanKind)}
                    >
                      {(Object.keys(LOAN_KINDS) as LoanKind[]).map((k) => (
                        <option key={k} value={k}>
                          {LOAN_KINDS[k].icon} {LOAN_KINDS[k][lang]}
                        </option>
                      ))}
                    </Select>
                    <label>
                      <small className="label">{sv ? "Namn" : "Name"}</small>
                      <input
                        spellCheck={false}
                        value={loan.name}
                        onChange={(e) =>
                          setLoans((a: Loan[]) =>
                            a.map((x) =>
                              x.id === loan.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="input"
                      />
                    </label>
                  </div>
                  <button
                    onClick={() =>
                      setLoans((a: Loan[]) => a.filter((x) => x.id !== loan.id))
                    }
                  >
                    <X size={15} className="text-white/25" />
                  </button>
                </div>
                <p
                  className={`ml-14 mt-2 text-[11px] ${kind === "credit" ? "text-red-400" : "text-white/30"}`}
                >
                  {meta[sv ? "helpSv" : "helpEn"]}
                </p>
                {kind === "family" && (
                  <FamilyLoanFields
                    lang={lang}
                    rate={loan.interestRate}
                    setRate={(v) => updateLoan(loan.id, "interestRate", v)}
                  />
                )}
                <div className="ml-0 mt-4 max-w-sm md:ml-14">
                  <Select
                    label={sv ? "Hur betalar du? ⓘ" : "How do you pay? ⓘ"}
                    value={amortKinds[loan.id] || "annuity"}
                    onChange={(v) => changeAmort(loan, v as AmortKind)}
                  >
                    <option value="fixed_amort">
                      {sv ? "Rak amortering" : "Straight-line principal"}
                    </option>
                    <option value="annuity">
                      {sv ? "Annuitet" : "Annuity"}
                    </option>
                    <option value="fixed_cost">
                      {sv ? "Fast kostnad (leasing)" : "Fixed cost (leasing)"}
                    </option>
                    <option value="interest_free">
                      {sv
                        ? "Räntefritt / Amorteringsfritt"
                        : "Interest-free / Payment holiday"}
                    </option>
                  </Select>
                  <p className="mt-2 text-[10px] text-white/25">
                    {sv
                      ? "Rak: samma amortering + sjunkande ränta. Annuitet: samma total varje månad."
                      : "Straight-line: same principal + declining interest. Annuity: same total each month."}
                  </p>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Field
                    label={t.balance}
                    value={number(loan.balance, lang)}
                    onChange={(v) => updateLoan(loan.id, "balance", v)}
                  />
                  <div>
                    <Field
                      label={t.rate}
                      value={(loan.interestRate * 100)
                        .toFixed(1)
                        .replace(".", sv ? "," : ".")}
                      suffix=" %"
                      decimal
                      onChange={(v) => {
                        const minimum =
                          kind === "mortgage" || kind === "personal" ? 0.1 : 0;
                        const maximum =
                          kind === "mortgage" ? 15 : kind === "personal" ? 30 : 100;
                        updateLoan(
                          loan.id,
                          "interestRate",
                          Math.min(maximum, Math.max(minimum, v)) / 100,
                        );
                      }}
                    />
                    {(kind === "mortgage" || kind === "personal") && (
                      <p className="mt-1 px-1 text-[10px] text-white/25">
                        {kind === "mortgage" ? "0,1–15 %" : "0,1–30 %"}
                      </p>
                    )}
                  </div>
                  <Field
                    label={sv ? "Månadskostnad" : "Monthly cost"}
                    value={number(loan.currentMonthlyPayment, lang)}
                    onChange={(v) =>
                      updateLoan(loan.id, "currentMonthlyPayment", v)
                    }
                  />
                </div>
                {loan.currentMonthlyPayment <=
                  (loan.balance * loan.interestRate) / 12 && (
                  <p className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
                    ⚠️{" "}
                    {sv
                      ? "Månadskostnaden täcker inte räntan. Skulden växer."
                      : "The monthly payment does not cover interest. This debt grows."}
                  </p>
                )}
                {loan.currentMonthlyPayment >
                  (loan.balance * loan.interestRate) / 12 &&
                  payoff &&
                  !payoff.isFullyAmortizing && (
                    <p className="mt-3 rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 text-xs text-orange-200">
                      ⚠️{" "}
                      {sv
                        ? "Planen tar längre än 50 år. Höj månadsbetalningen."
                        : "This plan takes longer than 50 years. Increase the monthly payment."}
                    </p>
                  )}
                <button
                  onClick={() =>
                    setExpanded((x: any) => ({ ...x, [loan.id]: !advanced }))
                  }
                  className="mt-4 text-xs text-blue-300"
                >
                  {advanced
                    ? sv
                      ? "Visa mindre ↑"
                      : "Show less ↑"
                    : sv
                      ? "Visa mer ↓"
                      : "Show more ↓"}
                </button>
                {advanced && (
                  <div className="mt-4 rounded-2xl border border-white/[.05] bg-black/10 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field
                        label={t.extra}
                        value={number(loan.extraMonthly || 0, lang)}
                        onChange={(v) => updateLoan(loan.id, "extraMonthly", v)}
                      />
                      {loans.length > 1 && (
                        <Select
                          label={`${t.when} ${loan.name} ${month(payoff?.newEndDate || "-", lang)} ${t.paid}`}
                          value={rule?.toLoanId || ""}
                          onChange={(v) => setRule(loan, v)}
                        >
                          <option value="">{t.none}</option>
                          {loans
                            .filter((x: Loan) => x.id !== loan.id)
                            .map((x: Loan) => (
                              <option key={x.id} value={x.id}>
                                {sv ? "Lägg till i " : "Add to "}
                                {x.name}
                              </option>
                            ))}
                        </Select>
                      )}
                      {loans.length > 1 &&
                        rule &&
                        loans.some((target: Loan) => target.id === rule.toLoanId) && (
                          <Field
                            label={t.amount}
                            value={number(rule.amount, lang)}
                            onChange={(v) => updateRuleAmount(loan.id, v)}
                          />
                        )}
                    </div>
                    <p className="mt-4 text-xs text-white/40">
                      {sv ? "Du betalar totalt" : "You pay a total of"}{" "}
                      <b className="text-white">
                        {money(
                          loan.balance + (payoff?.originalTotalInterest || 0),
                          lang,
                        )}
                      </b>{" "}
                      · {sv ? "varav" : "including"}{" "}
                      {money(payoff?.originalTotalInterest || 0, lang)}{" "}
                      {sv ? "ränta" : "interest"}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <UniversalCost
          lang={lang}
          value={leasingCompare}
          setValue={setLeasingCompare}
        />
      </section>
      <aside className="space-y-3 lg:sticky lg:top-24 lg:h-fit">
        <ResultSidebar
          lang={lang}
          t={t}
          result={result}
          loans={loans}
          reinvestments={reinvestments}
        />
        <SavingsVsPayoff
          lang={lang}
          loanRate={highestRateLoan.interestRate}
          loanName={highestRateLoan.name}
        />
        <Fear
          lang={lang}
          rate={fearRate}
          setRate={setFearRate}
          mortgage={mortgage}
          result={result}
          stressed={stressed}
          income={income}
          setIncome={setIncome}
          monthly={monthlyTotal}
        />
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
function UniversalCost({ lang, value, setValue }: any) {
  const sv = lang === "sv",
    set = (k: string, n: any) => setValue((x: any) => ({ ...x, [k]: n })),
    total = value.monthly * value.months,
    buyNet = value.cash - value.residual,
    diff = total - buyNet;
  return (
    <section className="card mt-6 p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">
            {sv
              ? "Jämför: Leasing vs Köpa? (valfritt)"
              : "Compare: Lease vs Buy? (optional)"}
          </h2>
          {!value.enabled && (
            <p className="mt-1 text-xs text-white/35">
              {sv
                ? "Håll jämförelsen separat från ditt skuldfri-datum."
                : "Keep this comparison separate from your debt-free date."}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => set("enabled", !value.enabled)}
          className="button shrink-0"
          aria-expanded={value.enabled}
        >
          {value.enabled
            ? sv
              ? "Dölj jämförelse ↑"
              : "Hide comparison ↑"
            : sv
              ? "+ Jämför leasing vs köpa"
              : "+ Compare lease vs buy"}
        </button>
      </div>
      {value.enabled && (
        <div className="mt-5 border-t border-white/[.06] pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <small className="label">
                {sv ? "Beskrivning" : "Description"}
              </small>
              <input
                spellCheck={false}
                value={value.description}
                onChange={(e) => set("description", e.target.value)}
                className="input"
              />
            </label>
            <Field
              label={sv ? "Kostnad / mån" : "Cost / month"}
              value={number(value.monthly, lang)}
              onChange={(n) => set("monthly", n)}
            />
            <label className="rounded-2xl border border-white/[.06] bg-black/10 p-3 text-xs text-white/35 sm:col-span-2">
              <span className="flex justify-between gap-4">
                <span>{sv ? "Period" : "Period"}</span>
                <b className="text-white/70">
                  {value.months} {sv ? "månader" : "months"}
                </b>
              </span>
              <input
                type="range"
                min="12"
                max="60"
                value={value.months}
                onChange={(e) => set("months", +e.target.value)}
                className="mt-2 min-h-11 w-full accent-blue-500"
              />
            </label>
            <Field
              label={sv ? "Köpa kontant" : "Buy cash"}
              value={number(value.cash, lang)}
              onChange={(n) => set("cash", n)}
            />
            <Field
              label={sv ? "Bilens värde efteråt" : "Car value after"}
              value={number(value.residual, lang)}
              onChange={(n) => set("residual", n)}
            />
            <div className="sm:col-span-2">
              <Stat
                label={sv ? "Leasing totalt" : "Leasing total"}
                value={money(total, lang)}
              />
            </div>
          </div>
          <div
            className={`mt-5 rounded-xl p-4 text-sm leading-6 ${diff > 0 ? "bg-orange-500/10 text-orange-200" : "bg-emerald-500/10 text-emerald-200"}`}
          >
            {sv
              ? `Leasing kostar ${money(total, lang)} på ${value.months} mån. Köpa kostar netto ${money(buyNet, lang)} efter bilens värde — leasing är ${money(Math.abs(diff), lang)} ${diff > 0 ? "dyrare" : "billigare"}, men utan värderisk.`
              : `Leasing costs ${money(total, lang)} over ${value.months} months. Buying costs ${money(buyNet, lang)} net of residual value—leasing is ${money(Math.abs(diff), lang)} ${diff > 0 ? "more expensive" : "cheaper"}, but without resale risk.`}
          </div>
        </div>
      )}
    </section>
  );
}
function Fear({
  lang,
  rate,
  setRate,
  mortgage,
  result,
  stressed,
  income,
  setIncome,
  monthly,
}: any) {
  const [incomeDrop, setIncomeDrop] = useState(20),
    [scenarios, setScenarios] = useState<number[]>([]);
  const sv = lang === "sv",
    monthlyShock = (mortgage.balance * (rate / 100)) / 12,
    interestShock = Math.max(
      0,
      stressed.totalNewInterest - (result?.totalNewInterest || 0),
    );
  return (
    <div className="card rounded-xl p-3">
      <div className="flex items-center justify-between">
        <b>{sv ? "Farhågor" : "What if"} 🔮</b>
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
      <p className="mt-4 text-xs text-white/40">
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
        {sv ? "total ränta" : "total interest"} ·{" "}
        {sv ? "skuldfri" : "debt-free"} {month(stressed.newFreedomDate, lang)}
      </div>
      <label className="mt-4 block text-xs text-white/35">
        {sv ? "Nettoinkomst (valfritt)" : "Net income (optional)"}
        <input
          spellCheck={false}
          type="number"
          value={income || ""}
          onChange={(e) => setIncome(+e.target.value)}
          className="input mt-2"
        />
      </label>
      <label className="mt-3 block text-xs text-white/35">
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
      <button
        onClick={() => setScenarios((x) => [...x, rate])}
        className="button mt-3 w-full"
      >
        + {sv ? "Lägg till scenario" : "Add scenario"} ({scenarios.length})
      </button>
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
  refinanceDate,
}: any) {
  const sv = lang === "sv",
    color =
      bake.ltvAfter < 0.7
        ? "#22C55E"
        : bake.ltvAfter <= 0.85
          ? "#EAB308"
          : "#EF4444",
    max = Math.max(1, Math.min(1000000, personalTotal));
  return (
    <main className="mx-auto max-w-[1120px] px-5 py-10 pb-28 md:px-10">
      <Title
        eyebrow={t.tabs.refinance}
        title={t.refinanceTitle}
        sub={t.refinanceSub}
      />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="card p-7">
          <div className="grid gap-3 sm:grid-cols-3">
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
            <Field
              label={t.personal}
              value={number(personalTotal, lang)}
              onChange={(n) =>
                setPersonalTotal(Math.min(10_000_000, Math.max(0, n)))
              }
            />
          </div>
          <div className="mt-8 flex items-end gap-3">
            <div className="flex-1">
              <Field
                label={t.baked}
                value={number(bakeAmount, lang)}
                onChange={(n) =>
                  setBakeAmount(Math.min(1000000, Math.max(0, n)))
                }
              />
            </div>
            <button
              onClick={() => setBakeAmount(personalTotal)}
              className="button"
            >
              {sv ? "Hela beloppet" : "Full amount"}
            </button>
          </div>
          <input
            type="range"
            min="0"
            max={max}
            value={Math.min(bakeAmount, max)}
            onChange={(e) => setBakeAmount(+e.target.value)}
            className="mt-5 h-3 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 accent-white"
          />
          <p className="mt-3 text-sm text-white/45">
            {sv ? "Baka in" : "Bake in"}{" "}
            {personalTotal ? Math.round((bake.bake / personalTotal) * 100) : 0}%
            = <b className="text-white">{money(bake.bake, lang)}</b>
          </p>
          <div className="mt-7 rounded-[20px] bg-black/15 p-6">
            <div className="flex justify-between">
              <span>{t.newLtv}</span>
              <b className="text-4xl" style={{ color }}>
                {(bake.ltvAfter * 100).toFixed(1)}%
              </b>
            </div>
          </div>
          {bake.warningLtv && (
            <div className="mt-4 flex gap-3 rounded-[20px] border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-300">
              <ShieldAlert size={19} />
              {t.denied}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <Stat label={t.newMonthly} value={money(bake.monthAfter, lang)} />
          <Stat label={t.newDate} value={month(refinanceDate, lang)} />
          <div className="card p-6">
            <span className="text-sm text-white/40">{t.saved}</span>
            <div className="mt-3 text-4xl font-semibold text-emerald-300">
              <CountUp value={Math.max(0, bake.interestSavedNet)} lang={lang} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
