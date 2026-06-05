import { ref, computed, watch } from "vue";
import { useApi } from "./useApi";
import {
  CURRENCY_SYMBOLS,
  SUPPORTED_CURRENCIES,
} from "@llm-proxy/shared/schemas";

const STORAGE_KEY = "llm-proxy-preferred-currency";

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  updated_at: string;
}

const preferredCurrency = ref<string>(
  localStorage.getItem(STORAGE_KEY) || "USD",
);

const rates = ref<ExchangeRates | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

export function useExchangeRates() {
  const api = useApi();

  /**
   * Fetch exchange rates from the API
   */
  async function fetchRates() {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.get<ExchangeRates>("/api/rates");
      if (res.success && res.data) {
        rates.value = res.data;
      } else {
        error.value = res.error || "Failed to fetch exchange rates";
      }
    } catch (e: any) {
      error.value = e.message || "Failed to fetch exchange rates";
    } finally {
      loading.value = false;
    }
  }

  /**
   * Set preferred currency and persist to localStorage
   */
  async function setCurrency(currency: string) {
    if (!SUPPORTED_CURRENCIES.includes(currency as any)) {
      console.warn(`Unsupported currency: ${currency}`);
      return;
    }
    preferredCurrency.value = currency;
    localStorage.setItem(STORAGE_KEY, currency);
    // Try to persist to server (non-blocking)
    try {
      await api.put<{ currency: string }>("/api/rates/preferred", { currency });
    } catch {
      // Ignore server persistence errors
    }
  }

  /**
   * Convert an amount from one currency to another.
   * Rate assumption: rates are stored as multiplier FROM 1 USD TO target currency.
   * So rate[CNY] = 7.2 means 1 USD = 7.2 CNY.
   */
  function convertAmount(
    amount: number,
    fromCurrency?: string,
    targetCurrency?: string,
  ): number {
    const target = targetCurrency || preferredCurrency.value;
    const from = fromCurrency || "USD";

    if (from === target || !rates.value?.rates) {
      return amount;
    }

    // Convert from source currency to USD first
    let usdAmount = amount;
    if (from !== "USD") {
      const fromRate = rates.value.rates[from];
      if (!fromRate) return amount;
      usdAmount = amount / fromRate;
    }

    // Convert from USD to target
    if (target === "USD") {
      return usdAmount;
    }
    const targetRate = rates.value.rates[target];
    if (!targetRate) {
      return usdAmount;
    }
    return usdAmount * targetRate;
  }

  /**
   * Format an amount from its source currency to the preferred/target currency
   */
  function formatAmount(
    amount: number,
    fromCurrency?: string,
    targetCurrency?: string,
  ): string {
    const cur = targetCurrency || preferredCurrency.value;
    const converted = convertAmount(amount, fromCurrency, cur);
    const symbol = CURRENCY_SYMBOLS[cur] || "$";
    const fixed = converted.toFixed(2);
    // Special formatting for JPY (no decimals) and KRW (no decimals)
    if (cur === "JPY" || cur === "KRW") {
      return `${symbol}${Math.round(converted).toLocaleString()}`;
    }
    return `${symbol}${Number(fixed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Convert a placeholder value from source currency to display currency
   */
  function convertPlaceholder(
    value: number,
    fromCurrency?: string,
    targetCurrency?: string,
  ): string {
    const cur = targetCurrency || preferredCurrency.value;
    const converted = convertAmount(value, fromCurrency, cur);
    if (cur === "JPY" || cur === "KRW") {
      return String(Math.round(converted));
    }
    // Show up to 4 decimal places for small values
    const str = converted.toFixed(4);
    // Trim trailing zeros but keep at least 3 significant digits
    const trimmed = parseFloat(str).toString();
    return trimmed;
  }

  /**
   * Get the currency symbol for display
   */
  function getCurrencySymbol(currency?: string): string {
    return CURRENCY_SYMBOLS[currency || preferredCurrency.value] || "$";
  }

  /**
   * Format a label like "单价" -> "单价 ($)" for a given currency
   */
  function formatLabel(baseLabel: string, targetCurrency?: string): string {
    const symbol = getCurrencySymbol(targetCurrency);
    return `${baseLabel} (${symbol})`;
  }

  /**
   * Build a placeholder reflecting a given display currency
   * Converts from USD default and shows with the display currency symbol
   * e.g. pricePlaceholder(0.001, "CNY") -> "¥ 0.007"
   *      pricePlaceholder(0.001, "USD") -> "$ 0.001"
   */
  function pricePlaceholder(
    usdValue: number,
    displayCurrency?: string,
  ): string {
    const currency = displayCurrency || preferredCurrency.value;
    const converted = convertAmount(usdValue, "USD", currency);
    const symbol = CURRENCY_SYMBOLS[currency] || "$";
    const formatted = convertPlaceholder(usdValue, "USD", currency);
    return `${symbol} ${formatted}`;
  }

  return {
    preferredCurrency: computed(() => preferredCurrency.value),
    rates: computed(() => rates.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    supportedCurrencies: SUPPORTED_CURRENCIES,
    currencySymbols: CURRENCY_SYMBOLS,
    fetchRates,
    setCurrency,
    convertAmount,
    formatAmount,
    convertPlaceholder,
    getCurrencySymbol,
    formatLabel,
    pricePlaceholder,
  };
}

// Auto-fetch rates on first import
const { fetchRates } = useExchangeRates();
fetchRates();
