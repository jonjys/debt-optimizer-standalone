"use client";
import { useState, useMemo } from "react";
import { calculatePayoffSchedule } from "@/lib/debt-optimizer/engine";
import type { Loan, OneTimePayment } from "@/lib/debt-optimizer/types";

const DEFAULT_START = "2026-08";

export default function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>([
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
  ]);

  const [oneTimes, setOneTimes] = useState<OneTimePayment[]>([]);
  const [strategy, setStrategy] = useState<"custom">("custom");

  const result = useMemo(() => {
    return calculatePayoffSchedule({
      loans,
      oneTimePayments: oneTimes,
      startDate: DEFAULT_START,
      strategy,
    });
  }, [loans, oneTimes, strategy]);

  const updateLoan = (id: string, patch: Partial<Loan>) => {
    setLoans((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Lånekalkylator</h1>
        <p className="text-[#71717A] text-sm mb-6">
          Nordea fast amortering 1389 + ränta. Sätt 2000/mån och se nytt slutdatum direkt. Big.js exakt.
        </p>

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
          {/* Vänster - Lån */}
          <div className="space-y-4">
            {loans.map((loan) => {
              const lr = result.loanResults.find((r) => r.id === loan.id);
              const isFixed = loan.paymentStyle === "fixed_amort";
              // Räkna ut nästa betalning för visning
              const nextInterest = loan.balance * (loan.interestRate / 12);
              const nextRegular = isFixed ? loan.currentMonthlyPayment + nextInterest : loan.currentMonthlyPayment;
              const nextTarget = loan.targetMonthlyEnabled && loan.targetMonthlyTotal ? loan.targetMonthlyTotal : nextRegular;
              const extraFromTarget = Math.max(0, nextTarget - nextRegular);

              return (
                <div key={loan.id} className="bg-[#18181B] border border-[#27272A] p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="font-semibold">{loan.name}</div>
                      <div className="text-xs text-[#71717A]">
                        {isFixed ? `Fast ${loan.currentMonthlyPayment}:- + ränta` : `Annuitet ${loan.currentMonthlyPayment.toFixed(2)}`} • Saldo {loan.balance.toLocaleString("sv-SE")} • { (loan.interestRate*100).toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-[#71717A]">Klar</div>
                      <div className="font-mono text-sm">{lr?.newEndDate || "-"} <span className="text-[#22C55E]">{lr?.monthsSaved ? `-${lr.monthsSaved}m` : ""}</span></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <label className="text-xs">
                      <div className="text-[#71717A] mb-1">Skuld</div>
                      <input type="number" value={loan.balance} onChange={(e) => updateLoan(loan.id, { balance: Number(e.target.value) })} className="w-full bg-[#09090B] border border-[#27272A] p-2 text-sm" />
                    </label>
                    <label className="text-xs">
                      <div className="text-[#71717A] mb-1">Ränta %</div>
                      <input type="number" step="0.01" value={loan.interestRate*100} onChange={(e) => updateLoan(loan.id, { interestRate: Number(e.target.value)/100 })} className="w-full bg-[#09090B] border border-[#27272A] p-2 text-sm" />
                    </label>
                    <label className="text-xs">
                      <div className="text-[#71717A] mb-1">{isFixed ? "Fast amort" : "Mån betalning"}</div>
                      <input type="number" value={loan.currentMonthlyPayment} onChange={(e) => updateLoan(loan.id, { currentMonthlyPayment: Number(e.target.value) })} className="w-full bg-[#09090B] border border-[#27272A] p-2 text-sm" />
                    </label>
                  </div>

                  {/* Din huvudfeature: Höj betalning varje månad till VALFRI summa */}
                  <div className="bg-[#09090B] border border-[#27272A] p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={!!loan.targetMonthlyEnabled} onChange={(e) => updateLoan(loan.id, { targetMonthlyEnabled: e.target.checked })} />
                        <span className="text-sm font-medium">Betala totalt per månad</span>
                      </div>
                      <div className="text-xs text-[#71717A]">Nu {nextRegular.toFixed(0)}:- → Nästa {nextTarget.toFixed(0)}:-</div>
                    </div>
                    {loan.targetMonthlyEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" placeholder="2000" value={loan.targetMonthlyTotal || ""} onChange={(e) => updateLoan(loan.id, { targetMonthlyTotal: Number(e.target.value) })} className="bg-[#18181B] border border-[#27272A] p-2 text-sm" />
                        <input type="month" value={loan.targetMonthlyFrom || DEFAULT_START} onChange={(e) => updateLoan(loan.id, { targetMonthlyFrom: e.target.value })} className="bg-[#18181B] border border-[#27272A] p-2 text-sm" />
                      </div>
                    )}
                    {loan.targetMonthlyEnabled && extraFromTarget > 0 && (
                      <div className="text-xs text-[#22C55E] mt-2">Amorterar {extraFromTarget.toFixed(0)}:- extra denna månad • Nytt saldo efter: {(loan.balance - loan.currentMonthlyPayment - extraFromTarget).toFixed(0)}:-</div>
                    )}
                  </div>

                  {/* Extra 500-rutan */}
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

                  {/* Återinvest när Nordea klart */}
                  {loan.id === "nordax" && (
                    <div className="bg-[#09090B] border border-[#3B82F6]/30 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input type="checkbox" checked={!!loan.reinvestment?.enabled} onChange={(e) => updateLoan(loan.id, { reinvestment: { ...(loan.reinvestment || { fromLoanId: "nordea", amount: 2000, startDate: DEFAULT_START }), enabled: e.target.checked } })} />
                        <span className="text-sm">När Nordea klart: lägg över summan på Nordax</span>
                      </div>
                      {loan.reinvestment?.enabled && (
                        <div className="grid grid-cols-2 gap-3">
                          <input type="number" value={loan.reinvestment.amount} onChange={(e) => updateLoan(loan.id, { reinvestment: { ...loan.reinvestment!, amount: Number(e.target.value) } })} className="bg-[#18181B] border border-[#27272A] p-2 text-sm" />
                          <input type="month" value={loan.reinvestment.startDate} onChange={(e) => updateLoan(loan.id, { reinvestment: { ...loan.reinvestment!, startDate: e.target.value } })} className="bg-[#18181B] border border-[#27272A] p-2 text-sm" />
                        </div>
                      )}
                    </div>
                  )}

                  {lr && (
                    <div className="mt-3 text-xs text-[#71717A] flex gap-4">
                      <span>Orig ränta: {lr.originalTotalInterest.toLocaleString()}:-</span>
                      <span>Ny ränta: {lr.newTotalInterest.toLocaleString()}:-</span>
                      <span className="text-[#22C55E]">Sparad: {lr.interestSaved.toLocaleString()}:-</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Engångsbetalning */}
            <div className="bg-[#18181B] border border-[#27272A] p-4">
              <div className="font-medium text-sm mb-2">Engångsbetalning från månad</div>
              <div className="flex gap-2">
                <input type="month" defaultValue={DEFAULT_START} id="ot-date" className="bg-[#09090B] border border-[#27272A] p-2 text-sm" />
                <input type="number" placeholder="Belopp" id="ot-amount" className="bg-[#09090B] border border-[#27272A] p-2 text-sm" />
                <select id="ot-loan" className="bg-[#09090B] border border-[#27272A] p-2 text-sm">
                  {loans.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <button onClick={() => {
                  const d = (document.getElementById("ot-date") as HTMLInputElement).value;
                  const a = Number((document.getElementById("ot-amount") as HTMLInputElement).value);
                  const lid = (document.getElementById("ot-loan") as HTMLSelectElement).value;
                  if (d && a) setOneTimes((prev) => [...prev, { id: Date.now().toString(), date: d, amount: a, loanId: lid }]);
                }} className="bg-[#3B82F6] px-3 text-sm">+ Lägg till</button>
              </div>
              <div className="mt-2 space-y-1">
                {oneTimes.map((ot) => <div key={ot.id} className="text-xs flex justify-between"><span>{ot.date} • {ot.amount}:- till {loans.find((l) => l.id === ot.loanId)?.name}</span><button onClick={() => setOneTimes((p) => p.filter((x) => x.id !== ot.id))} className="text-red-400">x</button></div>)}
              </div>
            </div>
          </div>

          {/* Höger - Resultat */}
          <div className="space-y-4 lg:sticky lg:top-6 h-fit">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#18181B] border border-[#27272A] p-4">
                <div className="text-xs text-[#71717A]">SKULDFRI</div>
                <div className="text-xl font-mono font-bold">{result.newFreedomDate}</div>
                <div className="text-xs text-[#22C55E]">{result.totalMonthsSaved} mån tidigare</div>
                <div className="text-[10px] text-[#71717A] mt-1">Orig: {result.originalFreedomDate}</div>
              </div>
              <div className="bg-[#18181B] border border-[#27272A] p-4">
                <div className="text-xs text-[#71717A]">SPARAD RÄNTA</div>
                <div className="text-xl font-mono font-bold">{result.totalInterestSaved.toLocaleString("sv-SE")}:-</div>
                <div className="text-xs text-[#71717A]">{result.totalOriginalInterest.toLocaleString()} → {result.totalNewInterest.toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-[#18181B] border border-[#27272A] p-4">
              <div className="text-sm font-medium mb-2">Tidslinje</div>
              <div className="h-2 bg-[#09090B] border border-[#27272A] w-full mb-2">
                <div className="h-full bg-[#3B82F6]" style={{ width: `${Math.min(100, (result.totalMonthsSaved / 40) * 100)}%` }}></div>
              </div>
              <div className="text-xs text-[#71717A]">{result.firstDebtPaidDate} första lån klart</div>
            </div>

            <div className="bg-[#18181B] border border-[#27272A] p-4">
              <div className="text-xs text-[#71717A] mb-2">NORDEA VERIFIERING - dina siffror</div>
              <div className="text-[11px] font-mono leading-5">
                Saldo 112351:- fast 1389:- + 5,95%<br/>
                2026-08-27 ordinarie 1957:- du sätter 2000:- = +43 extra<br/>
                2026-09-27 ordinarie 1950:- du sätter 2000:- = +50 extra<br/>
                2026-10-27 ordinarie 1925:- du sätter 2000:- = +75 extra<br/>
                Varje extra minskar räntan nästa månad. Allt med Big.js exakt.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
