export type PayoffStrategy = "cascade" | "avalanche" | "snowball";

export interface Loan {
  id: string;
  name: string;
  loanType: "Rak amortering" | "Annuitet";
  balance: number;
  interestRate: number; // decimal e.g. 0.0595
  currentMonthlyPayment: number;
  /** Toppa upp / extra varje månad på just detta lån (utöver min) */
  extraMonthly?: number;
  /** Om true: när föregående lån i ordningen är klart, läggs dess hela betalning hit */
  receiveCascade?: boolean;
}

export interface OneTimePayment {
  id: string;
  date: string; // YYYY-MM
  amount: number;
  /** optional: target loan id, otherwise first active in order */
  loanId?: string;
}

export interface StrategyInput {
  loans: Loan[];
  oneTimePayments: OneTimePayment[];
  startDate: string; // YYYY-MM
  strategy: PayoffStrategy;
  /** Global extra budget som alltid går till prioritets-lånet */
  globalExtraMonthly?: number;
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