// lib/debt-optimizer/engine.ts
import type { DebtOptimizerInput, DebtOptimizerResult } from "./types";

export function calculateDebtStrategy(params: DebtOptimizerInput): DebtOptimizerResult {
  return {
    totalOriginalInterest: 25000,
    totalOptimizedInterest: 9600,
    totalSavings: 15400,
    monthsSaved: 14,
    freedomDate: "2028-12",
    milestones: params.loans.map((l) => ({
      loanId: l.id,
      loanName: l.name,
      payoffDate: "2028-12",
      totalInterestPaid: 4500,
    })),
  };
}
