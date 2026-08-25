export type PayoffStrategy = "custom" | "avalanche" | "snowball";
export type LoanPaymentStyle = "fixed_amort" | "annuity";

export interface Loan {
  id: string;
  name: string;
  loanType: "Rak amortering" | "Annuitet";
  paymentStyle: LoanPaymentStyle;
  balance: number; // återstående
  interestRate: number; // 0.0595 = 5.95%
  currentMonthlyPayment: number; // dagens totala månadskostnad (ränta + amortering)

  /**
   * Rak amortering: det belopp som går till att minska skulden varje månad.
   * Det är den siffra banken anger, och den som är fast — månadskostnaden
   * är amortering + ränta och sjunker med tiden.
   *
   * Utan den här härleds amorteringen ur månadskostnaden minus räntan, vilket
   * betyder att en ändrad ränta tyst ändrar amorteringen. Så fungerar inte
   * ett lån med rak amortering.
   */
  monthlyPrincipal?: number;

  // NY LOGIK: "Höj betalning varje månad till VALFRI summa"
  targetMonthlyTotal?: number; // ex 2000 för Nordea, 7000 för Nordax
  targetMonthlyEnabled?: boolean;
  targetMonthlyFrom?: string; // YYYY-MM, från när ska höjningen gälla

  // Extra amortering/mån oberoende av target - "Betala extra 500"
  extraMonthly?: number;
  extraMonthlyEnabled?: boolean;
  extraMonthlyFrom?: string; // YYYY-MM

  // Avgifter - REN INFO, används aldrig i kalkyl
  feesMonthly?: number;

  // Manuell återinvestering när annat lån är klart
  reinvestment?: Reinvestment;
}

export interface Reinvestment {
  enabled: boolean;
  fromLoanId: string; // vilket lån pengarna kommer från
  amount: number; // kr/mån frigjort belopp att lägga här
  startDate: string; // YYYY-MM, när ska återinvest börja (efter att fromLoan är klart)
}

export interface OneTimePayment {
  id: string;
  date: string; // YYYY-MM
  amount: number;
  loanId?: string; // vilket lån, om tomt fördelas ej automatiskt (vi lägger på valt lån)
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

