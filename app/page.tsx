"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { calculatePayoffSchedule } from "@/lib/debt-optimizer/engine";
import { calculateBakeIn, bandLabel } from "@/lib/debt-optimizer/bake-in";
import type { Loan, OneTimePayment } from "@/lib/debt-optimizer/types";

const START = "2026-08";
const EXAMPLE: Loan[] = [
  { id: "nordea", name: "Nordea", loanType: "Rak amortering", paymentStyle: "fixed_amort", balance: 112351, interestRate: 0.0595, currentMonthlyPayment: 1389, targetMonthlyTotal: 2000, targetMonthlyEnabled: true, targetMonthlyFrom: START, extraMonthly: 0, extraMonthlyEnabled: false, extraMonthlyFrom: START },
  { id: "nordax", name: "Nordax Bank", loanType: "Annuitet", paymentStyle: "annuity", balance: 593689, interestRate: 0.0909, currentMonthlyPayment: 6887.77, targetMonthlyTotal: 0, targetMonthlyEnabled: false, targetMonthlyFrom: START, extraMonthly: 0, extraMonthlyEnabled: false, extraMonthlyFrom: START, reinvestment: { enabled: true, fromLoanId: "nordea", amount: 2000, startDate: START } },
];
function fmt(n: number) { return Math.round(n).toLocaleString("sv-SE"); }
function AnimatedNumber({ value }: { value: number }) {
  const [d, setD] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current; prev.current = value;
    if (from === value) { setD(value); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 350);
      setD(Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{fmt(d)}</>;
}
function interestThisMonth(loan: Loan) { return (loan.balance * loan.interestRate) / 12; }

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>(EXAMPLE);
  const [oneTimes, setOneTimes] = useState<OneTimePayment[]>([{ id: "1", date: "2026-12", amount: 10000, loanId: "nordax" }]);
  const [globalExtra, setGlobalExtra] = useState(500);
  const [globalExtraFrom, setGlobalExtraFrom] = useState(START);
  const [nav, setNav] = useState<"dashboard" | "loans" | "analytics" | "reports">("dashboard");
  const [tab, setTab] = useState<"idag" | "jamfor" | "bakain">("idag");
  const [biMortgage, setBiMortgage] = useState(2000000);
  const [biMortRate, setBiMortRate] = useState(4.1);
  const [biPersonal, setBiPersonal] = useState(180000);
  const [biPersRate, setBiPersRate] = useState(11.5);
  const [biHome, setBiHome] = useState(3200000);
  const [biBake, setBiBake] = useState(180000);

  const loansWithExtra = useMemo(() => {
    if (globalExtra <= 0) return loans;
    const sorted = [...loans].sort((a, b) => b.interestRate - a.interestRate);
    const targetId = sorted[0]?.id;
    return loans.map((l) => l.id === targetId ? { ...l, extraMonthly: globalExtra, extraMonthlyEnabled: true, extraMonthlyFrom: globalExtraFrom } : l);
  }, [loans, globalExtra, globalExtraFrom]);

  const run = (strategy: "custom" | "avalanche" | "snowball") => {
    if (!loansWithExtra.length) return null;
    return calculatePayoffSchedule({ loans: loansWithExtra, oneTimePayments: oneTimes, startDate: START, strategy });
  };
  const resultCustom = useMemo(() => run("custom"), [loansWithExtra, oneTimes]);
  const resultAva = useMemo(() => run("avalanche"), [loansWithExtra, oneTimes]);
  const resultSnow = useMemo(() => run("snowball"), [loansWithExtra, oneTimes]);
  const result = resultCustom;

  const bi = useMemo(
    () =>
      calculateBakeIn({
        mortgage: biMortgage,
        mortgageRate: biMortRate / 100,
        personal: biPersonal,
        personalRate: biPersRate / 100,
        homeValue: biHome,
        bakeAmount: biBake,
      }),
    [biMortgage, biMortRate, biPersonal, biPersRate, biHome, biBake]
  );

  const totalDebt = loans.reduce((s, l) => s + l.balance, 0);
  const totalMin = loans.reduce((s, l) => s + (l.paymentStyle === "fixed_amort" ? l.currentMonthlyPayment + interestThisMonth(l) : l.currentMonthlyPayment), 0);
  const updateLoan = (id: string, patch: Partial<Loan>) => setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const loadExample = () => { setLoans(EXAMPLE); setOneTimes([{ id: "1", date: "2026-12", amount: 10000, loanId: "nordax" }]); setGlobalExtra(500); };
  const clearAll = () => { setLoans([]); setOneTimes([]); setGlobalExtra(0); };
  const addLoan = () => setLoans((prev) => [...prev, { id: `loan-${Date.now()}`, name: `Lån ${prev.length + 1}`, loanType: "Annuitet", paymentStyle: "annuity", balance: 50000, interestRate: 0.08, currentMonthlyPayment: 1200, extraMonthly: 0, extraMonthlyEnabled: false, extraMonthlyFrom: START }]);
  const nordeaRes = result?.loanResults.find((r) => r.id === "nordea");

  const bandColor = (band: string) =>
    band === "over85" ? "text-red-400 bg-red-500/10 border-red-500/30" :
    band === "two" ? "text-amber-300 bg-amber-500/10 border-amber-500/30" :
    band === "one" ? "text-sky-300 bg-sky-500/10 border-sky-500/30" :
    "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans">
      {result && totalDebt > 0 && (
        <div className="lg:hidden sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0c]/95 backdrop-blur-md px-3 py-2 flex items-center justify-between text-[11px]">
          <span className="text-zinc-400">{loans.length} lån · {fmt(totalDebt)}:-</span>
          <span className="font-mono font-bold text-emerald-400">Skuldfri {result.newFreedomDate} · Sparat <AnimatedNumber value={result.totalInterestSaved} />:-</span>
        </div>
      )}
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-52 shrink-0 flex-col border-r border-white/[0.07] bg-[#0d0d10] p-4">
          <div className="flex items-center gap-2 mb-8 px-1"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600" /><span className="text-sm font-semibold">Debt Optimizer</span></div>
          <nav className="space-y-0.5">{(["dashboard", "loans", "analytics", "reports"] as const).map((key) => (
            <button key={key} onClick={() => setNav(key)} className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium ${nav === key ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-200"}`}>{key.charAt(0).toUpperCase() + key.slice(1)}</button>
          ))}</nav>
          <div className="mt-auto pt-6 text-[10px] text-zinc-600 px-1">✓ Beräkningar lokalt · Inget sparas · Rak vs annuitet i realtid</div>
        </aside>
        <main className="flex-1 min-w-0">
          <header className="border-b border-white/[0.06] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold">Lånekalkylator <span className="text-[10px] font-semibold uppercase text-amber-400/90 border border-amber-500/30 px-1.5 py-0.5 rounded">PRO</span></span>
            <span className="font-mono text-[12px] text-zinc-400 tabular-nums">{loans.length} lån · {fmt(totalDebt)}:-</span>
          </header>
          <div className="px-4 sm:px-6 pt-4 flex gap-1.5 flex-wrap">
            {([["idag", "Idag"], ["jamfor", "Jämför"], ["bakain", "Baka in"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`text-[12px] px-3 py-1.5 rounded-lg border transition ${tab === k ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300 font-semibold" : "border-white/10 text-zinc-500"}`}>{label}</button>
            ))}
          </div>
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
            {tab === "bakain" ? (
              <div className="grid lg:grid-cols-2 gap-5 max-w-4xl">
                <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-5 space-y-3">
                  <h2 className="text-sm font-bold">Baka in privatlån i bolån</h2>
                  <p className="text-[11px] text-zinc-500">Svensk LTV-trappa (apr 2026). Skuldkvotstillägg borttaget.</p>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <label><span className="text-zinc-500 text-[10px]">Bolån kr</span><input type="number" value={biMortgage} onChange={(e) => setBiMortgage(+e.target.value || 0)} className="w-full mt-0.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 font-mono tabular-nums" /></label>
                    <label><span className="text-zinc-500 text-[10px]">Bolåneränta %</span><input type="number" step="0.01" value={biMortRate} onChange={(e) => setBiMortRate(+e.target.value || 0)} className="w-full mt-0.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 font-mono tabular-nums" /></label>
                    <label><span className="text-zinc-500 text-[10px]">Blancolån kr</span><input type="number" value={biPersonal} onChange={(e) => setBiPersonal(+e.target.value || 0)} className="w-full mt-0.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 font-mono tabular-nums" /></label>
                    <label><span className="text-zinc-500 text-[10px]">Blanco-ränta %</span><input type="number" step="0.01" value={biPersRate} onChange={(e) => setBiPersRate(+e.target.value || 0)} className="w-full mt-0.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 font-mono tabular-nums" /></label>
                    <label className="col-span-2"><span className="text-zinc-500 text-[10px]">Bostadsvärde kr</span><input type="number" value={biHome} onChange={(e) => setBiHome(+e.target.value || 0)} className="w-full mt-0.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 font-mono tabular-nums" /></label>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1"><span className="text-zinc-400">Baka in</span><span className="font-mono text-emerald-400 font-bold tabular-nums">{fmt(biBake)} kr</span></div>
                    <input type="range" min={0} max={biPersonal || 1} step={5000} value={biBake} onChange={(e) => setBiBake(+e.target.value)} className="w-full accent-emerald-500" />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-5 space-y-3">
                  <h2 className="text-sm font-bold">Svenska regler</h2>
                  {bi.warningText && (
                    <div className={`text-[11px] border rounded-lg px-3 py-2 ${bi.warningLtv ? "text-red-300 bg-red-500/10 border-red-500/30" : "text-amber-300 bg-amber-500/10 border-amber-500/30"}`}>
                      {bi.warningText}
                    </div>
                  )}
                  <div className={`text-[11px] border rounded-lg px-3 py-2 ${bandColor(bi.bandAfter)}`}>
                    Efter inbakning: {bandLabel(bi.bandAfter)}
                  </div>
                  <div className="rounded-lg bg-black/30 p-3 text-[11px] font-mono space-y-1.5 tabular-nums">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">SVENSKA REGLER</div>
                    <div>Belåningsgrad: {(bi.ltvBefore * 100).toFixed(0)}% → <span className="text-white">{(bi.ltvAfter * 100).toFixed(0)}%</span></div>
                    <div>Amorteringskrav: {(bi.amortBefore * 100).toFixed(0)}% → <span className="text-white">{(bi.amortAfter * 100).toFixed(0)}%/år</span></div>
                    <div>Amortkrav kr/mån: {fmt(bi.amortKrBefore)} → <span className="text-white">{fmt(bi.amortKrAfter)}</span>{bi.amortKrDelta > 0 ? ` (+${fmt(bi.amortKrDelta)})` : ""}</div>
                    <div>Skuldkvot: Inget extra tillägg från apr 2026</div>
                    <div>Ränteavdrag: 30% på räntan</div>
                    <div>Brutto ränta: {fmt(bi.totalIntBefore)} → {fmt(bi.totalIntAfter)} kr</div>
                    <div>Netto efter avdrag: {fmt(bi.totalIntBefore * 0.7)} → {fmt(bi.totalIntAfter * 0.7)} kr</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-black/30 p-3"><div className="text-zinc-500 text-[9px] uppercase mb-1">Månadskostnad</div><div className="font-mono tabular-nums">{fmt(bi.monthBefore)} → {fmt(bi.monthAfter)}:-</div></div>
                    <div className="rounded-lg bg-black/30 p-3"><div className="text-zinc-500 text-[9px] uppercase mb-1">Sparad ränta netto</div><div className="font-mono text-emerald-400 tabular-nums">{fmt(bi.interestSavedNet)}:-</div></div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-sm leading-snug">
                    {bi.summaryLine}
                  </div>
                  <p className="text-[9px] text-zinc-600">Indikativ kalkyl. Bankens villkor kan skilja. LTV &gt;70% = 2%, 50–70% = 1%.</p>
                </div>
              </div>
            ) : tab === "jamfor" ? (
              <div className="space-y-4">
                <p className="text-[12px] text-zinc-500">Samma lån &amp; extra — tre strategier. Uppdateras live.</p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {[{ t: "Idag (din ordning)", r: resultCustom }, { t: "Lavin (högst ränta)", r: resultAva }, { t: "Snöboll (lägst skuld)", r: resultSnow }].map((c) => (
                    <div key={c.t} className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4 min-w-[200px] flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">{c.t}</div>
                      {c.r && c.r.newFreedomDate !== "-" ? (<><div className="font-mono text-xl font-bold tabular-nums">{c.r.newFreedomDate}</div><div className="text-[11px] text-zinc-400 mt-1 font-mono tabular-nums">Ränta {fmt(c.r.totalNewInterest)}:-</div>{c.r.totalInterestSaved > 0 && <div className="text-[11px] text-emerald-400 mt-1">Sparar {fmt(c.r.totalInterestSaved)}:- · −{c.r.totalMonthsSaved} mån</div>}</>) : (<div className="text-zinc-600 text-sm">—</div>)}
                    </div>
                  ))}
                </div>
                {resultCustom && resultAva && resultAva.totalNewInterest < resultCustom.totalNewInterest && (
                  <div className="rounded-xl border border-white/[0.08] bg-[#121216] p-4 text-[12px] text-emerald-400">Lavin sparar {fmt(resultCustom.totalNewInterest - resultAva.totalNewInterest)} kr mer än din ordning</div>
                )}
              </div>
            ) : (
              <div className="grid lg:grid-cols-12 gap-5">
                <section className="lg:col-span-7 space-y-3">
                  {loans.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-[#121216] p-10 text-center">
                      <h2 className="text-lg font-semibold mb-2">Tom mall</h2>
                      <p className="text-zinc-500 text-sm mb-6">Lägg till lån eller ladda exempel (706 040:-).</p>
                      <div className="flex gap-2 justify-center"><button onClick={addLoan} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-sm font-medium">+ Lägg till lån</button><button onClick={loadExample} className="px-5 py-2.5 rounded-xl border border-white/15 text-sm">Ladda exempel</button></div>
                    </div>
                  )}
                  {loans.map((loan) => {
                    const lr = result?.loanResults.find((r) => r.id === loan.id);
                    const isRak = loan.paymentStyle === "fixed_amort";
                    const intM = interestThisMonth(loan);
                    const regularTotal = isRak ? loan.currentMonthlyPayment + intM : loan.currentMonthlyPayment;
                    const target = loan.targetMonthlyEnabled ? loan.targetMonthlyTotal || 0 : 0;
                    const extraNow = target > regularTotal ? target - regularTotal : 0;
                    return (
                      <div key={loan.id} className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4 space-y-3">
                        <div className="flex justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold">{loan.name[0]}</span>
                            <input value={loan.name} onChange={(e) => updateLoan(loan.id, { name: e.target.value })} className="bg-transparent font-semibold text-sm outline-none min-w-0" />
                            <span title={isRak ? "Fast amortering, sjunkande total" : "Fast total, stigande amortering"} className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isRak ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300"}`}>{isRak ? "Rak amort" : "Annuitet"}</span>
                            <span className="text-[11px] font-mono text-zinc-400">Ränta {(loan.interestRate * 100).toFixed(2)}%</span>
                          </div>
                          <div className="text-right shrink-0"><div className="text-[9px] text-zinc-600">KLAR</div><div className="font-mono text-sm text-emerald-400 tabular-nums">{lr?.newEndDate && lr.newEndDate !== "-" ? lr.newEndDate : "—"}</div>{lr && lr.monthsSaved > 0 && <div className="text-[10px] text-emerald-500/80">−{lr.monthsSaved} mån</div>}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div className="rounded-lg bg-black/40 p-2"><div className="text-[9px] text-zinc-600">SKULD</div><div className="font-mono font-semibold tabular-nums">{fmt(loan.balance)}:-</div></div>
                          <div className="rounded-lg bg-black/40 p-2"><div className="text-[9px] text-zinc-600">{isRak ? "AMORT" : "MÅN"}</div><div className="font-mono font-semibold tabular-nums">{fmt(loan.currentMonthlyPayment)}:-</div></div>
                          <div className="rounded-lg bg-black/40 p-2"><div className="text-[9px] text-zinc-600">RÄNTA</div><div className="font-mono font-semibold tabular-nums">{fmt(intM)}:-</div></div>
                        </div>
                        <div className="rounded-xl bg-black/30 border border-white/[0.06] p-3 space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!loan.targetMonthlyEnabled} onChange={(e) => updateLoan(loan.id, { targetMonthlyEnabled: e.target.checked, targetMonthlyFrom: loan.targetMonthlyFrom || START, targetMonthlyTotal: loan.targetMonthlyTotal || Math.ceil(regularTotal) })} className="accent-emerald-500 w-3.5 h-3.5" /><span className="text-[11px] font-medium">BETALA TOTALT / MÅN</span></label>
                          {loan.targetMonthlyEnabled && (<div className="flex flex-wrap items-center gap-2"><input type="number" value={loan.targetMonthlyTotal || ""} onChange={(e) => updateLoan(loan.id, { targetMonthlyTotal: +e.target.value || 0 })} className="w-24 bg-[#0a0a0c] border border-emerald-500/30 rounded-lg px-2 py-1.5 font-mono text-sm font-bold text-emerald-300 tabular-nums" /><span className="text-[10px] text-zinc-500">NÄSTA {fmt(regularTotal)} → {fmt(target || regularTotal)}:-{extraNow > 0 && <span className="text-emerald-400" title="Extra amortering utöver ränta+bas"> +{fmt(extraNow)} EXTRA</span>}</span></div>)}
                        </div>
                        {loan.id === "nordax" && (
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-teal-500/20 bg-teal-950/20 px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={!!loan.reinvestment?.enabled} onChange={(e) => updateLoan(loan.id, { reinvestment: { enabled: e.target.checked, fromLoanId: "nordea", amount: loan.reinvestment?.amount || 2000, startDate: loan.reinvestment?.startDate || nordeaRes?.newEndDate || START } })} className="accent-teal-400 w-3.5 h-3.5" /><span className="text-[11px] text-teal-200" title="Snöboll: frigjort belopp återinvesteras">När Nordea klart: <span className="font-mono font-bold text-teal-300">{loan.reinvestment?.amount || 2000}:-</span> → Nordax</span></label>
                            {loan.reinvestment?.enabled && <span className="text-[9px] font-bold uppercase text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">Aktiv</span>}
                          </div>
                        )}
                        {lr && <div className="flex gap-3 text-[10px] font-mono text-zinc-500 tabular-nums"><span>Orig: {fmt(lr.originalTotalInterest)}:-</span><span>Ny: {fmt(lr.newTotalInterest)}:-</span><span className="text-emerald-400">Sparad: {fmt(lr.interestSaved)}:-</span></div>}
                      </div>
                    );
                  })}
                  {loans.length > 0 && (
                    <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-3 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase">Extra/mån</span>
                      <input type="number" value={globalExtra || ""} onChange={(e) => setGlobalExtra(+e.target.value || 0)} placeholder="500" className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 font-mono text-sm tabular-nums" />
                      <input type="month" value={globalExtraFrom} onChange={(e) => setGlobalExtraFrom(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 font-mono text-[11px]" />
                      <span className="text-[9px] text-zinc-600">→ högst ränta</span>
                      <span className="text-zinc-700">|</span>
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase">Engångs</span>
                      <input type="number" id="otp-amt" placeholder="10000" className="w-20 bg-black/40 border border-white/10 rounded-lg px-2 py-1 font-mono text-sm tabular-nums" />
                      <input type="month" id="otp-date" defaultValue="2026-12" className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 font-mono text-[11px]" />
                      <button onClick={() => { const a = Number((document.getElementById("otp-amt") as HTMLInputElement)?.value); const d = (document.getElementById("otp-date") as HTMLInputElement)?.value; if (a > 0 && d) setOneTimes((p) => [...p, { id: Date.now().toString(), amount: a, date: d, loanId: loans[0]?.id }]); }} className="px-2.5 py-1 rounded-lg bg-emerald-600/80 text-[11px] font-medium">+</button>
                      {oneTimes.map((ot) => (<span key={ot.id} className="text-[10px] font-mono text-zinc-400 flex items-center gap-1 tabular-nums">{ot.date} {fmt(ot.amount)}:- <button onClick={() => setOneTimes((p) => p.filter((x) => x.id !== ot.id))} className="text-red-400">×</button></span>))}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={addLoan} className="text-[12px] px-3 py-2 rounded-xl border border-dashed border-white/15 text-zinc-400">+ Lägg till lån</button>
                    {loans.length > 0 && (<><button onClick={loadExample} className="text-[12px] px-3 py-2 text-zinc-500">Ladda exempel</button><button onClick={clearAll} className="text-[12px] px-3 py-2 text-zinc-600">Rensa → tom mall</button></>)}
                  </div>
                </section>
                <section className="lg:col-span-5 space-y-3 lg:sticky lg:top-4 self-start">
                  {result && totalDebt > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4"><div className="text-[9px] uppercase text-zinc-500 mb-1">Skuldfri</div><div className="font-mono text-2xl font-bold tabular-nums">{result.newFreedomDate !== "-" ? result.newFreedomDate : "—"}</div>{result.totalMonthsSaved > 0 && <div className="text-[11px] text-emerald-400 mt-1">−{result.totalMonthsSaved} mån snabbare</div>}</div>
                        <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4"><div className="text-[9px] uppercase text-zinc-500 mb-1">Sparad ränta</div><div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums"><AnimatedNumber value={result.totalInterestSaved} />:-</div><div className="text-[10px] text-zinc-500 mt-1 font-mono tabular-nums">{fmt(result.totalOriginalInterest)} → {fmt(result.totalNewInterest)}</div></div>
                      </div>
                      <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4">
                        <div className="text-[9px] uppercase text-zinc-500 mb-2">Ordning</div>
                        {[...(result.loanResults || [])].sort((a, b) => a.payoffOrder - b.payoffOrder).map((r) => (
                          <div key={r.id} className="flex justify-between text-[12px] py-1"><span className="font-medium">{r.payoffOrder}. {r.name}</span><span className="font-mono text-[11px] tabular-nums"><span className="text-zinc-600">{r.originalEndDate}</span> → <span className="text-emerald-400">{r.newEndDate}</span></span></div>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-4">
                        <div className="text-[9px] uppercase text-zinc-500 mb-1">Betalning / mån</div>
                        <div className="font-mono text-lg font-bold tabular-nums">{fmt(totalMin + globalExtra)}:-</div>
                        {globalExtra > 0 && <div className="text-[11px] text-emerald-400">Extra +{fmt(globalExtra)}:-</div>}
                      </div>
                    </>
                  ) : (<div className="rounded-2xl border border-white/[0.08] bg-[#121216] p-8 text-center text-zinc-500 text-sm">Lägg till lån för resultat.</div>)}
                </section>
              </div>
            )}
          </div>
          <footer className="px-4 sm:px-6 py-4 text-center text-[10px] text-zinc-600">✓ Beräkningar lokalt · Inget sparas · Rak vs annuitet i realtid · LTV-trappa apr 2026</footer>
        </main>
      </div>
    </div>
  );
}
