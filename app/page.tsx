'use client'
import { useState, useMemo } from "react";

type Loan = {
  id: string;
  name: string;
  balance: number;
  rate: number;
  minPayment: number;
};

const INITIAL_LOANS: Loan[] = [
  { id: "a", name: "Loan A", balance: 185000, rate: 5.95, minPayment: 3200 },
  { id: "b", name: "Loan B", balance: 92000, rate: 3.42, minPayment: 1800 },
];

function calcSchedule(loans: Loan[], monthlyBudget: number) {
  let clones = loans.map(l => ({...l, balance: l.balance })).sort((a,b) => b.rate - a.rate);
  let month = 0;
  let totalInterest = 0;
  const totalStart = clones.reduce((s,l)=>s+l.balance,0);
  const totalMin = clones.reduce((s,l)=>s+l.minPayment,0);

  if (monthlyBudget < totalMin) return { months: 999, totalInterest: 0, debtFree: "Aldrig" };

  while (clones.some(l => l.balance > 0.01) && month < 600) {
    month++;
    clones.forEach(l => {
      if (l.balance <= 0) return;
      const interest = l.balance * (l.rate/100) / 12;
      l.balance += interest;
      totalInterest += interest;
    });

    let budget = monthlyBudget;
    // Betala min på alla
    clones.forEach(l => {
      if (l.balance <= 0) return;
      const pay = Math.min(l.balance, l.minPayment);
      l.balance -= pay;
      budget -= pay;
    });
    // Extra på högsta ränta
    for (const l of clones) {
      if (budget <= 0) break;
      if (l.balance <= 0) continue;
      const pay = Math.min(l.balance, budget);
      l.balance -= pay;
      budget -= pay;
    }

    if (clones.every(l => l.balance <= 0.01)) break;
  }

  const debtFree = new Date();
  debtFree.setMonth(debtFree.getMonth() + month);
  const label = month < 12? `${month} månader` : `${Math.floor(month/12)} år ${month%12} månader`;

  return { months: month, totalInterest, debtFree: label, debtFreeDate: debtFree };
}

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [monthly, setMonthly] = useState(2000);
  const [showCustom, setShowCustom] = useState(false);

  const totalMin = loans.reduce((s,l)=>s+l.minPayment,0);
  const totalDebt = loans.reduce((s,l)=>s+l.balance,0);

  const result = useMemo(() => calcSchedule(loans, monthly), [loans, monthly]);
  const baseline = useMemo(() => calcSchedule(loans, totalMin), [loans, totalMin]);

  const interestSaved = Math.max(0, baseline.totalInterest - result.totalInterest);
  const monthsSaved = baseline.months - result.months;

  // Anyfin quick-selects
  const quickAmounts = [400, 500, 600, 700, 800, 1000, 1500, 2000, 3000, 4000, 5000];
  const quickOptions = quickAmounts.map(amt => {
    const r = calcSchedule(loans, amt);
    return { amount: amt, months: r.months, label: r.debtFree };
  }).filter(o => o.amount >= totalMin);

  function addLoan() {
    const letter = String.fromCharCode(65 + loans.length);
    setLoans([...loans, { id: Math.random().toString(36).slice(2), name: `Loan ${letter}`, balance: 50000, rate: 4.50, minPayment: 1200 }]);
  }

  function updateLoan(id: string, patch: Partial<Loan>) {
    setLoans(prev => prev.map(l => l.id===id? {...l,...patch } : l));
  }

  function removeLoan(id: string) {
    if (loans.length===1) return;
    setLoans(prev => prev.filter(l=>l.id!==id));
  }

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 antialiased">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .font-sans { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <div className="mx-auto max-w-[640px] px-6 py-12 sm:py-16">
        <div className="text-center mb-12">
          <div className="font-sans text-[11px] tracking-widest uppercase font-medium text-zinc-500 mb-4">DEBT OPTIMIZER</div>
          <h1 className="font-sans text-[40px] sm:text-[48px] leading-[0.95] tracking-[-0.04em] font-[700] text-white mb-3">
            Betala av snabbare
          </h1>
          <p className="font-sans text-[14px] text-zinc-500">Välj hur mycket du vill betala varje månad</p>
        </div>

        {/* ANYFIN HERO CARD */}
        <div className="rounded-[20px] bg-[#111111] border border-white/[0.08] p-8 sm:p-10 mb-6"
             style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.6)" }}>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <span className="font-sans text-[11px] font-medium text-emerald-400">Skuldfri om</span>
              <span className="font-mono text-[13px] font-semibold text-emerald-300 tabular-nums">{result.debtFree}</span>
            </div>

            <div className="font-sans text-[13px] text-zinc-500 mb-3">Hur mycket vill du betala?</div>

            <div className="relative">
              <input
                type="number"
                value={monthly}
                onChange={e=>setMonthly(parseInt(e.target.value)||0)}
                className="w-full text-center bg-transparent border-none outline-none font-mono text-[56px] sm:text-[72px] leading-[0.9] tracking-[-0.04em] font-[700] text-white tabular-nums"
              />
              <div className="font-sans text-[16px] text-zinc-500 mt-2">kr/mån</div>
            </div>

            <div className="font-mono text-[11px] text-zinc-600 mt-4">
              Mellan {totalMin.toLocaleString('sv-SE')} kr till 10 000 kr
            </div>
          </div>

          <input
            type="range"
            min={totalMin}
            max={10000}
            step={50}
            value={monthly}
            onChange={e=>setMonthly(parseInt(e.target.value))}
            className="w-full h-2 rounded-full bg-[#1A1A1A] accent-white mb-6"
          />

          {monthsSaved > 0 && (
            <div className="text-center p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="font-sans text-[12px] text-emerald-400 mb-1">Du sparar</div>
              <div className="font-mono text-[20px] font-semibold text-emerald-300 tabular-nums">
                {monthsSaved} månader • {interestSaved.toFixed(0)} kr
              </div>
            </div>
          )}
        </div>

        {/* QUICK SELECT - ANYFIN STYLE */}
        <div className="space-y-2 mb-8">
          <div className="font-sans text-[11px] tracking-widest uppercase font-medium text-zinc-500 mb-3 px-1">Välj belopp</div>
          {quickOptions.slice(0,6).map(opt => (
            <button
              key={opt.amount}
              onClick={()=>{setMonthly(opt.amount); setShowCustom(false);}}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-150 ${
                monthly === opt.amount
                 ? 'bg-white text-black border-white'
                  : 'bg-[#0A0A0A] border-white/[0.08] text-zinc-300 hover:bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <span className="font-mono text-[16px] font-medium tabular-nums">{opt.amount.toLocaleString('sv-SE')} kr / mån</span>
              <span className="font-sans text-[13px]">{opt.label}</span>
            </button>
          ))}
          <button
            onClick={()=>setShowCustom(!showCustom)}
            className="w-full flex items-center justify-center p-4 rounded-xl border border-dashed border-white/20 text-[13px] font-medium text-zinc-500 hover:text-white hover:border-white/40"
          >
            Välj ett eget belopp
          </button>
        </div>

        {/* BAKA IN LÅN */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="font-sans text-[11px] tracking-widest uppercase font-medium text-zinc-500">Dina lån</span>
            <button onClick={addLoan} className="font-sans text-[12px] text-zinc-400 hover:text-white">+ Lägg till</button>
          </div>
          <div className="space-y-2">
            {loans.map(loan => (
              <div key={loan.id} className="rounded-xl bg-[#0A0A0A] border border-white/[0.08] p-4">
                <div className="flex items-start justify-between mb-3">
                  <input value={loan.name} onChange={e=>updateLoan(loan.id,{name:e.target.value})}
                         className="bg-transparent font-sans text-[15px] font-semibold text-white border-none outline-none" />
                  <button onClick={()=>removeLoan(loan.id)} className="text-zinc-600 hover:text-white text-[18px]">×</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" value={loan.balance} onChange={e=>updateLoan(loan.id,{balance:parseFloat(e.target.value)||0})}
                         placeholder="Skuld" className="h-9 rounded-lg bg-[#000000] border border-white/10 px-2.5 font-mono text-[12px] tabular-nums text-white" />
                  <input type="number" step="0.01" value={loan.rate} onChange={e=>updateLoan(loan.id,{rate:parseFloat(e.target.value)||0})}
                         placeholder="%" className="h-9 rounded-lg bg-[#000000] border border-white/10 px-2.5 font-mono text-[12px] tabular-nums text-white" />
                  <input type="number" value={loan.minPayment} onChange={e=>updateLoan(loan.id,{minPayment:parseFloat(e.target.value)||0})}
                         placeholder="Min" className="h-9 rounded-lg bg-[#000000] border border-white/10 px-2.5 font-mono text-[12px] tabular-nums text-white" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center font-sans text-[11px] text-zinc-700 mt-12">
          Privat • Local only • Inga moln • Byggd för imorgon
        </div>
      </div>
    </div>
  );
}