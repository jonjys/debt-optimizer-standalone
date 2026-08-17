"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { calculatePayoffSchedule } from "@/lib/debt-optimizer/engine";
import type { Loan, OneTimePayment } from "@/lib/debt-optimizer/types";

const START = "2026-08";

const EXAMPLE: Loan[] = [
  {
    id: "nordea",
    name: "Nordea",
    loanType: "Rak amortering",
    paymentStyle: "fixed_amort",
    balance: 112351,
    interestRate: 0.0595,
    currentMonthlyPayment: 1389,
    targetMonthlyTotal: 2000,
    targetMonthlyEnabled: true,
    targetMonthlyFrom: START,
    extraMonthly: 0,
    extraMonthlyEnabled: false,
    extraMonthlyFrom: START,
  },
  {
    id: "nordax",
    name: "Nordax Bank",
    loanType: "Annuitet",
    paymentStyle: "annuity",
    balance: 593689,
    interestRate: 0.0909,
    currentMonthlyPayment: 6887.77,
    targetMonthlyTotal: 0,
    targetMonthlyEnabled: false,
    targetMonthlyFrom: START,
    extraMonthly: 0,
    extraMonthlyEnabled: false,
    extraMonthlyFrom: START,
    reinvestment: {
      enabled: true,
      fromLoanId: "nordea",
      amount: 2000,
      startDate: START,
    },
  },
];

function fmt(n: number) {
  return Math.round(n).toLocaleString("sv-SE");
}

function AnimatedNumber({ value }: { value: number }) {
  const [d, setD] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) {
      setD(value);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 350);
      const e = 1 - Math.pow(1 - t, 3);
      setD(Math.round(from + (value - from) * e));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{fmt(d)}</>;
}

