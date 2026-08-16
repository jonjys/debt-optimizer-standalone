"use client";
import { useState, useMemo } from "react";
import { calculatePayoffSchedule } from "@/lib/debt-optimizer/engine";
import type { Loan, OneTimePayment } from "@/lib/debt-optimizer/types";

const DEFAULT_START = "2026-08";

const EMPTY_LOANS: Loan[] = [];

const TEST_LOANS: Loan[] = [
  {
    id: "nordea",
    name: "Nordea",
    loanType: "Rak amortering",
    paymentStyle: "fixed_amort",
    balance: 112351,
    interestRate: 0.0595,
    currentMonthlyPayment: 1389,
    targetMonthlyTotal: 2000,
    targetMonthlyEnabled: true,
    targetMonthlyFrom: DEFAULT_START,
    extraMonthly: 0,
    extraMonthlyEnabled: false,
    extraMonthlyFrom: DEFAULT_START,
  },
  {
    id: "nordax",
    name: "Nordax",
    loanType: "Annuitet",
    paymentStyle: "annuity",
    balance: 593689,
    interestRate: 0.0909,
    currentMonthlyPayment: 6887.77,
    targetMonthlyTotal: 0,
    targetMonthlyEnabled: false,
    targetMonthlyFrom: DEFAULT_START,
    extraMonthly: 0,
    extraMonthlyEnabled: false,
    extraMonthlyFrom: DEFAULT_START,
    reinvestment: {
      enabled: true,
      fromLoanId: "nordea",
      amount: 2000,
      startDate: "2030-01",
    },
  },
];

