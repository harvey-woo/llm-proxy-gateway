import { z } from "zod";

/**
 * Supported currencies for exchange rate display
 */
export const SUPPORTED_CURRENCIES = [
  "USD",
  "CNY",
  "EUR",
  "JPY",
  "GBP",
  "HKD",
  "TWD",
  "KRW",
  "SGD",
] as const;

export const CurrencySchema = z.enum(SUPPORTED_CURRENCIES);

export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Currency symbol mapping
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  JPY: "¥",
  GBP: "£",
  HKD: "HK$",
  TWD: "NT$",
  KRW: "₩",
  SGD: "S$",
};

/**
 * Exchange rate response from /api/rates
 */
export const ExchangeRateResponseSchema = z.object({
  base: z.string().default("USD"),
  rates: z.record(z.string(), z.number()),
  updated_at: z.string(),
});

export type ExchangeRateResponse = z.infer<typeof ExchangeRateResponseSchema>;

/**
 * Preferred currency response
 */
export const PreferredCurrencyResponseSchema = z.object({
  currency: CurrencySchema.default("USD"),
});

export type PreferredCurrencyResponse = z.infer<
  typeof PreferredCurrencyResponseSchema
>;

/**
 * Preferred currency update request
 */
export const PreferredCurrencyRequestSchema = z.object({
  currency: CurrencySchema,
});

export type PreferredCurrencyRequest = z.infer<
  typeof PreferredCurrencyRequestSchema
>;
