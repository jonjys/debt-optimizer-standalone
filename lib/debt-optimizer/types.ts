// lib/debt-optimizer/types.ts
export type AmortizationType = 'annuity' | 'straight';

export interface Loan {
  id: string;
  name: string;
  balance: number; // Kapitalskuld (kr)
  interestRate: number; // Årsränta (%)
  amortizationType: AmortizationType;
  currentMonthlyPayment: number; // Nuvarande ordinarie månadsbetalning (t.ex. 1389 kr)
  targetMonthlyPayment?: number; // Önskad toppning (t.ex. 2000 kr)
  monthlyFee?: number; // Ev. aviavgift
}

export interface DebtOptimizerInput {
  loans: Loan[];
  monthlyExtraBudget: number; // Extra budget utöver alla lånens toppningar
  strategy: 'avalanche' | 'snowball';
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
