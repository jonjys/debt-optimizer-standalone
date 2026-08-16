'use client'
import { useState, useMemo } from "react";

type Loan = {
  id: string;
  name: string;
  balance: number;
  rate: number;
  minPayment: number;
  target: boolean;
};

const INITIAL_LOANS: Loan[] = [
  { id: "a", name: "Loan A", balance: 185000, rate: 5.95, minPayment: 3200, target: true },
  { id: "b", name: "Loan B", balance: 92000, rate: 3.42, minPayment: 1800, target: false },
  { id: "c", name: "Loan C", balance: 41000, rate: 8.10, minPayment: 950, target: false },
];

function calcSchedule(loans: Loan[], extra: number) {
  let clones = loans.map(l => ({...l, balance: l.balance })).sort((a,b) => b.rate - a.rate);
  let month = 0;
  let totalInterest = 0;
  let history: { totalBalance: number }[] = [];
  const totalStart = clones.reduce((s,l)=>s+l.balance,0);

  while (clones.some(l => l.balance > 0.01) && month < 600) {
    month++;
    clones.forEach(l => {
      if (l.balance <= 0) return;
      const interest = l.balance * (l.rate/100) / 12;
      l.balance += interest;
      totalInterest += interest;
    });

    let extraPool = extra;
    clones.forEach(l => {
      if (l.balance <= 0) return;
      const pay = Math.min(l.balance, l.minPayment);
      l.balance -= pay;
    });
    const targetLoans = clones.filter(l => l.target && l.balance > 0);
    const order = targetLoans.length? targetLoans : [...clones].sort((a,b)=>b.rate-a.rate);
    for (const l of order) {
      if (extraPool <= 0) break;
      if (l.balance <= 0) continue;
      const pay = Math.min(l.balance, extraPool);
      l.balance -= pay;
      extraPool -= pay;
    }

    const totalBal = clones.reduce((s,l)=>s+Math.max(0,l.balance),0);
    history.push({ totalBalance: totalBal });
    if (totalBal <= 0.01) break;
  }

  return { months: month, totalInterest, totalStart, history };
}

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [extra, setExtra] = useState(2000);
  const [now] = useState(() => new Date());

  const baseline = useMemo(() => calcSchedule(loans, 0), [loans]);
  const optimized = useMemo(() => calcSchedule(loans, extra), [loans, extra]);

  const interestSaved = Math.max(0, baseline.totalInterest - optimized.totalInterest);
  const debtFreeDate = useMemo(() => {
    const d = new Date(now);
    d.setMonth(d.getMonth() + optimized.months);
    return d;
  }, [now, optimized.months]);

  const debtFreeLabel = `${debtFreeDate.getFullYear()}-${String(debtFreeDate.getMonth()+1).padStart(2,"0")}`;
  const totalDebt = loans.reduce((s,l)=>s+l.balance,0);
  const totalMin = loans.reduce((s,l)=>s+l.minPayment,0);
  const progressPct = baseline.months? Math.min(100, Math.max(0, 100 - (optimized.months / baseline.months) * 100)) : 0;
  const visualProgress = 38 + (progressPct * 0.5);

  function updateLoan(id: string, patch: Partial<Loan>) {
    setLoans(prev => prev.map(l => l.id===id? {...l,...patch } : l));
  }

  function addLoan() {
    const letter = String.fromCharCode(65 + loans.length);
    setLoans([...loans, { id: Math.random().toString(36).slice(2), name: `Loan ${letter}`, balance: 50000, rate: 4.50, minPayment: 1200, target: false }]);
  }

  function removeLoan(id: string) {
    if (loans.length===1) return;
    setLoans(prev => prev.filter(l=>l.id!==id));
  }

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 antialiased selection:bg-white selection:text-black">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
       .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
       .font-sans { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', sans-serif; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div className="mx-auto max-w-[1280px] px-6 sm:px-8 lg:px-12 py-8 sm:py-12">
        <header className="flex items-start justify-between gap-6 mb-10 sm:mb-12">
          <div>
            <h1 className="font-sans text-[40px] leading-[0.95] tracking-[-0.04em] font-[700] text-white">Debt Optimizer</h1>
            <p className="mt-3 font-sans text-[14px] leading-5 text-zinc-500 max-w-[420px]">
              Private, local-only avalanche optimizer. No tracking. No cloud. Built for tomorrow.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="h-8 rounded-full bg-white text-black px-4 flex items-center gap-2 text-[12px] font-medium tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE • LOCAL
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="relative rounded-[16px] bg-[#111111] border border-white/[0.08] p-8 sm:p-12 overflow-hidden"
               style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center justify-between mb-8">
              <div className="font-sans text-[11px] tracking-widest uppercase font-medium text-zinc-500">Debt Free</div>
              <div className="h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 flex items-center">
                <span className="font-mono text-[11px] font-medium text-emerald-400">{progressPct.toFixed(0)}% faster</span>
              </div>
            </div>
            <div className="font-mono text-[48px] leading-[0.9] tracking-[-0.04em] font-[600] text-white tabular-nums mb-2">{debtFreeLabel}</div>
            <div className="font-sans text-[13px] text-zinc-500">
              {optimized.months} months • {baseline.months - optimized.months} months saved
            </div>
          </div>

          <div className="relative rounded-[16px] bg-[#111111] border border-white/[0.08] p-8 sm:p-12 overflow-hidden"
               style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center justify-between mb-8">
              <div className="font-sans text-[11px] tracking-widest uppercase font-medium text-zinc-500">Interest Saved</div>
            </div>
            <div className="font-mono text-[48px] leading-[0.9] tracking-[-0.04em] font-[600] text-white tabular-nums mb-2">{interestSaved.toFixed(0)} SEK</div>
            <div className="font-sans text-[13px] text-zinc-500">
              {baseline.totalInterest.toFixed(0)} → {optimized.totalInterest.toFixed(0)} SEK
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[12px] bg-[#0A0A0A] border border-white/[0.08] p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-sans text-[11px] tracking-widest uppercase font-medium text-zinc-500">Timeline</span>
            <span className="font-mono text-[11px] text-zinc-400">{visualProgress.toFixed(0)}%</span>
          </div>
          <div className="relative h-[4px] bg-[#1A1A1A] rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#4B6BFF] via-[#A248FF] to-white rounded-full transition-all duration-500 ease-out"
                 style={{ width: `${visualProgress}%`, boxShadow: "0 0 20px rgba(75,107,255,0.4)" }} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          <div className="space-y-3">
            {loans.map((loan) => (
              <div key={loan.id} className="rounded-[12px] bg-[#111111] border border-white/[0.08] p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <input value={loan.name} onChange={e=>updateLoan(loan.id,{name:e.target.value})}
                           className="bg-transparent font-sans text-[16px] font-semibold text-white border-none outline-none w-full" />
                    <div className="mt-1 font-mono text-[12px] text-zinc-500 tabular-nums">
                      {loan.balance.toFixed(2)} SEK • {loan.rate.toFixed(2)}% • {loan.minPayment.toFixed(2)} SEK/mo
                    </div>
                  </div>
                  <button onClick={()=>removeLoan(loan.id)} className="h-8 w-8 rounded-full bg-[#0A0A0A] border border-white/10 flex items-center justify-center text-zinc-500 hover:text-white">
                    ×
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-sans text-[11px] tracking-widest uppercase text-zinc-500 mb-1.5 block">Balance</label>
                    <input type="number" value={loan.balance} onChange={e=>updateLoan(loan.id,{balance:parseFloat(e.target.value)||0})}
                           className="w-full h-10 rounded-lg bg-[#0A0A0A] border border-white/10 px-3 font-mono text-[13px] tabular-nums text-white" />
                  </div>
                  <div>
                    <label className="font-sans text-[11px] tracking-widest uppercase text-zinc-500 mb-1.5 block">Rate %</label>
                    <input type="number" step="0.01" value={loan.rate} onChange={e=>updateLoan(loan.id,{rate:parseFloat(e.target.value)||0})}
                           className="w-full h-10 rounded-lg bg-[#0A0A0A] border border-white/10 px-3 font-mono text-[13px] tabular-nums text-white" />
                  </div>
                  <div>
                    <label className="font-sans text-[11px] tracking-widest uppercase text-zinc-500 mb-1.5 block">Min payment</label>
                    <input type="number" value={loan.minPayment} onChange={e=>updateLoan(loan.id,{minPayment:parseFloat(e.target.value)||0})}
                           className="w-full h-10 rounded-lg bg-[#0A0A0A] border border-white/10 px-3 font-mono text-[13px] tabular-nums text-white" />
                  </div>
                <div className="mt-3 flex items-center gap-2">
                  <input type="checkbox" checked={loan.target} onChange={e=>updateLoan(loan.id,{target:e.target.checked})}
                         className="accent-white" />
                  <span className="font-sans text-[12px] text-zinc-400">Target monthly - avalanche priority</span>
                </div>
              </div>
            ))}
            <button onClick={addLoan} className="w-full h-12 rounded-full border border-dashed border-white/20 text-[13px] font-medium text-zinc-400 hover:text-white hover:border-white/40">
              + Add loan
            </button>
          </div>

          <div className="lg:sticky lg:top-8 space-y-4">
            <div className="rounded-[12px] bg-[#111111] border border-white/[0.08] p-5">
              <div className="font-sans text-[11px] tracking-widest uppercase font-medium text-zinc-500 mb-4">Controls</div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="font-sans text-[12px] text-zinc-300">Extra monthly budget</span>
                    <span className="font-mono text-[12px] tabular-nums text-white">{extra.toLocaleString('sv-SE')} SEK</span>
                  </div>
                  <input type="range" min={0} max={10000} step={100} value={extra} onChange={e=>setExtra(parseInt(e.target.value))}
                         className="w-full accent-white h-1.5 rounded-full bg-[#1A1A1A]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={()=>setExtra(0)} className="h-9 rounded-full bg-[#0A0A0A] border border-white/10 text-[12px] font-medium text-zinc-400">Min only</button>
                  <button onClick={()=>setExtra(2000)} className="h-9 rounded-full bg-white text-black text-[12px] font-medium">2 000 SEK</button>
                </div>
              </div>
            </div>
            <div className="px-2 py-2 font-sans text-[11px] leading-4 text-zinc-600">
              Designed for screenshot. True black #000000 • Surface #0A0A0A/#111111 • Hairline rgba(255,255,255,0.08) • Mono numbers • 150ms ease • Pill buttons • Huge whitespace.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}