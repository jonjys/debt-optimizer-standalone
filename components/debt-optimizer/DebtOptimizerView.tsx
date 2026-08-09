// components/debt-optimizer/DebtOptimizerView.tsx
"use client";

import React, { useState } from "react";
import { Plus, Trash2, TrendingDown, Calendar, ShieldCheck, Zap } from "lucide-react";
import { calculateDebtStrategy } from "../../lib/debt-optimizer/engine";
import type { Loan, DebtOptimizerResult } from "../../lib/debt-optimizer/types";

export function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>([
    {
      id: "1",
      name: "Privatlån",
      balance: 50000,
      interestRate: 8.5,
      amortizationType: "annuity",
      fixedAmortization: 1200,
      targetMonthlyPayment: 1500,
    },
    {
      id: "2",
      name: "Kreditkort",
      balance: 15000,
      interestRate: 19.5,
      amortizationType: "free",
      fixedAmortization: 500,
      targetMonthlyPayment: 800,
    },
  ]);

  const [monthlyExtraBudget, setMonthlyExtraBudget] = useState<number>(2000);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");

  const result: DebtOptimizerResult = calculateDebtStrategy({
    loans,
    monthlyExtraBudget,
    strategy,
  });

  const addLoan = () => {
    const newLoan: Loan = {
      id: Date.now().toString(),
      name: "Ny skuld",
      balance: 10000,
      interestRate: 10,
      amortizationType: "free",
      fixedAmortization: 300,
      targetMonthlyPayment: 500,
    };
    setLoans([...loans, newLoan]);
  };

  const removeLoan = (id: string) => {
    setLoans(loans.filter((loan) => loan.id !== id));
  };

  const updateLoan = (id: string, field: keyof Loan, value: any) => {
    setLoans(
      loans.map((loan) => (loan.id === id ? { ...loan, [field]: value } : loan))
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Debt Optimizer</h1>
        <p className="text-slate-400">
          Optimera dina avbetalningar och bli skuldfri snabbare.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <Calendar className="w-8 h-8 text-emerald-400" />
          <div>
            <div className="text-xs text-slate-400">Skuldfri datum</div>
            <div className="text-xl font-semibold text-white">{result.freedomDate}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <TrendingDown className="w-8 h-8 text-blue-400" />
          <div>
            <div className="text-xs text-slate-400">Uppskattad besparing</div>
            <div className="text-xl font-semibold text-white">{result.totalSavings.toLocaleString()} kr</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
          <Zap className="w-8 h-8 text-amber-400" />
          <div>
            <div className="text-xs text-slate-400">Sparade månader</div>
            <div className="text-xl font-semibold text-white">{result.monthsSaved} månader</div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white">Inställningar</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Extra månadsbudget (kr)</label>
            <input
              type="number"
              value={monthlyExtraBudget}
              onChange={(e) => setMonthlyExtraBudget(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Strategi</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
            >
              <option value="avalanche">Lavin (Högst ränta först)</option>
              <option value="snowball">Snöboll (Minsta skuld först)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Dina lån & skulder</h2>
          <button
            onClick={addLoan}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> Lägg till lån
          </button>
        </div>

        <div className="space-y-3">
          {loans.map((loan) => (
            <div
              key={loan.id}
              className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex flex-col md:flex-row gap-4 items-center justify-between"
            >
              <input
                type="text"
                value={loan.name}
                onChange={(e) => updateLoan(loan.id, "name", e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none border-b border-transparent focus:border-slate-700"
              />
              <div className="flex flex-wrap gap-3 items-center">
                <div>
                  <span className="text-xs text-slate-500 block">Belopp</span>
                  <input
                    type="number"
                    value={loan.balance}
                    onChange={(e) => updateLoan(loan.id, "balance", Number(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Ränta (%)</span>
                  <input
                    type="number"
                    value={loan.interestRate}
                    onChange={(e) => updateLoan(loan.id, "interestRate", Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
                <button
                  onClick={() => removeLoan(loan.id)}
                  className="text-slate-500 hover:text-red-400 transition p-1"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
