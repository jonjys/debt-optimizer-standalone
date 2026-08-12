# debt-optimizer-standalone

> **VIKTIGT: Detta är en MVP som ska dö.**
> 
> All kod här kommer porteras till `github.com/jonjys/Fred-platform` som **Modul 2: Debt Optimization** under `/lib/decision-engine/modules/debt-optimization/`
> 
> Bygg inget nytt här som bryter mot FREDs `DecisionEngine<TInput, TResult>` kontrakt.

## Vad gör appen?

Debt Optimizer räknar ut snabbaste vägen att bli skuldfri genom att simulera extra amorteringar och snöbolls/lavin-metoden. Används för att testa UX och kalkyl-logik innan vi integrerar i FRED – AI Business Decision OS.

**Mål:** Bevisa att SME CFOs vill betala 990kr/mån för att veta exakt vilket lån de ska betala av först.

## Status 2026-08-12

**Fungerar:**
- Lägg till flera lån med ränta, belopp, månadsbetalning
- Räkna ut SKULDFRI-datum med lavin/snöboll
- Simulera extra månadsbetalning
- Visa besparing i ränta + tid

**P0 BUGGAR – Måste fixas innan portning:**

1. **Engångsbetalning uppdaterar inte SKULDFRI-datum**
   - Felet: Kalkyl-loopen i `calculatePayoffSchedule()` räknar inte om resterande saldo efter engångsbetalning applicerats
   - Impact: Användare tror att 50k extra inte hjälper. Dödar förtroende = 0 konvertering
   - Fix: Applicera `oneTimePayment` på `balance` innan nästa månad-loop startar

2. **Auto-kaskad skrämmer användare**
   - Felet: När Lån 1 är betalt flyttas betalningen automatiskt till Lån 2 utan att fråga
   - Impact: CFOs vill ha kontroll. Auto = "vad hände med mina pengar?" 
   - Fix: Manuell reinvestment. Ny UI: Alert "Lån 1 klart!" → Checkbox "Använd frigjort belopp X kr/mån" → Slider för belopp → Datumväljare för start → Live-uppdatering av nytt skuldfri-datum

## Arkitektur
debt-optimizer-standalone/
├── app/
│   ├── page.tsx              # Input form
│   └── results/page.tsx      # Output + charts
├── lib/
│   ├── calculator.ts         # P0: Innehåller buggen med engångsbetalning
│   └── types.ts              # Loan, Payment, Result types
└── components/
    └── LoanForm.tsx          # P0: Saknar manual reinvestment UI

## Portning till FRED-platform

När vi flyttar detta till huvudrepot ska det se ut så här:

**Path:** `Fred-platform/lib/decision-engine/modules/debt-optimization/`

**Filer som skapas:**

1. **`types.ts`**
```ts
export interface DebtOptimizationInput {
  loans: Loan[]
  strategy: 'avalanche' | 'snowball'
  extraMonthlyPayment?: number
  oneTimePayments?: OneTimePayment[]
  manualReinvestments?: ManualReinvestment[]
}

export interface ManualReinvestment {
  enabled: boolean
  fromLoanId: string 
  toLoanId: string
  amount: number
  startDate: string
}

export interface DebtOptimizationResult {
  payoffDate: string
  totalInterestPaid: number
  monthsSaved: number
  schedule: PaymentSchedule[]
  recommendation: 'BUY' | 'NEGOTIATE' | 'REJECT'
}

2.  engine.ts

import { DecisionEngine } from '../../engine-interface'

export class DebtOptimizationEngine implements DecisionEngine<DebtOptimizationInput, DebtOptimizationResult> {
  async analyze(input: DebtOptimizationInput): Promise<Decision<DebtOptimizationResult>> {
    // Kalkyl-logik från calculator.ts men med buggen fixad
    // Ingen auto-kaskad. Kolla manualReinvestments[]
  }
}

3.  index.ts

export default new DebtOptimizationEngine()

Tester som måste gröna innan merge i FRED:
1.  test('oneTimePaymentReducesEndDate') – 50k extra ska kapa 12+ månader
2.  test('manualReinvestmentReducesEndDate') – Checkbox + slider ska uppdatera datum live
3.  test('noAutoTransfer') – Utan manualReinvestment ska frigjort belopp INTE flyttas
Kör lokalt

npm install
npm run dev

Öppna localhost
Nästa steg
1.  Fixa P0-buggen med engångsbetalning i lib/calculator.ts
2.  Bygg ny UI för manuell reinvestment i components/LoanForm.tsx
3.  Skriv 3 vitest för att låsa beteendet
4.  När allt grönt → Porta till Fred-platform enligt struktur ovan
5.  Arkivera detta repo
Regler
1.  MERGE ALWAYS: När npm run build + npm test är gröna, merge direkt
2.  MOBILE-FIRST: Testa på 390px width. 90% använder iPhone
3.  REVENUE > PERFECTION: Om en feature inte hjälper en CFO spara 100k+ i ränta, bygg den inte
￼
Ägare: @jonjys  
Del av: FRED – AI Business Decision OS  
Slutmål: 30k MKR så founder kan säga upp 7-16 jobbet
