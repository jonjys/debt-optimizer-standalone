export type PayoffStrategy = "cascade" | "avalanche" | "snowball";

/**
 * fixed_amort = rak amortering (t.ex. Nordea 1389 + ränta)
 *   → targetMonthlyTotal: toppa upp till t.ex. 2000 kr totalt
 * annuity = annuitet (fast total, t.ex. Nordax 6888)
 *   → extraMonthly: extra ovanpå min
 */
export type LoanPaymentStyle = "fixed_amort" | "annuity";

export interface Loan {
  id: string;
  name: string;
  loanType: "Rak amortering" | "Annuitet";
  /** fixed_amort | annuity — styr hur betalning beräknas */
  paymentStyle: LoanPaymentStyle;
  balance: number;
  interestRate: number;
  /** Min amortering (fixed_amort) ELLER min totalbetalning (annuity) */
  currentMonthlyPayment: number;
  /**
   * fixed_amort: toppa upp till detta TOTALbelopp varje månad (t.ex. 2000).
   * Extra amortering = target - (amortering + månadens ränta).
   */
  targetMonthlyTotal?: number;
  targetMonthlyEnabled?: boolean;
  targetMonthlyFrom?: string; // YYYY-MM
  /** annuity: extra kr ovanpå min total */
  extraMonthly?: number;
  extraMonthlyEnabled?: boolean;
  extraMonthlyFrom?: string;
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