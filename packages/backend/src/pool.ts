import type { Provider, Auth, ModelAlias } from "@llm-proxy/shared/schemas";
import { RateLimiter, type RateLimitCheckResult } from "./rate_limiter.js";

export interface AuthEntry {
  auth: Auth;
  providerId: string;
  provider: Provider;
}

export interface PoolSelection {
  authEntry: AuthEntry;
  realModel: string;
}

export interface HealthStats {
  successCount: number;
  failureCount: number;
  lastFailureAt: number | null;
}

export interface QueueEntry {
  resolve: (selection: PoolSelection | null) => void;
  reject: (error: Error) => void;
  modelAlias: string;
  enqueuedAt: number;
  timeoutMs: number;
}

export class ProviderPool {
  private models: Map<string, ModelAlias>;
  private providers: Map<string, Provider>;
  private auths: Map<string, Map<string, Auth>>;
  private rateLimiter: RateLimiter;
  private queue: QueueEntry[];
  private rrCounters: Map<string, number>;
  private sessionAffinity: Map<string, { providerId: string; authKey: string; realModel: string }>;
  private healthStats: Map<string, HealthStats>;

  constructor(
    models: Map<string, ModelAlias>,
    providers: Map<string, Provider>,
    auths: Map<string, Map<string, Auth>>,
    rateLimiter?: RateLimiter,
  ) {
    this.models = models;
    this.providers = providers;
    this.auths = auths;
    this.rateLimiter = rateLimiter ?? new RateLimiter();
    this.queue = [];
    this.rrCounters = new Map();
    this.sessionAffinity = new Map();
    this.healthStats = new Map();
  }

