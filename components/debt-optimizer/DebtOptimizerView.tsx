// components/debt-optimizer/DebtOptimizerView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { 
  Calculator, Calendar, TrendingDown, ArrowRight, CheckCircle2, 
  Sparkles, DollarSign, Layers
} from "lucide-react";
import { calculateExcelStrategy } from "@/lib/debt-optimizer/engine";
import type { Loan, StrategyInput } from "@/lib/debt-optimizer/types";

export function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>([
    {
      id: "nordea",
      name: "Nordea (lilla lånet)",
      loanType: "Rak amortering",
      balance: 112455,
      interestRate: 0.0595, // 5.95%
      currentMonthlyPayment: 1389,
      targetMonthlyPayment: 2000,
    },
    {
      id: "nordax",
      name: "Nordax (stora lånet)",
      loanType: "Annuitet",
      balance: 589110.72,
      interestRate: 0.0909, // 9.09%
      currentMonthlyPayment: 6887.77,
      extraPaymentFromStart: 0,
      extraPaymentAfterFreed: 2000,
    },
  ]);

  const [oneTimeAmount, setOneTimeAmount] = useState<number>(10000);
  const [oneTimeDate, setOneTimeDate] = useState<string>("2028-04");
  const [startDate, setStartDate] = useState<string>("2026-08");

  const result = useMemo(() => {
    return calculateExcelStrategy({
      loans,
      oneTimePaymentAmount: oneTimeAmount,
      oneTimePaymentDate: oneTimeDate,
      startDate,
    });
  }, [loans, oneTimeAmount, oneTimeDate, startDate]);

  const handleUpdateLoan = (id: string, field: keyof Loan, val: any) => {
    setLoans(loans.map((l) => (l.id === id ? { ...l, [field]: val } : l)));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-10 px-4 font-sans text-slate-100">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Calculator className="w-4 h-4" /> Karma Debt Engine
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Lånekalkylator & Strategi</h1>
          <p className="text-slate-400 text-sm mt-1">
            Baserad på din kalkylmodell med Toppa upp, engångsinbetalningar och automatisk kaskadeffekt.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3">
          <span className="text-xs text-slate-400">Startdatum:</span>
          <input
            type="text"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono font-bold text-teal-400 w-24 text-center"
          />
        </div>
      </div>

      {/* Sektion 1: KPI Resultat-kort */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Helt Skuldfri</div>
          <div className="text-3xl font-black text-white mt-2 font-mono">{result.newFreedomDate}</div>
          <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5" /> {result.totalMonthsSaved} månader snabbare än planen!
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Ränteresparing</div>
          <div className="text-3xl font-black text-emerald-400 mt-2 font-mono">
            {result.totalInterestSaved.toLocaleString("sv-SE")} kr
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Minskar från {result.totalOriginalInterest.toLocaleString("sv-SE")} kr till {result.totalNewInterest.toLocaleString("sv-SE")} kr
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Original Slutdatum</div>
          <div className="text-3xl font-black text-slate-500 mt-2 font-mono">{result.originalFreedomDate}</div>
          <div className="text-xs text-slate-500 mt-2">Utan några extra inbetalningar</div>
        </div>
      </div>

      {/* Sektion 2: Original vs Strategi Tabell */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" /> 1. Grunddata & Reella Kostnader
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">Lånets Namn</th>
                <th className="p-4">Lånetyp</th>
                <th className="p-4">Skuld Idag</th>
                <th className="p-4">Ränta</th>
                <th className="p-4">Ord. Bet/mån</th>
                <th className="p-4">Ord. Slutdatum</th>
                <th className="p-4 text-right">Nytt Slutdatum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loans.map((loan) => {
                const res = result.loanResults.find((r) => r.id === loan.id);
                return (
                  <tr key={loan.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-4 font-sans font-bold text-white">{loan.name}</td>
                    <td className="p-4 font-sans text-slate-400">{loan.loanType}</td>
                    <td className="p-4 font-bold text-slate-200">
                      <input
                        type="number"
                        value={loan.balance}
                        onChange={(e) => handleUpdateLoan(loan.id, "balance", Number(e.target.value))}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs w-28 text-slate-200"
                      /> kr
                    </td>
                    <td className="p-4 text-slate-300">
                      <input
                        type="number"
                        step="0.01"
                        value={(loan.interestRate * 100).toFixed(2)}
                        onChange={(e) => handleUpdateLoan(loan.id, "interestRate", Number(e.target.value) / 100)}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs w-16 text-slate-200"
                      /> %
                    </td>
                    <td className="p-4 text-slate-300">{loan.currentMonthlyPayment.toLocaleString("sv-SE")} kr</td>
                    <td className="p-4 text-slate-500">{res?.originalEndDate}</td>
                    <td className="p-4 text-right font-bold text-teal-400">{res?.newEndDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sektion 3: Dina Val & Strategi (Gula fält) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" /> 2. Dina Val & Strategi (Toppa upp & Kaskad)
          </h2>
          <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
            Motsvarar de gula rutorna i Excel
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Nordea Inställning */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-5 space-y-3 relative">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Nordea – Lilla lånet</div>
            <label className="block text-xs text-slate-300 font-medium">
              Målbelopp per månad (Toppa upp till):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={loans[0]?.targetMonthlyPayment || 2000}
                onChange={(e) => handleUpdateLoan(loans[0].id, "targetMonthlyPayment", Number(e.target.value))}
                className="bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-bold font-mono text-amber-300 w-full focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs text-slate-400 font-mono">kr/mån</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Du betalar fast 2 000 kr/mån oavsett ordinariebeloppet (1 389 kr).
            </p>
          </div>

          {/* Nordax Inställning */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-5 space-y-3">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Nordax – Stora lånet</div>
            <label className="block text-xs text-slate-300 font-medium">
              Extra amortering EFTER Nordea är helt klart:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={loans[1]?.extraPaymentAfterFreed || 2000}
                onChange={(e) => handleUpdateLoan(loans[1].id, "extraPaymentAfterFreed", Number(e.target.value))}
                className="bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-bold font-mono text-amber-300 w-full focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs text-slate-400 font-mono">kr/mån</span>
            </div>
            <p className="text-[11px] text-slate-400">
              När Nordea är nollas flyttas 2 000 kr/mån över automatiskt till Nordax.
            </p>
          </div>

        </div>

        {/* Engångsinbetalning */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-white">Engångsinbetalning (Extra skatteåterbäring e.d.)</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Betalas direkt in på det aktiva lånet vid valt datum</div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={oneTimeAmount}
              onChange={(e) => setOneTimeAmount(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 w-28 text-center"
            />
            <span className="text-xs text-slate-500">kr vid datum</span>
            <input
              type="text"
              value={oneTimeDate}
              onChange={(e) => setOneTimeDate(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-300 w-28 text-center"
            />
          </div>
        </div>

      </div>

    </div>
  );
}
