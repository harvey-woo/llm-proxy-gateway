<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useApi } from "../composables/useApi";
import { useExchangeRates } from "../composables/useExchangeRates";

import LoadingSpinner from "../components/LoadingSpinner.vue";
import EmptyState from "../components/EmptyState.vue";

interface LimitInfo {
  type: string;
  period?: string;
  used: number;
  max: number;
  remaining: number;
  usage_pct: number;
}

interface SectionAuthInfo {
  auth_key: string;
  auth_name?: string;
  limits: LimitInfo[];
}

interface PerRequestWeightedRow {
  provider_id: string;
  weighted_requests: number;
  cost: number;
  unit_price: number;
  rate_limited: number;
  auths: SectionAuthInfo[];
  currency?: string;
}

interface PerModelTokenRow {
  provider_id: string;
  tokens: number;
  cost: number;
  avg_price_per_m: number;
  rate_limited: number;
  auths: SectionAuthInfo[];
  currency?: string;
}

interface SubscriptionRow {
  provider_id: string;
  used: number;
  quota: number | null; // null = unlimited
  cost: number;
  period: string;
  overage_cost: number;
  auths: SectionAuthInfo[];
  currency?: string;
}

interface ByPricingModel {
  per_request_weighted: {
    label: string;
    rows: PerRequestWeightedRow[];
    total_weighted_requests: number;
    total_cost: number;
    total_rate_limited: number;
  };
  per_model_token: {
    label: string;
    rows: PerModelTokenRow[];
    total_tokens: number;
    total_cost: number;
    total_rate_limited: number;
  };
  subscription: {
    label: string;
    rows: SubscriptionRow[];
    total_cost: number;
    total_rate_limited: number;
  };
}

interface RateLimitedAuthEntry {
  auth_key: string;
  auth_name?: string;
  provider_id: string;
  triggered_rules: string[];
}

interface DashboardData {
  total_cost: number;
  total_requests: number;
  total_rate_limited: number;
  by_pricing_model: ByPricingModel;
  rate_limited_auths: RateLimitedAuthEntry[];
}

const api = useApi();
const exchangeRates = useExchangeRates();
const { t } = useI18n();
const stats = ref<DashboardData | null>(null);
const expandedRows = ref<Set<string>>(new Set());

async function fetchStats() {
  const res = await api.get<DashboardData>("/api/stats/dashboard");
  if (res.success) {
    stats.value = res.data;
  }
}

function toggleExpand(providerId: string) {
  const newSet = new Set(expandedRows.value);
  if (newSet.has(providerId)) {
    newSet.delete(providerId);
  } else {
    newSet.add(providerId);
  }
  expandedRows.value = newSet;
}

function isExpanded(providerId: string): boolean {
  return expandedRows.value.has(providerId);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number, fromCurrency?: string): string {
  return exchangeRates.formatAmount(n, fromCurrency);
}

// Derive primary display currency from dashboard data
const primaryCurrency = computed(() => {
  const data = stats.value;
  if (!data || !data.by_pricing_model) return undefined;
  for (const section of Object.values(data.by_pricing_model) as any[]) {
    if (section.rows && section.rows.length > 0 && section.rows[0].currency) {
      return section.rows[0].currency;
    }
  }
  return undefined;
});

function getProviderDisplayName(providerId: string): string {
  const names: Record<string, string> = {
    provider_a: "OpenAI",
    provider_b: "Anthropic",
    provider_c: "Google Vertex AI",
  };
  return names[providerId] ?? providerId;
}

const providerColors: Record<string, string> = {
  provider_a: "bg-blue-50 dark:bg-blue-900/30",
  provider_b: "bg-purple-500 dark:bg-purple-600",
  provider_c: "bg-green-500 dark:bg-green-600",
  provider_d: "bg-orange-500 dark:bg-orange-600",
};

function getProviderColor(providerId: string): string {
  return providerColors[providerId] ?? "bg-gray-50 dark:bg-gray-700";
}

function getBarWidth(used: number, quota: number | null): string {
  if (quota === null || quota === 0) return "100%";
  return `${Math.min((used / quota) * 100, 100)}%`;
}

