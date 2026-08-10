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
} from "lucide-react";
import { calculateExcelStrategy } from "@/lib/debt-optimizer/engine";
import type { Loan, OneTimePayment } from "@/lib/debt-optimizer/types";

/* ---------- Animated number (no extra deps) ---------- */
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
    if (from === to) return;

    const duration = 450;
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

/* ---------- Progress timeline ---------- */
function FreedomTimeline({
  originalMonths,
  newMonths,
}: {
  originalMonths: number;
  newMonths: number;
}) {
  const safeOrig = Math.max(originalMonths, 1);
  const pct = Math.min(100, (newMonths / safeOrig) * 100);
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

/* ---------- Main view ---------- */
export function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>([
    {
      id: "nordea",
      name: "Nordea",
      loanType: "Rak amortering",
      balance: 112455,
      interestRate: 0.0595,
      currentMonthlyPayment: 1389,
      targetMonthlyPayment: 2000,
    },
    {
      id: "nordax",
      name: "Nordax",
      loanType: "Annuitet",
      balance: 589111,
      interestRate: 0.0909,
      currentMonthlyPayment: 6888,
      extraPaymentFromStart: 500,
      extraPaymentAfterFreed: 2000,
    },
  ]);

  const [oneTimePayments, setOneTimePayments] = useState<OneTimePayment[]>([
    { id: "1", date: "2028-04", amount: 10000 },
    { id: "2", date: "2029-04", amount: 12000 },
  ]);

  const [startDate, setStartDate] = useState("2026-08");
  const [showOneTime, setShowOneTime] = useState(true);

  const result = useMemo(
    () => calculateExcelStrategy({ loans, oneTimePayments, startDate }),
    [loans, oneTimePayments, startDate]
  );

  // Approximate months from date strings for timeline
  const origMonths = useMemo(() => {
    const [y, m] = result.originalFreedomDate.split("-").map(Number);
    const [sy, sm] = startDate.split("-").map(Number);
    if (!y || !sy) return 140;
    return (y - sy) * 12 + (m - sm);
  }, [result.originalFreedomDate, startDate]);

  const newMonths = useMemo(() => {
    const [y, m] = result.newFreedomDate.split("-").map(Number);
    const [sy, sm] = startDate.split("-").map(Number);
    if (!y || !sy) return 100;
    return (y - sy) * 12 + (m - sm);
  }, [result.newFreedomDate, startDate]);

  const handleUpdateLoan = (id: string, field: keyof Loan, val: number) => {
    setLoans((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: val } : l))
    );
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Calculator className="w-4 h-4" />
              Karma Debt Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Lånekalkylator & Strategi
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-md">
              Ändra siffror och se direkt hur mycket du sparar och när du blir skuldfri.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl shrink-0">
            <span className="text-xs text-slate-400">Start</span>
            <input
              type="month"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-teal-400"
            />
          </div>
        </header>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* ===== LEFT: Inputs ===== */}
          <section className="lg:col-span-5 space-y-4">
            {loans.map((loan, idx) => {
              const res = result.loanResults.find((r) => r.id === loan.id);
              return (
                <div
                  key={loan.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-white">{loan.name}</h2>
                    <span className="text-xs font-mono text-teal-400">
                      {res?.newEndDate}
                    </span>
                  </div>

                  {/* Balance + rate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Skuld (kr)
                      </label>
                      <input
                        type="number"
                        value={loan.balance}
                        onChange={(e) =>
                          handleUpdateLoan(
                            loan.id,
                            "balance",
                            Number(e.target.value)
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-200 focus:border-teal-500/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">
                        Ränta (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={(loan.interestRate * 100).toFixed(2)}
                        onChange={(e) =>
                          handleUpdateLoan(
                            loan.id,
                            "interestRate",
                            Number(e.target.value) / 100
                          )
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-200 focus:border-teal-500/50 outline-none"
                      />
                    </div>
                  </div>

                  {/* Strategy controls */}
                  {idx === 0 && (
                    <div>
                      <label className="text-[11px] text-amber-400/90 block mb-1">
                        Toppa upp till (kr/mån)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={1400}
                          max={4000}
                          step={50}
                          value={loan.targetMonthlyPayment ?? 2000}
                          onChange={(e) =>
                            handleUpdateLoan(
                              loan.id,
                              "targetMonthlyPayment",
                              Number(e.target.value)
                            )
                          }
                          className="flex-1 accent-amber-400 h-1.5"
                        />
                        <input
                          type="number"
                          value={loan.targetMonthlyPayment ?? 2000}
                          onChange={(e) =>
                            handleUpdateLoan(
                              loan.id,
                              "targetMonthlyPayment",
                              Number(e.target.value)
                            )
                          }
                          className="w-20 bg-slate-950 border border-amber-500/40 rounded-xl px-2 py-1.5 text-sm font-mono font-bold text-amber-300 text-center"
                        />
                      </div>
                    </div>
                  )}

                  {idx === 1 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-amber-400/90 block mb-1">
                          Extra från start
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={3000}
                            step={50}
                            value={loan.extraPaymentFromStart ?? 0}
                            onChange={(e) =>
                              handleUpdateLoan(
                                loan.id,
                                "extraPaymentFromStart",
                                Number(e.target.value)
                              )
                            }
                            className="flex-1 accent-amber-400 h-1.5"
                          />
                          <input
                            type="number"
                            value={loan.extraPaymentFromStart ?? 0}
                            onChange={(e) =>
                              handleUpdateLoan(
                                loan.id,
                                "extraPaymentFromStart",
                                Number(e.target.value)
                              )
                            }
                            className="w-16 bg-slate-950 border border-amber-500/40 rounded-xl px-1 py-1.5 text-xs font-mono font-bold text-amber-300 text-center"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-amber-400/90 block mb-1">
                          Efter Nordea
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={5000}
                            step={50}
                            value={loan.extraPaymentAfterFreed ?? 2000}
                            onChange={(e) =>
                              handleUpdateLoan(
                                loan.id,
                                "extraPaymentAfterFreed",
                                Number(e.target.value)
                              )
                            }
                            className="flex-1 accent-amber-400 h-1.5"
                          />
                          <input
                            type="number"
                            value={loan.extraPaymentAfterFreed ?? 2000}
                            onChange={(e) =>
                              handleUpdateLoan(
                                loan.id,
                                "extraPaymentAfterFreed",
                                Number(e.target.value)
                              )
                            }
                            className="w-16 bg-slate-950 border border-amber-500/40 rounded-xl px-1 py-1.5 text-xs font-mono font-bold text-amber-300 text-center"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mini result row */}
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

            {/* One-time payments */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
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
                      <input
                        type="number"
                        value={p.amount}
                        onChange={(e) =>
                          updateOneTime(p.id, "amount", Number(e.target.value))
                        }
                        className="bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-emerald-400 w-24"
                      />
                      <button
                        onClick={() => removeOneTime(p.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition"
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

          {/* ===== RIGHT: Results (sticky on desktop) ===== */}
          <section className="lg:col-span-7 lg:sticky lg:top-6 self-start space-y-4">
            {/* Big KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Helt skuldfri
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono tracking-tight">
                  {result.newFreedomDate}
                </div>
                <div className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  <AnimatedNumber value={result.totalMonthsSaved} /> mån
                  snabbare
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Sparad ränta
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-mono tracking-tight">
                  <AnimatedNumber value={result.totalInterestSaved} />
                  <span className="text-lg ml-0.5">kr</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5">
                  {result.totalOriginalInterest.toLocaleString("sv-SE")} →{" "}
                  {result.totalNewInterest.toLocaleString("sv-SE")} kr
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Original
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-500 mt-1 font-mono tracking-tight">
                  {result.originalFreedomDate}
                </div>
                <div className="text-[11px] text-slate-600 mt-1.5">
                  utan extra inbetalningar
                </div>
              </div>
            </div>

            {/* Timeline */}
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

            {/* Per-loan summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4">
                Avbetalningsplan
              </h3>
              <div className="space-y-3">
                {result.loanResults.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 py-2.5 border-b border-slate-800 last:border-0"
                  >
                    <div className="font-medium text-white text-sm">
                      {r.name}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-slate-500">{r.originalEndDate}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
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
              Dra reglagen eller skriv siffror. När Nordea är klart flyttas
              beloppet automatiskt till Nordax.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}