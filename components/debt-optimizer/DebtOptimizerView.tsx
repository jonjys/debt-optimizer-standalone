// components/debt-optimizer/DebtOptimizerView.tsx
"use client";

import React, { useState, useMemo, ChangeEvent } from "react";
import { 
  Plus, Trash2, TrendingDown, Calendar, Zap, Globe, Table as TableIcon, 
  Sliders, FileText, Upload, RefreshCw, Sparkles, CheckCircle2, RotateCcw 
} from "lucide-react";
import { calculateDebtStrategy } from "@/lib/debt-optimizer/engine";
import { parseLoanFromText } from "@/lib/debt-optimizer/parser";
import type { Loan } from "@/lib/debt-optimizer/types";

export function DebtOptimizerView() {
  const [lang, setLang] = useState<"sv" | "en">("sv");
  
  // Mall-data (kan nollställas)
  const defaultLoans: Loan[] = [
    {
      id: "1",
      name: "Billån / Bank A",
      balance: 145000,
      interestRate: 6.8,
      amortizationType: "annuity",
      currentMonthlyPayment: 2450,
      targetMonthlyPayment: 3000,
      topUpStartMonthOffset: 1,
    },
    {
      id: "2",
      name: "Privatlån / Bank B",
      balance: 320000,
      interestRate: 8.9,
      amortizationType: "annuity",
      currentMonthlyPayment: 4200,
      targetMonthlyPayment: 5000,
      topUpStartMonthOffset: 1,
    },
  ];

  const [loans, setLoans] = useState<Loan[]>(defaultLoans);
  const [monthlyExtraBudget, setMonthlyExtraBudget] = useState<number>(1000);
  const [extraStartMonthOffset, setExtraStartMonthOffset] = useState<number>(1);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");

  // Modal & Importhantering
  const [showScanModal, setShowScanModal] = useState<boolean>(false);
  const [rawPastedText, setRawPastedText] = useState<string>("");
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string>("");

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
      name: lang === "sv" ? "Ny skuld" : "New Debt",
      balance: 50000,
      interestRate: 7.5,
      amortizationType: "annuity",
      currentMonthlyPayment: 1200,
      targetMonthlyPayment: 1500,
      topUpStartMonthOffset: 1,
    };
    setLoans([...loans, newLoan]);
  };

  const handleRemoveLoan = (id: string) => {
    setLoans(loans.filter((l) => l.id !== id));
  };

  const handleClearAll = () => {
    setLoans([]);
  };

  const handleResetDemo = () => {
    setLoans(defaultLoans);
  };

  const handleUpdateLoan = (id: string, field: keyof Loan, value: any) => {
    setLoans(loans.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  // Skannings- och filanalysator
  const handleProcessText = (text: string) => {
    const parsed = parseLoanFromText(text);
    const newLoan: Loan = {
      id: Date.now().toString(),
      name: parsed.name || "Importerat lån",
      balance: parsed.balance || 50000,
      interestRate: parsed.interestRate || 6.5,
      amortizationType: "annuity",
      currentMonthlyPayment: parsed.currentMonthlyPayment || 1500,
      targetMonthlyPayment: parsed.currentMonthlyPayment ? Math.round(parsed.currentMonthlyPayment * 1.2) : 2000,
      topUpStartMonthOffset: 1,
    };

    setLoans((prev) => [...prev, newLoan]);
    setScanSuccessMessage(`Identifierade: ${newLoan.name} (${newLoan.balance.toLocaleString()} kr, ${newLoan.interestRate}%)`);
    setTimeout(() => setScanSuccessMessage(""), 4000);
    setShowScanModal(false);
    setRawPastedText("");
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleProcessText(content);
      }
    };
    reader.readAsText(file);
  };

  const t = {
    sv: {
      title: "Skuldoptimeraren Pro",
      subtitle: "Interaktiv mall med automatisk inskanning och tidslinjer i realtid.",
      freedomDate: "Skuldfri datum",
      savings: "Total räntebesparing",
      monthsSaved: "Sparade månader",
      monthsUnit: "mån",
      settings: "Reglage & Månadsbudget",
      extraBudget: "Extra månadsbudget:",
      startFrom: "Börja betala extra:",
      monthLabel: "Månad",
      strategy: "Optimeringstyp",
      avalanche: "Lavin (Högst ränta först)",
      snowball: "Snöboll (Minst skuld först)",
      loansTitle: "Låneöversikt & Skulder",
      addLoan: "Lägg till rad",
      scanBtn: "Skanna / Importera underlag",
      clearBtn: "Tom mall",
      demoBtn: "Återställ mall",
      loanName: "Lånenamn / Borgenär",
      balance: "Skuld (kr)",
      rate: "Ränta (%)",
      currentPayment: "Nuvarande (kr/mån)",
      targetPayment: "Toppa upp till (kr/mån)",
      milestones: "Beräknade Slutdatum per Lån",
      interestPaid: "Ack. ränta",
      scanModalTitle: "Klistra in eller bifoga underlag",
      scanModalDesc: "Släpp in text från din internetbank, e-faktura eller PDF nedan så fylls fälten i automatiskt.",
      uploadFile: "Välj fil (PDF/Text)",
      pastePlaceholder: "Klistra in text från e-faktura eller lånebesked här...",
      processTextBtn: "Analysera & Fyll i",
    },
    en: {
      title: "Debt Optimizer Pro",
      subtitle: "Interactive template with auto-scanning and real-time payoff timelines.",
      freedomDate: "Debt-free Date",
      savings: "Total Interest Savings",
      monthsSaved: "Months Saved",
      monthsUnit: "mos",
      settings: "Controls & Monthly Budget",
      extraBudget: "Extra monthly budget:",
      startFrom: "Start extra payments:",
      monthLabel: "Month",
      strategy: "Optimization Strategy",
      avalanche: "Avalanche (Highest rate first)",
      snowball: "Snowball (Lowest balance first)",
      loansTitle: "Debt Matrix & Summary",
      addLoan: "Add Row",
      scanBtn: "Scan / Import Document",
      clearBtn: "Clear All",
      demoBtn: "Reset Demo",
      loanName: "Loan / Creditor",
      balance: "Balance ($/kr)",
      rate: "Interest (%)",
      currentPayment: "Current Pay ($/mo)",
      targetPayment: "Top-up To ($/mo)",
      milestones: "Estimated Payoff Dates",
      interestPaid: "Acc. Interest",
      scanModalTitle: "Paste or attach statement",
      scanModalDesc: "Paste text from your online bank or e-invoice below to automatically extract details.",
      uploadFile: "Select File (PDF/Text)",
      pastePlaceholder: "Paste statement text or bill info here...",
      processTextBtn: "Analyze & Auto-fill",
    },
  }[lang];

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 px-3">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <TableIcon className="w-6 h-6 text-teal-400" />
            {t.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScanModal(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            {t.scanBtn}
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 text-xs px-2 py-1.5 rounded border border-slate-800"
            title="Töm alla fält"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.clearBtn}
          </button>

          <button
            onClick={handleResetDemo}
            className="flex items-center gap-1 text-slate-400 hover:text-teal-400 text-xs px-2 py-1.5 rounded border border-slate-800"
            title="Ladda exempel"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t.demoBtn}
          </button>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg ml-2">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <button
              onClick={() => setLang("sv")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${lang === "sv" ? "bg-teal-500 text-slate-950" : "text-slate-400"}`}
            >
              SV
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${lang === "en" ? "bg-teal-500 text-slate-950" : "text-slate-400"}`}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      {/* Notis om lyckad skanning */}
      {scanSuccessMessage && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {scanSuccessMessage}
        </div>
      )}

      {/* KPI Mätare */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-medium text-slate-400 block">{t.freedomDate}</span>
            <span className="text-3xl font-black text-white">{result.freedomDate}</span>
          </div>
          <Calendar className="w-8 h-8 text-teal-400/30" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-medium text-slate-400 block">{t.savings}</span>
            <span className="text-3xl font-black text-emerald-400">
              {result.totalSavings.toLocaleString()} kr
            </span>
          </div>
          <TrendingDown className="w-8 h-8 text-emerald-400/30" />
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-md">
          <div>
            <span className="text-xs font-medium text-slate-400 block">{t.monthsSaved}</span>
            <span className="text-3xl font-black text-amber-400">
              {result.monthsSaved} {t.monthsUnit}
            </span>
          </div>
          <Zap className="w-8 h-8 text-amber-400/30" />
        </div>
      </div>

      {/* Huvudsektion: Lånematris + Interaktiva Reglage */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
        
        {/* Lånelista & Inmatning */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              {t.loansTitle} ({loans.length})
            </h2>
            <button
              onClick={handleAddLoan}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 px-3 py-1.5 rounded-lg font-bold text-xs transition"
            >
              <Plus className="w-4 h-4" />
              {t.addLoan}
            </button>
          </div>

          {loans.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <FileText className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="text-sm">Inga lån tillagda ännu. Klicka på "Lägg till rad" eller skanna in underlag.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
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
                    <tr key={loan.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-2">
                        <input
                          type="text"
                          value={loan.name}
                          onChange={(e) => handleUpdateLoan(loan.id, "name", e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-sans text-xs focus:outline-none focus:border-teal-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={loan.balance || ""}
                          onChange={(e) => handleUpdateLoan(loan.id, "balance", Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.1"
                          value={loan.interestRate || ""}
                          onChange={(e) => handleUpdateLoan(loan.id, "interestRate", Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-teal-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={loan.currentMonthlyPayment || ""}
                          onChange={(e) => handleUpdateLoan(loan.id, "currentMonthlyPayment", Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-teal-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={loan.targetMonthlyPayment || ""}
                          onChange={(e) => handleUpdateLoan(loan.id, "targetMonthlyPayment", Number(e.target.value))}
                          className="w-full bg-slate-950 border border-teal-500/40 rounded px-2 py-1.5 text-teal-300 text-xs focus:outline-none focus:border-teal-400 font-bold"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => handleRemoveLoan(loan.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidopanel med Interaktiva Reglage & Slutdatum */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow-lg">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-teal-400" />
              {t.settings}
            </h2>
            
            {/* Slider för extra budget */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{t.extraBudget}</span>
                <span className="font-mono font-bold text-teal-400">{monthlyExtraBudget.toLocaleString()} kr</span>
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

            {/* Slider för startmånad */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{t.startFrom}</span>
                <span className="font-mono text-slate-200">{t.monthLabel} +{extraStartMonthOffset}</span>
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

            {/* Strategi-väljare */}
            <div className="pt-2">
              <label className="block text-xs text-slate-400 mb-1">{t.strategy}</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-teal-500"
              >
                <option value="avalanche">{t.avalanche}</option>
                <option value="snowball">{t.snowball}</option>
              </select>
            </div>
          </div>

          {/* Slutdatum per lån */}
          {result.milestones.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {t.milestones}
              </h2>
              <div className="space-y-2">
                {result.milestones.map((m) => (
                  <div
                    key={m.loanId}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200">{m.loanName}</div>
                      <div className="text-[10px] text-slate-500">
                        {t.interestPaid}: {m.totalInterestPaid.toLocaleString()} kr
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-teal-400 font-mono font-bold text-sm block">{m.payoffDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Modal för Skanning / Bifoga underlag */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-400" />
                {t.scanModalTitle}
              </h3>
              <button
                onClick={() => setShowScanModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">{t.scanModalDesc}</p>

            {/* Filuppladdning */}
            <div className="border-2 border-dashed border-slate-800 hover:border-teal-500/50 rounded-xl p-4 text-center transition">
              <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
              <label className="text-xs text-teal-400 font-semibold cursor-pointer">
                {t.uploadFile}
                <input
                  type="file"
                  accept=".txt,.pdf,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="relative text-center">
              <span className="bg-slate-900 px-2 text-[10px] text-slate-500 uppercase">eller klistra in</span>
            </div>

            {/* Textområde */}
            <textarea
              rows={5}
              value={rawPastedText}
              onChange={(e) => setRawPastedText(e.target.value)}
              placeholder={t.pastePlaceholder}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono"
            />

            <button
              onClick={() => handleProcessText(rawPastedText)}
              disabled={!rawPastedText.trim()}
              className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition"
            >
              {t.processTextBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
