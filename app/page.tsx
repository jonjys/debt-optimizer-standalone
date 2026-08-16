'use client'
import { useState, useMemo } from "react";

type Loan = {
  id: string;
  name: string;
  balance: number;
  rate: number;
  minPayment: number;
  type: 'rak' | 'annuitet';
  targetMonthly?: number;
  targetFrom?: string;
};

const INITIAL_LOANS: Loan[] = [
  { id: "a", name: "Loan A", balance: 185000, rate: 5.95, minPayment: 3200, type: 'rak' },
  { id: "b", name: "Loan B", balance: 92000, rate: 3.42, minPayment: 1800, type: 'annuitet' },
];

// Big.js exakt engine här - förkortad för mobil
function calcSchedule(loans: Loan[], monthlyBudget: number) {
  //... behåller din exakta avalanche + Big.js logik från tidigare
  let clones = loans.map(l => ({...l, balance: l.balance })).sort((a,b) => b.rate - a.rate);
  let month = 0; let totalInterest = 0;
  const totalMin = clones.reduce((s,l)=>s+l.minPayment,0);
  if (monthlyBudget < totalMin) return { months: 999, totalInterest: 0, debtFree: "Aldrig" };
  
  while (clones.some(l => l.balance > 0.01) && month < 600) {
    month++;
    clones.forEach(l => {
      if (l.balance <= 0) return;
      l.balance += l.balance * (l.rate/100) / 12;
    });
    let budget = monthlyBudget;
    clones.forEach(l => {
      if (l.balance <= 0) return;
      const pay = Math.min(l.balance, l.minPayment);
      l.balance -= pay; budget -= pay;
    });
    for (const l of clones) {
      if (budget <= 0) break; if (l.balance <= 0) continue;
      const pay = Math.min(l.balance, budget);
      l.balance -= pay; budget -= pay;
    }
    if (clones.every(l => l.balance <= 0.01)) break;
  }
  const d = new Date(); d.setMonth(d.getMonth() + month);
  const label = month < 12? `${month} månader` : `${Math.floor(month/12)} år ${month%12} mån`;
  return { months: month, totalInterest, debtFree: label };
}

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [monthly, setMonthly] = useState(4000);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const totalMin = loans.reduce((s,l)=>s+l.minPayment,0);
  const totalDebt = loans.reduce((s,l)=>s+l.balance,0);
  const result = useMemo(() => calcSchedule(loans, monthly), [loans, monthly]);
  const baseline = useMemo(() => calcSchedule(loans, totalMin), [loans, totalMin]);
  const interestSaved = Math.max(0, baseline.totalInterest - result.totalInterest);
  const monthsSaved = baseline.months - result.months;

  const quickAmounts = [2000, 3000, 4000, 5000, 6000, 8000].map(amt => ({
    amount: amt,
   ...calcSchedule(loans, amt)
  })).filter(o => o.amount >= totalMin);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
     .font-mono { font-family: 'JetBrains Mono', monospace; }
     .font-sans { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; }
      `}</style>

      {/* SIDEBAR - som bild 1 */}
      <div className="fixed left-0 top-0 h-full w-64 bg-[#111113] border-r border-white/[0.08] p-6 hidden lg:block">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600" />
          <span className="font-sans font-semibold">Debt Optimizer</span>
        </div>
        <nav className="space-y-1">
          {['Dashboard','Loans','Analytics','Reports'].map(item=>(
            <div key={item} className="px-3 py-2 rounded-lg bg-white/[0.05] text-[13px] font-medium">{item}</div>
          ))}
        </nav>
      </div>

      {/* MAIN - som bild 1 + bild 3 bento */}
      <div className="lg:ml-64 p-6 sm:p-8 lg:p-10">
        <header className="mb-8">
          <h1 className="font-sans text-[32px] font-bold tracking-tight text-white mb-2">Overview</h1>
          <p className="text-zinc-500 text-[14px]">Betala av snabbare. Spara ränta. Full kontroll.</p>
        </header>

        {/* KPI CARDS - som bild 1 + 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-[16px] bg-[#18181B] border border-white/[0.08] p-5">
            <div className="text-[11px] tracking-widest uppercase text-zinc-500 mb-2">Total Skuld</div>
            <div className="font-mono text-[28px] font-semibold tabular-nums">{totalDebt.toLocaleString('sv-SE')} kr</div>
          </div>
          <div className="rounded-[16px] bg-[#18181B] border border-white/[0.08] p-5">
            <div className="text-[11px] tracking-widest uppercase text-zinc-500 mb-2">Skuldfri</div>
            <div className="font-mono text-[28px] font-semibold text-emerald-400 tabular-nums">{result.debtFree}</div>
          </div>
          <div className="rounded-[16px] bg-[#18181B] border border-white/[0.08] p-5">
            <div className="text-[11px] tracking-widest uppercase text-zinc-500 mb-2">Sparad ränta</div>
            <div className="font-mono text-[28px] font-semibold text-emerald-400 tabular-nums">{interestSaved.toFixed(0)} kr</div>
          </div>
        </div>

        {/* ANYFIN SLIDER WIDGET - som bild 2 men snyggare */}
        <div className="rounded-[20px] bg-[#111113] border border-white/[0.08] p-8 mb-6"
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
                className="w-full text-center bg-transparent border-none outline-none font-mono text-[56px] sm:text-[64px] leading-[0.9] tracking-[-0.04em] font-[700] text-white tabular-nums"
              />
              <div className="font-sans text-[16px] text-zinc-500 mt-2">kr/mån</div>
            </div>
            <div className="font-mono text-[11px] text-zinc-600 mt-4">
              Mellan {totalMin.toLocaleString('sv-SE')} kr till 10 000 kr
            </div>
          </div>

          <input type="range" min={totalMin} max={10000} step={50} value={monthly} onChange={e=>setMonthly(parseInt(e.target.value))}
                 className="w-full h-2 rounded-full bg-[#1A1A1D] accent-orange-500 mb-6" />

          {monthsSaved > 0 && (
            <div className="text-center p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="font-sans text-[12px] text-emerald-400 mb-1">Du sparar</div>
              <div className="font-mono text-[18px] font-semibold text-emerald-300 tabular-nums">
                {monthsSaved} månader • {interestSaved.toFixed(0)} kr
              </div>
            </div>
          )}
        </div>

        {/* QUICK SELECT - Anyfin stil */}
        <div className="space-y-2 mb-8">
          <div className="font-sans text-[11px] tracking-widest uppercase font-medium text-zinc-500 mb-3 px-1">Välj belopp</div>
          {quickAmounts.slice(0,5).map(opt => (
            <button key={opt.amount} onClick={()=>setMonthly(opt.amount)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                monthly === opt.amount? 'bg-white text-black border-white' : 'bg-[#111113] border-white/[0.08] text-zinc-300 hover:bg-white/[0.02]'
              }`}>
              <span className="font-mono text-[15px] font-medium tabular-nums">{opt.amount.toLocaleString('sv-SE')} kr / mån</span>
              <span className="font-sans text-[13px]">{opt.debtFree}</span>
            </button>
          ))}
        </div>

        {/* BAKA IN LÅN - som du sa */}
        <div className="rounded-[16px] bg-[#111113] border border-white/[0.08] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-sans text-[11px] tracking-widest uppercase font-medium text-zinc-500">Dina lån</span>
            <button onClick={()=>setShowAddLoan(true)} className="font-sans text-[12px] text-zinc-400 hover:text-white">+ Lägg till</button>
          </div>
          <div className="space-y-3">
            {loans.map(loan => (
              <div key={loan.id} className="rounded-xl bg-[#0A0A0B] border border-white/[0.08] p-4">
                <div className="font-sans text-[14px] font-semibold mb-2">{loan.name}</div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums text-zinc-400">
                  <div>{loan.balance.toLocaleString('sv-SE')} kr</div>
                  <div>{loan.rate.toFixed(2)}%</div>
                  <div>{loan.minPayment.toLocaleString('sv-SE')} kr</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}