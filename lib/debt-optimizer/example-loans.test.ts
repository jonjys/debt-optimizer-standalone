import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOAN_PRESETS } from "./example-loans";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Personal financial data (the founder's real loan numbers) must never
// appear in the file that ships to production. This checks both the raw
// source text (catches it however it's written — string, template literal,
// comment, etc.) and the parsed preset data itself.
const FORBIDDEN_STRINGS = ["Nordax", "Nordea", "589111", "112351", "112455"];

describe("exampleLoansContainNoPersonalData", () => {
  it("example-loans.ts source contains none of the founder's personal loan identifiers", () => {
    const source = fs.readFileSync(path.join(__dirname, "example-loans.ts"), "utf-8");
    for (const forbidden of FORBIDDEN_STRINGS) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("no preset loan name or id matches personal/bank-identifying data", () => {
    for (const preset of LOAN_PRESETS) {
      for (const loan of preset.loans) {
        for (const forbidden of FORBIDDEN_STRINGS) {
          expect(loan.name).not.toContain(forbidden);
          expect(loan.id).not.toContain(forbidden);
          expect(String(loan.balance)).not.toBe(forbidden);
        }
      }
    }
  });

  it("ships at least the three required presets: SME, private, and empty template", () => {
    const ids = LOAN_PRESETS.map((p) => p.id);
    expect(ids).toContain("sme");
    expect(ids).toContain("private");
    expect(ids).toContain("empty");
  });
});
