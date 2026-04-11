import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats a whole number with two decimals", () => {
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats decimals correctly", () => {
    expect(formatCurrency(49.9)).toBe("$49.90");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
  });
});

describe("formatDate", () => {
  it("converts YYYY-MM-DD to DD/MM/YYYY", () => {
    expect(formatDate("2026-04-09")).toBe("09/04/2026");
  });

  it("returns dash for empty string", () => {
    expect(formatDate("")).toBe("-");
  });
});
