import type {
  RateLimit,
  RateLimitType,
  RateLimitPeriod,
} from "@llm-proxy/shared/schemas";

export interface RateLimitState {
  requestCounts: Map<string, number[]>; // period_key -> [timestamps]
  tokenCounts: Map<string, number>; // period_key -> total tokens
  currentConcurrency: Map<string, number>; // auth_key -> concurrent count
  tpmWindow: Map<string, { tokens: number; windowStart: number }>; // auth_key -> {tokens, windowStart}
}

export interface RateLimitCheckResult {
  allowed: boolean;
  blockedBy?: RateLimitType;
  message?: string;
}

export function createRateLimitState(): RateLimitState {
  return {
    requestCounts: new Map(),
    tokenCounts: new Map(),
    currentConcurrency: new Map(),
    tpmWindow: new Map(),
  };
}

// ============================================================
// Period key generation
// ============================================================

function getPeriodKey(period: RateLimitPeriod): string {
  const now = new Date();

  switch (period) {
    case "second":
      return now.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss
    case "minute":
      return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    case "hour":
      return now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    case "day":
      return now.toISOString().slice(0, 10); // YYYY-MM-DD
    case "5h": {
      // 5-hour window
      const hoursSinceEpoch = Math.floor(Date.now() / (5 * 60 * 60 * 1000));
      return `${hoursSinceEpoch}`;
    }
    case "week": {
      // Week starting Monday
      const startOfWeek = new Date(now);
      const dayOfWeek = startOfWeek.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfWeek.setDate(startOfWeek.getDate() - diff);
      startOfWeek.setHours(0, 0, 0, 0);
      return startOfWeek.toISOString().slice(0, 10);
    }
    case "month":
      return now.toISOString().slice(0, 7); // YYYY-MM
    case "30d": {
      // 30-day rolling window
      const epoch30 = Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000));
      return `${epoch30}`;
    }
    default:
      return now.toISOString();
  }
}

