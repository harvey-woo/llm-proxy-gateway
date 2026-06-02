<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useI18n } from "vue-i18n";
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { TokensPerHour, RequestsPerPeriod } from '@llm-proxy/shared/schemas';
import { useApi } from '../composables/useApi';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import EmptyState from '../components/EmptyState.vue';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const api = useApi();
const { t } = useI18n();

// Reactive dark mode detection
const isDarkMode = ref(document.documentElement.classList.contains('dark'));
let themeObserver: MutationObserver | null = null;

onMounted(() => {
  themeObserver = new MutationObserver(() => {
    isDarkMode.value = document.documentElement.classList.contains('dark');
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onUnmounted(() => {
  themeObserver?.disconnect();
});

// === Auth tabs ===
interface AuthTab {
  key: string;
  displayKey: string;
  name?: string;
  provider: string;
}

const authTabs = ref<AuthTab[]>([]);
const activeAuthKey = ref('');

// === Time range ===
type TimeRange = '24h' | '7d' | '30d';
const activeRange = ref<TimeRange>('24h');

const rangeOptions = computed(() => [
  { value: '24h' as TimeRange, label: t('stats.last24h') },
  { value: '7d' as TimeRange, label: t('stats.last7d') },
  { value: '30d' as TimeRange, label: t('stats.last30d') },
]);

function rangeToGranularity(range: TimeRange): 'hour' | 'day' | 'month' {
  if (range === '24h') return 'hour';
  return 'day';
}

function rangeToHours(range: TimeRange): number {
  if (range === '24h') return 24;
  if (range === '7d') return 168;
  return 720;
}

// === Data ===
const requestStats = ref<RequestsPerPeriod[]>([]);
const tokenStats = ref<TokensPerHour[]>([]);

const activeRequestStats = computed(() => {
  return requestStats.value.filter((r) => r.auth_key === activeAuthKey.value);
});

const activeTokenStats = computed(() => {
  return tokenStats.value.filter((t) => t.auth_key === activeAuthKey.value);
});

function getActiveAuth(): AuthTab | undefined {
  return authTabs.value.find((t) => t.displayKey === activeAuthKey.value);
}

// === Chart config ===
const chartLabels = computed(() => {
  const sorted = [...activeTokenStats.value].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return sorted.map((b) => {
    const d = new Date(b.timestamp);
    if (activeRange.value === '24h') {
      return `${d.getHours().toString().padStart(2, '0')}:00`;
    }
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
});

const inputTokens = computed(() => {
  return [...activeTokenStats.value]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((b) => b.input_tokens);
});

const outputTokens = computed(() => {
  return [...activeTokenStats.value]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((b) => b.output_tokens);
});

const cacheTokens = computed(() => {
  return [...activeTokenStats.value]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((b) => b.cache_tokens);
});

const chartData = computed(() => ({
  labels: chartLabels.value,
  datasets: [
    {
      label: t('stats.inputTokens'),
      data: inputTokens.value,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: false,
    },
    {
      label: t('stats.outputTokens'),
      data: outputTokens.value,
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: false,
    },
    {
      label: t('stats.cacheTokens'),
      data: cacheTokens.value,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: false,
      borderDash: [5, 3],
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: true,
  aspectRatio: 2.5,
  interaction: {
    intersect: false,
    mode: 'index' as const,
  },
  plugins: {
    legend: {
      display: false, // We have custom legend
    },
    tooltip: {
      backgroundColor: isDarkMode.value ? 'rgba(55, 65, 81, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      titleColor: isDarkMode.value ? '#f3f4f6' : '#1f2937',
      bodyColor: isDarkMode.value ? '#d1d5db' : '#6b7280',
      borderColor: isDarkMode.value ? '#4b5563' : '#e5e7eb',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      boxPadding: 4,
      callbacks: {
        label: (ctx: any) => {
          const val = ctx.raw;
          const label = ctx.dataset.label;
          const formatted = val >= 1_000_000
            ? `${(val / 1_000_000).toFixed(1)}M`
            : val >= 1_000
              ? `${(val / 1_000).toFixed(1)}K`
              : val.toLocaleString();
          return `${label}: ${formatted}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: true,
        color: isDarkMode.value ? '#374151' : 'rgba(0,0,0,0.06)',
      },
      ticks: {
        color: '#9ca3af',
        font: { size: 11 },
        maxRotation: chartLabels.value.length > 12 ? 30 : 0,
        autoSkip: true,
        maxTicksLimit: 24,
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: isDarkMode.value ? '#374151' : 'rgba(0,0,0,0.06)',
      },
      ticks: {
        color: '#9ca3af',
        font: { size: 11 },
        callback: (val: any) => {
          const n = val as number;
          if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
          if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
          return n.toLocaleString();
        },
      },
    },
  },
}));

// === Request data (weighted counts) ===
const weightedPeriodLabels = computed(() => ({
  '5h': t('stats.last24h'),
  week: t('stats.last7d'),
  month: t('stats.last30d'),
}));
const requestWeightedData = computed(() => {
  const auth = activeAuthKey.value;
  const data = requestStats.value.filter((r) => r.auth_key === auth);
  const map: Record<string, number> = {};
  for (const d of data) {
    map[d.period] = d.count;
  }
  return map;
});

// === Fetch ===
async function fetchProviders() {
  const provRes = await api.get<{ data: Array<{ id: string; name: string; auths: Array<{ key: string; name?: string }> }> }>('/api/providers');
  if (provRes.success) {
    const providers = provRes.data.data ?? provRes.data;
    const tabs: AuthTab[] = [];
    for (const p of providers) {
      for (const a of p.auths ?? []) {
        const dk = a.key.length > 10
          ? a.key.substring(0, 6) + '...' + a.key.substring(a.key.length - 4)
          : a.key;
        tabs.push({
          key: a.key,
          displayKey: dk,
          name: a.name,
          provider: p.name || p.id,
        });
      }
    }
    authTabs.value = tabs;
    if (tabs.length > 0 && !activeAuthKey.value) {
      activeAuthKey.value = tabs[0].displayKey;
    }
  }
}

async function fetchStats() {
  const gran = rangeToGranularity(activeRange.value);
  const hours = rangeToHours(activeRange.value);

  const [reqRes, tokRes] = await Promise.all([
    api.get<RequestsPerPeriod[]>(`/api/stats/requests`),
    api.get<TokensPerHour[]>(`/api/stats/tokens?granularity=${gran}&hours=${hours}`),
  ]);

  if (reqRes.success) {
    requestStats.value = reqRes.data;
  }
  if (tokRes.success) {
    tokenStats.value = tokRes.data;
  }
}

async function fetchAll() {
  await fetchProviders();
  await fetchStats();
}

watch(activeRange, () => {
  fetchStats();
});

watch(activeAuthKey, () => {
  fetchStats();
});

onMounted(fetchAll);
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="page-title" data-testid="stats-title">{{ $t('stats.title') }}</h1>
      <p class="page-subtitle">{{ $t('stats.subtitle') }}</p>
    </div>

    <LoadingSpinner v-if="api.loading.value && !authTabs.length" />

    <template v-else-if="authTabs.length">
      <!-- Auth tabs (pill style) -->
      <div
        class="flex flex-wrap gap-2 mb-6"
        data-testid="stats-auth-tabs"
        role="tablist"
      >
        <button
          v-for="tab in authTabs"
          :key="tab.key"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap border',
            activeAuthKey === tab.displayKey
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 shadow-sm'
              : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-300',
          ]"
          :data-testid="`stats-auth-tab-${tab.displayKey.slice(0, 8)}`"
          @click="activeAuthKey = tab.displayKey"
          role="tab"
          :aria-selected="activeAuthKey === tab.displayKey"
        >
          {{ tab.provider }} / {{ tab.displayKey }}<span v-if="tab.name">（{{ tab.name }}）</span>
        </button>
      </div>

      <template v-if="activeAuthKey">
        <!-- Token usage line chart -->
        <div class="card p-5 mb-6" data-testid="stats-token-chart">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span class="i-tabler-chart-line w-4 h-4 text-purple-500" />
              {{ $t('stats.inputTokens') }}
            </h3>
            <!-- Time range switcher (pill buttons) -->
            <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5" role="tablist">
              <button
                v-for="opt in rangeOptions"
                :key="opt.value"
                :class="[
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  activeRange === opt.value
                    ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300',
                ]"
                :data-testid="`stats-range-${opt.value}`"
                @click="activeRange = opt.value"
                role="tab"
                :aria-selected="activeRange === opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Chart legend -->
          <div class="flex gap-5 mb-3 text-xs text-gray-500 dark:text-gray-400 justify-end">
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-0.5 rounded-full inline-block" style="background:#6366f1" />
              {{ $t('stats.inputTokens') }}
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-0.5 rounded-full inline-block" style="background:#22c55e" />
              {{ $t('stats.outputTokens') }}
            </span>
            <span class="flex items-center gap-1.5">
              <span class="w-3 h-0.5 rounded-full inline-block" style="background:#f59e0b" />
              {{ $t('stats.cacheTokens') }}
            </span>
          </div>

          <div v-if="activeTokenStats.length" class="relative" style="min-height: 240px">
            <Line :data="chartData" :options="chartOptions" />
          </div>
          <EmptyState v-else :message="$t('stats.noTokenData')" />
        </div>

        <!-- Request weighted counts (cards) -->
        <div class="card p-5" data-testid="stats-request-counts">
          <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
            <span class="i-tabler-numbers w-4 h-4 text-indigo-500" />
            {{ $t('stats.requests') }} — {{ getActiveAuth()?.provider || '' }}
          </h3>
          <div v-if="Object.keys(requestWeightedData).length" class="grid grid-cols-3 gap-4">
            <div
              v-for="(label, period) in weightedPeriodLabels"
              :key="period"
              class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center border border-gray-100 dark:border-gray-600"
              :data-testid="`stats-weighted-${period}`"
            >
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ label }}</div>
              <div class="text-2xl font-semibold text-gray-800 dark:text-gray-200 font-mono">
                {{ (requestWeightedData[period] ?? 0).toLocaleString() }}
              </div>
              <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ $t('stats.times') }}</div>
            </div>
          </div>
          <EmptyState v-else :message="$t('stats.noRequestData')" />
        </div>
      </template>

      <EmptyState v-else :message="$t('common.noData')" />
    </template>

    <EmptyState v-else :message="$t('common.noData')" />
  </div>
</template>
