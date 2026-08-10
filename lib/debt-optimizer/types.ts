export type PayoffStrategy = "cascade" | "avalanche" | "snowball";

export interface Loan {
  id: string;
  name: string;
  loanType: "Rak amortering" | "Annuitet";
  balance: number;
  interestRate: number;
  currentMonthlyPayment: number;
  /** Extra varje månad (utöver min) */
  extraMonthly?: number;
  /** true = extra-månadsbetalning aktiv */
  extraMonthlyEnabled?: boolean;
  /** Från vilken månad extra gäller (YYYY-MM). Tom = från startDate */
  extraMonthlyFrom?: string;
}

export interface OneTimePayment {
  id: string;
  date: string; // YYYY-MM
  amount: number;
  /** vilket lån — krävs för tydlighet */
  loanId?: string;
}

export interface StrategyInput {
  loans: Loan[];
  oneTimePayments: OneTimePayment[];
  startDate: string;
  strategy: PayoffStrategy;
  globalExtraMonthly?: number;
  globalExtraTarget?: "priority" | string;
  globalExtraFromDate?: string;
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
  payoffOrder: number;
}

export interface CalculationResult {
  totalOriginalInterest: number;
  totalNewInterest: number;
  totalInterestSaved: number;
  originalFreedomDate: string;
  newFreedomDate: string;
  totalMonthsSaved: number;
  firstDebtPaidDate: string;
  loanResults: LoanResult[];
}