function getPeriodMs(period: RateLimitPeriod): number {
  switch (period) {
    case "second":
      return 1000;
    case "minute":
      return 60 * 1000;
    case "hour":
      return 60 * 60 * 1000;
    case "day":
      return 24 * 60 * 60 * 1000;
    case "5h":
      return 5 * 60 * 60 * 1000;
    case "week":
      return 7 * 24 * 60 * 60 * 1000;
    case "month":
      return 30 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

// ============================================================
// Rate limit checking
// ============================================================

export class RateLimiter {
  private state: RateLimitState;

  constructor(state?: RateLimitState) {
    this.state = state ?? createRateLimitState();
  }

  getState(): RateLimitState {
    return this.state;
  }

  /**
   * Check if an auth key is allowed to make a request based on rate limits.
   * Uses AND logic: ANY limit exceeded => blocked.
   */
  check(
    authKey: string,
    rateLimits: RateLimit[],
    estimatedTokens: number = 0,
  ): RateLimitCheckResult {
    for (const limit of rateLimits) {
      const result = this.checkSingle(authKey, limit, estimatedTokens);
      if (!result.allowed) {
        return result;
      }
    }
    return { allowed: true };
  }

  private checkSingle(
    authKey: string,
    limit: RateLimit,
    estimatedTokens: number,
  ): RateLimitCheckResult {
    switch (limit.type) {
      case "weighted_requests":
        return this.checkWeightedRequests(authKey, limit);
      case "concurrency":
        return this.checkConcurrency(authKey, limit);
      case "tokens":
        return this.checkTokens(authKey, limit, estimatedTokens);
    }
  }

  private checkWeightedRequests(
    authKey: string,
    limit: Extract<RateLimit, { type: "weighted_requests" }>,
  ): RateLimitCheckResult {
    const periodKey = `${authKey}:requests:${limit.period}:${getPeriodKey(limit.period)}`;
    const timestamps = this.state.requestCounts.get(periodKey) ?? [];

    // Clean up old timestamps outside the period
    const periodMs = getPeriodMs(limit.period);
    const now = Date.now();
    const validTimestamps = timestamps.filter((t) => now - t < periodMs);
    this.state.requestCounts.set(periodKey, validTimestamps);

    if (validTimestamps.length >= limit.max) {
      return {
        allowed: false,
        blockedBy: "requests",
        message: `Request limit exceeded: ${validTimestamps.length}/${limit.max} per ${limit.period}`,
      };
    }

    return { allowed: true };
  }

  private checkConcurrency(
    authKey: string,
    limit: Extract<RateLimit, { type: "concurrency" }>,
  ): RateLimitCheckResult {
    const current = this.state.currentConcurrency.get(authKey) ?? 0;

    if (current >= limit.max) {
      return {
        allowed: false,
        blockedBy: "concurrency",
        message: `Concurrency limit exceeded: ${current}/${limit.max}`,
      };
    }

    return { allowed: true };
  }

  private checkTokens(
    authKey: string,
    limit: Extract<RateLimit, { type: "tokens" }>,
    estimatedTokens: number,
  ): RateLimitCheckResult {
    const periodKey = `${authKey}:tokens:${limit.period}:${getPeriodKey(limit.period)}`;
    const currentTokens = this.state.tokenCounts.get(periodKey) ?? 0;

    if (currentTokens + estimatedTokens > limit.max) {
      return {
        allowed: false,
        blockedBy: "tokens",
        message: `Token limit exceeded: ${currentTokens}/${limit.max} per ${limit.period}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a request being made (increments counters).
   */
  recordRequest(
    authKey: string,
    rateLimits: RateLimit[],
    actualTokens: number = 0,
    weight: number = 1,
  ): void {
    for (const limit of rateLimits) {
      switch (limit.type) {
        case "weighted_requests": {
          const periodKey = `${authKey}:requests:${limit.period}:${getPeriodKey(limit.period)}`;
          const timestamps = this.state.requestCounts.get(periodKey) ?? [];
          // Push N timestamps for weighted counting
          for (let w = 0; w < weight; w++) {
            timestamps.push(Date.now());
          }
          this.state.requestCounts.set(periodKey, timestamps);
          break;
        }
        case "concurrency": {
          const current = this.state.currentConcurrency.get(authKey) ?? 0;
          this.state.currentConcurrency.set(authKey, current + 1);
          break;
        }
        case "tokens": {
          const periodKey = `${authKey}:tokens:${limit.period}:${getPeriodKey(limit.period)}`;
          const currentTokens = this.state.tokenCounts.get(periodKey) ?? 0;
          this.state.tokenCounts.set(periodKey, currentTokens + actualTokens);
          break;
        }
      }
    }
  }

  /**
   * Record a request being completed (decrements concurrency).
   */
  releaseConcurrency(authKey: string, rateLimits: RateLimit[]): void {
    for (const limit of rateLimits) {
      if (limit.type === "concurrency") {
        const current = this.state.currentConcurrency.get(authKey) ?? 0;
        this.state.currentConcurrency.set(authKey, Math.max(0, current - 1));
      }
    }
  }

  /**
   * Get current usage stats for an auth key.
   */
  getUsage(authKey: string, rateLimits: RateLimit[]): Record<string, number> {
    const usage: Record<string, number> = {};

    for (const limit of rateLimits) {
      switch (limit.type) {
        case "weighted_requests": {
          const periodKey = `${authKey}:requests:${limit.period}:${getPeriodKey(limit.period)}`;
          const timestamps = this.state.requestCounts.get(periodKey) ?? [];
          const periodMs = getPeriodMs(limit.period);
          const now = Date.now();
          const validTimestamps = timestamps.filter((t) => now - t < periodMs);
          usage[`requests_per_${limit.period}`] = validTimestamps.length;
          break;
        }
        case "concurrency": {
          usage[`current_concurrency`] =
            this.state.currentConcurrency.get(authKey) ?? 0;
          break;
        }
        case "tokens": {
          const periodKey = `${authKey}:tokens:${limit.period}:${getPeriodKey(limit.period)}`;
          usage[`tokens_per_${limit.period}`] =
            this.state.tokenCounts.get(periodKey) ?? 0;
          break;
        }
      }
    }

    return usage;
  }
}
