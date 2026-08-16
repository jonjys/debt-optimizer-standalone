"use client";
import { useState, useMemo } from "react";
import { calculatePayoffSchedule } from "@/lib/debt-optimizer/engine";
import type { Loan, OneTimePayment } from "@/lib/debt-optimizer/types";

const DEFAULT_START = "2026-01";
const EMPTY_LOANS: Loan[] = [];
const TEST_LOANS: Loan[] = [
  { id: "nordea", name: "Nordea", loanType: "Rak amortering", paymentStyle: "fixed_amort" as const, balance: 112351, interestRate: 0.0595, currentMonthlyPayment: 1389, targetMonthlyTotal: 2000, targetMonthlyEnabled: true, targetMonthlyFrom: DEFAULT_START, extraMonthly: 0, extraMonthlyEnabled: false, extraMonthlyFrom: DEFAULT_START },
  { id: "nordax", name: "Nordax", loanType: "Annuitet", paymentStyle: "annuity" as const, balance: 593689, interestRate: 0.0909, currentMonthlyPayment: 6887.77, targetMonthlyTotal: 0, targetMonthlyEnabled: false, targetMonthlyFrom: DEFAULT_START, extraMonthly: 0, extraMonthlyEnabled: false, extraMonthlyFrom: DEFAULT_START, reinvestment: { enabled: true, fromLoanId: "nordea", amount: 2000, startDate: "2030-01" } },
];