function getBarColor(used: number, quota: number | null): string {
  if (quota === null) return "bg-blue-300 dark:bg-blue-700";
  if (quota === 0) return "bg-gray-300 dark:bg-gray-600";
  const ratio = used / quota;
  if (ratio >= 1) return "bg-red-500 dark:bg-red-600";
  if (ratio >= 0.8) return "bg-yellow-500 dark:bg-yellow-600";
  return "bg-green-500 dark:bg-green-600";
}

function getLimitBarColor(usagePct: number): string {
  if (usagePct >= 100) return "bg-red-500 dark:bg-red-600";
  if (usagePct >= 80) return "bg-yellow-500 dark:bg-yellow-600";
  return "bg-green-500 dark:bg-green-600";
}

function getLimitBarWidth(usagePct: number): string {
  return `${Math.min(usagePct, 100)}%`;
}

function formatLimitLabel(type: string, period?: string): string {
  if (period) return `${type}/${period}`;
  return type;
}

onMounted(fetchStats);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="page-title" data-testid="dashboard-title">{{ $t('dashboard.title') }}</h1>
      <p class="page-subtitle">{{ $t('dashboard.subtitle') }}</p>
    </div>

    <LoadingSpinner v-if="api.loading.value" />

    <EmptyState v-else-if="!stats" :message="$t('dashboard.noStats')" />

    <template v-else>
      <!-- 3 overview cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div class="card p-5" data-testid="dashboard-total-cost-card">
          <div class="flex items-center gap-2 mb-2">
            <span class="i-carbon-wallet text-xl text-blue-500 dark:text-blue-400" />
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ $t('dashboard.totalCost') }}</div>
          </div>
          <div class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ formatCurrency(stats.total_cost, primaryCurrency) }}</div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ exchangeRates.preferredCurrency.value }}</div>
        </div>

        <div class="card p-5" data-testid="dashboard-total-requests-card">
          <div class="flex items-center gap-2 mb-2">
            <span class="i-carbon-request-quote text-xl text-indigo-500 dark:text-indigo-400" />
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ $t('dashboard.totalRequests') }}</div>
          </div>
          <div class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ stats.total_requests.toLocaleString() }}</div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ $t('dashboard.rawRequests') }}</div>
        </div>

        <div class="card p-5" data-testid="dashboard-total-rate-limited-card">
          <div class="flex items-center gap-2 mb-2">
            <span class="i-carbon-warning-alt text-xl text-red-500 dark:text-red-400" />
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ $t('dashboard.totalRateLimited') }}</div>
          </div>
          <div class="text-3xl font-bold text-red-600">{{ stats.total_rate_limited }}</div>
          <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ $t('stats.times') }}</div>
        </div>
      </div>

      <!-- Section 1: Per-Request Weighted -->
      <div class="card-section" data-testid="dashboard-section-per-request-weighted">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          <span class="i-carbon-chart-bar text-blue-500 dark:text-blue-400 inline-flex items-center mr-1" />
          {{ stats.by_pricing_model.per_request_weighted.label }}
        </h2>
        <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">{{ $t('dashboard.perRequestWeightedDesc') }}</p>

        <div class="overflow-x-auto" v-if="stats.by_pricing_model.per_request_weighted.rows.length > 0">
          <table class="table-wrap">
            <thead class="table-head">
              <tr>
                <th class="table-th-sticky">{{ $t('dashboard.rateLimited') }}</th>
                <th class="table-th text-right">{{ $t('dashboard.weightedRequests') }}</th>
                <th class="table-th text-right">{{ $t('dashboard.cost') }}</th>
                <th class="table-th text-right">{{ $t('dashboard.unitPrice') }}</th>
                <th class="table-th text-center">{{ $t('dashboard.rateLimited') }}</th>
                <th class="pb-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in stats.by_pricing_model.per_request_weighted.rows" :key="row.provider_id">
                <tr
                  class="table-row cursor-pointer"
                  data-testid="dashboard-expandable-row"
                  @click="toggleExpand(row.provider_id)"
                >
                  <td class="table-td-sticky">
                    <span class="inline-block w-2 h-2 rounded-full mr-2" :class="getProviderColor(row.provider_id)" />
                    {{ getProviderDisplayName(row.provider_id) }}
                  </td>
                  <td class="table-td text-right font-mono">{{ row.weighted_requests.toLocaleString() }}</td>
                  <td class="table-td text-right font-mono">{{ formatCurrency(row.cost, row.currency) }}</td>
                  <td class="table-td text-right text-gray-500 dark:text-gray-400 font-mono">{{ formatCurrency(row.unit_price, row.currency) }}</td>
                  <td class="py-3 text-center">
                    <span
                      v-if="row.rate_limited > 0"
                    class="badge-red"
                  >
                    <span class="i-tabler-alert-circle text-xs" /> {{ row.rate_limited }}
                    </span>
                    <span
                      v-else
                      class="badge-green"
                    >
                      <span class="i-tabler-circle-check text-xs" /> 0
                    </span>
                  </td>
                  <td class="py-3 text-center text-gray-400 dark:text-gray-500 text-sm">{{ isExpanded(row.provider_id) ? '▼' : '▶' }}</td>
                </tr>
                <tr v-if="isExpanded(row.provider_id) && row.auths.length > 0" data-testid="dashboard-expanded-row">
                  <td colspan="6" class="p-0 bg-gray-50 dark:bg-gray-700 dark:bg-gray-800/30">
                    <div class="px-6 py-4 border-b border-gray-200">
                      <div
                        v-for="auth in row.auths"
                        :key="auth.auth_key"
                        class="mb-4 last:mb-0"
                        data-testid="dashboard-expanded-auth-row"
                      >
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ auth.auth_name || $t('common.unknown') }}</span>
                          <span class="text-xs text-gray-400 dark:text-gray-500 font-mono">{{ auth.auth_key }}</span>
                        </div>
                        <div class="space-y-2 pl-4">
                          <div
                            v-for="limit in auth.limits"
                            :key="limit.type + (limit.period || '')"
                            class="flex items-center gap-3"
                          >
                            <span
                              class="text-xs font-mono text-gray-500 dark:text-gray-400 w-40 shrink-0"
                              data-testid="dashboard-auth-limit-label"
                            >
                              {{ formatLimitLabel(limit.type, limit.period) }}
                            </span>
                            <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" data-testid="dashboard-auth-limit-bar">
                              <div
                                class="h-full rounded-full transition-all duration-500"
                                :class="getLimitBarColor(limit.usage_pct)"
                                :style="{ width: getLimitBarWidth(limit.usage_pct) }"
                              />
                            </div>
                            <span class="text-xs font-mono text-gray-600 w-28 text-right shrink-0">
                              {{ limit.used.toLocaleString() }} / {{ limit.max.toLocaleString() }}
                              ({{ limit.usage_pct }}%)
                            </span>
                          </div>
                          <div v-if="auth.limits.length === 0" class="text-xs text-gray-400 dark:text-gray-500 italic pl-2">
                            {{ $t('dashboard.noLimits') }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="isExpanded(row.provider_id) && row.auths.length === 0" data-testid="dashboard-expanded-row">
                  <td colspan="6" class="p-0 bg-gray-50 dark:bg-gray-700 dark:bg-gray-800/30">
                    <div class="px-6 py-4 text-sm text-gray-400 dark:text-gray-500 italic border-b border-gray-200">
                      {{ $t('dashboard.noAuthData') }}
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr class="font-semibold text-gray-800 border-t-2 border-gray-300" data-testid="dashboard-section-table-footer">
                <td class="py-3 pr-4 text-sm">{{ $t('common.total') }}</td>
                <td class="py-3 pr-4 text-sm text-right font-mono">{{ stats.by_pricing_model.per_request_weighted.total_weighted_requests.toLocaleString() }}</td>
                <td class="py-3 pr-4 text-sm text-right font-mono">{{ formatCurrency(stats.by_pricing_model.per_request_weighted.total_cost, primaryCurrency) }}</td>
                <td class="py-3 pr-4 text-sm text-right font-mono">—</td>
                <td class="py-3 text-center text-sm">{{ stats.by_pricing_model.per_request_weighted.total_rate_limited }}</td>
                <td class="py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <EmptyState v-else :message="$t('dashboard.noWeightedData')" />
      </div>

      <!-- Section 2: Per-Model Token -->
      <div class="card-section" data-testid="dashboard-section-per-model-token">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          <span class="i-carbon-token text-purple-500 dark:text-purple-400 inline-flex items-center mr-1" />
          {{ stats.by_pricing_model.per_model_token.label }}
        </h2>
        <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">{{ $t('dashboard.perModelTokenDesc') }}</p>

        <div class="overflow-x-auto" v-if="stats.by_pricing_model.per_model_token.rows.length > 0">
          <table class="table-wrap">
            <thead class="table-head">
              <tr>
                <th class="table-th-sticky">{{ $t('dashboard.rateLimited') }}</th>
                <th class="table-th text-right">{{ $t('dashboard.tokens') }}</th>
                <th class="table-th text-right">{{ $t('dashboard.cost') }}</th>
                <th class="table-th text-right">{{ $t('dashboard.avgPrice') }}</th>
                <th class="table-th text-center">{{ $t('dashboard.rateLimited') }}</th>
                <th class="pb-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in stats.by_pricing_model.per_model_token.rows" :key="row.provider_id">
                <tr
                  class="table-row cursor-pointer"
                  data-testid="dashboard-expandable-row"
                  @click="toggleExpand(row.provider_id)"
                >
                  <td class="table-td-sticky">
                    <span class="inline-block w-2 h-2 rounded-full mr-2" :class="getProviderColor(row.provider_id)" />
                    {{ getProviderDisplayName(row.provider_id) }}
                  </td>
                  <td class="table-td text-right font-mono">{{ formatNumber(row.tokens) }}</td>
                  <td class="table-td text-right font-mono">{{ formatCurrency(row.cost, row.currency) }}</td>
                  <td class="table-td text-right text-gray-500 dark:text-gray-400 font-mono">${{ row.avg_price_per_m.toFixed(2) }}/M</td>
                  <td class="py-3 text-center">
                    <span
                      v-if="row.rate_limited > 0"
                    class="badge-red"
                  >
                    <span class="i-tabler-alert-circle text-xs" /> {{ row.rate_limited }}
                    </span>
                    <span
                      v-else
                      class="badge-green"
                    >
                      <span class="i-tabler-circle-check text-xs" /> 0
                    </span>
                  </td>
                  <td class="py-3 text-center text-gray-400 dark:text-gray-500 text-sm">{{ isExpanded(row.provider_id) ? '▼' : '▶' }}</td>
                </tr>
                <tr v-if="isExpanded(row.provider_id) && row.auths.length > 0" data-testid="dashboard-expanded-row">
                  <td colspan="6" class="p-0 bg-gray-50 dark:bg-gray-700 dark:bg-gray-800/30">
                    <div class="px-6 py-4 border-b border-gray-200">
                      <div
                        v-for="auth in row.auths"
                        :key="auth.auth_key"
                        class="mb-4 last:mb-0"
                        data-testid="dashboard-expanded-auth-row"
                      >
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ auth.auth_name || $t('common.unknown') }}</span>
                          <span class="text-xs text-gray-400 dark:text-gray-500 font-mono">{{ auth.auth_key }}</span>
                        </div>
                        <div class="space-y-2 pl-4">
                          <div
                            v-for="limit in auth.limits"
                            :key="limit.type + (limit.period || '')"
                            class="flex items-center gap-3"
                          >
                            <span
                              class="text-xs font-mono text-gray-500 dark:text-gray-400 w-40 shrink-0"
                              data-testid="dashboard-auth-limit-label"
                            >
                              {{ formatLimitLabel(limit.type, limit.period) }}
                            </span>
                            <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" data-testid="dashboard-auth-limit-bar">
                              <div
                                class="h-full rounded-full transition-all duration-500"
                                :class="getLimitBarColor(limit.usage_pct)"
                                :style="{ width: getLimitBarWidth(limit.usage_pct) }"
                              />
                            </div>
                            <span class="text-xs font-mono text-gray-600 w-28 text-right shrink-0">
                              {{ limit.used.toLocaleString() }} / {{ limit.max.toLocaleString() }}
                              ({{ limit.usage_pct }}%)
                            </span>
                          </div>
                          <div v-if="auth.limits.length === 0" class="text-xs text-gray-400 dark:text-gray-500 italic pl-2">
                            {{ $t('dashboard.noLimits') }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="isExpanded(row.provider_id) && row.auths.length === 0" data-testid="dashboard-expanded-row">
                  <td colspan="6" class="p-0 bg-gray-50 dark:bg-gray-700 dark:bg-gray-800/30">
                    <div class="px-6 py-4 text-sm text-gray-400 dark:text-gray-500 italic border-b border-gray-200">
                      {{ $t('dashboard.noAuthData') }}
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr class="font-semibold text-gray-800 border-t-2 border-gray-300" data-testid="dashboard-section-table-footer">
                <td class="py-3 pr-4 text-sm">{{ $t('common.total') }}</td>
                <td class="py-3 pr-4 text-sm text-right font-mono">{{ formatNumber(stats.by_pricing_model.per_model_token.total_tokens) }}</td>
                <td class="py-3 pr-4 text-sm text-right font-mono">{{ formatCurrency(stats.by_pricing_model.per_model_token.total_cost, primaryCurrency) }}</td>
                <td class="py-3 pr-4 text-sm text-right font-mono">—</td>
                <td class="py-3 text-center text-sm">{{ stats.by_pricing_model.per_model_token.total_rate_limited }}</td>
                <td class="py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <EmptyState v-else :message="$t('dashboard.noTokenData')" />
      </div>

      <!-- Section 3: Subscription -->
      <div class="card-section" data-testid="dashboard-section-subscription">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          <span class="i-carbon-subscription text-green-500 dark:text-green-400 inline-flex items-center mr-1" />
          {{ stats.by_pricing_model.subscription.label }}
        </h2>
        <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">{{ $t('dashboard.subscriptionDesc') }}</p>

        <div class="overflow-x-auto" v-if="stats.by_pricing_model.subscription.rows.length > 0">
          <table class="table-wrap">
            <thead class="table-head">
              <tr>
                <th class="table-th-sticky">{{ $t('dashboard.rateLimited') }}</th>
                <th class="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">{{ $t('dashboard.quota') }}</th>
                <th class="table-th text-right">{{ $t('dashboard.cost') }}</th>
                <th class="table-th text-right">{{ $t('dashboard.overageCost') }}</th>
                <th class="table-th text-center">{{ $t('dashboard.period') }}</th>
                <th class="pb-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in stats.by_pricing_model.subscription.rows" :key="row.provider_id">
                <tr
                  class="table-row cursor-pointer"
                  data-testid="dashboard-expandable-row"
                  @click="toggleExpand(row.provider_id)"
                >
                  <td class="table-td-sticky">
                    <span class="inline-block w-2 h-2 rounded-full mr-2" :class="getProviderColor(row.provider_id)" />
                    {{ getProviderDisplayName(row.provider_id) }}
                  </td>
                  <td class="py-3 pr-6">
                    <div class="flex items-center gap-3">
                      <div class="flex-1 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden w-40">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          :class="getBarColor(row.used, row.quota)"
                          :style="{ width: getBarWidth(row.used, row.quota) }"
                        />
                      </div>
                      <span class="text-xs text-gray-600 font-mono whitespace-nowrap">
                        {{ row.used.toLocaleString() }} / {{ row.quota !== null ? row.quota.toLocaleString() : '不限' }}
                      </span>
                    </div>
                  </td>
                  <td class="table-td text-right font-mono">{{ formatCurrency(row.cost, row.currency) }}</td>
                  <td class="table-td text-right font-mono">{{ row.overage_cost > 0 ? formatCurrency(row.overage_cost, row.currency) : '—' }}</td>
                  <td class="py-3 text-center text-sm text-gray-500 dark:text-gray-400">{{ row.period }}</td>
                  <td class="py-3 text-center text-gray-400 dark:text-gray-500 text-sm">{{ isExpanded(row.provider_id) ? '▼' : '▶' }}</td>
                </tr>
                <tr v-if="isExpanded(row.provider_id) && row.auths.length > 0" data-testid="dashboard-expanded-row">
                  <td colspan="6" class="p-0 bg-gray-50 dark:bg-gray-700 dark:bg-gray-800/30">
                    <div class="px-6 py-4 border-b border-gray-200">
                      <div
                        v-for="auth in row.auths"
                        :key="auth.auth_key"
                        class="mb-4 last:mb-0"
                        data-testid="dashboard-expanded-auth-row"
                      >
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ auth.auth_name || $t('common.unknown') }}</span>
                          <span class="text-xs text-gray-400 dark:text-gray-500 font-mono">{{ auth.auth_key }}</span>
                        </div>
                        <div class="space-y-2 pl-4">
                          <div
                            v-for="limit in auth.limits"
                            :key="limit.type + (limit.period || '')"
                            class="flex items-center gap-3"
                          >
                            <span
                              class="text-xs font-mono text-gray-500 dark:text-gray-400 w-40 shrink-0"
                              data-testid="dashboard-auth-limit-label"
                            >
                              {{ formatLimitLabel(limit.type, limit.period) }}
                            </span>
                            <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" data-testid="dashboard-auth-limit-bar">
                              <div
                                class="h-full rounded-full transition-all duration-500"
                                :class="getLimitBarColor(limit.usage_pct)"
                                :style="{ width: getLimitBarWidth(limit.usage_pct) }"
                              />
                            </div>
                            <span class="text-xs font-mono text-gray-600 w-28 text-right shrink-0">
                              {{ limit.used.toLocaleString() }} / {{ limit.max.toLocaleString() }}
                              ({{ limit.usage_pct }}%)
                            </span>
                          </div>
                          <div v-if="auth.limits.length === 0" class="text-xs text-gray-400 dark:text-gray-500 italic pl-2">
                            {{ $t('dashboard.noLimits') }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr v-if="isExpanded(row.provider_id) && row.auths.length === 0" data-testid="dashboard-expanded-row">
                  <td colspan="6" class="p-0 bg-gray-50 dark:bg-gray-700 dark:bg-gray-800/30">
                    <div class="px-6 py-4 text-sm text-gray-400 dark:text-gray-500 italic border-b border-gray-200">
                      {{ $t('dashboard.noAuthData') }}
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr class="font-semibold text-gray-800 border-t-2 border-gray-300" data-testid="dashboard-section-table-footer">
                <td class="py-3 pr-4 text-sm">{{ $t('common.total') }}</td>
                <td class="py-3 pr-6 text-sm text-gray-400 dark:text-gray-500">—</td>
                <td class="py-3 pr-4 text-sm text-right font-mono">{{ formatCurrency(stats.by_pricing_model.subscription.total_cost, stats.by_pricing_model.subscription.rows[0]?.currency) }}</td>
                <td class="py-3 pr-4 text-sm text-right font-mono">—</td>
                <td class="py-3 text-center text-sm">—</td>
                <td class="py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <EmptyState v-else :message="$t('dashboard.noSubscriptionData')" />
      </div>

      <!-- Section 4: Rate Limited Auths -->
      <div class="card" data-testid="dashboard-rate-limited-auths-section">
        <div class="card-body">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            <span class="i-tabler-alert-triangle text-red-500 dark:text-red-400 inline-flex items-center mr-1" />
            {{ $t('dashboard.rateLimitedAuths') }}
          </h2>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">{{ $t('dashboard.rateLimitedAuthsDesc') }}</p>

          <div class="overflow-x-auto" v-if="stats.rate_limited_auths.length > 0">
            <table class="table-wrap" data-testid="dashboard-rate-limited-auths-table">
              <thead class="table-head">
                <tr>
                  <th class="table-th-sticky">授权 Key</th>
                  <th class="table-th">名称</th>
                  <th class="table-th">{{ $t('dashboard.rateLimited') }}</th>
                  <th class="table-th">{{ $t('dashboard.triggeredRules') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(entry, index) in stats.rate_limited_auths"
                  :key="entry.auth_key + index"
                  class="border-b border-gray-100 hover:bg-red-50 dark:bg-red-900/30 transition-colors"
                  data-testid="dashboard-rate-limited-auths-row"
                >
                  <td class="table-td-sticky font-mono">{{ entry.auth_key.substring(0, 8) }}...</td>
                  <td class="table-td">{{ entry.auth_name || '—' }}</td>
                  <td class="table-td">{{ getProviderDisplayName(entry.provider_id) }}</td>
                  <td class="py-3 pr-4 text-sm">
                    <span
                      v-for="rule in entry.triggered_rules"
                      :key="rule"
                      class="badge-red mr-1"
                    >
                      {{ rule }}
                    </span>
                    <span v-if="entry.triggered_rules.length === 0" class="text-gray-400 dark:text-gray-500">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <EmptyState v-else :message="$t('dashboard.noRateLimited')" />
        </div>
      </div>
    </template>
  </div>
</template>
