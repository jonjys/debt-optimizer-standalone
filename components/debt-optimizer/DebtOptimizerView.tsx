// components/debt-optimizer/DebtOptimizerView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Plus, Trash2, TrendingDown, Calendar, Zap, Globe, Sliders } from "lucide-react";
import { calculateDebtStrategy } from "@/lib/debt-optimizer/engine";
import type { Loan } from "@/lib/debt-optimizer/types";

export function DebtOptimizerView() {
  const [lang, setLang] = useState<"sv" | "en">("sv");
  
  const [loans, setLoans] = useState<Loan[]>([
    {
      id: "1",
      name: "Privatlån",
      balance: 50000,
      interestRate: 8.5,
      amortizationType: "annuity",
      targetMonthlyPayment: 2000,
    },
    {
      id: "2",
      name: "Kreditkort",
      balance: 15000,
      interestRate: 19.5,
      amortizationType: "straight",
      targetMonthlyPayment: 1000,
    },
  ]);

  const [monthlyExtraBudget, setMonthlyExtraBudget] = useState<number>(2000);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");

  const result = useMemo(() => {
    return calculateDebtStrategy({
      loans,
      monthlyExtraBudget,
      strategy,
    });
  }, [loans, monthlyExtraBudget, strategy]);

  const handleAddLoan = () => {
    const newLoan: Loan = {
      id: Date.now().toString(),
      name: lang === "sv" ? "Ny skuld" : "New Debt",
      balance: 10000,
      interestRate: 10,
      amortizationType: "annuity",
      targetMonthlyPayment: 1500,
    };
    setLoans([...loans, newLoan]);
  };

  const handleRemoveLoan = (id: string) => {
    setLoans(loans.filter((l) => l.id !== id));
  };

  const handleUpdateLoan = (id: string, field: keyof Loan, value: any) => {
    setLoans(
      loans.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const t = {
    sv: {
      title: "Skuldoptimering",
      subtitle: "Bli skuldfri snabbare och spara tusentals kronor i ränta.",
      freedomDate: "Skuldfri datum",
      savings: "Uppskattad besparing",
      monthsSaved: "Sparade månader",
      monthsUnit: "månader",
      settings: "Inställningar",
      extraBudget: "Extra månadsbudget utöver lägsta inbetalning (kr)",
      strategy: "Strategi",
      avalanche: "Lavin (Högst ränta först - Bäst besparing)",
      snowball: "Snöboll (Minst belopp först - Psykologisk vinst)",
      loansTitle: "Dina lån & skulder",
      addLoan: "Lägg till lån",
      loanName: "Lånenamn",
      balance: "Belopp (kr)",
      rate: "Ränta (%)",
      targetPayment: "Toppa upp månadsinbetalning (kr)",
      type: "Amorteringstyp",
      annuity: "Annuitet",
      straight: "Rak amortering",
      milestones: "Avbetalningsplan / Slutdatum",
      paidOff: "Färdigbetalt",
      interestPaid: "Total ränta",
    },
    en: {
      title: "Debt Optimizer",
      subtitle: "Become debt-free faster and save thousands in interest.",
      freedomDate: "Debt-free Date",
      savings: "Estimated Savings",
      monthsSaved: "Months Saved",
      monthsUnit: "months",
      settings: "Settings",
      extraBudget: "Extra Monthly Budget beyond minimum (kr/$)",
      strategy: "Strategy",
      avalanche: "Avalanche (Highest interest first - Best savings)",
      snowball: "Snowball (Lowest balance first - Quick wins)",
      loansTitle: "Your Loans & Debts",
      addLoan: "Add Loan",
      loanName: "Loan Name",
      balance: "Balance",
      rate: "Interest Rate (%)",
      targetPayment: "Top-up monthly payment (kr/$)",
      type: "Amortization Type",
      annuity: "Annuity",
      straight: "Straight",
      milestones: "Payoff Schedule / Final Dates",
      paidOff: "Paid off",
      interestPaid: "Total interest",
    },
  }[lang];

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Header & Language Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t.title}</h1>
          <p className="text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-lg w-fit">
          <Globe className="w-4 h-4 text-slate-400 ml-1" />
          <button
            onClick={() => setLang("sv")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              lang === "sv" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            Svenska
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              lang === "en" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 text-teal-400 mb-2">
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-medium text-slate-400">{t.freedomDate}</span>
          </div>
          <div className="text-3xl font-bold text-white">{result.freedomDate}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 text-emerald-400 mb-2">
            <TrendingDown className="w-5 h-5" />
            <span className="text-sm font-medium text-slate-400">{t.savings}</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400">
            {result.totalSavings.toLocaleString()} kr
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-3 text-amber-400 mb-2">
            <Zap className="w-5 h-5" />
            <span className="text-sm font-medium text-slate-400">{t.monthsSaved}</span>
          </div>
          <div className="text-3xl font-bold text-white">
            {result.monthsSaved} {t.monthsUnit}
          </div>
        </div>
      </div>

      {/* Global Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
        <div className="flex items-center gap-2 text-slate-200">
          <Sliders className="w-5 h-5 text-teal-400" />
          <h2 className="text-lg font-semibold">{t.settings}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">{t.extraBudget}</label>
            <input
              type="number"
              value={monthlyExtraBudget}
              onChange={(e) => setMonthlyExtraBudget(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">{t.strategy}</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
            >
              <option value="avalanche">{t.avalanche}</option>
              <option value="snowball">{t.snowball}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loans List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t.loansTitle}</h2>
          <button
            onClick={handleAddLoan}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 px-4 py-2 rounded-lg font-semibold text-sm transition"
          >
            <Plus className="w-4 h-4" />
            {t.addLoan}
          </button>
        </div>

        <div className="space-y-4">
          {loans.map((loan) => (
            <div
              key={loan.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-3">
                  <label className="block text-xs text-slate-500 mb-1">{t.loanName}</label>
                  <input
                    type="text"
                    value={loan.name}
                    onChange={(e) => handleUpdateLoan(loan.id, "name", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs text-slate-500 mb-1">{t.balance}</label>
                  <input
                    type="number"
                    value={loan.balance}
                    onChange={(e) => handleUpdateLoan(loan.id, "balance", Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">{t.rate}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={loan.interestRate}
                    onChange={(e) => handleUpdateLoan(loan.id, "interestRate", Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs text-teal-400 font-medium mb-1">{t.targetPayment}</label>
                  <input
                    type="number"
                    value={loan.targetMonthlyPayment || ""}
                    onChange={(e) => handleUpdateLoan(loan.id, "targetMonthlyPayment", Number(e.target.value))}
                    placeholder="t.ex. 2000"
                    className="w-full bg-slate-900 border border-teal-500/50 rounded-lg px-3 py-1.5 text-teal-300 text-sm focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div className="md:col-span-1 flex justify-end pt-5">
                  <button
                    onClick={() => handleRemoveLoan(loan.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payoff Milestones */}
      {result.milestones.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
          <h2 className="text-lg font-semibold text-white">{t.milestones}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.milestones.map((m) => (
              <div
                key={m.loanId}
                className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-200">{m.loanName}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {t.interestPaid}: {m.totalInterestPaid.toLocaleString()} kr
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">{t.paidOff}</span>
                  <span className="text-base font-bold text-teal-400">{m.payoffDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
