"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Calculator,
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  TrendingDown,
  Layers,
  AlertTriangle,
  Info,
} from "lucide-react";
import { calculateExcelStrategy, emptyResult, sortLoans } from "@/lib/debt-optimizer/engine";
import type {
  Loan,
  OneTimePayment,
  PayoffStrategy,
  LoanPaymentStyle,
} from "@/lib/debt-optimizer/types";

const STRATEGY_LABELS: Record<PayoffStrategy, string> = {
  cascade: "Egen ordning",
  avalanche: "Lavin",
  snowball: "Snöboll",
};

const STRATEGY_HINTS: Record<PayoffStrategy, string> = {
  cascade: "Du bestämmer själv vilka lån som ska betalas av först, och när pengar ska återinvesteras.",
  avalanche: "listar högst ränta först — lägg extra manuellt eller återinvestera",
  snowball: "listar minsta skuld först — lägg extra manuellt eller återinvestera",
};

/** Vad ett lån faktiskt kostar per månad just nu, inkl. ev. extra — men inte återinvestering (visas separat, dynamiskt). */
function loanNowTotal(loan: Loan): number {
  const isFixed = loan.paymentStyle === "fixed_amort";
  const extraAmt = loan.extraMonthlyEnabled ? loan.extraMonthly || 0 : 0;
  return isFixed
    ? (loan.targetMonthlyEnabled ? loan.targetMonthlyTotal || 0 : loan.currentMonthlyPayment) + extraAmt
    : loan.currentMonthlyPayment + extraAmt;
}

/** Ett lån räknas som avklarat när användaren själv satt skulden till 0 (eller lägre) för ett lån som faktiskt användes. */
function isCleared(loan: Loan): boolean {
  return loan.balance <= 0 && loan.currentMonthlyPayment > 0;
}

function addMonthsToYYYYMM(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}

function todayYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" });
}

function AnimatedNumber({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const duration = 350;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return (
    <span className={className}>{display.toLocaleString("sv-SE")}</span>
  );
}

function NumField({
  value,
  onChange,
  className = "",
  placeholder = "0",
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value ? String(value) : "");
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        const n = parseFloat(text.replace(",", "."));
        if (!isNaN(n)) {
          onChange(n);
          setText(String(n));
        } else {
          onChange(0);
          setText("");
        }
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.,]/g, "");
        setText(v);
        const n = parseFloat(v.replace(",", "."));
        if (!isNaN(n) && v !== "" && v !== "." && v !== ",") onChange(n);
      }}
      className={className}
    />
  );
}

function FreedomTimeline({
  originalMonths,
  newMonths,
}: {
  originalMonths: number;
  newMonths: number;
}) {
  const safe = Math.max(originalMonths, 1);
  const pct = Math.min(100, (Math.max(newMonths, 0) / safe) * 100);
  const saved = Math.max(0, originalMonths - newMonths);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>Din plan</span>
        <span>Original ({originalMonths} mån)</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[11px] text-emerald-400 font-medium">
        {saved} mån tidigare
      </div>
    </div>
  );
}

function emptyLoan(n: number, startDate: string): Loan {
  return {
    id: `loan-${Date.now()}-${n}`,
    name: `Lån ${n}`,
    loanType: "Annuitet",
    paymentStyle: "annuity",
    balance: 0,
    interestRate: 0.05,
    currentMonthlyPayment: 0,
    extraMonthly: 0,
    extraMonthlyEnabled: false,
    extraMonthlyFrom: startDate,
  };
}

/** Empty template – user fills in their own loans */
const emptyLoans = (): Loan[] => [
  {
    id: "loan-1",
    name: "Lån 1",
    loanType: "Rak amortering",
    paymentStyle: "fixed_amort",
    balance: 0,
    interestRate: 0.05,
    currentMonthlyPayment: 0,
    targetMonthlyTotal: 0,
    targetMonthlyEnabled: false,
    targetMonthlyFrom: "2026-08",
    extraMonthly: 0,
    extraMonthlyEnabled: false,
    extraMonthlyFrom: "2026-08",
  },
  {
    id: "loan-2",
    name: "Lån 2",
    loanType: "Annuitet",
    paymentStyle: "annuity",
    balance: 0,
    interestRate: 0.08,
    currentMonthlyPayment: 0,
    extraMonthly: 0,
    extraMonthlyEnabled: false,
    extraMonthlyFrom: "2026-08",
  },
];

const STORAGE_KEY = "karma-debt-optimizer-v1";