  setConfig(
    models: Map<string, ModelAlias>,
    providers: Map<string, Provider>,
    auths: Map<string, Map<string, Auth>>,
  ): void {
    this.models = models;
    this.providers = providers;
    this.auths = auths;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Update an auth's key and metadata in the in-memory map (used after OAuth refresh).
   */
  updateAuthKey(oldKey: string, newKey: string, metadataJson: string): void {
    for (const [, authMap] of this.auths.entries()) {
      if (authMap.has(oldKey)) {
        const existing = authMap.get(oldKey)!;
        const updated = {
          ...existing,
          key: newKey,
          oauth_metadata: metadataJson,
        } as any;
        authMap.delete(oldKey);
        authMap.set(newKey, updated);
        return;
      }
    }
  }

  /**
   * Get all available auth entries for a model alias.
   * Filters out disabled models, disabled providers, and suspended/expired auths.
   */
  private getAvailableAuths(modelAlias: string): AuthEntry[] {
    const model = this.models.get(modelAlias);
    if (!model || !model.enabled) return [];

    const entries: AuthEntry[] = [];

    for (const entry of model.models) {
      const providerId = entry.provider_id;
      const provider = this.providers.get(providerId);
      if (!provider || !provider.enabled) continue;

      const providerAuths = this.auths.get(providerId);
      if (!providerAuths) continue;

      for (const auth of providerAuths.values()) {
        // Status check: if status is not set (backward compat), treat as active
        if (auth.status && auth.status !== "active") continue;
        entries.push({ auth, providerId, provider });
      }
    }

    return entries;
  }

  /**
   * Check if an auth entry is available (not rate limited).
   */
  private isAuthAvailable(
    authEntry: AuthEntry,
    estimatedTokens: number = 0,
  ): RateLimitCheckResult {
    return this.rateLimiter.check(
      authEntry.auth.key,
      authEntry.provider.rate_limits,
      estimatedTokens,
    );
  }

  /**
   * Select an auth entry based on the model's strategy.
   * @param excludeAuthKey - optional auth key to exclude (for failover retry)
   * Returns null if no auth is available.
   */
  selectAuth(
    modelAlias: string,
    estimatedTokens: number = 0,
    sessionId?: string,
    excludeAuthKey?: string,
  ): PoolSelection | null {
    const model = this.models.get(modelAlias);
    if (!model) return null;

    // Session affinity: if we've pinned this session, reuse same provider
    if (sessionId) {
      const pinned = this.sessionAffinity.get(sessionId);
      if (pinned) {
        const provider = this.providers.get(pinned.providerId);
        if (provider?.enabled) {
          const authMap = this.auths.get(pinned.providerId);
          const auth = authMap?.get(pinned.authKey);
          if (auth) {
            const authEntry: AuthEntry = { auth, providerId: pinned.providerId, provider };
            // "Best effort": only reuse if still available, otherwise fall through
            if (this.isAuthAvailable(authEntry, estimatedTokens).allowed) {
              return { authEntry, realModel: pinned.realModel };
            }
          }
        }
        // Pinned provider gone or rate-limited, remove and fall through
        this.sessionAffinity.delete(sessionId);
      }
    }

    const available = this.getAvailableAuths(modelAlias);
    if (available.length === 0) return null;

    // Filter by rate limit availability and optional exclusion
    const availableAuths = available.filter((entry) => {
      if (excludeAuthKey && entry.auth.key === excludeAuthKey) return false;
      return this.isAuthAvailable(entry, estimatedTokens).allowed;
    });

    if (availableAuths.length === 0) return null;

    let selected: AuthEntry;

    switch (model.strategy) {
      case "proportional":
        selected = this.selectProportional(availableAuths);
        break;
      case "round_robin":
        selected = this.selectRoundRobin(modelAlias, availableAuths);
        break;
      case "random":
        selected = this.selectRandom(availableAuths);
        break;
      case "priority":
        selected = availableAuths[0];
        break;
      case "least_loaded":
        selected = this.selectLeastLoaded(availableAuths);
        break;
      case "health_first":
        selected = this.selectHealthFirst(availableAuths);
        break;
      default:
        selected = availableAuths[0];
    }

    const realModel = this.getRealModel(modelAlias, selected.providerId);
    return { authEntry: selected, realModel };
  }

  /**
   * Proportional: pick the auth with the lowest peak usage.
   * For each auth, finds the max usage % across all its rate limits,
   * then picks the auth with the smallest max (least constrained bottleneck).
   */
  private selectProportional(auths: AuthEntry[]): AuthEntry {
    let minPeakUsage = Infinity;
    let selected = auths[0];

    for (const entry of auths) {
      const usage = this.rateLimiter.getUsage(entry.auth.key, entry.provider.rate_limits);
      let peakUsage = 0;

      for (const limit of entry.provider.rate_limits) {
        const max = limit.max;
        if (max <= 0) continue;

        let used = 0;
        if (limit.type === "weighted_requests") {
          used = usage[`requests_per_${limit.period}`] as number ?? 0;
        } else if (limit.type === "tokens") {
          used = usage[`tokens_per_${limit.period}`] as number ?? 0;
        } else if (limit.type === "concurrency") {
          used = usage["current_concurrency"] as number ?? 0;
        }
        const pct = used / max;
        if (pct > peakUsage) peakUsage = pct;
      }

      if (peakUsage < minPeakUsage) {
        minPeakUsage = peakUsage;
        selected = entry;
      }
    }

    return selected;
  }

  /**
   * Round-robin selection.
   */
  private selectRoundRobin(modelAlias: string, auths: AuthEntry[]): AuthEntry {
    const counter = this.rrCounters.get(modelAlias) ?? 0;
    const selected = auths[counter % auths.length];
    this.rrCounters.set(modelAlias, counter + 1);
    return selected;
  }

  /**
   * Random selection.
   */
  private selectRandom(auths: AuthEntry[]): AuthEntry {
    return auths[Math.floor(Math.random() * auths.length)];
  }

  /**
   * Least loaded selection (based on current concurrency).
   */
  private selectLeastLoaded(auths: AuthEntry[]): AuthEntry {
    let minConcurrency = Infinity;
    let selected = auths[0];

    for (const entry of auths) {
      const usage = this.rateLimiter.getUsage(entry.auth.key, entry.provider.rate_limits);
      const concurrency = usage.current_concurrency ?? 0;
      if (concurrency < minConcurrency) {
        minConcurrency = concurrency;
        selected = entry;
      }
    }

    return selected;
  }

  /**
   * Health-first selection: pick the auth with the highest success rate.
   * Success rate = successes / (successes + failures) over a sliding window.
   * Auths with no data default to 100% (neutral).
   * When scores are equal, falls back to proportional logic.
   */
  private selectHealthFirst(auths: AuthEntry[]): AuthEntry {
    let bestScore = -1;
    let selected = auths[0];

    for (const entry of auths) {
      const stats = this.healthStats.get(entry.auth.key);
      let score: number;
      if (!stats || (stats.successCount === 0 && stats.failureCount === 0)) {
        score = 1.0; // No data yet — neutral
      } else {
        const total = stats.successCount + stats.failureCount;
        score = stats.successCount / total;
        // Apply recency penalty: if last failure was recent, reduce score
        if (stats.lastFailureAt && Date.now() - stats.lastFailureAt < 60_000) {
          score *= 0.5;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        selected = entry;
      }
    }

    return selected;
  }

  /**
   * Record a successful upstream request for health tracking.
   */
  recordSuccess(authKey: string): void {
    const stats = this.healthStats.get(authKey) ?? { successCount: 0, failureCount: 0, lastFailureAt: null };
    stats.successCount++;
    this.healthStats.set(authKey, stats);
  }

  /**
   * Record an upstream failure for health tracking.
   */
  recordFailure(authKey: string): void {
    const stats = this.healthStats.get(authKey) ?? { successCount: 0, failureCount: 0, lastFailureAt: null };
    stats.failureCount++;
    stats.lastFailureAt = Date.now();
    this.healthStats.set(authKey, stats);
  }

  /**
   * Get the real model name for a provider given a model alias.
   */
  private getRealModel(modelAlias: string, providerId: string): string {
    const model = this.models.get(modelAlias);
    if (!model) return modelAlias;

    const provider = this.providers.get(providerId);
    if (!provider || provider.models.length === 0) return modelAlias;

    // Use the model_name from the alias's entry for this provider
    const aliasEntry = model.models.find((m) => m.provider_id === providerId);
    if (aliasEntry?.model_name) {
      return aliasEntry.model_name;
    }

    return modelAlias;
  }

  /**
   * Enqueue a request when no auth is available.
   * Returns a promise that resolves when an auth becomes available or times out.
   */
  enqueue(modelAlias: string, timeoutMs: number = 30000): Promise<PoolSelection | null> {
    return new Promise<PoolSelection | null>((resolve, reject) => {
      const entry: QueueEntry = {
        resolve,
        reject,
        modelAlias,
        enqueuedAt: Date.now(),
        timeoutMs,
      };

      this.queue.push(entry);

      // Set timeout
      const timer = setTimeout(() => {
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          resolve(null); // Timeout -> null
        }
      }, timeoutMs);

      // Override resolve to clear timer
      const originalResolve = entry.resolve;
      entry.resolve = (selection) => {
        clearTimeout(timer);
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) this.queue.splice(idx, 1);
        originalResolve(selection);
      };
    });
  }

