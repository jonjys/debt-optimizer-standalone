// lib/debt-optimizer/types.ts
export interface Loan {
  id: string;
  name: string;
  balance: number; // Skuld i kr
  interestRate: number; // Årsränta i %
  currentMonthlyPayment: number; // Ordinarie lägsta/avtalad inbetalning
  targetMonthlyPayment?: number; // Önskad inbetalning (t.ex. toppa upp till 2000 kr)
  topUpStartMonthOffset?: number; // Månad när extra inbetalning startar
}

export interface CalculationInput {
  loans: Loan[];
  monthlyExtraBudget: number; // Extra fri budget utöver lånens ordinarie belopp
  extraBudgetStartMonthOffset: number;
  strategy: "avalanche" | "snowball";
  startDate?: Date;
}

export interface Milestone {
  loanId: string;
  loanName: string;
  payoffDate: string;
  monthsToPayoff: number;
  totalInterestPaid: number;
}

export interface CalculationResult {
  freedomDate: string;
  totalMonths: number;
  totalInterestPaid: number;
  totalSavings: number;
  monthsSaved: number;
  milestones: Milestone[];
}
