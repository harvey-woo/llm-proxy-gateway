import { Hono } from "hono";

// Mock exchange rates data (same as mock API)
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  CNY: 7.2,
  EUR: 0.92,
  JPY: 149.5,
  GBP: 0.79,
  HKD: 7.82,
  TWD: 32.15,
  KRW: 1320.5,
  SGD: 1.34,
};

// In-memory preferred currency
let preferredCurrency = "USD";

export function createRatesRoutes(): Hono {
  const router = new Hono();

  // GET /api/rates - Get current exchange rates
  router.get("/api/rates", (c) => {
    return c.json({
      success: true,
      data: {
        base: "USD",
        rates: EXCHANGE_RATES,
        updated_at: new Date().toISOString(),
      },
    });
  });

  // GET /api/rates/preferred - Get preferred currency
  router.get("/api/rates/preferred", (c) => {
    return c.json({
      success: true,
      data: {
        currency: preferredCurrency,
      },
    });
  });

  // PUT /api/rates/preferred - Set preferred currency
  router.put("/api/rates/preferred", async (c) => {
    const body = await c.req.json();
    const currency = (body as { currency?: string }).currency;

    if (!currency || !EXCHANGE_RATES[currency]) {
      return c.json(
        {
          success: false,
          error: `Unsupported currency: ${currency}`,
          code: "INVALID_CURRENCY",
        },
        400,
      );
    }

    preferredCurrency = currency;
    return c.json({
      success: true,
      data: { currency },
    });
  });

  return router;
}
