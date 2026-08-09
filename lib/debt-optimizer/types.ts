// lib/debt-optimizer/types.ts
export interface Loan {
  id: string;
  name: string;
  loanType: "Rak amortering" | "Annuitet";
  balance: number; // Skuld idag
  interestRate: number; // Ränta i decimal (t.ex. 0.0595 = 5.95%)
  currentMonthlyPayment: number; // Ord. Betalning/mån
  targetMonthlyPayment?: number; // Målbelopp (Toppa upp till, t.ex. 2000)
  extraPaymentFromStart?: number; // Extra amortering från start
  extraPaymentAfterFreed?: number; // Extra amortering efter föregående lån är klart
}

export interface StrategyInput {
  loans: Loan[];
  oneTimePaymentAmount: number; // Engångsinbetalning (t.ex. 10 000 kr)
  oneTimePaymentDate: string; // T.ex. "2028-04"
  startDate: string; // T.ex. "2026-08"
}

export interface LoanResult {
  id: string;
  name: string;
  originalEndDate: string;
  originalTotalInterest: number;
  newEndDate: string;
  newTotalInterest: number;
  interestSaved: number;
  monthsSaved: number;
}

export interface CalculationResult {
  totalOriginalInterest: number;
  totalNewInterest: number;
  totalInterestSaved: number;
  originalFreedomDate: string;
  newFreedomDate: string;
  totalMonthsSaved: number;
  loanResults: LoanResult[];
}
