"use client";

import React, { useState, useMemo } from "react";
import {
  Calculator, Sparkles, DollarSign, Layers, Plus, Trash2,
  Calendar, TrendingDown, ArrowRight
} from "lucide-react";
import { calculateExcelStrategy } from "@/lib/debt-optimizer/engine";
import type { Loan, OneTimePayment } from "@/lib/debt-optimizer/types";

export function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>([
    {
      id: "nordea",
      name: "Nordea (lilla lånet)",
      loanType: "Rak amortering",
      balance: 112455,
      interestRate: 0.0595,
      currentMonthlyPayment: 1389,
      targetMonthlyPayment: 2000,
    },
    {
      id: "nordax",
      name: "Nordax (stora lånet)",
      loanType: "Annuitet",
      balance: 589111,
      interestRate: 0.0909,
      currentMonthlyPayment: 6888,
      extraPaymentFromStart: 500,
      extraPaymentAfterFreed: 2000,
    },
  ]);

  const [oneTimePayments, setOneTimePayments] = useState<OneTimePayment[]>([
    { id: "1", date: "2028-04", amount: 10000 },
    { id: "2", date: "2029-04", amount: 12000 },
  ]);

  const [startDate, setStartDate] = useState("2026-08");

  const result = useMemo(() => {
    return calculateExcelStrategy({
      loans,
      oneTimePayments,
      startDate,
    });
  }, [loans, oneTimePayments, startDate]);

  const handleUpdateLoan = (id: string, field: keyof Loan, val: any) => {
    setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: val } : l)));
  };

  const addOneTime = () => {
    const id = Date.now().toString();
    setOneTimePayments((prev) => [...prev, { id, date: "2028-04", amount: 10000 }]);
  };

  const updateOneTime = (id: string, field: "date" | "amount", val: string | number) => {
    setOneTimePayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const removeOneTime = (id: string) => {
    setOneTimePayments((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4 font-sans text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Calculator className="w-4 h-4" /> Karma Debt Engine
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Lånekalkylator & Strategi</h1>
          <p className="text-slate-400 text-sm mt-1">
            Toppa upp, kaskad och engångsinbetalningar (skatteåterbäring) – allt räknas om direkt.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
          <span className="text-xs text-slate-400">Start:</span>
          <input
            type="month"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono font-bold text-teal-400"
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Helt skuldfri</div>
          <div className="text-3xl font-black text-white mt-2 font-mono">{result.newFreedomDate}</div>
          <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5" /> {result.totalMonthsSaved} månader snabbare
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sparad ränta</div>
          <div className="text-3xl font-black text-emerald-400 mt-2 font-mono">
            {result.totalInterestSaved.toLocaleString("sv-SE")} kr
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Från {result.totalOriginalInterest.toLocaleString("sv-SE")} → {result.totalNewInterest.toLocaleString("sv-SE")} kr
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Original slutdatum</div>
          <div className="text-3xl font-black text-slate-500 mt-2 font-mono">{result.originalFreedomDate}</div>
          <div className="text-xs text-slate-500 mt-2">Utan extra inbetalningar</div>
        </div>
      </div>

      {/* Loans table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" /> Dina lån
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Lån</th>
                <th className="p-3">Skuld</th>
                <th className="p-3">Ränta</th>
                <th className="p-3">Ord. bet/mån</th>
                <th className="p-3">Ord. slut</th>
                <th className="p-3 text-right">Nytt slut</th>
                <th className="p-3 text-right">Sparad ränta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loans.map((loan) => {
                const res = result.loanResults.find((r) => r.id === loan.id);
                return (
                  <tr key={loan.id} className="hover:bg-slate-800/20">
                    <td className="p-3 font-sans font-bold text-white">{loan.name}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        value={loan.balance}
                        onChange={(e) => handleUpdateLoan(loan.id, "balance", Number(e.target.value))}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-24 text-slate-200"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        step="0.01"
                        value={(loan.interestRate * 100).toFixed(2)}
                        onChange={(e) => handleUpdateLoan(loan.id, "interestRate", Number(e.target.value) / 100)}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-16 text-slate-200"
                      /> %
                    </td>
                    <td className="p-3 text-slate-300">{loan.currentMonthlyPayment.toLocaleString("sv-SE")}</td>
                    <td className="p-3 text-slate-500">{res?.originalEndDate}</td>
                    <td className="p-3 text-right font-bold text-teal-400">{res?.newEndDate}</td>
                    <td className="p-3 text-right text-emerald-400">{res?.interestSaved.toLocaleString("sv-SE")} kr</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategy inputs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" /> Strategi (gula fält)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Nordea */}
          <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-5 space-y-3">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Nordea – Toppa upp</div>
            <label className="block text-xs text-slate-300">Total betalning varje månad</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={loans[0]?.targetMonthlyPayment ?? 2000}
                onChange={(e) => handleUpdateLoan(loans[0].id, "targetMonthlyPayment", Number(e.target.value))}
                className="bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-bold font-mono text-amber-300 w-full"
              />
              <span className="text-xs text-slate-400">kr/mån</span>
            </div>
          </div>

          {/* Nordax extras */}
          <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-5 space-y-3">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Nordax – Extra amortering</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Från start</label>
                <input
                  type="number"
                  value={loans[1]?.extraPaymentFromStart ?? 0}
                  onChange={(e) => handleUpdateLoan(loans[1].id, "extraPaymentFromStart", Number(e.target.value))}
                  className="bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-bold font-mono text-amber-300 w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Efter Nordea klart</label>
                <input
                  type="number"
                  value={loans[1]?.extraPaymentAfterFreed ?? 2000}
                  onChange={(e) => handleUpdateLoan(loans[1].id, "extraPaymentAfterFreed", Number(e.target.value))}
                  className="bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-sm font-bold font-mono text-amber-300 w-full"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">När Nordea är borta flyttas dess betalning + extra över automatiskt.</p>
          </div>
        </div>

        {/* Multiple one-time payments */}
        <div className="bg-slate-950 border border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-400" /> Engångsinbetalningar (skatteåterbäring m.m.)
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Lägg till flera – t.ex. april varje år 10–20 000 kr</p>
            </div>
            <button
              onClick={addOneTime}
              className="flex items-center gap-1.5 text-xs bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 px-3 py-1.5 rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" /> Lägg till
            </button>
          </div>

          <div className="space-y-2">
            {oneTimePayments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 flex-wrap">
                <input
                  type="month"
                  value={p.date}
                  onChange={(e) => updateOneTime(p.id, "date", e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200"
                />
                <input
                  type="number"
                  value={p.amount}
                  onChange={(e) => updateOneTime(p.id, "amount", Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-emerald-400 w-28"
                />
                <span className="text-xs text-slate-500">kr</span>
                <button
                  onClick={() => removeOneTime(p.id)}
                  className="p-1.5 text-slate-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {oneTimePayments.length === 0 && (
              <p className="text-xs text-slate-500 italic">Inga engångsinbetalningar tillagda ännu.</p>
            )}
          </div>
        </div>
      </div>

      {/* Summary per loan */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-teal-400" /> Avbetalningsplan
        </h2>
        <div className="space-y-3">
          {result.loanResults.map((r) => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-slate-800 last:border-0">
              <div className="font-medium text-white">{r.name}</div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-slate-500">{r.originalEndDate}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-teal-400 font-bold">{r.newEndDate}</span>
                <span className="text-emerald-400">−{r.interestSaved.toLocaleString("sv-SE")} kr</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}