export default function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>(EMPTY_LOANS);
  const [oneTimes, setOneTimes] = useState<OneTimePayment[]>([]);
  const [strategy, setStrategy] = useState<"custom">("custom");
  const isDev = process.env.NODE_ENV === "development";

  const result = useMemo(() => {
    if (loans.length === 0) return null;
    return calculatePayoffSchedule({
      loans,
      oneTimePayments: oneTimes,
      startDate: DEFAULT_START,
      strategy,
    });
  }, [loans, oneTimes, strategy]);

  const updateLoan = (id: string, patch: Partial<Loan>) => {
    setLoans((prev) => prev.map((l) => (l.id === id? {...l,...patch } : l)));
  };

  const addEmptyLoan = () => {
    setLoans(prev => [...prev, {
      id: Date.now().toString(),
      name: "Nytt lån",
      loanType: "Annuitet",
      paymentStyle: "annuity" as const,
      balance: 100000,
      interestRate: 0.05,
      currentMonthlyPayment: 2000,
      targetMonthlyTotal: 0,
      targetMonthlyEnabled: false,
      targetMonthlyFrom: DEFAULT_START,
      extraMonthly: 0,
      extraMonthlyEnabled: false,
      extraMonthlyFrom: DEFAULT_START,
    }])
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] p-4 md:p-6 overflow-x-hidden">
      <div className="max-w- mx-auto w-full">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Lånekalkylator</h1>
        <p className="text-[#71717A] text-sm mb-6">
          Lägg till lån och se hur extra betalning påverkar. Big.js exakt. Inget sparas online.
        </p>

        {isDev && (
          <div className="flex gap-2 mb-4">
            <button onClick={() => setLoans(TEST_LOANS)} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm font-medium">
              test-lån-fredde
            </button>
            <button onClick={() => setLoans([])} className="bg-zinc-700 px-4 py-2 rounded text-sm">
              Rensa
            </button>
          </div>
        )}

        {loans.length === 0 && (
          <div className="bg-[#18181B] border border-dashed border-[#27272A] p-8 text-center mb-6">
            <div className="text-[#71717A] mb-3">Inga lån tillagda - helt tom prod</div>
            <button onClick={addEmptyLoan} className="bg-[#3B82F6] px-6 py-2 rounded text-sm">+ Lägg till ditt första lån</button>
          </div>
        )}

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="space-y-4 min-w-0">
            {loans.map((loan) => {
              const lr = result?.loanResults.find((r) => r.id === loan.id);
              const isFixed = loan.paymentStyle === "fixed_amort";
              const nextInterest = loan.balance * (loan.interestRate / 12);
              const nextRegular = isFixed? loan.currentMonthlyPayment + nextInterest : loan.currentMonthlyPayment;
              const nextTarget = loan.targetMonthlyEnabled && loan.targetMonthlyTotal? loan.targetMonthlyTotal : nextRegular;
              const extraFromTarget = Math.max(0, nextTarget - nextRegular);

              return (
                <div key={loan.id} className="bg-[#18181B] border border-[#27272A] p-4 min-w-0">
                  <div className="flex justify-between items-center mb-3 gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{loan.name}</div>
                      <div className="text-xs text-[#71717A] truncate">
                        {isFixed? `Fast ${loan.currentMonthlyPayment}:- + ränta` : `Annuitet ${loan.currentMonthlyPayment.toFixed(2)}`} • Saldo {loan.balance.toLocaleString("sv-SE")} • { (loan.interestRate*100).toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm text-[#71717A]">Klar</div>
                      <div className="font-mono text-sm">{lr?.newEndDate || "-"} <span className="text-[#22C55E]">{lr?.monthsSaved? `-${lr.monthsSaved}m` : ""}</span></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <label className="text-xs min-w-0">
                      <div className="text-[#71717A] mb-1">Skuld</div>
                      <input type="number" value={loan.balance} onChange={(e) => updateLoan(loan.id, { balance: Number(e.target.value) })} className="w-full bg-[#09090B] border border-[#27272A] p-2 text-sm" />
                    </label>
                    <label className="text-xs min-w-0">
                      <div className="text-[#71717A] mb-1">Ränta %</div>
                      <input type="number" step="0.01" value={loan.interestRate*100} onChange={(e) => updateLoan(loan.id, { interestRate: Number(e.target.value)/100 })} className="w-full bg-[#09090B] border border-[#27272A] p-2 text-sm" />
                    </label>
                    <label className="text-xs min-w-0">
                      <div className="text-[#71717A] mb-1">{isFixed? "Fast amort" : "Mån betalning"}</div>
                      <input type="number" value={loan.currentMonthlyPayment} onChange={(e) => updateLoan(loan.id, { currentMonthlyPayment: Number(e.target.value) })} className="w-full bg-[#09090B] border border-[#27272A] p-2 text-sm" />
                    </label>
                  </div>

                  <div className="bg-[#09090B] border border-[#27272A] p-3 mb-3">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={!!loan.targetMonthlyEnabled} onChange={(e) => updateLoan(loan.id, { targetMonthlyEnabled: e.target.checked })} />
                        <span className="text-sm font-medium">Betala totalt per månad</span>
                      </div>
                      <div className="text- text-[#71717A] shrink-0">Nu {nextRegular.toFixed(0)}:- → Nästa {nextTarget.toFixed(0)}:-</div>
                    </div>
                    {loan.targetMonthlyEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" placeholder="2000" value={loan.targetMonthlyTotal || ""} onChange={(e) => updateLoan(loan.id, { targetMonthlyTotal: Number(e.target.value) })} className="bg-[#18181B] border border-[#27272A] p-2 text-sm" />
                        <input type="month" value={loan.targetMonthlyFrom || DEFAULT_START} onChange={(e) => updateLoan(loan.id, { targetMonthlyFrom: e.target.value })} className="bg-[#18181B] border border-[#27272A] p-2 text-sm" />
                      </div>
                    )}
                    {loan.targetMonthlyEnabled && extraFromTarget > 0 && (
                      <div className="text-xs text-[#22C55E] mt-2">Amorterar {extraFromTarget.toFixed(0)}:- extra • Nytt saldo: {(loan.balance - loan.currentMonthlyPayment - extraFromTarget).toFixed(0)}:-</div>
                    )}
                  </div>

                  <div className="bg-[#09090B] border border-[#27272A] p-3 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" checked={!!loan.extraMonthlyEnabled} onChange={(e) => updateLoan(loan.id, { extraMonthlyEnabled: e.target.checked })} />
                      <span className="text-sm">Extra amortering/mån</span>
                    </div>
                    {loan.extraMonthlyEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" placeholder="500" value={loan.extraMonthly || ""} onChange={(e) => updateLoan(loan.id, { extraMonthly: Number(e.target.value) })} className="bg-[#18181B] border border-[#27272A] p-2 text-sm" />
                        <input type="month" value={loan.extraMonthlyFrom || DEFAULT_START} onChange={(e) => updateLoan(loan.id, { extraMonthlyFrom: e.target.value })} className="bg-[#18181B] border border-[#27272A] p-2 text-sm" />
                      </div>
                    )}
                  </div>

                  {loan.id === "nordax" && (
                    <div className="bg-[#09090B] border border-[#3B82F6]/30 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input type="checkbox" checked={!!loan.reinvestment?.enabled} onChange={(e) => updateLoan(loan.id, { reinvestment: {...(loan.reinvestment || { fromLoanId: "nordea", amount: 2000, startDate: DEFAULT_START }), enabled: e.target.checked } })} />
                        <span className="text-sm">När Nordea klart: lägg över summan på Nordax</span>
                      </div>
                    </div>
                  )}

                  {lr && (
                    <div className="mt-3 text-xs text-[#71717A] flex flex-wrap gap-4">
                      <span>Orig ränta: {lr.originalTotalInterest.toLocaleString()}:-</span>
                      <span>Ny ränta: {lr.newTotalInterest.toLocaleString()}:-</span>
                      <span className="text-[#22C55E]">Sparad: {lr.interestSaved.toLocaleString()}:-</span>
                    </div>
                  )}
                </div>
              );
            })}
            {loans.length > 0 && <button onClick={addEmptyLoan} className="bg-zinc-800 border border-[#27272A] w-full py-2 text-sm">+ Lägg till lån</button>}
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 h-fit min-w-0">
            {result? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#18181B] border border-[#27272A] p-4">
                    <div className="text-xs text-[#71717A]">SKULDFRI</div>
                    <div className="text-xl font-mono font-bold">{result.newFreedomDate}</div>
                    <div className="text-xs text-[#22C55E]">{result.totalMonthsSaved} mån tidigare</div>
                    <div className="text- text-[#71717A] mt-1">Orig: {result.originalFreedomDate}</div>
                  </div>
                  <div className="bg-[#18181B] border border-[#27272A] p-4">
                    <div className="text-xs text-[#71717A]">SPARAD RÄNTA</div>
                    <div className="text-xl font-mono font-bold">{result.totalInterestSaved.toLocaleString("sv-SE")}:-</div>
                    <div className="text-xs text-[#71717A]">{result.totalOriginalInterest.toLocaleString()} → {result.totalNewInterest.toLocaleString()}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#18181B] border border-[#27272A] p-4 text-sm text-[#71717A]">Lägg till lån för att se resultat</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}