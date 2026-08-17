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
function interestThisMonth(loan: Loan) { return (loan.balance * loan.interestRate) / 12; }

function AnimatedNumber({ value }: { value: number }) {
  const [d, setD] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current; prev.current = value;
    if (from === value) { setD(value); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 280);
      setD(Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className="tabular-nums">{fmt(d)}</span>;
}

function Donut({ amort, interest, extra }: { amort: number; interest: number; extra: number }) {
  const total = Math.max(1, amort + interest + extra);
  const r = 38;
  const c = 2 * Math.PI * r;
  const a1 = (amort / total) * c;
  const a2 = (interest / total) * c;
  const a3 = (extra / total) * c;
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#27272A" strokeWidth="12" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#FAFAFA" strokeWidth="12" strokeDasharray={`${a1} ${c}`} strokeLinecap="butt" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#3B82F6" strokeWidth="12" strokeDasharray={`${a2} ${c}`} strokeDashoffset={-a1} />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#52525B" strokeWidth="12" strokeDasharray={`${a3} ${c}`} strokeDashoffset={-(a1 + a2)} />
    </svg>
  );
}

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [oneTimes, setOneTimes] = useState<OneTimePayment[]>([]);
  const [globalExtra, setGlobalExtra] = useState(0);
  const [globalExtraFrom, setGlobalExtraFrom] = useState(START);
  const [tab, setTab] = useState<"idag" | "jamfor" | "bakain">("idag");
  const [biMortgage, setBiMortgage] = useState(2128112);
  const [biMortRate, setBiMortRate] = useState(3.5);
  const [biPersonal, setBiPersonal] = useState(180000);
  const [biPersRate, setBiPersRate] = useState(9.0);
  const [biHome, setBiHome] = useState(3027201);
  const [biPct, setBiPct] = useState(100);
  const [otpAmt, setOtpAmt] = useState("");
  const [otpDate, setOtpDate] = useState("2026-12");

  const biBake = Math.round((biPersonal * biPct) / 100);

  const loansWithExtra = useMemo(() => {
    if (globalExtra <= 0 || !loans.length) return loans;
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
  const totalAmort = loans.reduce((s, l) => s + (l.paymentStyle === "fixed_amort" ? l.currentMonthlyPayment : Math.max(0, l.currentMonthlyPayment - interestThisMonth(l))), 0);
  const totalInterest = loans.reduce((s, l) => s + interestThisMonth(l), 0);
  const totalMin = loans.reduce((s, l) => s + (l.paymentStyle === "fixed_amort" ? l.currentMonthlyPayment + interestThisMonth(l) : l.currentMonthlyPayment), 0);

  const updateLoan = (id: string, patch: Partial<Loan>) => setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const loadExample = () => {
    setLoans(EXAMPLE);
    setOneTimes([{ id: "1", date: "2026-12", amount: 10000, loanId: "nordax" }]);
    setGlobalExtra(500);
    setGlobalExtraFrom(START);
  };
  const clearAll = () => { setLoans([]); setOneTimes([]); setGlobalExtra(0); };
  const addLoan = () =>
    setLoans((prev) => [
      ...prev,
      {
        id: `loan-${Date.now()}`,
        name: `Lån ${prev.length + 1}`,
        loanType: "Annuitet",
        paymentStyle: "annuity",
        balance: 0,
        interestRate: 0.08,
        currentMonthlyPayment: 0,
        extraMonthly: 0,
        extraMonthlyEnabled: false,
        extraMonthlyFrom: START,
      },
    ]);
  const nordeaRes = result?.loanResults.find((r) => r.id === "nordea");
  const addOtp = () => {
    const a = Number(otpAmt);
    if (a > 0 && otpDate && loans[0]) {
      setOneTimes((p) => [...p, { id: Date.now().toString(), amount: a, date: otpDate, loanId: loans[loans.length - 1]?.id }]);
      setOtpAmt("");
    }
  };

  const bandColor = (band: string) =>
    band === "over85" ? "text-red-400 border-red-500/30 bg-red-500/10" :
    band === "two" ? "text-amber-300 border-amber-500/30 bg-amber-500/10" :
    band === "one" ? "text-sky-300 border-sky-500/30 bg-sky-500/10" :
    "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";

  const tabs = [["idag", "Idag"], ["jamfor", "Jämför"], ["bakain", "Baka in"]] as const;

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] antialiased">
      {result && totalDebt > 0 && (
        <div className="lg:hidden sticky top-0 z-50 border-b border-[#27272A] bg-[#09090B]/90 backdrop-blur-xl px-4 py-2.5 flex items-center justify-between text-[11px]">
          <span className="text-[#71717A] mono tabular-nums">{loans.length} lån · {fmt(totalDebt)}:-</span>
          <span className="mono font-medium text-emerald-400 tabular-nums">Skuldfri {result.newFreedomDate} · <AnimatedNumber value={result.totalInterestSaved} />:-</span>
        </div>
      )}

      <header className="border-b border-[#18181B] px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Lånekalkylator</span>
          <span className="border border-[#27272A] bg-[#18181B] px-1.5 py-0.5 text-[10px] font-medium tracking-widest text-[#A1A1AA]">PRO</span>
        </div>
        <div className="flex items-center gap-1">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`h-[28px] border px-3 text-[12px] font-medium tracking-[-0.01em] transition-colors ${tab === k ? "border-[#27272A] bg-[#18181B] text-[#FAFAFA]" : "border-transparent text-[#71717A] hover:text-[#A1A1AA]"}`}>{label}</button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] p-4 sm:p-6">
        {tab === "bakain" ? (
          <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
            <div className="border border-white/[0.08] bg-[#18181B] rounded-2xl p-5 space-y-4">
              <div className="mono text-[10px] uppercase tracking-widest text-[#71717A]">Baka in privatlån i bolån</div>
              <p className="text-[12px] text-[#71717A]">Fyll i dina verkliga siffror. LTV-trappa apr 2026.</p>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <label className="space-y-1"><span className="text-[10px] text-[#52525B] uppercase">Bostadsvärde</span><input type="number" inputMode="numeric" value={biHome || ""} onChange={(e) => setBiHome(+e.target.value || 0)} placeholder="3200000" className="w-full bg-[#09090B] border border-[#27272A] px-3 py-2 mono tabular-nums text-[13px] outline-none focus:border-[#3B82F6]/50" /></label>
                <label className="space-y-1"><span className="text-[10px] text-[#52525B] uppercase">Bolån kvar</span><input type="number" inputMode="numeric" value={biMortgage || ""} onChange={(e) => setBiMortgage(+e.target.value || 0)} placeholder="2000000" className="w-full bg-[#09090B] border border-[#27272A] px-3 py-2 mono tabular-nums text-[13px] outline-none focus:border-[#3B82F6]/50" /></label>
                <label className="space-y-1"><span className="text-[10px] text-[#52525B] uppercase">Bolåneränta %</span><input type="number" inputMode="decimal" step="0.01" value={biMortRate} onChange={(e) => setBiMortRate(+e.target.value || 0)} className="w-full bg-[#09090B] border border-[#27272A] px-3 py-2 mono tabular-nums text-[13px] outline-none focus:border-[#3B82F6]/50" /></label>
                <label className="space-y-1"><span className="text-[10px] text-[#52525B] uppercase">Blancolån</span><input type="number" inputMode="numeric" value={biPersonal || ""} onChange={(e) => setBiPersonal(+e.target.value || 0)} placeholder="180000" className="w-full bg-[#09090B] border border-[#27272A] px-3 py-2 mono tabular-nums text-[13px] outline-none focus:border-[#3B82F6]/50" /></label>
                <label className="space-y-1 col-span-2"><span className="text-[10px] text-[#52525B] uppercase">Blanco-ränta %</span><input type="number" inputMode="decimal" step="0.01" value={biPersRate} onChange={(e) => setBiPersRate(+e.target.value || 0)} className="w-full bg-[#09090B] border border-[#27272A] px-3 py-2 mono tabular-nums text-[13px] outline-none focus:border-[#3B82F6]/50" /></label>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-2"><span className="text-[#71717A]">Andel att baka in</span><span className="mono text-[#3B82F6] font-medium">{biPct}% · {fmt(biBake)} kr</span></div>
                <input type="range" min={0} max={100} step={5} value={biPct} onChange={(e) => setBiPct(+e.target.value)} className="w-full accent-[#3B82F6] h-6" />
                <div className="flex justify-between mono text-[10px] text-[#52525B] mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
              </div>
            </div>
            <div className="border border-white/[0.08] bg-[#18181B] rounded-2xl p-5 space-y-3">
              <div className="mono text-[10px] uppercase tracking-widest text-[#71717A]">Svenska regler</div>
              {bi.warningText && <div className={`text-[11px] border px-3 py-2 ${bi.warningLtv ? "text-red-300 border-red-500/30 bg-red-500/10" : "text-amber-300 border-amber-500/30 bg-amber-500/10"}`}>{bi.warningText}</div>}
              <div className={`text-[11px] border px-3 py-2 ${bandColor(bi.bandAfter)}`}>Efter: {bandLabel(bi.bandAfter)}</div>
              <div className="bg-[#09090B] border border-[#27272A] p-3 mono text-[11px] space-y-1.5 tabular-nums">
                <div>LTV: {(bi.ltvBefore * 100).toFixed(0)}% → <span className="text-[#FAFAFA]">{(bi.ltvAfter * 100).toFixed(0)}%</span></div>
                <div>Amortkrav: {(bi.amortBefore * 100).toFixed(0)}% → <span className="text-[#FAFAFA]">{(bi.amortAfter * 100).toFixed(0)}%/år</span></div>
                <div>Amort kr/mån: {fmt(bi.amortKrBefore)} → {fmt(bi.amortKrAfter)}{bi.amortKrDelta > 0 ? ` (+${fmt(bi.amortKrDelta)})` : ""}</div>
                <div>Ränteavdrag 30% · Netto sparat: <span className="text-emerald-400">{fmt(bi.interestSavedNet)}:-</span></div>
                <div>Månad: {fmt(bi.monthBefore)} → {fmt(bi.monthAfter)}:-</div>
              </div>
              <div className="border border-emerald-500/20 bg-emerald-500/10 p-3 text-[12px] leading-relaxed">{bi.summaryLine}</div>
            </div>
          </div>
        ) : tab === "jamfor" ? (
          <div className="space-y-4">
            <div className="mono text-[10px] uppercase tracking-widest text-[#71717A]">Tre strategier · live</div>
            {!loans.length ? (
              <div className="border border-dashed border-white/[0.08] rounded-2xl p-10 text-center text-[#71717A] text-[13px]">Lägg till lån eller ladda exempel först.</div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                {[{ t: "Idag", r: resultCustom }, { t: "Lavin", r: resultAva }, { t: "Snöboll", r: resultSnow }].map((c) => (
                  <div key={c.t} className="border border-white/[0.08] bg-[#18181B] rounded-2xl p-5">
                    <div className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-3">{c.t}</div>
                    {c.r && c.r.newFreedomDate !== "-" ? (
                      <>
                        <div className="mono text-[22px] font-semibold tracking-[-0.04em]">{c.r.newFreedomDate}</div>
                        <div className="mt-2 mono text-[11px] text-[#71717A]">Ränta {fmt(c.r.totalNewInterest)}:-</div>
                        {c.r.totalInterestSaved > 0 && <div className="mt-1 mono text-[11px] text-emerald-400">Sparar {fmt(c.r.totalInterestSaved)}:- · −{c.r.totalMonthsSaved} mån</div>}
                      </>
                    ) : <div className="text-[#52525B]">—</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_380px] gap-4">
            <div className="space-y-3">
              {loans.length === 0 && (
                <div className="border border-dashed border-white/[0.08] bg-[#18181B] rounded-2xl p-10 text-center">
                  <div className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-3">Tom mall</div>
                  <p className="text-[13px] text-[#A1A1AA] mb-6 max-w-sm mx-auto">Lägg till dina lån manuellt, eller ladda ett exempel för att se hur kalkylen fungerar.</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <button onClick={addLoan} className="h-9 px-4 bg-[#3B82F6] text-[12px] font-semibold text-white hover:bg-[#2563EB]">+ Lägg till lån</button>
                    <button onClick={loadExample} className="h-9 px-4 border border-white/[0.08] bg-white/[0.05] text-[12px] text-[#A1A1AA] hover:text-[#FAFAFA] rounded-lg">Ladda exempel</button>
                  </div>
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
                  <div key={loan.id} className="border border-white/[0.08] bg-[#18181B] rounded-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-5 w-5 border border-[#27272A] bg-[#09090B] flex items-center justify-center text-[10px] font-bold shrink-0">{loan.name[0]}</div>
                        <input value={loan.name} onChange={(e) => updateLoan(loan.id, { name: e.target.value })} className="bg-transparent text-[13px] font-medium outline-none min-w-0 max-w-[110px]" />
                        <span className="border border-[#27272A] px-1 py-0.5 mono text-[9px] uppercase tracking-wide text-[#71717A]">{isRak ? "rak" : "annuitet"}</span>
                        <span className="mono text-[11px] text-[#71717A] tabular-nums">{(loan.interestRate * 100).toFixed(2)}%</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="mono text-[10px] text-[#52525B]">KLAR</div>
                        <div className="mono text-[13px] font-medium text-emerald-400 tabular-nums">{lr?.newEndDate && lr.newEndDate !== "-" ? lr.newEndDate : "—"}</div>
                        {lr && lr.monthsSaved > 0 && <div className="mono text-[10px] text-emerald-400/80">−{lr.monthsSaved} mån</div>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-[#27272A]">
                      <div className="p-3"><div className="mono text-[9px] text-[#52525B] uppercase">Skuld</div><div className="mono text-[13px] font-medium tabular-nums mt-0.5">{fmt(loan.balance)}:-</div></div>
                      <div className="p-3"><div className="mono text-[9px] text-[#52525B] uppercase">{isRak ? "Amort" : "Mån"}</div><div className="mono text-[13px] font-medium tabular-nums mt-0.5">{fmt(loan.currentMonthlyPayment)}:-</div></div>
                      <div className="p-3"><div className="mono text-[9px] text-[#52525B] uppercase">Ränta</div><div className="mono text-[13px] font-medium tabular-nums mt-0.5">{fmt(intM)}:-</div></div>
                    </div>
                    <div className="px-4 py-3 border-t border-[#27272A] space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!loan.targetMonthlyEnabled} onChange={(e) => updateLoan(loan.id, { targetMonthlyEnabled: e.target.checked, targetMonthlyFrom: loan.targetMonthlyFrom || START, targetMonthlyTotal: loan.targetMonthlyTotal || Math.ceil(regularTotal) })} className="accent-[#3B82F6] w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium tracking-wide">BETALA TOTALT / MÅN</span>
                      </label>
                      {loan.targetMonthlyEnabled && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="number" inputMode="numeric" value={loan.targetMonthlyTotal || ""} onChange={(e) => updateLoan(loan.id, { targetMonthlyTotal: +e.target.value || 0 })} className="w-24 bg-[#09090B] border border-[#3B82F6]/30 px-2 py-1.5 mono text-[13px] font-semibold text-[#3B82F6] tabular-nums outline-none" />
                          <span className="mono text-[10px] text-[#71717A]">NÄSTA {fmt(regularTotal)} → {fmt(target || regularTotal)}:-{extraNow > 0 && <span className="text-[#3B82F6]"> +{fmt(extraNow)} EXTRA</span>}</span>
                        </div>
                      )}
                      {(loan.reinvestment !== undefined || loan.id === "nordax") && (
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input type="checkbox" checked={!!loan.reinvestment?.enabled} onChange={(e) => updateLoan(loan.id, { reinvestment: { enabled: e.target.checked, fromLoanId: loans.find((x) => x.id !== loan.id)?.id || "", amount: loan.reinvestment?.amount || 2000, startDate: loan.reinvestment?.startDate || nordeaRes?.newEndDate || START } })} className="accent-emerald-500 w-3.5 h-3.5" />
                          <span className="text-[11px] text-[#A1A1AA]">När föregående klart: <span className="mono font-medium text-emerald-400">{loan.reinvestment?.amount || 2000}:-</span> hit</span>
                        </label>
                      )}
                      {lr && <div className="flex gap-3 mono text-[10px] text-[#52525B] tabular-nums pt-1"><span>Orig {fmt(lr.originalTotalInterest)}</span><span>Ny {fmt(lr.newTotalInterest)}</span><span className="text-emerald-400">Sparad {fmt(lr.interestSaved)}</span></div>}
                    </div>
                  </div>
                );
              })}

              {loans.length > 0 && (
                <div className="border border-white/[0.08] bg-[#18181B] rounded-2xl p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono text-[10px] uppercase tracking-widest text-[#71717A]">Extra/mån</span>
                    <input type="number" inputMode="numeric" value={globalExtra || ""} onChange={(e) => setGlobalExtra(+e.target.value || 0)} placeholder="500" className="w-[72px] bg-[#09090B] border border-[#27272A] px-2 py-1.5 mono text-[12px] tabular-nums outline-none focus:border-[#3B82F6]/40" />
                    <input type="month" value={globalExtraFrom} onChange={(e) => setGlobalExtraFrom(e.target.value)} className="bg-[#09090B] border border-[#27272A] px-2 py-1.5 mono text-[11px] outline-none" />
                    <span className="mono text-[9px] text-[#52525B]">→ högst ränta</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono text-[10px] uppercase tracking-widest text-[#71717A]">Engångs</span>
                    <input type="number" inputMode="numeric" value={otpAmt} onChange={(e) => setOtpAmt(e.target.value)} placeholder="10000" className="w-[80px] bg-[#09090B] border border-[#27272A] px-2 py-1.5 mono text-[12px] tabular-nums outline-none" />
                    <input type="month" value={otpDate} onChange={(e) => setOtpDate(e.target.value)} className="bg-[#09090B] border border-[#27272A] px-2 py-1.5 mono text-[11px] outline-none" />
                    <button onClick={addOtp} className="px-2.5 py-1.5 bg-[#3B82F6] text-[11px] font-medium text-white">+</button>
                  </div>
                  {oneTimes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {oneTimes.map((ot) => (
                        <span key={ot.id} className="mono text-[10px] text-[#A1A1AA] flex items-center gap-1 border border-[#27272A] bg-[#09090B] px-2 py-0.5 tabular-nums">
                          {ot.date} {fmt(ot.amount)}:-
                          <button onClick={() => setOneTimes((p) => p.filter((x) => x.id !== ot.id))} className="text-red-400 ml-0.5">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <button onClick={addLoan} className="text-[12px] px-3 py-2 border border-dashed border-[#27272A] text-[#71717A] hover:text-[#A1A1AA]">+ Lägg till lån</button>
                <button onClick={loadExample} className="text-[12px] px-3 py-2 text-[#52525B] hover:text-[#A1A1AA]">Ladda exempel</button>
                {loans.length > 0 && <button onClick={clearAll} className="text-[12px] px-3 py-2 text-[#52525B] hover:text-[#A1A1AA]">Rensa</button>}
              </div>
            </div>

            <div className="space-y-3 lg:sticky lg:top-4 self-start">
              {result && totalDebt > 0 ? (
                <>
                  <div className="border border-white/[0.08] bg-[#18181B] rounded-2xl">
                    <div className="grid grid-cols-2 divide-x divide-[#27272A]">
                      <div className="p-5">
                        <div className="mono text-[10px] uppercase tracking-widest text-[#71717A]">Skuldfri</div>
                        <div className="mono mt-2 text-[24px] font-semibold leading-none tracking-[-0.04em]">{result.newFreedomDate}</div>
                        {result.totalMonthsSaved > 0 && (
                          <div className="mt-2 inline-flex items-center gap-1.5 border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
                            <span className="h-1 w-1 bg-emerald-500" />
                            <span className="mono text-[11px] font-medium text-emerald-400">−{result.totalMonthsSaved} mån snabbare</span>
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="mono text-[10px] uppercase tracking-widest text-[#71717A]">Sparad ränta</div>
                        <div className="mono mt-2 text-[22px] font-semibold leading-none tracking-[-0.04em] text-emerald-400"><AnimatedNumber value={result.totalInterestSaved} />:-</div>
                        <div className="mt-2 mono text-[11px] text-[#71717A] tabular-nums">{fmt(result.totalOriginalInterest)} → {fmt(result.totalNewInterest)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-white/[0.08] bg-[#18181B] rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <span className="mono text-[10px] uppercase tracking-widest text-[#71717A]">Betalningsfördelning / mån</span>
                      <span className="mono text-[11px] text-[#A1A1AA] tabular-nums">{fmt(totalMin + globalExtra)}:- totalt</span>
                    </div>
                    <div className="mt-5 grid grid-cols-[96px_1fr] items-center gap-6">
                      <div className="relative h-[96px] w-[96px]">
                        <Donut amort={totalAmort} interest={totalInterest} extra={globalExtra} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="mono text-[9px] uppercase tracking-widest text-[#71717A]">Skuldfri</span>
                          <span className="mono text-[13px] font-semibold leading-tight mt-0.5">{result.newFreedomDate}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><div className="h-[10px] w-[10px] bg-[#FAFAFA]" /><span className="text-[12px]">Amortering</span></div>
                          <span className="mono text-[12px] font-medium tabular-nums">{fmt(totalAmort)}:-</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><div className="h-[10px] w-[10px] bg-[#3B82F6]" /><span className="text-[12px]">Ränta</span></div>
                          <span className="mono text-[12px] font-medium tabular-nums">{fmt(totalInterest)}:-</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2"><div className="h-[10px] w-[10px] bg-[#52525B]" /><span className="text-[12px]">Extra</span></div>
                          <span className="mono text-[12px] font-medium text-[#3B82F6] tabular-nums">{fmt(globalExtra)}:-</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-white/[0.08] bg-[#18181B] rounded-2xl">
                    <div className="border-b border-[#27272A] px-5 py-3">
                      <span className="mono text-[10px] uppercase tracking-widest text-[#71717A]">Avbetalningsordning</span>
                    </div>
                    <div className="divide-y divide-[#27272A]">
                      {[...(result.loanResults || [])].sort((a, b) => a.payoffOrder - b.payoffOrder).map((r) => (
                        <div key={r.id} className="flex items-center justify-between px-5 py-3">
                          <span className="text-[12px] font-medium">{r.payoffOrder}. {r.name}</span>
                          <span className="mono text-[11px] tabular-nums"><span className="text-[#52525B]">{r.originalEndDate}</span> → <span className="text-emerald-400">{r.newEndDate}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="border border-white/[0.08] bg-[#18181B] rounded-2xl p-8 text-center">
                  <div className="mono text-[10px] uppercase tracking-widest text-[#71717A] mb-2">Resultat</div>
                  <p className="text-[13px] text-[#52525B]">Lägg till lån för att se skuldfri-datum och sparad ränta.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="px-4 py-4 text-center mono text-[10px] text-[#52525B]">
        ✓ Beräkningar lokalt · Inget sparas · LTV-trappa apr 2026
      </footer>
    </div>
  );
}
