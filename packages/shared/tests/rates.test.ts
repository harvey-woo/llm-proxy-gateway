import { describe, it, expect } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  CurrencySchema,
  CURRENCY_SYMBOLS,
  ExchangeRateResponseSchema,
  PreferredCurrencyResponseSchema,
  PreferredCurrencyRequestSchema,
} from "../src/schemas/rates.js";

describe("CurrencySchema", () => {
  it("should accept all supported currencies", () => {
    for (const c of SUPPORTED_CURRENCIES) {
      const result = CurrencySchema.safeParse(c);
      expect(result.success).toBe(true);
    }
  });

  it("should reject unsupported currency", () => {
    const result = CurrencySchema.safeParse("INR");
    expect(result.success).toBe(false);
  });

  it("should reject empty string", () => {
    const result = CurrencySchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("CURRENCY_SYMBOLS", () => {
  it("should have symbols for all supported currencies", () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(CURRENCY_SYMBOLS[c]).toBeDefined();
      expect(CURRENCY_SYMBOLS[c].length).toBeGreaterThan(0);
    }
  });

  it("should have $ for USD", () => {
    expect(CURRENCY_SYMBOLS["USD"]).toBe("$");
  });

  it("should have ¥ for CNY", () => {
    expect(CURRENCY_SYMBOLS["CNY"]).toBe("¥");
  });
});

describe("ExchangeRateResponseSchema", () => {
  it("should parse a valid exchange rate response", () => {
    const result = ExchangeRateResponseSchema.safeParse({
      base: "USD",
      rates: { CNY: 7.2, EUR: 0.92 },
      updated_at: "2026-05-31T00:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.base).toBe("USD");
      expect(result.data.rates.CNY).toBe(7.2);
    }
  });

  it("should default base to USD", () => {
    const result = ExchangeRateResponseSchema.safeParse({
      rates: { CNY: 7.2 },
      updated_at: "2026-05-31T00:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.base).toBe("USD");
    }
  });

  it("should reject missing rates", () => {
    const result = ExchangeRateResponseSchema.safeParse({
      base: "USD",
      updated_at: "2026-05-31T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("PreferredCurrencyResponseSchema", () => {
  it("should parse with valid currency", () => {
    const result = PreferredCurrencyResponseSchema.safeParse({
      currency: "CNY",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("CNY");
    }
  });

  it("should default to USD when missing", () => {
    const result = PreferredCurrencyResponseSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
    }
  });

  it("should reject invalid currency", () => {
    const result = PreferredCurrencyResponseSchema.safeParse({
      currency: "INR",
    });
    expect(result.success).toBe(false);
  });
});

describe("PreferredCurrencyRequestSchema", () => {
  it("should parse a valid request", () => {
    const result = PreferredCurrencyRequestSchema.safeParse({
      currency: "EUR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("EUR");
    }
  });

  it("should reject missing currency", () => {
    const result = PreferredCurrencyRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject invalid currency", () => {
    const result = PreferredCurrencyRequestSchema.safeParse({
      currency: "INR",
    });
    expect(result.success).toBe(false);
  });
});