  /**
   * Try to process queued requests.
   * Called periodically or after a request completes.
   */
  processQueue(): void {
    const now = Date.now();
    const toProcess: QueueEntry[] = [];
    const remaining: QueueEntry[] = [];

    for (const entry of this.queue) {
      if (now - entry.enqueuedAt >= entry.timeoutMs) {
        entry.resolve(null);
        continue;
      }
      remaining.push(entry);

      const selection = this.selectAuth(entry.modelAlias);
      if (selection) {
        toProcess.push(entry);
      }
    }

    this.queue = remaining;

    for (const entry of toProcess) {
      const selection = this.selectAuth(entry.modelAlias);
      entry.resolve(selection);
    }
  }

  /**
   * Record a request completion (release concurrency).
   */
  recordCompletion(authKey: string, provider: Provider, tokens: number = 0): void {
    this.rateLimiter.releaseConcurrency(authKey, provider.rate_limits);

    // Record actual tokens for token-based limits
    for (const limit of provider.rate_limits) {
      if (limit.type === "tokens" || limit.type === "tpm") {
        // These were already recorded during selection
      }
    }

    // Try to process queued requests
    this.processQueue();
  }

  /**
   * Get queue length.
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get available auths count for a model.
   */
  getAvailableAuthsCount(modelAlias: string): number {
    return this.getAvailableAuths(modelAlias).length;
  }

  /** Pin a session ID to a provider/auth for affinity */
  pinSession(sessionId: string, providerId: string, authKey: string, realModel: string): void {
    this.sessionAffinity.set(sessionId, { providerId, authKey, realModel });
  }
}
