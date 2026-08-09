// components/debt-optimizer/DebtOptimizerView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Plus, Trash2, TrendingDown, Calendar, Zap, Globe, Table as TableIcon, Sliders, ArrowRight } from "lucide-react";
import { calculateDebtStrategy } from "@/lib/debt-optimizer/engine";
import type { Loan } from "@/lib/debt-optimizer/types";

export function DebtOptimizerView() {
  const [lang, setLang] = useState<"sv" | "en">("sv");
  
  const [loans, setLoans] = useState<Loan[]>([
    {
      id: "1",
      name: "Nordea",
      balance: 112000,
      interestRate: 5.5,
      amortizationType: "annuity",
      currentMonthlyPayment: 1389,
      targetMonthlyPayment: 2000,
      topUpStartMonthOffset: 1, // Börja nästa månad
    },
    {
      id: "2",
      name: "Nordax",
      balance: 580000,
      interestRate: 9.2,
      amortizationType: "annuity",
      currentMonthlyPayment: 6200,
      targetMonthlyPayment: 6200,
      topUpStartMonthOffset: 1,
    },
  ]);

  const [monthlyExtraBudget, setMonthlyExtraBudget] = useState<number>(500);
  const [extraStartMonthOffset, setExtraStartMonthOffset] = useState<number>(1); // 1 = Nästa månad
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
      name: lang === "sv" ? "Nytt lån" : "New Loan",
      balance: 50000,
      interestRate: 7.5,
      amortizationType: "annuity",
      currentMonthlyPayment: 1000,
      targetMonthlyPayment: 1500,
      topUpStartMonthOffset: 1,
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
      title: "Skuldoptimering & Matris",
      subtitle: "Automatisk överskjutning av frigjorda pengar och tidsinställda toppningar.",
      freedomDate: "Skuldfri datum",
      savings: "Uppskattad besparing",
      monthsSaved: "Sparade månader",
      monthsUnit: "månader",
      settings: "Strategi & Extra Månadsbudget",
      extraBudget: "Extra månadsbudget (kr)",
      startFrom: "Börja betala extra från",
      nextMonth: "Nästa månad",
      in3Months: "Om 3 månader",
      in6Months: "Om 6 månader",
      strategy: "Optimeringstyp",
      avalanche: "Lavin (Högst ränta först)",
      snowball: "Snöboll (Minst skuld först)",
      loansTitle: "Dina lån (Excel-vy)",
      addLoan: "Ny rad",
      loanName: "Lånenamn / Borgenär",
      balance: "Skuldbelopp (kr)",
      rate: "Ränta (%)",
      currentPayment: "Nuvarande (kr/mån)",
      targetPayment: "Toppa upp till (kr/mån)",
      milestones: "Beräknade Slutdatum",
      interestPaid: "Ack. ränta",
      rolloverNotice: "⚡ När ett lån är färdigbetalt överförs hela dess månadskostnad automatiskt till nästa lån!",
    },
    en: {
      title: "Debt Optimizer & Sheet",
      subtitle: "Automatic rollover of freed-up funds and scheduled top-ups.",
      freedomDate: "Debt-free Date",
      savings: "Estimated Savings",
      monthsSaved: "Months Saved",
      monthsUnit: "months",
      settings: "Strategy & Extra Monthly Budget",
      extraBudget: "Extra monthly budget ($/kr)",
      startFrom: "Start extra payment from",
      nextMonth: "Next month",
      in3Months: "In 3 months",
      in6Months: "In 6 months",
      strategy: "Optimization Strategy",
      avalanche: "Avalanche (Highest rate first)",
      snowball: "Snowball (Lowest balance first)",
      loansTitle: "Your Loans (Sheet View)",
      addLoan: "Add Row",
      loanName: "Loan Name / Creditor",
      balance: "Balance",
      rate: "Interest (%)",
      currentPayment: "Current Payment (kr/mo)",
      targetPayment: "Top-up to (kr/mo)",
      milestones: "Estimated Payoff Dates",
      interestPaid: "Acc. Interest",
      rolloverNotice: "⚡ When a loan is paid off, its payment automatically rolls over to the next loan!",
    },
  }[lang];

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-4 px-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <TableIcon className="w-6 h-6 text-teal-400" />
            {t.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-lg w-fit">
          <Globe className="w-3.5 h-3.5 text-slate-400 ml-1" />
          <button
            onClick={() => setLang("sv")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              lang === "sv" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            SV
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              lang === "en" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">{t.freedomDate}</span>
            <span className="text-2xl font-extrabold text-white">{result.freedomDate}</span>
          </div>
          <Calendar className="w-8 h-8 text-teal-400/30" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">{t.savings}</span>
            <span className="text-2xl font-extrabold text-emerald-400">
              {result.totalSavings.toLocaleString()} kr
            </span>
          </div>
          <TrendingDown className="w-8 h-8 text-emerald-400/30" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 block">{t.monthsSaved}</span>
            <span className="text-2xl font-extrabold text-amber-400">
              {result.monthsSaved} {t.monthsUnit}
            </span>
          </div>
          <Zap className="w-8 h-8 text-amber-400/30" />
        </div>
      </div>

      {/* Rollover Banner */}
      <div className="bg-teal-950/40 border border-teal-800/50 rounded-lg p-3 text-xs text-teal-300 font-medium flex items-center gap-2">
        <span>{t.rolloverNotice}</span>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        
        {/* Loan Matrix */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              {t.loansTitle}
            </h2>
            <button
              onClick={handleAddLoan}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 px-3 py-1.5 rounded-md font-semibold text-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.addLoan}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">{t.loanName}</th>
                  <th className="p-3">{t.balance}</th>
                  <th className="p-3">{t.rate}</th>
                  <th className="p-3">{t.currentPayment}</th>
                  <th className="p-3">{t.targetPayment}</th>
                  <th className="p-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-2">
                      <input
                        type="text"
                        value={loan.name}
                        onChange={(e) => handleUpdateLoan(loan.id, "name", e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-white font-sans text-xs focus:outline-none focus:border-teal-500"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={loan.balance}
                        onChange={(e) => handleUpdateLoan(loan.id, "balance", Number(e.target.value))}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.1"
                        value={loan.interestRate}
                        onChange={(e) => handleUpdateLoan(loan.id, "interestRate", Number(e.target.value))}
                        className="w-full bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={loan.currentMonthlyPayment || ""}
                        onChange={(e) => handleUpdateLoan(loan.id, "currentMonthlyPayment", Number(e.target.value))}
                        placeholder="1389"
                        className="w-full bg-slate-950/60 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-teal-500"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={loan.targetMonthlyPayment || ""}
                        onChange={(e) => handleUpdateLoan(loan.id, "targetMonthlyPayment", Number(e.target.value))}
                        placeholder="2000"
                        className="w-full bg-slate-950/60 border border-teal-500/40 rounded px-2 py-1 text-teal-300 text-xs focus:outline-none focus:border-teal-400 font-semibold"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => handleRemoveLoan(loan.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Controls & Output */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-teal-400" />
              {t.settings}
            </h2>
            
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.extraBudget}</label>
              <input
                type="number"
                value={monthlyExtraBudget}
                onChange={(e) => setMonthlyExtraBudget(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.startFrom}</label>
              <select
                value={extraStartMonthOffset}
                onChange={(e) => setExtraStartMonthOffset(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
              >
                <option value={1}>{t.nextMonth}</option>
                <option value={3}>{t.in3Months}</option>
                <option value={6}>{t.in6Months}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.strategy}</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="avalanche">{t.avalanche}</option>
                <option value="snowball">{t.snowball}</option>
              </select>
            </div>
          </div>

          {result.milestones.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {t.milestones}
              </h2>
              <div className="space-y-2">
                {result.milestones.map((m) => (
                  <div
                    key={m.loanId}
                    className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{m.loanName}</div>
                      <div className="text-[10px] text-slate-500">
                        {t.interestPaid}: {m.totalInterestPaid.toLocaleString()} kr
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-teal-400 font-mono font-bold">{m.payoffDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
