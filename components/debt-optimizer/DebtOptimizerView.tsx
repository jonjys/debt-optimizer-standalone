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
} from "lucide-react";
import { calculateExcelStrategy } from "@/lib/debt-optimizer/engine";
import type {
  Loan,
  OneTimePayment,
  PayoffStrategy,
} from "@/lib/debt-optimizer/types";

/* ---------- Animated number ---------- */
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
    const duration = 400;
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

/* ---------- Number field that allows empty / typing ---------- */
function NumField({
  value,
  onChange,
  className = "",
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
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
            setText(String(value));
          }
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.,]/g, "");
          setText(v);
          const n = parseFloat(v.replace(",", "."));
          if (!isNaN(n) && v !== "" && v !== "." && v !== ",") {
            onChange(n);
          }
        }}
        className={className}
      />
    </div>
  );
}

/* ---------- Timeline ---------- */
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
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>Din plan</span>
        <span>Original ({originalMonths} mån)</span>
      </div>
      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-emerald-400 font-medium">
        {saved} månader tidigare
      </div>
    </div>
  );
}

const defaultLoans = (): Loan[] => [
  {
    id: "nordea",
    name: "Nordea",
    loanType: "Rak amortering",
    balance: 112455,
    interestRate: 0.0595,
    currentMonthlyPayment: 1389,
    extraMonthly: 611,
  },
  {
    id: "nordax",
    name: "Nordax",
    loanType: "Annuitet",
    balance: 589111,
    interestRate: 0.0909,
    currentMonthlyPayment: 6888,
    extraMonthly: 500,
  },
];export function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>(defaultLoans);
  const [oneTimePayments, setOneTimePayments] = useState<OneTimePayment[]>([
    { id: "1", date: "2028-04", amount: 10000 },
    { id: "2", date: "2029-04", amount: 12000 },
  ]);
  const [startDate, setStartDate] = useState("2026-08");
  const [strategy, setStrategy] = useState<PayoffStrategy>("cascade");
  const [globalExtra, setGlobalExtra] = useState(0);
  const [showOneTime, setShowOneTime] = useState(true);

  const result = useMemo(
    () =>
      calculateExcelStrategy({
        loans,
        oneTimePayments,
        startDate,
        strategy,
        globalExtraMonthly: globalExtra,
      }),
    [loans, oneTimePayments, startDate, strategy, globalExtra]
  );

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

  const addLoan = () => {
    const id = `loan-${Date.now()}`;
    setLoans((prev) => [
      ...prev,
      {
        id,
        name: `Lån ${prev.length + 1}`,
        loanType: "Annuitet",
        balance: 50000,
        interestRate: 0.08,
        currentMonthlyPayment: 1000,
        extraMonthly: 0,
      },
    ]);
  };

  const removeLoan = (id: string) => {
    setLoans((prev) => prev.filter((l) => l.id !== id));
  };

  const addOneTime = () => {
    setOneTimePayments((prev) => [
      ...prev,
      { id: Date.now().toString(), date: "2028-04", amount: 10000 },
    ]);
  };

  const updateOneTime = (
    id: string,
    field: "date" | "amount",
    val: string | number
  ) => {
    setOneTimePayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const removeOneTime = (id: string) => {
    setOneTimePayments((prev) => prev.filter((p) => p.id !== id));
  };

  const topUpTo = (loan: Loan) =>
    (loan.currentMonthlyPayment || 0) + (loan.extraMonthly || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Calculator className="w-4 h-4" />
              Karma Debt Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Lånekalkylator & Strategi
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-lg">
              Lägg till dina lån, välj strategi och se direkt när du blir
              skuldfri – och hur mycket ränta du sparar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
              <span className="text-xs text-slate-400">Start</span>
              <input
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-teal-400"
              />
            </div>
          </div>
        </header>

        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap gap-2 items-center">
            <span className="text-[11px] text-slate-400 font-medium mr-1">
              Strategi
            </span>
            {(
              [
                ["cascade", "Kaskad (din ordning)"],
                ["avalanche", "Lavin (högst ränta)"],
                ["snowball", "Snöboll (lägst skuld)"],
              ] as [PayoffStrategy, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStrategy(key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  strategy === key
                    ? "bg-teal-600/25 border-teal-500/50 text-teal-300 font-bold"
                    : "bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-3 min-w-[200px]">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">
              Extra budget / mån
            </span>
            <NumField
              value={globalExtra}
              onChange={setGlobalExtra}
              className="w-24 bg-slate-950 border border-amber-500/40 rounded-xl px-2 py-1.5 text-sm font-mono font-bold text-amber-300 text-center"
            />
          </div>
        </div>        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <section className="lg:col-span-5 space-y-4">
            {loans.map((loan, idx) => {
              const res = result.loanResults.find((r) => r.id === loan.id);
              return (
                <div
                  key={loan.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={loan.name}
                      onChange={(e) =>
                        updateLoan(loan.id, { name: e.target.value })
                      }
                      className="bg-transparent font-bold text-white text-sm border-b border-transparent hover:border-slate-600 focus:border-teal-500 outline-none flex-1 min-w-0"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-teal-400">
                        {res?.newEndDate ?? "—"}
                      </span>
                      {loans.length > 1 && (
                        <button
                          onClick={() => removeLoan(loan.id)}
                          className="p-1 text-slate-600 hover:text-red-400"
                          title="Ta bort lån"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Skuld (kr)
                      </label>
                      <NumField
                        value={loan.balance}
                        onChange={(n) => updateLoan(loan.id, { balance: n })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-200 outline-none focus:border-teal-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Ränta (%)
                      </label>
                      <NumField
                        value={+(loan.interestRate * 100).toFixed(2)}
                        onChange={(n) =>
                          updateLoan(loan.id, { interestRate: n / 100 })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-200 outline-none focus:border-teal-500/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Min. bet/mån
                      </label>
                      <NumField
                        value={loan.currentMonthlyPayment}
                        onChange={(n) =>
                          updateLoan(loan.id, { currentMonthlyPayment: n })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-200 outline-none focus:border-teal-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-amber-400/90 block mb-1">
                        Extra / mån
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={5000}
                          step={50}
                          value={loan.extraMonthly ?? 0}
                          onChange={(e) =>
                            updateLoan(loan.id, {
                              extraMonthly: Number(e.target.value),
                            })
                          }
                          className="flex-1 accent-amber-400 h-1.5 min-w-0"
                        />
                        <NumField
                          value={loan.extraMonthly ?? 0}
                          onChange={(n) =>
                            updateLoan(loan.id, { extraMonthly: n })
                          }
                          className="w-16 bg-slate-950 border border-amber-500/40 rounded-xl px-1 py-1.5 text-xs font-mono font-bold text-amber-300 text-center outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Betalar ca{" "}
                    <span className="text-slate-300 font-mono">
                      {topUpTo(loan).toLocaleString("sv-SE")}
                    </span>{" "}
                    kr/mån totalt
                    {strategy === "cascade" && idx === 0 && (
                      <span className="text-teal-500/80">
                        {" "}
                        · när detta är klart flyttas beloppet vidare
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-[11px] font-mono pt-2 border-t border-slate-800">
                    <span className="text-slate-500">
                      {res?.originalEndDate}{" "}
                      <ArrowRight className="inline w-3 h-3 text-slate-600" />{" "}
                      <span className="text-teal-400">{res?.newEndDate}</span>
                    </span>
                    <span className="text-emerald-400">
                      −
                      <AnimatedNumber value={res?.interestSaved ?? 0} /> kr
                    </span>
                  </div>
                </div>
              );
            })}

            <button
              onClick={addLoan}
              className="w-full flex items-center justify-center gap-2 text-sm bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-600 text-slate-300 py-3 rounded-2xl transition"
            >
              <Plus className="w-4 h-4" /> Lägg till lån
            </button>            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowOneTime(!showOneTime)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-400" />
                  <span className="text-sm font-bold text-white">
                    Engångs (skatt m.m.)
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                    {oneTimePayments.length}
                  </span>
                </div>
                {showOneTime ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {showOneTime && (
                <div className="px-4 pb-4 space-y-2">
                  {oneTimePayments.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <input
                        type="month"
                        value={p.date}
                        onChange={(e) =>
                          updateOneTime(p.id, "date", e.target.value)
                        }
                        className="bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono text-slate-200 flex-1"
                      />
                      <NumField
                        value={p.amount}
                        onChange={(n) => updateOneTime(p.id, "amount", n)}
                        className="bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-emerald-400 w-24 outline-none"
                      />
                      <button
                        onClick={() => removeOneTime(p.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addOneTime}
                    className="w-full flex items-center justify-center gap-1.5 text-xs bg-teal-600/15 hover:bg-teal-600/25 text-teal-300 border border-teal-500/20 py-2.5 rounded-xl transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Lägg till engångs
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="lg:col-span-7 lg:sticky lg:top-6 self-start space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Helt skuldfri
                </div>
                <div className="text-2xl font-black text-white mt-1 font-mono">
                  {result.newFreedomDate}
                </div>
                <div className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  <AnimatedNumber value={result.totalMonthsSaved} /> mån
                  snabbare
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Sparad ränta
                </div>
                <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                  <AnimatedNumber value={result.totalInterestSaved} />
                  <span className="text-base ml-0.5">kr</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5">
                  {result.totalOriginalInterest.toLocaleString("sv-SE")} →{" "}
                  {result.totalNewInterest.toLocaleString("sv-SE")}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Första lånet klart
                </div>
                <div className="text-2xl font-black text-teal-300 mt-1 font-mono">
                  {result.firstDebtPaidDate}
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5">
                  Original: {result.originalFreedomDate}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-teal-400" />
                Tidslinje
              </h3>
              <FreedomTimeline
                originalMonths={origMonths}
                newMonths={newMonths}
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                Avbetalningsordning
              </h3>
              <div className="space-y-3">
                {[...result.loanResults]
                  .sort((a, b) => a.payoffOrder - b.payoffOrder)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2.5 border-b border-slate-800 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-slate-800 text-slate-400 w-5 h-5 rounded-full flex items-center justify-center">
                          {r.payoffOrder}
                        </span>
                        <span className="font-medium text-white text-sm">
                          {r.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono pl-7 sm:pl-0">
                        <span className="text-slate-500">
                          {r.originalEndDate}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-teal-400 font-bold">
                          {r.newEndDate}
                        </span>
                        <span className="text-emerald-400">
                          −
                          <AnimatedNumber value={r.interestSaved} /> kr
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-600 text-center px-2">
              Kaskad = din ordning uppifrån. När ett lån är klart går hela dess
              betalning automatiskt till nästa. Lavin prioriterar högst ränta.
              Snöboll lägst skuld.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}