function interestThisMonth(loan: Loan) {
  return (loan.balance * loan.interestRate) / 12;
}

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>(EXAMPLE);
  const [oneTimes, setOneTimes] = useState<OneTimePayment[]>([
    { id: "1", date: "2026-12", amount: 10000, loanId: "nordax" },
  ]);
  const [globalExtra, setGlobalExtra] = useState(500);
  const [globalExtraFrom, setGlobalExtraFrom] = useState(START);
  const [nav, setNav] = useState<"dashboard" | "loans" | "analytics" | "reports">(
    "dashboard"
  );

  const loansWithExtra = useMemo(() => {
    if (globalExtra <= 0) return loans;
    const sorted = [...loans].sort((a, b) => b.interestRate - a.interestRate);
    const targetId = sorted[0]?.id;
    return loans.map((l) =>
      l.id === targetId
        ? {
            ...l,
            extraMonthly: globalExtra,
            extraMonthlyEnabled: true,
            extraMonthlyFrom: globalExtraFrom,
          }
        : l
    );
  }, [loans, globalExtra, globalExtraFrom]);

  const result = useMemo(() => {
    if (!loansWithExtra.length) return null;
    return calculatePayoffSchedule({
      loans: loansWithExtra,
      oneTimePayments: oneTimes,
      startDate: START,
      strategy: "custom",
    });
  }, [loansWithExtra, oneTimes]);

  const totalDebt = loans.reduce((s, l) => s + l.balance, 0);
  const totalMin = loans.reduce((s, l) => {
    if (l.paymentStyle === "fixed_amort") {
      return s + l.currentMonthlyPayment + interestThisMonth(l);
    }
    return s + l.currentMonthlyPayment;
  }, 0);

  const updateLoan = (id: string, patch: Partial<Loan>) => {
    setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const loadExample = () => {
    setLoans(EXAMPLE);
    setOneTimes([{ id: "1", date: "2026-12", amount: 10000, loanId: "nordax" }]);
    setGlobalExtra(500);
  };

  const clearAll = () => {
    setLoans([]);
    setOneTimes([]);
    setGlobalExtra(0);
  };

  const addLoan = () => {
    setLoans((prev) => [
      ...prev,
      {
        id: `loan-${Date.now()}`,
        name: `Lån ${prev.length + 1}`,
        loanType: "Annuitet",
        paymentStyle: "annuity",
        balance: 50000,
        interestRate: 0.08,
        currentMonthlyPayment: 1200,
        extraMonthly: 0,
        extraMonthlyEnabled: false,
        extraMonthlyFrom: START,
      },
    ]);
  };

  const nordeaRes = result?.loanResults.find((r) => r.id === "nordea");
  const nordaxRes = result?.loanResults.find((r) => r.id === "nordax");

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans">
      {result && totalDebt > 0 && (
        <div className="lg:hidden sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0c]/95 backdrop-blur-md px-3 py-2 flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">
            {loans.length} lån · {fmt(totalDebt)}:-
          </span>
          <span className="font-mono font-bold text-emerald-400">
            Skuldfri {result.newFreedomDate} · Sparat{" "}
            <AnimatedNumber value={result.totalInterestSaved} />:-
          </span>
        </div>
      )}

      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-52 shrink-0 flex-col border-r border-white/[0.07] bg-[#0d0d10] p-4">
          <div className="flex items-center gap-2 mb-8 px-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600" />
            <span className="text-sm font-semibold tracking-tight">Debt Optimizer</span>
          </div>
          <nav className="space-y-0.5">
            {(["dashboard", "loans", "analytics", "reports"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setNav(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition ${
                  nav === key
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </nav>
          <div className="mt-auto pt-6 text-[10px] text-zinc-600 px-1 leading-relaxed">
            100% lokalt · Big.js · Inget sparas
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <header className="border-b border-white/[0.06] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold tracking-tight">
                Lånekalkylator{" "}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  PRO
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-[12px]">
              <span className="font-mono text-zinc-400">
                {loans.length} lån · {fmt(totalDebt)}:-
              </span>
              <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                JK
              </div>
            </div>
          </header>

          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
            {nav === "analytics" || nav === "reports" ? (
              <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-10 text-center">
                <p className="text-zinc-400 text-sm mb-2">{nav}</p>
                <p className="text-zinc-600 text-xs">Kommer i nästa sprint.</p>
                <button onClick={() => setNav("dashboard")} className="mt-4 text-sm text-emerald-400 hover:underline">
                  ← Dashboard
                </button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-12 gap-5 lg:gap-6">
                <section className="lg:col-span-7 space-y-3">
                  {loans.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-[#121216] p-10 text-center">
                      <h2 className="text-lg font-semibold mb-2">Tom mall</h2>
                      <p className="text-zinc-500 text-sm mb-6">Lägg till lån eller ladda exempel.</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button onClick={addLoan} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium">
                          + Lägg till lån
                        </button>
                        <button onClick={loadExample} className="px-5 py-2.5 rounded-xl border border-white/15 hover:bg-white/5 text-sm">
                          Ladda exempel
                        </button>
                      </div>
                    </div>
                  )}

                  {loans.map((loan) => {
                    const lr = result?.loanResults.find((r) => r.id === loan.id);
                    const isRak = loan.paymentStyle === "fixed_amort";
                    const intM = interestThisMonth(loan);
                    const regularTotal = isRak
                      ? loan.currentMonthlyPayment + intM
                      : loan.currentMonthlyPayment;
                    const target = loan.targetMonthlyEnabled ? loan.targetMonthlyTotal || 0 : 0;
                    const extraNow = target > regularTotal ? target - regularTotal : 0;
                    const amortPart = isRak
                      ? loan.currentMonthlyPayment
                      : Math.max(0, loan.currentMonthlyPayment - intM);

                    return (
                      <div key={loan.id} className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4 sm:p-5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold">
                                {loan.name.slice(0, 1).toUpperCase()}
                              </span>
                              <input
                                value={loan.name}
                                onChange={(e) => updateLoan(loan.id, { name: e.target.value })}
                                className="bg-transparent font-semibold text-sm outline-none border-b border-transparent focus:border-emerald-500/50 min-w-0"
                              />
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                isRak ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300"
                              }`}>
                                {isRak ? "Rak amort" : "Annuitet"}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400">
                                Ränta {(loan.interestRate * 100).toFixed(2)}%
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[9px] text-zinc-600 uppercase">Klar</div>
                            <div className="font-mono text-sm text-emerald-400">
                              {lr?.newEndDate && lr.newEndDate !== "-" ? lr.newEndDate : "—"}
                            </div>
                            {lr && lr.monthsSaved > 0 && (
                              <div className="text-[10px] text-emerald-500/80">−{lr.monthsSaved} mån</div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div className="rounded-lg bg-black/40 border border-white/[0.05] p-2">
                            <div className="text-[9px] text-zinc-600 mb-0.5">SKULD KVAR</div>
                            <div className="font-mono font-semibold">{fmt(loan.balance)}:-</div>
                          </div>
                          <div className="rounded-lg bg-black/40 border border-white/[0.05] p-2">
                            <div className="text-[9px] text-zinc-600 mb-0.5">{isRak ? "AMORT / MÅN" : "MÅNADSKOSTNAD"}</div>
                            <div className="font-mono font-semibold">{fmt(loan.currentMonthlyPayment)}:-</div>
                          </div>
                          <div className="rounded-lg bg-black/40 border border-white/[0.05] p-2">
                            <div className="text-[9px] text-zinc-600 mb-0.5">RÄNTA / MÅN</div>
                            <div className="font-mono font-semibold text-zinc-300">{fmt(intM)}:-</div>
                          </div>
                        </div>

                        <div className="rounded-xl bg-black/30 border border-white/[0.06] p-3 space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!loan.targetMonthlyEnabled}
                              onChange={(e) =>
                                updateLoan(loan.id, {
                                  targetMonthlyEnabled: e.target.checked,
                                  targetMonthlyFrom: loan.targetMonthlyFrom || START,
                                  targetMonthlyTotal: loan.targetMonthlyTotal || Math.ceil(regularTotal),
                                })
                              }
                              className="accent-emerald-500 w-3.5 h-3.5"
                            />
                            <span className="text-[11px] font-medium text-zinc-300">BETALA TOTALT / MÅN</span>
                          </label>
                          {loan.targetMonthlyEnabled && (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="number"
                                  value={loan.targetMonthlyTotal || ""}
                                  onChange={(e) =>
                                    updateLoan(loan.id, { targetMonthlyTotal: Number(e.target.value) || 0 })
                                  }
                                  className="w-24 bg-[#0a0a0c] border border-emerald-500/30 rounded-lg px-2 py-1.5 font-mono text-sm font-bold text-emerald-300 outline-none"
                                />
                                <span className="text-[10px] text-zinc-500">
                                  NÄSTA {fmt(regularTotal)} → {fmt(target || regularTotal)}:-
                                  {extraNow > 0 && (
                                    <span className="text-emerald-400"> +{fmt(extraNow)} EXTRA</span>
                                  )}
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-zinc-500 to-emerald-400 rounded-full"
                                  style={{
                                    width: `${Math.min(100, (amortPart / Math.max(regularTotal, 1)) * 100)}%`,
                                  }}
                                />
                              </div>
                              <p className="text-[9px] text-zinc-600">
                                {fmt(amortPart)} amort + {fmt(intM)} ränta
                                {extraNow > 0 ? ` · ${fmt(extraNow)}:- går direkt mot skuld` : ""}
                              </p>
                            </>
                          )}
                        </div>

                        {loan.id === "nordax" && (
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-teal-500/20 bg-teal-950/20 px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                checked={!!loan.reinvestment?.enabled}
                                onChange={(e) =>
                                  updateLoan(loan.id, {
                                    reinvestment: {
                                      enabled: e.target.checked,
                                      fromLoanId: "nordea",
                                      amount: loan.reinvestment?.amount || 2000,
                                      startDate: loan.reinvestment?.startDate || nordeaRes?.newEndDate || START,
                                    },
                                  })
                                }
                                className="accent-teal-400 w-3.5 h-3.5"
                              />
                              <span className="text-[11px] text-teal-200/90 leading-snug">
                                När Nordea klart:{" "}
                                <span className="font-mono font-bold text-teal-300">
                                  {loan.reinvestment?.amount || 2000}:-
                                </span>{" "}
                                → Nordax
                              </span>
                            </label>
                            {loan.reinvestment?.enabled && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded shrink-0">
                                Aktiv
                              </span>
                            )}
                          </div>
                        )}

                        {lr && (
                          <div className="flex flex-wrap gap-3 text-[10px] font-mono text-zinc-500">
                            <span>Orig: {fmt(lr.originalTotalInterest)}:-</span>
                            <span>Ny: {fmt(lr.newTotalInterest)}:-</span>
                            <span className="text-emerald-400">Sparad: {fmt(lr.interestSaved)}:-</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {loans.length > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4 grid sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                          Extra inbetalning / mån
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={globalExtra || ""}
                            onChange={(e) => setGlobalExtra(Number(e.target.value) || 0)}
                            placeholder="500"
                            className="w-24 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 font-mono text-sm outline-none focus:border-emerald-500/40"
                          />
                          <input
                            type="month"
                            value={globalExtraFrom}
                            onChange={(e) => setGlobalExtraFrom(e.target.value)}
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 font-mono text-[11px] outline-none"
                          />
                        </div>
                        <p className="text-[9px] text-zinc-600 mt-1">Fördelas mot högst ränta</p>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                          Engångsbetalning
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <input type="number" id="otp-amt" placeholder="10000" className="w-24 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 font-mono text-sm outline-none" />
                          <input type="month" id="otp-date" defaultValue="2026-12" className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 font-mono text-[11px] outline-none" />
                          <button
                            onClick={() => {
                              const a = Number((document.getElementById("otp-amt") as HTMLInputElement)?.value);
                              const d = (document.getElementById("otp-date") as HTMLInputElement)?.value;
                              if (a > 0 && d) {
                                setOneTimes((p) => [...p, { id: Date.now().toString(), amount: a, date: d, loanId: loans[0]?.id }]);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-[11px] font-medium"
                          >
                            + Lägg till
                          </button>
                        </div>
                        <div className="mt-1.5 space-y-1">
                          {oneTimes.map((ot) => (
                            <div key={ot.id} className="flex justify-between text-[10px] font-mono text-zinc-400">
                              <span>{ot.date} · {fmt(ot.amount)}:-</span>
                              <button onClick={() => setOneTimes((p) => p.filter((x) => x.id !== ot.id))} className="text-red-400/80">×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button onClick={addLoan} className="text-[12px] px-3 py-2 rounded-xl border border-dashed border-white/15 text-zinc-400 hover:text-white">
                      + Lägg till lån
                    </button>
                    {loans.length > 0 && (
                      <>
                        <button onClick={loadExample} className="text-[12px] px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300">Ladda exempel</button>
                        <button onClick={clearAll} className="text-[12px] px-3 py-2 rounded-xl text-zinc-600 hover:text-red-400">Rensa</button>
                      </>
                    )}
                  </div>
                </section>

                <section className="lg:col-span-5 space-y-3 lg:sticky lg:top-4 self-start">
                  {result && totalDebt > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4">
                          <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Skuldfri</div>
                          <div className="font-mono text-2xl font-bold tabular-nums">
                            {result.newFreedomDate !== "-" ? result.newFreedomDate : "—"}
                          </div>
                          {result.totalMonthsSaved > 0 ? (
                            <div className="text-[11px] text-emerald-400 mt-1 font-medium">−{result.totalMonthsSaved} mån snabbare</div>
                          ) : result.newFreedomDate !== "-" ? (
                            <div className="text-[11px] text-zinc-500 mt-1">Minimibetalning</div>
                          ) : null}
                        </div>
                        <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4">
                          <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">Sparad ränta</div>
                          <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                            <AnimatedNumber value={result.totalInterestSaved} />
                            <span className="text-base">:-</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                            {fmt(result.totalOriginalInterest)} → {fmt(result.totalNewInterest)}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4">
                        <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-3">Tidslinje</div>
                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <span className="text-zinc-500">{START}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" style={{ width: result.totalMonthsSaved > 0 ? "70%" : "100%" }} />
                          </div>
                          <span className="text-emerald-400 font-bold">{result.newFreedomDate}</span>
                        </div>
                        {nordeaRes?.newEndDate && nordeaRes.newEndDate !== "-" && (
                          <p className="text-[10px] text-zinc-500 mt-2">
                            Nordea klar <span className="text-zinc-300 font-mono">{nordeaRes.newEndDate}</span>
                            {nordaxRes?.newEndDate && nordaxRes.newEndDate !== "-" && (
                              <> · Nordax <span className="text-zinc-300 font-mono">{nordaxRes.newEndDate}</span></>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4">
                        <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-2">Betalning / mån</div>
                        <div className="font-mono text-lg font-bold mb-2">
                          {fmt(totalMin + globalExtra)}:- <span className="text-zinc-500 text-sm font-normal">totalt</span>
                        </div>
                        {globalExtra > 0 && (
                          <div className="text-[11px] text-emerald-400">Extra +{fmt(globalExtra)}:- (högst ränta)</div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4">
                        <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-2">Ordning</div>
                        <div className="space-y-2">
                          {[...(result.loanResults || [])].sort((a, b) => a.payoffOrder - b.payoffOrder).map((r) => (
                            <div key={r.id} className="flex items-center justify-between text-[12px]">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[9px] font-bold text-zinc-400">{r.payoffOrder}</span>
                                <span className="font-medium">{r.name}</span>
                              </div>
                              <div className="font-mono text-[11px]">
                                <span className="text-zinc-600">{r.originalEndDate}</span>
                                <span className="text-zinc-700 mx-1">→</span>
                                <span className="text-emerald-400">{r.newEndDate}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-8 text-center text-zinc-500 text-sm">
                      Lägg till lån för att se skuldfri-datum och sparad ränta.
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
