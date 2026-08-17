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
  { id: "a", name: "Nordea Privatlån", balance: 112351, rate: 5.95, minPayment: 1389, type: 'rak' },
  { id: "b", name: "Nordax Bank", balance: 593689, rate: 3.42, minPayment: 3500, type: 'annuitet' },
];

function calcSchedule(loans: Loan[], globalExtra: number) {
  // DIN EXAKTA BIG.JS ENGINE HÄR - förkortad för mobil
  let month = 0; let totalInterest = 0;
  const totalMin = loans.reduce((s,l)=>s+l.minPayment,0);
  const monthly = totalMin + globalExtra;
  
  //... full avalanche + rak/annuitet logik från tidigare...
  
  const d = new Date(); d.setMonth(d.getMonth() + month);
  const years = Math.floor(month/12); const months = month%12;
  return { 
    months: month, 
    totalInterest, 
    debtFree: month < 12? `${month} månader` : `${years} år ${months} mån`,
    debtFreeDate: d 
  };
}

export default function Page() {
  const [loans, setLoans] = useState<Loan[]>(INITIAL_LOANS);
  const [globalExtra, setGlobalExtra] = useState(1000);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const totalMin = loans.reduce((s,l)=>s+l.minPayment,0);
  const totalDebt = loans.reduce((s,l)=>s+l.balance,0);
  const currentMonthly = totalMin + globalExtra;

  const result = useMemo(() => calcSchedule(loans, globalExtra), [loans, globalExtra]);
  const baseline = useMemo(() => calcSchedule(loans, 0), [loans]);

  const interestSaved = Math.max(0, baseline.totalInterest - result.totalInterest);
  const monthsSaved = baseline.months - result.months;

  // Anyfin quick-selects
  const quickAmounts = [3000, 4000, 5000, 6000, 8000, 10000].map(amt => {
    const r = calcSchedule(loans, amt - totalMin);
    return { amount: amt,...r };
  }).filter(o => o.amount >= totalMin);

  function addLoan() {
    setLoans([...loans, { 
      id: Math.random().toString(36).slice(2), 
      name: `Nytt lån`, 
      balance: 50000, 
      rate: 4.50, 
      minPayment: 1200,
      type: 'annuitet'
    }]);
  }

  function updateLoan(id: string, patch: Partial<Loan>) {
    setLoans(prev => prev.map(l => l.id===id? {...l,...patch} : l));
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      .font-mono { font-family: 'JetBrains Mono', monospace; }
      .font-sans { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; }
      `}</style>

      {/* ORANGE GLOW - som bild 1 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-radial from-orange-600/25 via-red-600/10 to-transparent blur-3xl" />
      </div>

      {/* SIDEBAR - som bild 1 */}
      <div className="fixed left-0 top-0 h-full w-64 bg-[#111113]/80 backdrop-blur-xl border-r border-white/[0.08] p-6 hidden lg:block z-20">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600" />
          <span className="font-sans font-semibold">Debt Optimizer</span>
        </div>
        <nav className="space-y-1">
          {['Dashboard','Loans','Analytics','Reports'].map(item=>(
            <div key={item} className={`px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
              item==='Dashboard'? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
            }`}>{item}</div>
          ))}
        </nav>
      </div>

      {/* MAIN - som bild 1 + 3 + din skärmbild */}
      <div className="lg:ml-64 relative z-10">
        <div className="p-6 sm:p-8 lg:p-10 max-w-[1400px]">

          {/* HEADER */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">
                <span className="text-[11px] font-medium text-zinc-400">Trusted by 2000+ Users</span>
              </div>
            </div>
            <h1 className="font-sans text-[40px] sm:text-[52px] leading-[0.95] tracking-[-0.04em] font-[700] text-white mb-3">
              AI Driven universal<br/>finance tool you need
            </h1>
            <p className="text-zinc-500 text-[15px] max-w-[500px]">
              Betala av snabbare. Spara ränta. Full kontroll.
            </p>
          </div>

          {/* BENTO CARDS - Overview som din skärmbild */}
          <div className="mb-8">
            <h2 className="font-sans text-[20px] font-semibold mb-4">Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-[16px] bg-[#18181B]/60 backdrop-blur-xl border border-white/[0.08] p-6">
                <div className="text-[11px] tracking-widest uppercase text-zinc-500 mb-3">TOTAL SKULD</div>
                <div className="font-mono text-[32px] font-bold tabular-nums">{totalDebt.toLocaleString('sv-SE')} kr</div>
              </div>
              <div className="rounded-[16px] bg-[#18181B]/60 backdrop-blur-xl border border-white/[0.08] p-6">
                <div className="text-[11px] tracking-widest uppercase text-zinc-500 mb-3">SKULDFRI</div>
                <div className="font-mono text-[32px] font-bold text-emerald-400 tabular-nums">{result.debtFree}</div>
              </div>
              <div className="rounded-[16px] bg-[#18181B]/60 backdrop-blur-xl border border-white/[0.08] p-6">
                <div className="text-[11px] tracking-widest uppercase text-zinc-500 mb-3">SPARAD RÄNTA</div>
                <div className="font-mono text-[32px] font-bold text-emerald-400 tabular-nums">{interestSaved.toFixed(0)} kr</div>
              </div>
            </div>
          </div>

          {/* ANYFIN SLIDER WIDGET - som din skärmbild */}
          <div className="rounded-[24px] bg-[#111113]/60 backdrop-blur-xl border border-white/[0.08] p-8 sm:p-10 mb-6"
               style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.6)" }}>

            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-sans text-[11px] font-semibold text-emerald-300">Skuldfri om</span>
                <span className="font-mono text-[14px] font-bold text-emerald-200 tabular-nums">{result.debtFree}</span>
              </div>

              <div className="font-sans text-[13px] text-zinc-500 mb-4">Hur mycket vill du betala?</div>

              <input
                type="number"
                value={currentMonthly}
                onChange={e=>{
                  const val = parseInt(e.target.value)||0;
                  setGlobalExtra(Math.max(0, val - totalMin));
                }}
                className="w-full text-center bg-transparent border-none outline-none font-mono text-[64px] sm:text-[80px] leading-[0.9] tracking-[-0.04em] font-[700] text-white tabular-nums"
              />
              <div className="font-sans text-[16px] text-zinc-500 mt-3">kr/mån</div>
              <div className="font-mono text-[11px] text-zinc-600 mt-4">
                Min: {totalMin.toLocaleString('sv-SE')} kr • Max: 10 000 kr
              </div>
            </div>

            <input type="range" min={totalMin} max={10000} step={100} value={currentMonthly}
                   onChange={e=>{
                     const val = parseInt(e.target.value);
                     setGlobalExtra(Math.max(0, val - totalMin));
                   }}
                   className="w-full h-2 rounded-full bg-[#1A1A1D] accent-orange-500 mb-6" />

            {monthsSaved > 0 && (
              <div className="text-center p-5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20">
                <div className="font-sans text-[12px] text-emerald-400 mb-2">Du sparar</div>
                <div className="font-mono text-[22px] font-bold text-emerald-300 tabular-nums">
                  {monthsSaved} månader • {interestSaved.toFixed(0)} kr
                </div>
              </div>
            )}
          </div>

          {/* QUICK SELECT - Anyfin style */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
            {quickAmounts.slice(0,6).map(opt => (
              <button key={opt.amount} onClick={()=>setGlobalExtra(Math.max(0, opt.amount - totalMin))}
                className={`p-4 rounded-xl border transition-all ${
                  currentMonthly === opt.amount
                 ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white border-transparent shadow-lg shadow-orange-500/30'
                    : 'bg-[#111113]/60 backdrop-blur-xl border-white/[0.08] text-zinc-300 hover:bg-white/[0.05]'
                }`}>
                <div className="font-mono text-[16px] font-semibold tabular-nums mb-1">{opt.amount.toLocaleString('sv-SE')} kr</div>
                <div className="font-sans text-[11px] opacity-70">{opt.debtFree}</div>
              </button>
            ))}
          </div>

          {/* BAKA IN LÅN - alla features från idag */}
          <div className="rounded-[20px] bg-[#111113]/60 backdrop-blur-xl border border-white/[0.08] p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-sans text-[18px] font-semibold">Dina lån</h2>
              <button onClick={addLoan} className="px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-[13px] font-medium">
                + Lägg till lån
              </button>
            </div>

            <div className="space-y-4">
              {loans.map(loan => (
                <div key={loan.id} className="rounded-xl bg-[#0A0A0B] border border-white/[0.08] p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <input value={loan.name} onChange={e=>updateLoan(loan.id,{name:e.target.value})}
                             className="bg-transparent font-sans text-[16px] font-semibold text-white border-none outline-none mb-1" />
                      <div className="flex gap-4 text-[11px] font-mono tabular-nums text-zinc-500">
                        <span>{loan.balance.toLocaleString('sv-SE')} kr</span>
                        <span>{loan.rate.toFixed(2)}%</span>
                        <span>{loan.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Target monthly från idag */}
                  <div className="space-y-3 pt-3 border-t border-white/[0.05]">
                    <label className="flex items-center gap-2 text-[12px]">
                      <input type="checkbox" checked={!!loan.targetMonthly}
                             onChange={e=>updateLoan(loan.id,{targetMonthly: e.target.checked? loan.minPayment : undefined})}
                             className="accent-orange-500" />
                      <span className="text-zinc-400">Betala totalt per månad</span>
                    </label>
                    {loan.targetMonthly && (
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={loan.targetMonthly}
                               onChange={e=>updateLoan(loan.id,{targetMonthly: parseFloat(e.target.value)||0})}
                               placeholder="Belopp"
                               className="h-9 rounded-lg bg-[#000000] border border-white/10 px-3 font-mono text-[13px] tabular-nums" />
                        <input type="month" value={loan.targetFrom}
                               onChange={e=>updateLoan(loan.id,{targetFrom: e.target.value})}
                               className="h-9 rounded-lg bg-[#000000] border border-white/10 px-3 font-mono text-[13px]" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}