export default function DebtOptimizerView() {
  const [loans, setLoans] = useState<Loan[]>(EMPTY_LOANS);
  const [oneTimes, setOneTimes] = useState<OneTimePayment[]>([]);
  const isDev = process.env.NODE_ENV === "development";
  const result = useMemo(() => loans.length? calculatePayoffSchedule({ loans, oneTimePayments: oneTimes, startDate: DEFAULT_START, strategy: "custom" }) : null, [loans, oneTimes]);

  const updateLoan = (id: string, p: Partial<Loan>) => setLoans(prev => prev.map(l => l.id===id? {...l,...p} : l));
  const addLoan = () => setLoans(prev => [...prev, { id: Date.now().toString(), name: `Lån ${prev.length+1}`, loanType: "Annuitet", paymentStyle: "annuity", balance: 100000, interestRate: 0.05, currentMonthlyPayment: 2000, targetMonthlyTotal: 0, targetMonthlyEnabled: false, targetMonthlyFrom: DEFAULT_START, extraMonthly: 0, extraMonthlyEnabled: false, extraMonthlyFrom: DEFAULT_START }]);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] p-4 md:p-6 overflow-x-hidden">
      <div className="max-w- mx-auto">
        <h1 className="text- md:text- font-bold mb-2 tracking-tight">Lånekalkylator</h1>
        <p className="text-[#A1A1AA] text- md:text- mb-6 md:mb-8">Se exakt vad extra betalning gör med dina lån</p>

        {isDev && <button onClick={() => setLoans(TEST_LOANS)} className="mb-4 bg-purple-600 px-4 py-2 rounded text-sm">test-lån-fredde</button>}

        {loans.length===0 && (
          <div className="bg-[#18181B] border border-[#27272A] p-6 md:p-10 rounded-xl text-center">
            <h2 className="text- md:text- font-semibold mb-3">Kom igång</h2>
            <p className="text-[#A1A1AA] text- md:text- leading-relaxed mb-6">
              Lägg till dina lån och se direkt hur mycket ränta och tid du sparar<br className="hidden sm:block"/>
              genom att betala lite extra varje månad.
            </p>
            <button onClick={addLoan} className="bg-[#3B82F6] hover:bg-[#2563EB] w-full sm:w-auto px-8 py-4 rounded-lg text- font-medium">+ Lägg till ditt första lån</button>
            <div className="mt-8 pt-6 border-t border-[#27272A] text- text-[#71717A]">100% privat • Inget sparas online • Big.js för exakt matte</div>
          </div>
        )}

        <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-6 mt-6">
          <div className="space-y-4 min-w-0">
            {loans.map(loan => {
              const lr = result?.loanResults.find(r=>r.id===loan.id);
              const monthlyRate = loan.interestRate/12;
              const interestPart = loan.balance * monthlyRate;
              const baseAmort = loan.paymentStyle==="fixed_amort"? loan.currentMonthlyPayment : Math.max(0, loan.currentMonthlyPayment - interestPart);
              const newTotal = loan.targetMonthlyEnabled? (loan.targetMonthlyTotal||0) : loan.currentMonthlyPayment;
              const newAmort = Math.max(0, newTotal - interestPart);
              return (
                <div key={loan.id} className="bg-[#18181B] border border-[#27272A] p-4 rounded-lg">
                  <div className="flex justify-between mb-3">
                    <input value={loan.name} onChange={e=>updateLoan(loan.id,{name:e.target.value})} className="bg-transparent font-semibold text- border-b border-transparent focus:border-[#3B82F6] outline-none" />
                    <div className="text-right"><div className="text- text-[#71717A]">KLAR</div><div className="font-mono text-">{lr?.newEndDate||"-"} <span className="text-[#22C55E]">{lr?.monthsSaved? `-${lr.monthsSaved}m`: ""}</span></div></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <label className="text-"><div className="text-[#71717A] mb-1">Skuld</div><input type="number" min={0} max={9999999} value={loan.balance} onChange={e=>updateLoan(loan.id,{balance:Number(e.target.value)})} className="w-full bg-[#09090B] border border-[#27272A] p- text- rounded" /></label>
                    <label className="text-"><div className="text-[#71717A] mb-1">Ränta %</div><input type="number" step="0.01" value={loan.interestRate*100} onChange={e=>updateLoan(loan.id,{interestRate:Number(e.target.value)/100})} className="w-full bg-[#09090B] border border-[#27272A] p- text- rounded" /></label>
                    <label className="text-"><div className="text-[#71717A] mb-1">{loan.paymentStyle==="fixed_amort"?"Fast amort":"Mån betalning"}</div><input type="number" value={loan.currentMonthlyPayment} onChange={e=>updateLoan(loan.id,{currentMonthlyPayment:Number(e.target.value)})} className="w-full bg-[#09090B] border border-[#27272A] p- text- rounded" /></label>
                  </div>

                  <div className="bg-[#09090B] border border-[#27272A] p-3 mb-3 rounded">
                    <div className="flex items-center gap-2 mb-2"><input type="checkbox" checked={!!loan.targetMonthlyEnabled} onChange={e=>updateLoan(loan.id,{targetMonthlyEnabled:e.target.checked})} className="w-4 h-4" /><span className="text- font-medium">Betala ny summa varje månad</span></div>
                    {loan.targetMonthlyEnabled? (
                      <div>
                        <div className="grid grid-cols-2 gap-3"><div><div className="text- text-[#71717A]">Min totala månadskostnad</div><input type="number" min={0} max={99999} placeholder="2500" value={loan.targetMonthlyTotal||""} onChange={e=>updateLoan(loan.id,{targetMonthlyTotal:Number(e.target.value)})} className="w-full bg-[#18181B] border border-[#27272A] p-2 text- rounded" /></div><div><div className="text- text-[#71717A]">Från</div><input type="month" value={loan.targetMonthlyFrom||DEFAULT_START} onChange={e=>updateLoan(loan.id,{targetMonthlyFrom:e.target.value})} className="w-full bg-[#18181B] border border-[#27272A] p-2 text- rounded" /></div></div>
                        <div className="mt-2 text- text-[#A1A1AA]">Av <span className="text-white font-mono">{newTotal.toFixed(0)}:-</span> är <span className="text-white">{interestPart.toFixed(0)}:- ränta</span> + <span className="text-[#22C55E]">{newAmort.toFixed(0)}:- amortering</span> • Idag {loan.currentMonthlyPayment.toFixed(0)}:- ({baseAmort.toFixed(0)}:- amort)</div>
                      </div>
                    ) : <div className="text- text-[#71717A]">Betalar idag {loan.currentMonthlyPayment.toFixed(0)}:- /mån varav {interestPart.toFixed(0)}:- är ränta</div>}
                  </div>

                  <div className="bg-[#09090B] border border-[#27272A] p-3 rounded">
                    <div className="text- font-medium mb-2">Extra betalningar för detta lån</div>
                    <div className="flex gap-2 mb-2 flex-wrap"><input type="month" defaultValue={DEFAULT_START} id={`ex-date-${loan.id}`} className="bg-[#18181B] border border-[#27272A] p-2 text- flex-1 min-w- rounded" /><input type="text" placeholder="Skatteåterbäring" id={`ex-label-${loan.id}`} className="bg-[#18181B] border border-[#27272A] p-2 text- flex-1 min-w- rounded" /><input type="number" placeholder="15000" id={`ex-amt-${loan.id}`} className="bg-[#18181B] border border-[#27272A] p-2 text- w-24 rounded" /><button onClick={()=>{const d=(document.getElementById(`ex-date-${loan.id}`) as HTMLInputElement).value; const lab=(document.getElementById(`ex-label-${loan.id}`) as HTMLInputElement).value; const a=Number((document.getElementById(`ex-amt-${loan.id}`) as HTMLInputElement).value); if(d&&a) setOneTimes(p=>[...p,{id:Date.now().toString(), date:d, amount:a, loanId:loan.id, label:lab}] as any);}} className="bg-[#3B82F6] px-3 text- rounded">+ Lägg till</button></div>
                    <div className="space-y-1">{oneTimes.filter(ot=>ot.loanId===loan.id).map(ot=><div key={ot.id} className="flex justify-between text- bg-[#18181B] p-2 rounded"><span>{ot.date} • {(ot as any).label||"Extra"} • {ot.amount}:- </span><div className="flex gap-2"><button onClick={()=>{const copy={...ot, id:Date.now().toString()}; setOneTimes(p=>[...p,copy]);}} className="text-[#3B82F6]">kopiera</button><button onClick={()=>setOneTimes(p=>p.filter(x=>x.id!==ot.id))} className="text-red-400">x</button></div></div>)}</div>
                    {lr && <div className="mt-3 text- text-[#71717A] flex gap-3 flex-wrap"><span>Orig ränta: {lr.originalTotalInterest.toLocaleString()}:-</span><span>Ny: {lr.newTotalInterest.toLocaleString()}:-</span><span className="text-[#22C55E]">Sparad: {lr.interestSaved.toLocaleString()}:-</span></div>}
                  </div>
                </div>
              )
            })}
            {loans.length>0 && <button onClick={addLoan} className="w-full bg-zinc-800 border border-[#27272A] py-3 text-sm rounded">+ Lägg till lån</button>}
          </div>
          <div className="space-y-4 lg:sticky lg:top-6 h-fit">
            {result? <><div className="grid grid-cols-2 gap-3"><div className="bg-[#18181B] border border-[#27272A] p-4 rounded-lg"><div className="text- text-[#71717A]">SKULDFRI</div><div className="text-xl font-mono">{result.newFreedomDate}</div><div className="text-xs text-[#22C55E]">{result.totalMonthsSaved} mån tidigare</div></div><div className="bg-[#18181B] border border-[#27272A] p-4 rounded-lg"><div className="text- text-[#71717A]">SPARAD RÄNTA</div><div className="text-xl font-mono">{result.totalInterestSaved.toLocaleString()}:-</div></div></div></> : null}
            {loans.length>0 && <div className="bg-[#18181B] border border-[#27272A] p-4 rounded-lg text-sm text-[#71717A]">Lägg till lån för att se resultat</div>}
          </div>
        </div>
      </div>
    </div>
  )
}