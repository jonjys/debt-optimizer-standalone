export interface Loan {
  id: string;
  name: string;
  loanType: "Rak amortering" | "Annuitet";
  balance: number;
  interestRate: number; // decimal, e.g. 0.0595
  currentMonthlyPayment: number;
  targetMonthlyPayment?: number;
  extraPaymentFromStart?: number;
  extraPaymentAfterFreed?: number;
}

export interface OneTimePayment {
  id: string;
  date: string; // "YYYY-MM" e.g. "2028-04"
  amount: number;
}

export interface StrategyInput {
  loans: Loan[];
  oneTimePayments: OneTimePayment[];
  startDate: string; // "YYYY-MM"
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