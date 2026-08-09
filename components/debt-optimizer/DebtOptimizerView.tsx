// components/debt-optimizer/DebtOptimizerView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { 
  Plus, Trash2, TrendingDown, Calendar, Zap, Table as TableIcon, 
  Sliders, RotateCcw, ArrowRight
} from "lucide-react";
import { calculateDebtStrategy } from "@/lib/debt-optimizer/engine";
import type { Loan } from "@/lib/debt-optimizer/types";

export function DebtOptimizerView() {
  const defaultLoans: Loan[] = [
    {
      id: "1",
      name: "Nordea (Annuitet)",
      balance: 112000,
      interestRate: 5.9,
      currentMonthlyPayment: 1389,
      targetMonthlyPayment: 2000,
      topUpStartMonthOffset: 1,
    },
    {
      id: "2",
      name: "Nordax (Privatlån)",
      balance: 580000,
      interestRate: 9.2,
      currentMonthlyPayment: 6800,
      targetMonthlyPayment: 6800,
      topUpStartMonthOffset: 1,
    },
  ];

  const [loans, setLoans] = useState<Loan[]>(defaultLoans);
  const [monthlyExtraBudget, setMonthlyExtraBudget] = useState<number>(500);
  const [extraStartMonthOffset, setExtraStartMonthOffset] = useState<number>(1);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");

  const result = useMemo(() => {
    return calculateDebtStrategy({
      loans,
      monthlyExtraBudget,
      extraBudgetStartMonthOffset: extraStartMonthOffset,
      strategy,
      startDate: new Date(),
    });
  }, [loans, monthlyExtraBudget, extraStartMonthOffset, strategy]);

  const handleAddLoan = () => {
    const newLoan: Loan = {
      id: Date.now().toString(),
      name: "Ny Skuld",
      balance: 50000,
      interestRate: 7.5,
      currentMonthlyPayment: 1000,
      targetMonthlyPayment: 1000,
      topUpStartMonthOffset: 1,
    };
    setLoans([...loans, newLoan]);
  };

  const handleRemoveLoan = (id: string) => {
    setLoans(loans.filter((l) => l.id !== id));
  };

  const handleReset = () => {
    setLoans(defaultLoans);
    setMonthlyExtraBudget(500);
    setExtraStartMonthOffset(1);
  };

  const handleUpdateLoan = (id: string, field: keyof Loan, value: any) => {
    setLoans(loans.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-8 px-4 text-slate-100 font-sans">
      
      {/* Rubrik */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <TableIcon className="w-6 h-6 text-teal-400" />
            Skuldoptimeraren Pro
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Beräkna dina avbetalningar, höj enskilda månadsbelopp och se hur betalda lån automatiskt snöbollar vidare till nästa.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Återställ exempel
        </button>
      </div>

      {/* KPI-kort */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">Helt skuldfri</span>
            <span className="text-2xl font-black text-white mt-1 block">{result.freedomDate}</span>
          </div>
          <Calendar className="w-8 h-8 text-teal-400/20" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">Sparad ränta</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">
              {result.totalSavings.toLocaleString()} kr
            </span>
          </div>
          <TrendingDown className="w-8 h-8 text-emerald-400/20" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">Tid sparad</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">
              {result.monthsSaved} månader
            </span>
          </div>
          <Zap className="w-8 h-8 text-amber-400/20" />
        </div>
      </div>

      {/* Huvudinnehåll */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Lånelista */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <h2 className="text-sm font-bold text-white">Dina lån & skulder</h2>
            <button
              onClick={handleAddLoan}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 px-3 py-1.5 rounded-lg font-bold text-xs transition"
            >
              <Plus className="w-4 h-4" />
              Lägg till lån
            </button>
          </div>

          <div className="p-4 space-y-4">
            {loans.map((loan) => (
              <div key={loan.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={loan.name}
                    onChange={(e) => handleUpdateLoan(loan.id, "name", e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-sm font-bold text-white focus:outline-none focus:border-teal-500 w-1/2"
                  />
                  <button
                    onClick={() => handleRemoveLoan(loan.id)}
                    className="text-slate-500 hover:text-rose-400 transition p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Skuld (kr)</label>
                    <input
                      type="number"
                      value={loan.balance || ""}
                      onChange={(e) => handleUpdateLoan(loan.id, "balance", Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Ränta (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={loan.interestRate || ""}
                      onChange={(e) => handleUpdateLoan(loan.id, "interestRate", Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Avtalad (kr/mån)</label>
                    <input
                      type="number"
                      value={loan.currentMonthlyPayment || ""}
                      onChange={(e) => handleUpdateLoan(loan.id, "currentMonthlyPayment", Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-300 font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-teal-400 font-medium block mb-1">Höj till (kr/mån)</label>
                    <input
                      type="number"
                      value={loan.targetMonthlyPayment || ""}
                      onChange={(e) => handleUpdateLoan(loan.id, "targetMonthlyPayment", Number(e.target.value))}
                      className="w-full bg-slate-900 border border-teal-500/50 text-teal-300 font-bold rounded px-2 py-1.5 font-mono focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidopanel */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-400" />
              Inställningar & Överskott
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Extra månadsbudget:</span>
                <span className="font-mono font-bold text-teal-400">{monthlyExtraBudget.toLocaleString()} kr/mån</span>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="250"
                value={monthlyExtraBudget}
                onChange={(e) => setMonthlyExtraBudget(Number(e.target.value))}
                className="w-full accent-teal-400 bg-slate-950 h-2 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Börja betala extra:</span>
                <span className="font-mono text-slate-200">Månad +{extraStartMonthOffset}</span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={extraStartMonthOffset}
                onChange={(e) => setExtraStartMonthOffset(Number(e.target.value))}
                className="w-full accent-teal-400 bg-slate-950 h-2 rounded-lg cursor-pointer"
              />
            </div>

            <div className="pt-2">
              <label className="block text-xs text-slate-400 mb-1.5">Sorteringsstrategi</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="avalanche">Lavin (Högst ränta först - Bäst besparing)</option>
                <option value="snowball">Snöboll (Minst skuld först - Snabbast avbeta lån)</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Avbetalningsplan per Lån
            </h2>
            <div className="space-y-2">
              {result.milestones.map((m, idx) => (
                <div key={m.loanId} className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold text-white">
                    <span>{m.loanName}</span>
                    <span className="text-teal-400 font-mono">{m.payoffDate}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Ackumulerad ränta:</span>
                    <span className="font-mono text-slate-300">{m.totalInterestPaid.toLocaleString()} kr</span>
                  </div>
                  {idx < result.milestones.length - 1 && (
                    <div className="pt-1 text-[10px] text-teal-400/80 flex items-center gap-1 font-medium">
                      <ArrowRight className="w-3 h-3" /> Friställt belopp flyttas över till nästa lån!
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
