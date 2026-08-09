// lib/debt-optimizer/types.ts
export type AmortizationType = 'annuity' | 'straight' | 'free';

export interface Loan {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  amortizationType: AmortizationType;
  fixedAmortization?: number;
  monthlyFee?: number;
  targetMonthlyPayment?: number;
}

export interface DebtOptimizerInput {
  loans: Loan[];
  monthlyExtraBudget: number;
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