export function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>(emptyLoans);
  const [oneTimePayments, setOneTimePayments] = useState<OneTimePayment[]>([]);
  const [startDate, setStartDate] = useState("2026-08");
  const [strategy, setStrategy] = useState<PayoffStrategy>("cascade");
  const [showOneTime, setShowOneTime] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load any previously saved plan once, after mount (avoids SSR/client
  // hydration mismatch — first render always matches the server's default).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.loans) && saved.loans.length) setLoans(saved.loans);
        if (Array.isArray(saved.oneTimePayments))
          setOneTimePayments(saved.oneTimePayments);
        if (saved.startDate) setStartDate(saved.startDate);
        if (saved.strategy) setStrategy(saved.strategy);
      }
    } catch {
      // corrupt/blocked storage — just start fresh
    }
    setHydrated(true);
  }, []);

  // Persist on every change, once the initial load above has settled.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ loans, oneTimePayments, startDate, strategy })
      );
    } catch {
      // storage full/blocked — plan still works, just won't persist
    }
  }, [hydrated, loans, oneTimePayments, startDate, strategy]);

  const clearAll = () => {
    setLoans(emptyLoans());
    setOneTimePayments([]);
    setStrategy("cascade");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const { result, calcError } = useMemo(() => {
    try {
      return {
        result: calculateExcelStrategy({
          loans: loans.filter((l) => l.balance > 0 && l.currentMonthlyPayment > 0),
          oneTimePayments,
          startDate,
          strategy,
        }),
        calcError: null as string | null,
      };
    } catch (e) {
      return {
        result: emptyResult(),
        calcError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [loans, oneTimePayments, startDate, strategy]);

  const monthsBetween = (from: string, to: string) => {
    const [y1, m1] = from.split("-").map(Number);
    const [y2, m2] = to.split("-").map(Number);
    if (!y1 || !y2) return 0;
    return (y2 - y1) * 12 + (m2 - m1);
  };

  const origMonths = monthsBetween(startDate, result.originalFreedomDate);
  const newMonths = monthsBetween(startDate, result.newFreedomDate);

  const updateLoan = (id: string, patch: Partial<Loan>) => {
    setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const setStyle = (id: string, style: LoanPaymentStyle) => {
    updateLoan(id, {
      paymentStyle: style,
      loanType: style === "fixed_amort" ? "Rak amortering" : "Annuitet",
    });
  };

  const addLoan = () => {
    setLoans((prev) => [...prev, emptyLoan(prev.length + 1, startDate)]);
  };

  const removeLoan = (id: string) => {
    setLoans((prev) => prev.filter((l) => l.id !== id));
  };

  const addOneTime = (loanId?: string) => {
    setOneTimePayments((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        date: startDate,
        amount: 0,
        loanId: loanId || loans[0]?.id,
      },
    ]);
    setShowOneTime(true);
  };

  const updateOneTime = (
    id: string,
    field: "date" | "amount" | "loanId",
    val: string | number
  ) => {
    setOneTimePayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const removeOneTime = (id: string) => {
    setOneTimePayments((prev) => prev.filter((p) => p.id !== id));
  };

  const loadDemo = () => {
    setLoans([
      {
        id: "nordea",
        name: "Nordea",
        loanType: "Rak amortering",
        paymentStyle: "fixed_amort",
        balance: 112455,
        interestRate: 0.0595,
        currentMonthlyPayment: 1389,
        targetMonthlyTotal: 2000,
        targetMonthlyEnabled: true,
        targetMonthlyFrom: startDate,
      },
      {
        id: "nordax",
        name: "Nordax",
        loanType: "Annuitet",
        paymentStyle: "annuity",
        balance: 589111,
        interestRate: 0.0909,
        currentMonthlyPayment: 6888,
        extraMonthly: 500,
        extraMonthlyEnabled: true,
        extraMonthlyFrom: startDate,
      },
    ]);
    setOneTimePayments([]);
    setStrategy("cascade");
  };

  const sortedResults = useMemo(
    () => [...result.loanResults].sort((a, b) => a.payoffOrder - b.payoffOrder),
    [result.loanResults]
  );

  // Manual mode: order only decides (a) the "Ordning" list and (b) which
  // cleared loans a given loan is allowed to reinvest from (only ones
  // earlier in the order — money can't flow "backwards").
  const orderedLoanIds = useMemo(
    () => sortLoans(loans, strategy).map((l) => l.id),
    [loans, strategy]
  );
  const orderIndexOf = (id: string) => orderedLoanIds.indexOf(id);

  const setReinvestSource = (loanId: string, sourceLoan: Loan) => {
    updateLoan(loanId, {
      reinvestment: {
        enabled: true,
        fromLoanId: sourceLoan.id,
        amount: loanNowTotal(sourceLoan),
        startDate: addMonthsToYYYYMM(todayYYYYMM(), 1),
      },
    });
  };

  const toggleReinvestSource = (loan: Loan, sourceLoan: Loan, on: boolean) => {
    if (on) {
      setReinvestSource(loan.id, sourceLoan);
    } else if (loan.reinvestment) {
      updateLoan(loan.id, { reinvestment: { ...loan.reinvestment, enabled: false } });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <header className="mb-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-teal-400 text-[10px] font-bold uppercase tracking-wider">
                <Calculator className="w-3.5 h-3.5" />
                Karma Debt Engine
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Lånekalkylator
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Fyll i dina lån · välj strategi · se slutdatum & sparad ränta
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <input
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-teal-400"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadDemo}
                  className="text-[10px] text-slate-500 hover:text-teal-400 underline"
                >
                  Ladda exempel
                </button>
                <span className="text-[10px] text-slate-700">·</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[10px] text-slate-500 hover:text-red-400 underline"
                >
                  Rensa allt
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              Object.keys(STRATEGY_LABELS) as PayoffStrategy[]
            ).map((key) => (
              <button
                key={key}
                onClick={() => setStrategy(key)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                  strategy === key
                    ? "bg-teal-600/25 border-teal-500/50 text-teal-300 font-bold"
                    : "bg-slate-900 border-slate-700 text-slate-400"
                }`}
              >
                {STRATEGY_LABELS[key]}
              </button>
            ))}
            <span className="text-[10px] text-slate-500 self-center ml-1">
              {STRATEGY_HINTS[strategy]}
            </span>
          </div>
        </header>

        {calcError && (
          <div className="mb-4 flex items-start gap-2 bg-red-950/40 border border-red-800/60 rounded-xl px-3 py-2.5 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{calcError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          <section className="lg:col-span-5 space-y-3">
            {loans.map((loan) => {
              const res = result.loanResults.find((r) => r.id === loan.id);
              const isFixed = loan.paymentStyle === "fixed_amort";
              const extraOn = !!loan.extraMonthlyEnabled;
              const nowTotal = loanNowTotal(loan);
              const cleared = isCleared(loan);
              // Cleared loans earlier in the order this loan can pull money from.
              const reinvestSources = cleared
                ? []
                : loans.filter(
                    (l) =>
                      l.id !== loan.id &&
                      isCleared(l) &&
                      orderIndexOf(l.id) < orderIndexOf(loan.id)
                  );

              return (
                <div
                  key={loan.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={loan.name}
                      placeholder="Namn på lån"
                      onChange={(e) =>
                        updateLoan(loan.id, { name: e.target.value })
                      }
                      className="bg-transparent font-bold text-white text-sm border-b border-transparent focus:border-teal-500 outline-none flex-1 min-w-0"
                    />
                    <span
                      className={`text-xs font-mono shrink-0 ${
                        res && !res.isFullyAmortizing
                          ? "text-red-400"
                          : "text-teal-400"
                      }`}
                    >
                      {!res || res.newEndDate === "-" ? "—" : res.newEndDate}
                    </span>
                    {loans.length > 1 && (
                      <button
                        onClick={() => removeLoan(loan.id)}
                        className="p-1 text-slate-600 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {cleared && (
                    <div className="flex items-start gap-2 bg-emerald-950/40 border border-emerald-700/50 rounded-lg px-2.5 py-2">
                      <span className="shrink-0" aria-hidden="true">🎉</span>
                      <div className="text-[11px] text-emerald-300 leading-snug">
                        <span className="font-bold">{loan.name || "Lånet"} avklarat</span>{" "}
                        {todayLabel()}. Du frigör nu{" "}
                        <span className="font-mono font-bold">
                          {loanNowTotal(loan).toLocaleString("sv-SE")}
                        </span>{" "}
                        kr/mån.
                      </div>
                    </div>
                  )}

                  {/* Style toggle */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setStyle(loan.id, "fixed_amort")}
                      className={`text-[10px] px-2 py-0.5 rounded-md border ${
                        isFixed
                          ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                          : "border-slate-700 text-slate-500"
                      }`}
                    >
                      Fast amortering
                    </button>
                    <button
                      type="button"
                      onClick={() => setStyle(loan.id, "annuity")}
                      className={`text-[10px] px-2 py-0.5 rounded-md border ${
                        !isFixed
                          ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                          : "border-slate-700 text-slate-500"
                      }`}
                    >
                      Annuitet
                    </button>
                  </div>

                  {/* Core fields */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-0.5">
                        Skuld
                      </label>
                      <NumField
                        value={loan.balance}
                        onChange={(n) => updateLoan(loan.id, { balance: n })}
                        placeholder="0"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-teal-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-0.5">
                        Ränta %
                      </label>
                      <NumField
                        value={
                          loan.interestRate
                            ? +(loan.interestRate * 100).toFixed(2)
                            : 0
                        }
                        onChange={(n) =>
                          updateLoan(loan.id, { interestRate: n / 100 })
                        }
                        placeholder="5"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-teal-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-0.5">
                        {isFixed ? "Amortering" : "Min/mån"}
                      </label>
                      <NumField
                        value={loan.currentMonthlyPayment}
                        onChange={(n) =>
                          updateLoan(loan.id, { currentMonthlyPayment: n })
                        }
                        placeholder="0"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-teal-500/50"
                      />
                    </div>
                  </div>

                  {/* Top-up for fixed amort */}
                  {isFixed && (
                    <div className="flex flex-wrap items-center gap-2 bg-slate-950/50 rounded-lg px-2 py-1.5 border border-slate-800">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!loan.targetMonthlyEnabled}
                          onChange={(e) =>
                            updateLoan(loan.id, {
                              targetMonthlyEnabled: e.target.checked,
                              targetMonthlyFrom:
                                loan.targetMonthlyFrom || startDate,
                            })
                          }
                          className="w-3.5 h-3.5 rounded accent-amber-400"
                        />
                        <span
                          className="text-[10px] text-amber-300 font-medium inline-flex items-center gap-0.5"
                          title="Detta är vad du betalar totalt varje månad. Allt över Min/mån är extra amortering."
                        >
                          Total betalning/mån
                          <Info className="w-2.5 h-2.5 text-amber-300/70" />
                        </span>
                      </label>
                      {loan.targetMonthlyEnabled && (
                        <>
                          <NumField
                            value={loan.targetMonthlyTotal ?? 0}
                            onChange={(n) =>
                              updateLoan(loan.id, { targetMonthlyTotal: n })
                            }
                            placeholder="2000"
                            className="w-16 bg-slate-950 border border-amber-500/40 rounded-md px-1.5 py-1 text-[11px] font-mono font-bold text-amber-300 text-center outline-none"
                          />
                          <span className="text-[9px] text-slate-500">från</span>
                          <input
                            type="month"
                            value={loan.targetMonthlyFrom || startDate}
                            onChange={(e) =>
                              updateLoan(loan.id, {
                                targetMonthlyFrom: e.target.value,
                              })
                            }
                            className="bg-slate-950 border border-slate-700 rounded-md px-1 py-1 text-[10px] font-mono text-teal-400"
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Extra monthly – compact one row */}
                  <div className="flex flex-wrap items-center gap-2 bg-slate-950/50 rounded-lg px-2 py-1.5 border border-slate-800">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={extraOn}
                        onChange={(e) =>
                          updateLoan(loan.id, {
                            extraMonthlyEnabled: e.target.checked,
                            extraMonthlyFrom:
                              loan.extraMonthlyFrom || startDate,
                          })
                        }
                        className="w-3.5 h-3.5 rounded accent-amber-400"
                      />
                      <span
                        className="text-[10px] text-amber-300 font-medium inline-flex items-center gap-0.5"
                        title="Läggs ovanpå Min/mån varje månad från startdatum."
                      >
                        Extra amortering/mån
                        <Info className="w-2.5 h-2.5 text-amber-300/70" />
                      </span>
                    </label>
                    {extraOn && (
                      <>
                        <NumField
                          value={loan.extraMonthly ?? 0}
                          onChange={(n) =>
                            updateLoan(loan.id, { extraMonthly: n })
                          }
                          placeholder="500"
                          className="w-16 bg-slate-950 border border-amber-500/40 rounded-md px-1.5 py-1 text-[11px] font-mono font-bold text-amber-300 text-center outline-none"
                        />
                        <span className="text-[9px] text-slate-500">från</span>
                        <input
                          type="month"
                          value={loan.extraMonthlyFrom || startDate}
                          onChange={(e) =>
                            updateLoan(loan.id, {
                              extraMonthlyFrom: e.target.value,
                            })
                          }
                          className="bg-slate-950 border border-slate-700 rounded-md px-1 py-1 text-[10px] font-mono text-teal-400"
                        />
                      </>
                    )}
                  </div>

                  {/* Clear current total */}
                  <div className="text-[10px] text-slate-500 px-0.5">
                    Betalar nu ca{" "}
                    <span className="text-slate-300 font-mono">
                      {nowTotal > 0 ? nowTotal.toLocaleString("sv-SE") : "—"}
                    </span>{" "}
                    kr/mån
                    {loan.reinvestment?.enabled && (
                      <span className="text-emerald-500/80">
                        {" "}
                        · +{(loan.reinvestment.amount || 0).toLocaleString("sv-SE")} kr
                        återinvesterat från {loan.reinvestment.startDate}
                      </span>
                    )}
                  </div>

                  {reinvestSources.length > 0 && (
                    <div className="space-y-1.5 bg-emerald-950/20 border border-emerald-800/40 rounded-lg px-2 py-1.5">
                      <div className="text-[10px] font-bold text-emerald-300">
                        Återinvestering
                      </div>
                      {reinvestSources.map((source) => {
                        const active =
                          !!loan.reinvestment?.enabled &&
                          loan.reinvestment.fromLoanId === source.id;
                        const maxAmount = Math.max(1, loanNowTotal(source));
                        const amount = active
                          ? loan.reinvestment!.amount || 0
                          : maxAmount;
                        return (
                          <div key={source.id} className="space-y-1.5">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={(e) =>
                                  toggleReinvestSource(loan, source, e.target.checked)
                                }
                                className="w-3.5 h-3.5 rounded accent-emerald-400"
                              />
                              <span className="text-[10px] text-emerald-200">
                                Återinvestera{" "}
                                <span className="font-mono font-bold">
                                  {maxAmount.toLocaleString("sv-SE")}
                                </span>{" "}
                                kr från {source.name}
                              </span>
                            </label>
                            {active && (
                              <div className="pl-5 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-slate-500 w-14 shrink-0">
                                    Startdatum
                                  </span>
                                  <input
                                    type="month"
                                    value={loan.reinvestment!.startDate}
                                    onChange={(e) =>
                                      updateLoan(loan.id, {
                                        reinvestment: {
                                          ...loan.reinvestment!,
                                          startDate: e.target.value,
                                        },
                                      })
                                    }
                                    className="bg-slate-950 border border-slate-700 rounded-md px-1 py-1 text-[10px] font-mono text-teal-400"
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                                  <span className="text-[9px] text-slate-500 sm:w-14 sm:shrink-0">
                                    Belopp
                                  </span>
                                  <input
                                    type="range"
                                    min={0}
                                    max={maxAmount}
                                    step={Math.max(1, Math.round(maxAmount / 100))}
                                    value={amount}
                                    onChange={(e) =>
                                      updateLoan(loan.id, {
                                        reinvestment: {
                                          ...loan.reinvestment!,
                                          amount: Number(e.target.value),
                                        },
                                      })
                                    }
                                    className="flex-1 accent-emerald-400"
                                  />
                                  <NumField
                                    value={amount}
                                    onChange={(n) =>
                                      updateLoan(loan.id, {
                                        reinvestment: {
                                          ...loan.reinvestment!,
                                          amount: Math.max(0, Math.min(maxAmount, n)),
                                        },
                                      })
                                    }
                                    className="w-16 bg-slate-950 border border-emerald-500/40 rounded-md px-1.5 py-1 text-[11px] font-mono font-bold text-emerald-300 text-center outline-none"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {res && !res.isFullyAmortizing && (
                    <div className="flex items-start gap-1.5 text-[10px] text-red-400 bg-red-950/30 border border-red-800/50 rounded-lg px-2 py-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>
                        Detta lån blir aldrig avbetalt med nuvarande
                        betalning — den täcker inte ens räntan.
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => addOneTime(loan.id)}
                      className="text-[10px] text-emerald-400/90 hover:text-emerald-300"
                    >
                      + Engångs
                    </button>
                    <div className="text-[10px] font-mono text-slate-500">
                      {res ? (
                        <>
                          <span>{res.originalEndDate}</span>
                          <ArrowRight className="inline w-2.5 h-2.5 mx-0.5 text-slate-600" />
                          <span
                            className={
                              res.isFullyAmortizing
                                ? "text-teal-400"
                                : "text-red-400"
                            }
                          >
                            {res.isFullyAmortizing ? res.newEndDate : "aldrig"}
                          </span>
                          <span className="text-emerald-400 ml-1.5">
                            −
                            <AnimatedNumber value={res.interestSaved} />
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={addLoan}
              className="w-full flex items-center justify-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-600 text-slate-400 py-2.5 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" /> Lägg till lån
            </button>

            {/* One-time collapsed */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowOneTime(!showOneTime)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-xs font-bold text-white">
                    Engångs
                  </span>
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 rounded-full">
                    {oneTimePayments.length}
                  </span>
                </div>
                {showOneTime ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>
              {showOneTime && (
                <div className="px-3 pb-3 space-y-1.5">
                  {oneTimePayments.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={p.loanId || ""}
                        onChange={(e) =>
                          updateOneTime(p.id, "loanId", e.target.value)
                        }
                        className="bg-slate-950 border border-slate-700 rounded-md px-1.5 py-1 text-[10px] text-slate-200 max-w-[90px]"
                      >
                        {loans.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="month"
                        value={p.date}
                        onChange={(e) =>
                          updateOneTime(p.id, "date", e.target.value)
                        }
                        className="bg-slate-950 border border-slate-700 rounded-md px-1 py-1 text-[10px] font-mono text-slate-200"
                      />
                      <NumField
                        value={p.amount}
                        onChange={(n) => updateOneTime(p.id, "amount", n)}
                        placeholder="10000"
                        className="bg-slate-950 border border-slate-700 rounded-md px-1.5 py-1 text-[10px] font-mono font-bold text-emerald-400 w-20 outline-none"
                      />
                      <button
                        onClick={() => removeOneTime(p.id)}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addOneTime()}
                    className="w-full text-[10px] py-1.5 rounded-lg bg-teal-600/15 text-teal-300 border border-teal-500/20"
                  >
                    + Engångs
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="lg:col-span-7 space-y-3 lg:sticky lg:top-4 self-start">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Skuldfri
                </div>
                <div className="text-lg sm:text-xl font-black text-white mt-0.5 font-mono">
                  {result.newFreedomDate === "-"
                    ? "—"
                    : result.newFreedomDate}
                </div>
                <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-0.5 font-medium">
                  <Sparkles className="w-3 h-3" />
                  <AnimatedNumber value={result.totalMonthsSaved} /> mån
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Sparad ränta
                </div>
                <div className="text-lg sm:text-xl font-black text-emerald-400 mt-0.5 font-mono">
                  <AnimatedNumber value={result.totalInterestSaved} />
                </div>
                <div className="text-[9px] text-slate-500 mt-1 truncate">
                  {result.totalOriginalInterest.toLocaleString("sv-SE")} →{" "}
                  {result.totalNewInterest.toLocaleString("sv-SE")}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Första klart
                </div>
                <div className="text-lg sm:text-xl font-black text-teal-300 mt-0.5 font-mono">
                  {result.firstDebtPaidDate === "-"
                    ? "—"
                    : result.firstDebtPaidDate}
                </div>
                <div className="text-[9px] text-slate-500 mt-1">
                  Orig: {result.originalFreedomDate}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-teal-400" />
                Tidslinje
              </h3>
              <FreedomTimeline
                originalMonths={origMonths || 0}
                newMonths={newMonths || 0}
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <h3 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                Ordning
              </h3>
              <div className="space-y-1.5">
                {sortedResults.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800 last:border-0 text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] font-bold bg-slate-800 text-slate-400 w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                        {r.payoffOrder}
                      </span>
                      <span className="font-medium text-white truncate">
                        {r.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
                      <span className="text-slate-500">
                        {r.originalEndDate}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      <span
                        className={
                          r.isFullyAmortizing
                            ? "text-teal-400 font-bold"
                            : "text-red-400 font-bold"
                        }
                      >
                        {r.isFullyAmortizing ? r.newEndDate : "aldrig"}
                      </span>
                      {r.isFullyAmortizing && (
                        <span className="text-emerald-400">
                          −
                          <AnimatedNumber value={r.interestSaved} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {result.loanResults.length === 0 && (
                  <p className="text-[11px] text-slate-500 py-2">
                    Fyll i skuld och månadsbelopp för att se resultat.
                  </p>
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-600 text-center px-2 leading-relaxed">
              <b>Manuellt läge:</b> Du väljer själv när och hur mycket extra
              du betalar. Använd &quot;Återinvestera&quot; när ett lån är
              klart.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
