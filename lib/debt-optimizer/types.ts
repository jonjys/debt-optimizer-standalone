// lib/debt-optimizer/types.ts
export type AmortizationType = 'annuity' | 'straight';

export interface Loan {
  id: string;
  name: string;
  balance: number; // Kapitalskuld
  interestRate: number; // Årsränta (%)
  amortizationType: AmortizationType;
  currentMonthlyPayment: number; // Ordinarie betalning (kr/mån)
  targetMonthlyPayment?: number; // Önskad toppning (kr/mån)
  topUpStartMonthOffset?: number; // Månader tills toppning startar (0 = direkt nästa månad)
}

export interface DebtOptimizerInput {
  loans: Loan[];
  monthlyExtraBudget: number; // Extra belopp varje månad
  extraBudgetStartMonthOffset: number; // Hur många månader tills extra budget startar
  strategy: 'avalanche' | 'snowball';
  startDate?: Date;
}

export interface PayoffMilestone {
  loanId: string;
  loanName: string;
  payoffDate: string;
  totalInterestPaid: number;
}

export interface DebtOptimizerResult {
  totalOriginalInterest: number;
  totalOptimizedInterest: number;
  totalSavings: number;
  monthsSaved: number;
  freedomDate: string;
  milestones: PayoffMilestone[];
}
