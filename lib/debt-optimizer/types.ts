export type PayoffStrategy = "cascade" | "avalanche" | "snowball";
export type LoanPaymentStyle = "fixed_amort" | "annuity";

export interface Loan {
  id: string;
  name: string;
  loanType: "Rak amortering" | "Annuitet";
  paymentStyle: LoanPaymentStyle;
  balance: number;
  interestRate: number;
  /** fixed_amort = fast amortering; annuity = min total/mån */
  currentMonthlyPayment: number;
  /** fixed_amort: toppa upp till denna totalsumma */
  targetMonthlyTotal?: number;
  targetMonthlyEnabled?: boolean;
  targetMonthlyFrom?: string;
  /** Extra kr/mån utöver min (alla lånetyper) — manuellt, oberoende av allt annat */
  extraMonthly?: number;
  extraMonthlyEnabled?: boolean;
  extraMonthlyFrom?: string;
  /** Manuell återinvestering: användaren väljer själv att lägga ett annat (avklarat) låns frigjorda belopp här */
  reinvestment?: Reinvestment;
}

export interface Reinvestment {
  enabled: boolean;
  /** vilket lån pengarna kommer från */
  fromLoanId: string;
  /** kr/mån */
  amount: number;
  /** YYYY-MM */
  startDate: string;
}

export interface OneTimePayment {
  id: string;
  date: string;
  amount: number;
  loanId?: string;
}

export interface StrategyInput {
  loans: Loan[];
  oneTimePayments: OneTimePayment[];
  startDate: string;
  strategy: PayoffStrategy;
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
  /** false = never pays off within the 600-month simulation window (payment doesn't outpace interest). newEndDate is "-" in that case. */
  isFullyAmortizing: boolean;
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
