// components/debt-optimizer/DebtOptimizerView.tsx
"use client";

import { useState } from "react";
import { Plus, Trash2, TrendingDown, Calendar, ShieldCheck, Zap } from "lucide-react";
import { calculateDebtStrategy } from "@/lib/debt-optimizer/engine";
import type { Loan, DebtOptimizerResult } from "@/lib/debt-optimizer/types";

export function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>([
    {
      id: "1",
      name: "Nordea Lån 1",
      balance: 150000,
      interestRate: 5.2,
      amortizationType: "straight",
      fixedAmortization: 1389,
      targetMonthlyPayment: 2000,
    },
  ]);

  const [extraBudget, setExtraBudget] = useState("1000");
  const [result, setResult] = useState<DebtOptimizerResult | null>(null);

  const addLoan = () => {
    setLoans([
      ...loans,
      {
        id: Date.now().toString(),
        name: `Lån ${loans.length + 1}`,
        balance: 50000,
        interestRate: 6.5,
        amortizationType: "straight",
        fixedAmortization: 500,
        targetMonthlyPayment: 1000,
      },
    ]);
  };

  const removeLoan = (id: string) => {
    setLoans(loans.filter((l) => l.id !== id));
  };

  const updateLoan = (id: string, field: keyof Loan, value: string | number) => {
    setLoans(
      loans.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const handleCalculate = () => {
    const res = calculateDebtStrategy({
      loans,
      monthlyExtraBudget: Number(extraBudget) || 0,
      strategy: "avalanche",
    });
    setResult(res);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-indigo-400" /> Skuld & Låne-Optimizer
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Simulera automatisk lavineffekt (Debt Avalanche) och toppa upp månadsbelopp.
          </p>
        </div>
        <button
          onClick={addLoan}
          className="flex items-center border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
        >
          <Plus className="w-4 h-4 mr-1" /> Lägg till lån
        </button>
      </div>

      <div className="space-y-4">
        {loans.map((loan, idx) => (
          <div key={loan.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Lån #{idx + 1}</span>
              {loans.length > 1 && (
                <button onClick={() => removeLoan(loan.id)} className="text-slate-500 hover:text-rose-400 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Lånets namn</label>
                <input
                  type="text"
                  value={loan.name}
                  onChange={(e) => updateLoan(loan.id, "name", e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Skuld (kr)</label>
                <input
                  type="number"
                  value={loan.balance}
                  onChange={(e) => updateLoan(loan.id, "balance", Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Ränta (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={loan.interestRate}
                  onChange={(e) => updateLoan(loan.id, "interestRate", Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Toppa upp till (kr/mån)</label>
                <input
                  type="number"
                  value={loan.targetMonthlyPayment || ""}
                  placeholder="t.ex. 2000"
                  onChange={(e) => updateLoan(loan.id, "targetMonthlyPayment", Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between gap-4">
        <div>
          <label className="block text-xs text-slate-300 font-medium">Extra månadsbudget utöver lånen (kr/mån)</label>
          <p className="text-[11px] text-slate-500 mt-0.5">Läggs automatiskt på lånet med högst ränta</p>
        </div>
        <input
          type="number"
          value={extraBudget}
          onChange={(e) => setExtraBudget(e.target.value)}
          className="w-32 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-bold text-indigo-400 focus:outline-none focus:border-indigo-500 text-right"
        />
      </div>

      <button
        onClick={handleCalculate}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-xs transition"
      >
        Räkna ut Optimering & Slutdatum
      </button>

      {result && (
        <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
              <div className="text-[10px] font-bold text-emerald-400 uppercase">Helt Schuldfri</div>
              <div className="text-xl font-black text-emerald-300 mt-1 flex items-center gap-1">
                <Calendar className="w-5 h-5" /> {result.freedomDate}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30">
              <div className="text-[10px] font-bold text-indigo-400 uppercase">Uppskattad Räntesparing</div>
              <div className="text-xl font-black text-indigo-300 mt-1 flex items-center gap-1">
                <TrendingDown className="w-5 h-5" /> {new Intl.NumberFormat("sv-SE").format(result.totalSavings)} kr
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Inbesparade Månader</div>
              <div className="text-xl font-black text-slate-200 mt-1">
                ~{result.monthsSaved} månader snabbare
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Avbetalningsplan & Milstolpar
            </h3>
            <div className="space-y-2 pt-2">
              {result.milestones.map((m) => (
                <div key={m.loanId} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="font-semibold text-slate-200">{m.loanName}</span>
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>Klart: <strong className="text-emerald-400">{m.payoffDate}</strong></span>
                    <span>Total ränta: {new Intl.NumberFormat("sv-SE").format(m.totalInterestPaid)} kr</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
