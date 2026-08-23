"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Big from "big.js";
import { useMemo, type ReactNode } from "react";
import type { LoanPaymentStyle } from "@/lib/debt-optimizer/types";

export type LoanCardLang = "en" | "sv";

export interface LeasingTerms {
  company: string;
  monthlyCost: number;
  months: number;
  buyPrice: number;
  downPayment: number;
  residualValue: number;
  buyRate: number;
  rateIncrease: number;
}

export interface TimeBox {
  enabled: boolean;
  months: number;
}

const parseNumber = (value: string, max = 10_000_000) => {
  const parsed = Number(
    value.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, ""),
  );
  return Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : 0;
};

const formatNumber = (value: number, lang: LoanCardLang) =>
  Math.round(value).toLocaleString(lang === "sv" ? "sv-SE" : "en-US");

const formatRate = (value: number, lang: LoanCardLang) =>
  String(value).replace(".", lang === "sv" ? "," : ".");

const formatBig = (value: Big, lang: LoanCardLang) =>
  Number(value.toFixed(0)).toLocaleString(
    lang === "sv" ? "sv-SE" : "en-US",
  );

function NumberInput({
  label,
  value,
  onChange,
  lang,
  suffix,
  decimal = false,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  lang: LoanCardLang;
  suffix?: string;
  decimal?: boolean;
  max?: number;
}) {
  return (
    <label className="rounded-2xl border border-white/[.06] bg-black/10 p-3">
      <small className="block uppercase tracking-wider text-white/25">
        {label}
      </small>
      <span className="mt-1 flex h-7 items-center gap-1">
        <input
          spellCheck={false}
          inputMode="decimal"
          value={decimal ? formatRate(value, lang) : formatNumber(value, lang)}
          onChange={(event) => onChange(parseNumber(event.target.value, max))}
          className="w-full bg-transparent text-base outline-none"
        />
        {suffix ? <span className="text-xs text-white/25">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function SortableLoanCard({
  id,
  disabled = false,
  children,
  label,
}: {
  id: string;
  disabled?: boolean;
  children: ReactNode;
  label: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? "z-30 opacity-70" : ""}`}
    >
      {!disabled ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={label}
          className="absolute right-11 top-4 z-10 grid h-8 w-8 touch-none place-items-center rounded-lg border border-white/[.06] bg-white/[.04] text-sm tracking-[-3px] text-white/35 hover:border-blue-400/30 hover:text-blue-200"
        >
          ⋮⋮
        </button>
      ) : null}
      {children}
    </div>
  );
}

export function TimeBoxControl({
  lang,
  value,
  onChange,
}: {
  lang: LoanCardLang;
  value: TimeBox;
  onChange: (value: TimeBox) => void;
}) {
  const sv = lang === "sv";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[.05] bg-black/10 px-3 py-2 text-xs text-white/45">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) =>
            onChange({ ...value, enabled: event.target.checked })
          }
          className="accent-blue-500"
        />
        {sv ? "Kör denna strategi i:" : "Run this strategy for:"}
      </label>
      {value.enabled ? (
        <>
          <input
            inputMode="numeric"
            aria-label={sv ? "Antal månader" : "Number of months"}
            value={value.months}
            onChange={(event) =>
              onChange({
                ...value,
                months: Math.min(600, Math.max(1, parseNumber(event.target.value, 600))),
              })
            }
            className="h-8 w-20 rounded-lg border border-white/[.08] bg-white/[.04] px-2 text-white outline-none"
          />
          <span>{sv ? "Månader" : "Months"}</span>
          <span className="text-white/25">
            {sv ? "sedan flyttas resten sist" : "then the remainder moves last"}
          </span>
        </>
      ) : null}
    </div>
  );
}

export function LeasingLoanFields({
  lang,
  value,
  onChange,
}: {
  lang: LoanCardLang;
  value: LeasingTerms;
  onChange: (value: LeasingTerms) => void;
}) {
  const sv = lang === "sv";
  const calculation = useMemo(() => {
    const months = new Big(Math.max(1, value.months));
    const monthly = new Big(Math.max(0, value.monthlyCost));
    const buyPrice = new Big(Math.max(0, value.buyPrice));
    const downPayment = new Big(Math.max(0, value.downPayment));
    const residual = new Big(Math.max(0, value.residualValue));
    const financed = buyPrice.minus(downPayment);
    const buyNet = financed.minus(residual);
    const effectiveRate = new Big(value.buyRate)
      .plus(value.rateIncrease)
      .div(100)
      .div(12);
    const leasingTotal = monthly.times(months);
    const buyMonthly = buyNet.div(months).plus(financed.times(effectiveRate));
    return {
      leasingTotal,
      buyNet,
      buyMonthly,
      diff: leasingTotal.minus(buyNet),
    };
  }, [value]);

  const set = <Key extends keyof LeasingTerms>(
    key: Key,
    next: LeasingTerms[Key],
  ) => onChange({ ...value, [key]: next });

  return (
    <div className="mt-4 rounded-2xl border border-blue-400/10 bg-blue-500/[.035] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <small className="label">{sv ? "Företag / Bil" : "Company / Car"}</small>
          <input
            spellCheck={false}
            value={value.company}
            onChange={(event) => set("company", event.target.value)}
            className="input"
          />
        </label>
        <NumberInput
          label={sv ? "Månadskostnad" : "Monthly cost"}
          value={value.monthlyCost}
          onChange={(next) => set("monthlyCost", next)}
          lang={lang}
          suffix={sv ? "kr/mån" : "SEK/mo"}
        />
      </div>

      <div className="mt-4 rounded-xl border border-white/[.05] bg-black/10 p-3">
        <div className="flex items-center justify-between gap-3 text-xs text-white/40">
          <span>{sv ? "Hyrtid" : "Lease term"}</span>
          <b className="text-white/70">{value.months} {sv ? "mån" : "mo"}</b>
        </div>
        <div className="mt-3 flex gap-2">
          {[12, 24, 36].map((months) => (
            <button
              type="button"
              key={months}
              aria-pressed={value.months === months}
              onClick={() => set("months", months)}
              className={`pill ${value.months === months ? "active" : ""}`}
            >
              {months}
            </button>
          ))}
        </div>
        <input
          type="range"
          min="12"
          max="60"
          value={value.months}
          onChange={(event) => set("months", Number(event.target.value))}
          className="mt-2 min-h-11 w-full accent-blue-500"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberInput
          label={sv ? "Köpa bil" : "Buy car"}
          value={value.buyPrice}
          onChange={(next) => set("buyPrice", next)}
          lang={lang}
        />
        <NumberInput
          label={sv ? "Kontant" : "Down payment"}
          value={value.downPayment}
          onChange={(next) => set("downPayment", next)}
          lang={lang}
        />
        <NumberInput
          label={sv ? "Restvärde" : "Residual value"}
          value={value.residualValue}
          onChange={(next) => set("residualValue", next)}
          lang={lang}
        />
        <NumberInput
          label={sv ? "Ränta köp" : "Purchase rate"}
          value={value.buyRate}
          onChange={(next) => set("buyRate", next)}
          lang={lang}
          suffix="%"
          decimal
          max={30}
        />
      </div>

      <label className="mt-4 block text-xs text-white/40">
        <span className="flex justify-between gap-3">
          <span>{sv ? "Om räntan går upp" : "If the rate rises"}</span>
          <b className="text-orange-300">+{formatRate(value.rateIncrease, lang)} %</b>
        </span>
        <input
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={value.rateIncrease}
          onChange={(event) => set("rateIncrease", Number(event.target.value))}
          className="mt-2 min-h-11 w-full accent-orange-500"
        />
      </label>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-white/[.035] p-3">
          <span className="text-white/35">{sv ? "Total hyrkostnad" : "Total lease cost"}</span>
          <b className="mt-1 block">{formatBig(calculation.leasingTotal, lang)} kr</b>
        </div>
        <div className="rounded-xl bg-white/[.035] p-3">
          <span className="text-white/35">{sv ? "Månad om köp" : "Monthly if buying"}</span>
          <b className="mt-1 block">{formatBig(calculation.buyMonthly, lang)} kr</b>
        </div>
        <div className={`rounded-xl p-3 ${calculation.diff.gt(0) ? "bg-orange-500/10 text-orange-200" : "bg-emerald-500/10 text-emerald-200"}`}>
          <span className="opacity-65">Leasing</span>
          <b className="mt-1 block">
            {formatBig(calculation.diff.abs(), lang)} kr {calculation.diff.gt(0) ? (sv ? "dyrare" : "more") : sv ? "billigare" : "less"}
          </b>
        </div>
      </div>
    </div>
  );
}

export function CreditLoanMetrics({
  lang,
  balance,
  interestRate,
  monthlyPayment,
  paymentStyle,
}: {
  lang: LoanCardLang;
  balance: number;
  interestRate: number;
  monthlyPayment: number;
  paymentStyle: LoanPaymentStyle;
}) {
  const sv = lang === "sv";
  const calculation = useMemo(() => {
    const balanceBig = new Big(Math.max(0, balance));
    const payment = new Big(Math.max(0, monthlyPayment));
    const monthlyRate = new Big(Math.max(0, interestRate)).div(12);
    const interest = balanceBig.times(monthlyRate);
    const amortization = payment.minus(interest);
    const share = payment.gt(0) ? interest.div(payment).times(100) : new Big(100);
    let payoffBalance = balanceBig;
    let payoffMonths = 0;
    while (payoffBalance.gt(0) && payoffMonths < 600) {
      const monthInterest = payoffBalance.times(monthlyRate);
      const principal =
        paymentStyle === "fixed_amort" ? amortization : payment.minus(monthInterest);
      if (principal.lte(0)) break;
      payoffBalance = payoffBalance.minus(
        principal.lt(payoffBalance) ? principal : payoffBalance,
      );
      payoffMonths++;
    }
    return { interest, amortization, share, payoffMonths };
  }, [balance, interestRate, monthlyPayment, paymentStyle]);

  const interestText = formatBig(calculation.interest, lang);
  const amortizationText = formatBig(calculation.amortization, lang);
  const shareText = formatBig(calculation.share, lang);
  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-xl border border-white/[.05] bg-black/10 p-3 text-xs leading-5 text-white/50">
        <b className="text-white/75">
          {sv ? "Ränta denna månad" : "Interest this month"}: {interestText} kr
        </b>{" "}
        · {sv ? "Amortering" : "Principal"}: {amortizationText} kr
        <br />
        {sv
          ? `Av dina ${formatNumber(monthlyPayment, lang)} kr går ${interestText} kr till ränta. Endast ${amortizationText} kr betalar av skulden. Du betalar ${shareText} % ränta.`
          : `Of SEK ${formatNumber(monthlyPayment, lang)}, SEK ${interestText} goes to interest. Only SEK ${amortizationText} reduces the debt. ${shareText}% is interest.`}
        {calculation.amortization.gt(0) && calculation.payoffMonths < 600 ? (
          <span className="mt-1 block text-blue-300">
            {sv ? "Skuldfri om cirka" : "Debt-free in about"} {calculation.payoffMonths} {sv ? "mån" : "months"}
          </span>
        ) : null}
      </div>
      {calculation.amortization.lte(0) ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {sv
            ? `Månadskostnaden täcker inte räntan. Skulden växer med ${formatBig(calculation.interest.minus(monthlyPayment), lang)} kr/mån. Höj till minst ${formatBig(calculation.interest.plus(100), lang)} kr.`
            : `The monthly payment does not cover interest. The debt grows by SEK ${formatBig(calculation.interest.minus(monthlyPayment), lang)}/month. Raise it to at least SEK ${formatBig(calculation.interest.plus(100), lang)}.`}
        </div>
      ) : calculation.share.gt(75) ? (
        <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 text-xs text-orange-200">
          {sv ? "Du betalar nästan bara ränta." : "Almost all of your payment goes to interest."}
        </div>
      ) : null}
    </div>
  );
}
