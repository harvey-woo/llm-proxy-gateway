<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApi } from "../composables/useApi";
import { useToast } from "../composables/useToast";

import LoadingSpinner from "../components/LoadingSpinner.vue";
import EmptyState from "../components/EmptyState.vue";
import AppModal from "../components/AppModal.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";

interface AuthDisplay {
  provider_id: string;
  provider_name: string;
  key: string;
  name?: string;
  auth_type: "api_key" | "oauth";
  oauth_metadata?: string;
  status?: "healthy" | "warning" | "rate_limited";
  usage?: Array<{
    type: string;
    period: string;
    used: number;
    max: number;
  }>;
}

interface ProviderOption {
  id: string;
  name: string;
  base_url?: string;
}

interface ParsedSession {
  accessToken: string;
  sessionToken?: string;
  email?: string;
  planType?: string;
  userName?: string;
  userId?: string;
  expiresAt?: string;
}

const api = useApi();
const toast = useToast();
const { t } = useI18n();

const isDesktop =
  typeof window !== "undefined" && !!(window as any).__electrobun;

const authsList = ref<AuthDisplay[]>([]);
const providers = ref<ProviderOption[]>([]);
const showAddModal = ref(false);
const activeTab = ref<"api_key" | "oauth">("api_key");

// API Key form
const formProviderId = ref("");
const formKey = ref("");
const formName = ref("");

// ── OAuth import ──
// ============================================================
// OAuth 类型：
// Codex → Codex API
//   - 粘贴：Codex JSON 文件（例如 CPA 导出的 codex-xxx.json）
//   - OAuth：跳转 auth.openai.com 完成授权
//   → 适用于 chatgpt.com/backend-api/codex 供应商
// ============================================================
const OAUTH_TYPE_PRESETS: Record<
  string,
  {
    label: string;
    baseUrlPattern: string;
    description: string;
    flowType: "codex";
  }
> = {
  codex: {
    label: "Codex",
    baseUrlPattern: "chatgpt.com/backend-api/codex",
    description: "Paste codex JSON or import via OAuth",
    flowType: "codex",
  },
};

const oauthTypes = Object.entries(OAUTH_TYPE_PRESETS).map(([key, val]) => ({
  id: key,
  label: val.label,
  baseUrlPattern: val.baseUrlPattern,
  description: val.description,
  flowType: val.flowType,
}));

const selectedOauthType = ref("");
const oauthProviderId = ref("");
const oauthName = ref("");

// Codex sub-tab: "paste" or "oauth"
const codexSubTab = ref<"oauth" | "paste">("oauth");

// Confirm dialog state (ElectroBun doesn't support native confirm())
const deleteConfirm = ref<{
  show: boolean;
  providerId: string;
  key: string;
}>({ show: false, providerId: "", key: "" });

function confirmDelete(providerId: string, key: string) {
  deleteConfirm.value = { show: true, providerId, key };
}

function handleDeleteConfirmed() {
  const { providerId, key } = deleteConfirm.value;
  deleteConfirm.value = { show: false, providerId: "", key: "" };
  doDeleteAuth(providerId, key);
}

// Codex JSON paste
const codexJsonInput = ref("");
const codexParsedInfo = ref<ParsedSession | null>(null);

// Codex OAuth state
const codexOAuthState = ref("");
const codexOAuthUrl = ref("");
const codexOAuthStatus = ref<"idle" | "authorizing" | "completed" | "error">(
  "idle",
);
const codexOAuthError = ref("");
const codexUrlCopied = ref(false);
let codexPollTimer: ReturnType<typeof setInterval> | null = null;

// Providers filtered by OAuth type baseUrl pattern
const filteredProviders = computed(() => {
  const preset = oauthTypes.find((o) => o.id === selectedOauthType.value);
  if (!preset) return [];
  return providers.value.filter((p) =>
    p.base_url?.toLowerCase().includes(preset.baseUrlPattern),
  );
});

// Selected OAuth type label
const selectedOauthTypeLabel = computed(() => {
  const preset = oauthTypes.find((o) => o.id === selectedOauthType.value);
  return preset?.label ?? "";
});

function onOauthTypeChange() {
  oauthProviderId.value = "";
  codexOAuthStatus.value = "idle";
  codexOAuthState.value = "";
  codexOAuthUrl.value = "";
  codexOAuthError.value = "";
  if (codexPollTimer) {
    clearInterval(codexPollTimer);
    codexPollTimer = null;
  }
  codexJsonInput.value = "";
  codexParsedInfo.value = null;
  codexSubTab.value = "oauth";

  // 自动选中唯一的匹配供应商
  const preset = oauthTypes.find((o) => o.id === selectedOauthType.value);
  if (preset) {
    const matching = providers.value.filter((p) =>
      p.base_url?.toLowerCase().includes(preset.baseUrlPattern),
    );
    if (matching.length === 1) {
      oauthProviderId.value = matching[0].id;
    }
  }
}

/** 当前选中的 OAuth 类型的 flowType */
const selectedFlowType = computed(() => {
  const preset = oauthTypes.find((o) => o.id === selectedOauthType.value);
  return preset?.flowType ?? null;
});

// ── Codex OAuth 流程 ──

async function startCodexOAuth() {
  if (!oauthProviderId.value) {
    toast.error(t("auths.codexMissingProvider"));
    return;
  }

  codexOAuthStatus.value = "authorizing";
  codexOAuthError.value = "";

  const res = await api.get<{ url: string; state: string }>(
    `/api/oauth/codex/authorize?provider_id=${encodeURIComponent(oauthProviderId.value)}`,
  );

  if (!res.success) {
    codexOAuthStatus.value = "error";
    codexOAuthError.value = res.error ?? t("auths.codexOAuthUrlError");
    toast.error(codexOAuthError.value);
    return;
  }

  const { url, state } = res.data;
  codexOAuthState.value = state;
  codexOAuthUrl.value = url;

  // Open the auth URL — desktop: send to host to open system browser; web: new tab
  if (isDesktop && (window as any).__electrobunSendToHost) {
    (window as any).__electrobunSendToHost({ type: "open-url", url });
  } else {
    window.open(url, "_blank");
  }

  // Start polling for completion
  if (codexPollTimer) clearInterval(codexPollTimer);
  codexPollTimer = setInterval(async () => {
    const statusRes = await api.get<{
      data: { status: string; error?: string };
    }>(`/api/oauth/codex/status?state=${encodeURIComponent(state)}`);

    if (!statusRes.success) return;

    const { status, error } = statusRes.data;
    if (status === "completed") {
      codexOAuthStatus.value = "completed";
      if (codexPollTimer) {
        clearInterval(codexPollTimer);
        codexPollTimer = null;
      }
      toast.success(t("auths.codexAuthSuccess"));
      await fetchAuths();
    } else if (status === "error") {
      codexOAuthStatus.value = "error";
      codexOAuthError.value = error ?? t("auths.codexAuthFailed");
      if (codexPollTimer) {
        clearInterval(codexPollTimer);
        codexPollTimer = null;
      }
      toast.error(codexOAuthError.value);
    }
    // "pending" → keep polling
  }, 1500);
}

/** 用户手动确认授权完成（兜底：当轮询卡死时使用） */
async function handleCodexAuthDone() {
  if (codexPollTimer) {
    clearInterval(codexPollTimer);
    codexPollTimer = null;
  }
  codexOAuthStatus.value = "completed";
  await fetchAuths();
  toast.success(t("auths.codexAuthSuccess"));
}

/** OAuth 完成后的保存：关闭弹窗并刷新列表 */
async function confirmOAuthSave() {
  showAddModal.value = false;
  await api.post("/api/oauth/codex/cancel").catch(() => {});
  resetOAuthForm();
  await fetchAuths();
  toast.success(t("auths.codexAuthSuccess"));
}

/** 取消 OAuth 授权，关闭 1455 回调服务器 */
async function cancelCodexOAuth() {
  if (codexOAuthUrl.value) {
    await api.post("/api/oauth/codex/cancel").catch(() => {});
  }
  showAddModal.value = false;
  resetOAuthForm();
}

function copyCodexUrl() {
  navigator.clipboard
    .writeText(codexOAuthUrl.value)
    .then(() => {
      codexUrlCopied.value = true;
      setTimeout(() => {
        codexUrlCopied.value = false;
      }, 5000);
    })
    .catch(() => {
      codexUrlCopied.value = true;
      setTimeout(() => {
        codexUrlCopied.value = false;
      }, 5000);
    });
}

async function fetchProviders() {
  // 先拉取模板（后端自动 seed 新增供应商）
  await api.get("/api/templates");

  const res = await api.get<{
    data: { id: string; name: string; base_url?: string }[];
  }>("/api/providers");
  if (res.success) {
    const list = res.data.data ?? (res.data as any);
    providers.value = list.map((p: any) => ({
      id: p.id,
      name: p.name,
      base_url: p.base_url,
    }));
  }
}

async function fetchAuths() {
  const res = await api.get<{ data: { id: string; name: string }[] }>(
    "/api/providers",
  );
  if (!res.success) {
    toast.error(t("auths.getProvidersFailed"));
    return;
  }

  const statsRes = await api.get<any>("/api/stats/dashboard");
  const rateLimitedAuths: string[] = [];
  if (statsRes.success) {
    const stats = statsRes.data.data ?? statsRes.data;
    if (Array.isArray(stats.rate_limited_auths)) {
      rateLimitedAuths.push(
        ...stats.rate_limited_auths.map((r: any) => r.auth_key),
      );
    }
  }

  const list = res.data.data ?? (res.data as any);
  const items: AuthDisplay[] = [];
  for (const p of list) {
    const authRes = await api.get<{
      data: Array<{
        key: string;
        name?: string;
        auth_type?: string;
        oauth_metadata?: string;
      }>;
    }>(`/api/providers/${p.id}/auths`);
    if (authRes.success) {
      const auths = authRes.data.data ?? (authRes.data as any);
      for (const a of auths) {
        items.push({
          provider_id: p.id,
          provider_name: p.name,
          key: a.key,
          name: a.name,
          auth_type: a.auth_type ?? "api_key",
          oauth_metadata: a.oauth_metadata,
          status: rateLimitedAuths.includes(a.key) ? "rate_limited" : "healthy",
        });
      }
    }
  }
  authsList.value = items;
  await fetchUsage();
}

async function addAuth() {
  if (!formProviderId.value) {
    toast.error(t("auths.providerRequired"));
    return;
  }
  if (!formKey.value.trim()) {
    toast.error(t("auths.keyRequired"));
    return;
  }
  const res = await api.post(`/api/providers/${formProviderId.value}/auths`, {
    key: formKey.value.trim(),
    name: formName.value.trim() || undefined,
    auth_type: "api_key",
  });
  if (res.success) {
    toast.success(t("auths.addSuccess"));
    showAddModal.value = false;
    formProviderId.value = "";
    formKey.value = "";
    formName.value = "";
    await fetchAuths();
  } else {
    toast.error(res.error ?? t("auths.addFailed"));
  }
}

// ── Codex JSON 导入 ──
// Codex JSON 格式：{access_token, refresh_token, id_token, email, expired, account_id, type}
// 例如 CPA 导出的 codex-xxx@example.com-free.json 文件

function parseCodexJson(raw: string): void {
  codexParsedInfo.value = null;
  if (!raw.trim()) return;
  try {
    const data = JSON.parse(raw.trim());
    const accessToken = data.access_token ?? data.accessToken ?? "";
    if (!accessToken) {
      toast.error(t("auths.codexNoAccessToken"));
      return;
    }

    // Parse JWT for plan type
    let planType = "";
    if (accessToken.includes(".")) {
      try {
        const parts = accessToken.split(".");
        const jwt = JSON.parse(atob(parts[1]));
        const codexAuth = jwt["https://api.openai.com/auth"];
        if (codexAuth?.chatgpt_plan_type) {
          planType = codexAuth.chatgpt_plan_type;
        }
      } catch {
        /* ignore JWT parse errors */
      }
    }

    codexParsedInfo.value = {
      accessToken,
      sessionToken: data.refresh_token ?? data.sessionToken,
      email: data.email ?? "",
      planType: planType || data.plan_type || "",
      expiresAt: data.expired ?? data.expires ?? "",
    };
    toast.success(t("auths.codexParseSuccess"));
  } catch {
    toast.warning(t("auths.codexParseError"));
  }
}

async function importCodexJson() {
  if (!oauthProviderId.value) {
    toast.error(t("auths.providerRequired"));
    return;
  }
  if (!codexParsedInfo.value) {
    toast.error(t("auths.codexPasteFirst"));
    return;
  }

  // 校验必要字段
  if (!codexParsedInfo.value.accessToken) {
    toast.error(t("auths.codexNoAccessToken"));
    return;
  }
  // access_token 应该是 JWT 格式（三段式）
  if (codexParsedInfo.value.accessToken.split(".").length !== 3) {
    toast.error(t("auths.codexInvalidJwt"));
    return;
  }

  const res = await api.post("/api/oauth/import", {
    provider_id: oauthProviderId.value,
    access_token: codexParsedInfo.value.accessToken,
    refresh_token: codexParsedInfo.value.sessionToken || undefined,
    email: codexParsedInfo.value.email || undefined,
    plan_type: codexParsedInfo.value.planType || undefined,
    expires_at: codexParsedInfo.value.expiresAt || undefined,
    name: oauthName.value.trim() || undefined,
  });
  if (res.success) {
    toast.success(t("auths.codexImportSuccess"));
    showAddModal.value = false;
    resetOAuthForm();
    await fetchAuths();
  } else {
    toast.error(res.error ?? t("auths.codexImportFailed"));
  }
}

function resetOAuthForm() {
  selectedOauthType.value = "";
  oauthProviderId.value = "";
  oauthName.value = "";
  codexJsonInput.value = "";
  codexParsedInfo.value = null;
  codexSubTab.value = "oauth";
  codexOAuthStatus.value = "idle";
  codexOAuthState.value = "";
  codexOAuthUrl.value = "";
  codexOAuthError.value = "";
  codexUrlCopied.value = false;
  if (codexPollTimer) {
    clearInterval(codexPollTimer);
    codexPollTimer = null;
  }
}

async function doDeleteAuth(providerId: string, key: string) {
  const res = await api.remove(
    `/api/providers/${providerId}/auths/${encodeURIComponent(key)}`,
  );
  if (res.success) {
    toast.success(t("auths.deleteSuccess"));
    await fetchAuths();
  } else {
    toast.error(res.error ?? t("common.delete"));
  }
}

async function fetchUsage() {
  const res =
    await api.get<
      Array<{
        provider_id: string;
        auth_key: string;
        usage: Array<{
          type: string;
          period: string;
          used: number;
          max: number;
        }>;
      }>
    >("/api/auths/usage");
  if (!res.success) return;

  const usageData = Array.isArray(res.data)
    ? res.data
    : (res.data as any)?.data;
  if (!Array.isArray(usageData)) return;

  // Merge usage into authsList
  for (const item of usageData) {
    const auth = authsList.value.find(
      (a) => a.key === item.auth_key && a.provider_id === item.provider_id,
    );
    if (auth) {
      auth.usage = item.usage;
    }
  }
}
defineExpose({ fetchUsage });

async function syncUsage(providerId: string, authKey: string) {
  const res = await api.post("/api/auths/sync-usage", {
    provider_id: providerId,
    auth_key: authKey,
  });
  if (res.success) {
    toast.success(t("auths.syncUsageSuccess"));
    await fetchUsage();
  } else {
    toast.error(res.error ?? t("auths.syncUsageFailed"));
  }
}

function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return key.slice(0, 6) + "..." + key.slice(-4);
}

function formatUsage(used: number, max: number): string {
  if (max === 0) return `${used}`;
  const pct = Math.round((used / max) * 100);
  return `${used}/${max} (${pct}%)`;
}

function usageColor(used: number, max: number): string {
  if (max === 0) return "text-gray-500";
  const pct = used / max;
  if (pct >= 0.9) return "text-red-600 dark:text-red-400";
  if (pct >= 0.7) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

function openAddModal() {
  activeTab.value = "api_key";
  formProviderId.value = "";
  formKey.value = "";
  formName.value = "";
  resetOAuthForm();
  showAddModal.value = true;
}

onMounted(() => {
  fetchProviders();
  fetchAuths();
});

// 弹窗关闭时自动关闭 1455 回调服务器
watch(showAddModal, (open) => {
  if (!open && codexOAuthUrl.value) {
    api.post("/api/oauth/codex/cancel").catch(() => {});
  }
});
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title" data-testid="auths-title">{{ $t("auths.title") }}</h1>
        <p class="page-subtitle">{{ $t("auths.subtitle") }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="btn-secondary"
          data-testid="auth-refresh-usage-btn"
          @click="fetchUsage"
        >
          <span class="i-tabler-refresh text-sm" />
          {{ $t("auths.refreshUsage") }}
        </button>
        <button
          class="btn-primary"
          data-testid="auth-add-btn"
          @click="openAddModal"
        >
          + {{ $t("common.add") }}
        </button>
      </div>
    </div>

    <LoadingSpinner v-if="api.loading.value && authsList.length === 0" />

    <EmptyState
      v-else-if="authsList.length === 0"
      :message="$t('auths.empty')"
    />

    <div v-else class="card overflow-x-auto" data-testid="auths-table">
      <table class="table-wrap">
        <thead class="table-head">
          <tr>
            <th class="table-th-sticky">{{ $t("common.name") }}</th>
            <th class="table-th">{{ $t("auths.provider") }}</th>
            <th class="table-th">{{ $t("auths.authType") }}</th>
            <th class="table-th">{{ $t("auths.apiKey") }}</th>
            <th class="table-th">{{ $t("common.status") }}</th>
            <th class="table-th">{{ $t("auths.usage") }}</th>
            <th class="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">{{ $t("common.delete") }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="a in authsList" :key="a.key + a.provider_id" class="table-row" :data-testid="`auth-row-${a.key.slice(0, 8)}`">
            <td class="table-td-sticky">
              <span class="text-gray-900 dark:text-gray-100">{{ a.name || "-" }}</span>
            </td>
            <td class="table-td">
              <span class="text-gray-900 dark:text-gray-100 font-medium">{{ a.provider_name }}</span>
              <code class="text-xs text-gray-400 dark:text-gray-500 ml-1">({{ a.provider_id }})</code>
            </td>
            <td class="table-td">
              <span v-if="a.auth_type === 'oauth'" class="badge-oauth font-mono text-xs">
                {{ $t("auths.oauthLabel") }}
              </span>
              <span v-else class="badge-gray font-mono text-xs">
                {{ $t("auths.apiKeyLabel") }}
              </span>
            </td>
            <td class="table-td">
              <code class="badge-gray font-mono">{{ maskKey(a.key) }}</code>
            </td>
            <td class="table-td">
                <span v-if="a.status === 'rate_limited'" class="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                  <span class="i-tabler-alert-circle text-sm" /> {{ $t("auths.rateLimited") }}
                </span>
                <span v-else class="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                  <span class="i-tabler-circle-check text-sm" /> {{ $t("auths.normal") }}
                </span>
            </td>
            <td class="table-td">
              <div v-if="a.usage && a.usage.length > 0" class="space-y-0.5">
                <div v-for="u in a.usage" :key="u.period + u.type" class="text-xs whitespace-nowrap" :class="usageColor(u.used, u.max)">
                  <span class="font-mono">{{ u.period }}:</span>
                  <template v-if="u.type === 'credits'">
                    {{ formatUsage(u.used, u.max) }}
                  </template>
                  <template v-else-if="u.type === 'reviews'">
                    {{ formatUsage(u.used, u.max) }}
                  </template>
                  <template v-else>
                    {{ formatUsage(u.used, u.max) }}
                  </template>
                </div>
              </div>
              <span v-else class="text-xs text-gray-400 dark:text-gray-500">-</span>
            </td>
            <td class="table-td text-right">
              <button
                v-if="a.auth_type === 'oauth'"
                class="btn-secondary btn-xs mr-1"
                data-testid="auth-sync-usage-btn"
                @click="syncUsage(a.provider_id, a.key)"
              >
                {{ $t("auths.syncUsage") }}
              </button>
              <button
                class="btn-danger"
                data-testid="auth-delete-btn"
                @click="confirmDelete(a.provider_id, a.key)"
              >
                {{ $t("common.delete") }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Auth Modal -->
    <AppModal v-model:open="showAddModal" :title="$t('auths.addTitle')" width="max-w-lg" data-testid="auth-add-modal">
      <!-- Tabs -->
      <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'api_key'
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
          @click="activeTab = 'api_key'"
        >
          {{ $t("auths.addTabApiKey") }}
        </button>
        <button
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer"
          :class="activeTab === 'oauth'
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
          @click="activeTab = 'oauth'"
        >
          {{ $t("auths.addTabOAuthImport") }}
        </button>
      </div>

      <!-- API Key Tab -->
      <div v-if="activeTab === 'api_key'" class="space-y-4">
        <div>
          <label class="form-label">{{ $t("auths.provider") }}</label>
          <select
            v-model="formProviderId"
            class="select"
            data-testid="auth-provider-select"
          >
            <option value="">{{ $t("auths.selectProvider") }}</option>
            <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
          </select>
        </div>
        <div>
          <label class="form-label">{{ $t("auths.apiKey") }}</label>
          <input
            v-model="formKey"
            type="text"
            class="input"
            data-testid="auth-key-input"
            :placeholder="$t('auths.keyPlaceholder')"
          />
        </div>
        <div>
          <label class="form-label">{{ $t("auths.name") }}</label>
          <input
            v-model="formName"
            type="text"
            class="input"
            data-testid="auth-name-input"
            :placeholder="$t('auths.namePlaceholder')"
          />
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button
            class="btn-secondary"
            data-testid="auth-cancel-btn"
            @click="cancelCodexOAuth()"
          >
            {{ $t("common.cancel") }}
          </button>
          <button
            class="btn-primary"
            data-testid="auth-save-btn"
            @click="addAuth"
          >
            {{ $t("common.save") }}
          </button>
        </div>
      </div>

      <!-- OAuth Import Tab -->
      <div v-else class="space-y-4">
        <!-- OAuth 类型选择 -->
        <div>
          <label class="form-label">{{ $t("auths.oauthType") }}</label>
          <select
            v-model="selectedOauthType"
            class="select"
            @change="onOauthTypeChange"
          >
            <option value="">{{ $t("auths.selectOAuthType") }}</option>
            <option v-for="ot in oauthTypes" :key="ot.id" :value="ot.id">{{ ot.label }}</option>
          </select>
        </div>

        <!-- 选择供应商（按 OAuth 类型过滤） -->
        <div v-if="selectedOauthType">
          <label class="form-label">{{ $t("auths.provider") }}</label>
          <select
            v-model="oauthProviderId"
            class="select"
          >
            <option value="">{{ $t("auths.selectProvider") }}</option>
            <option v-for="p in filteredProviders" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
          </select>
          <p v-if="filteredProviders.length === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1" v-html="$t('auths.noProviderMatch', { pattern: oauthTypes.find(o => o.id === selectedOauthType)?.baseUrlPattern })" />
        </div>

        <!-- Codex 流程：支持粘贴 JSON 或 OAuth 授权 -->
        <template v-if="selectedFlowType === 'codex'">
          <!-- 子 Tab：OAuth / 粘贴 -->
          <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            <button
              class="px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer"
              :class="codexSubTab === 'oauth'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
              @click="codexSubTab = 'oauth'"
            >
              {{ $t("auths.codexOAuthTab") }}
            </button>
            <button
              class="px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer"
              :class="codexSubTab === 'paste'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
              @click="codexSubTab = 'paste'"
            >
              {{ $t("auths.codexPasteTab") }}
            </button>
          </div>

          <!-- OAuth 授权子页面（默认） -->
          <template v-if="codexSubTab === 'oauth'">
            <div class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div class="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-1.5">
                <span class="i-tabler-brand-openai text-base" />
                {{ $t("auths.codexOAuthTitle") }}
              </div>
              <div class="space-y-2 text-sm text-purple-700 dark:text-purple-300">
                <p>{{ $t("auths.codexOAuthDesc") }}</p>
                <div class="flex gap-2.5">
                  <span class="flex-shrink-0 w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                  <div>
                    <span class="font-medium">{{ $t("auths.codexOAuthStep1") }}</span>
                    <p class="text-purple-500 dark:text-purple-400 text-xs mt-0.5">{{ isDesktop ? $t('auths.codexOAuthStep1Desc') : $t('auths.codexOAuthStep1DescBrowser') }}</p>
                  </div>
                </div>
                <div class="flex gap-2.5">
                  <span class="flex-shrink-0 w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                  <div>
                    <span class="font-medium">{{ $t("auths.codexOAuthStep2") }}</span>
                    <p class="text-purple-500 dark:text-purple-400 text-xs mt-0.5">{{ $t("auths.codexOAuthStep2Desc") }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 授权状态 -->
            <div v-if="codexOAuthStatus === 'authorizing'" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div class="text-center mb-3">
                <div class="i-tabler-loader-3 text-2xl text-blue-500 animate-spin mx-auto mb-2" />
                <p class="text-sm text-blue-700 dark:text-blue-300">{{ $t("auths.codexOAuthWaiting") }}</p>
              </div>
              <div class="bg-white dark:bg-blue-950/40 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                <p class="text-xs text-blue-500 dark:text-blue-400 mb-1.5">{{ $t("auths.codexOAuthManual") }}</p>
                <div class="flex items-center gap-1.5">
                  <code class="flex-1 text-xs font-mono bg-blue-100 dark:bg-blue-900/60 px-2 rounded truncate select-all h-7 leading-none inline-flex items-center">{{ codexOAuthUrl }}</code>
                  <button
                    class="flex-shrink-0 px-2 rounded text-xs font-medium transition-colors h-7 inline-flex items-center gap-1"
                    :class="codexUrlCopied ? 'bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-300' : 'bg-blue-200 text-blue-700 hover:bg-blue-300 dark:bg-blue-700 dark:text-blue-200 dark:hover:bg-blue-600'"
                    @click="copyCodexUrl"
                  >
                    <span v-if="codexUrlCopied" class="i-tabler-check text-sm" />
                    <span v-else class="i-tabler-copy text-sm" />
                    {{ codexUrlCopied ? $t('auths.codexCopied') : $t('auths.codexCopy') }}
                  </button>
                </div>
              </div>
            </div>
            <div v-else-if="codexOAuthStatus === 'completed'" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center cursor-pointer" @click="handleCodexAuthDone">
              <span class="i-tabler-circle-check text-2xl text-green-500 mx-auto block mb-1" />
              <p class="text-sm font-medium text-green-700 dark:text-green-300">{{ $t("auths.codexOAuthSuccess") }}</p>
              <p class="text-xs text-green-500 dark:text-green-400 mt-1">{{ $t("auths.codexClosePrompt") }}</p>
            </div>
            <div v-else-if="codexOAuthStatus === 'error'" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
              <span class="i-tabler-alert-circle text-2xl text-red-500 mx-auto block mb-1" />
              <p class="text-sm font-medium text-red-700 dark:text-red-300">{{ $t("auths.codexOAuthFailed") }}</p>
              <p class="text-xs text-red-500 dark:text-red-400 mt-1">{{ codexOAuthError }}</p>
            </div>

            <div v-if="codexSubTab === 'oauth'" class="flex items-center justify-center gap-3 py-4">
              <!-- 初始/错误状态 → 开始授权 -->
              <template v-if="codexOAuthStatus === 'idle' || codexOAuthStatus === 'error'">
                <button
                  class="btn-primary"
                  :disabled="!oauthProviderId"
                  @click="startCodexOAuth"
                >
                  <span class="i-tabler-brand-openai text-sm mr-1" />
                  {{ $t("auths.codexOAuthBtn") }}
                </button>
              </template>
              <!-- 授权中 → 重试 + 手动检查 -->
              <template v-if="codexOAuthStatus === 'authorizing'">
                <button
                  class="btn-secondary"
                  @click="resetOAuthForm(); selectedOauthType = 'codex'; onOauthTypeChange()"
                >
                  <span class="i-tabler-refresh text-sm mr-1" />
                  {{ $t("common.retry") }}
                </button>
                <button
                  class="btn-primary"
                  @click="handleCodexAuthDone"
                >
                  <span class="i-tabler-check text-sm mr-1" />
                  {{ $t("auths.codexCheckDone") }}
                </button>
              </template>
            </div>
          </template>

          <!-- 粘贴 JSON 子页面 -->
          <template v-if="codexSubTab === 'paste'">
            <div class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div class="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-1.5">
                <span class="i-tabler-file-text text-base" />
                {{ $t("auths.codexPasteTitle") }}
              </div>
              <div class="space-y-2 text-sm text-purple-700 dark:text-purple-300">
                <p v-html="$t('auths.codexPasteDesc')" />
                <div class="flex gap-2.5">
                  <span class="flex-shrink-0 w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
                  <div>
                    <span class="font-medium">{{ $t("auths.codexPasteStep1") }}</span>
                    <p class="text-purple-500 dark:text-purple-400 text-xs mt-0.5" v-html="$t('auths.codexPasteStep1Desc')" />
                  </div>
                </div>
                <div class="flex gap-2.5">
                  <span class="flex-shrink-0 w-5 h-5 rounded-full bg-purple-200 dark:bg-purple-700 text-purple-700 dark:text-purple-200 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
                  <div>
                    <span class="font-medium">{{ $t("auths.codexPasteStep2") }}</span>
                    <p class="text-purple-500 dark:text-purple-400 text-xs mt-0.5">{{ $t("auths.codexPasteStep2Desc") }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label class="form-label flex items-center gap-1.5">
                Codex JSON
                <span v-if="codexParsedInfo" class="text-green-600 dark:text-green-400 text-xs font-normal flex items-center gap-0.5">
                  <span class="i-tabler-circle-check text-xs" /> {{ $t("auths.parseSuccess") }}
                </span>
              </label>
              <textarea
                v-model="codexJsonInput"
                class="input font-mono text-xs h-36 resize-y"
                :class="codexParsedInfo ? 'border-green-300 dark:border-green-700 focus:border-green-500' : ''"
                :placeholder="$t('auths.codexPlaceholder')"
                @input="parseCodexJson(codexJsonInput)"
              />
            </div>

            <!-- 解析结果预览 -->
            <div v-if="codexParsedInfo" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm">
              <div class="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-1.5">
                <span class="i-tabler-user-check text-base" />
                {{ $t("auths.recognizedInfo") }}
              </div>
              <div class="grid grid-cols-2 gap-2 text-green-700 dark:text-green-300">
                <div>
                  <span class="text-green-500 dark:text-green-400 text-xs">{{ $t("auths.email") }}</span>
                  <div class="font-mono text-xs truncate">{{ codexParsedInfo.email || '-' }}</div>
                </div>
                <div>
                  <span class="text-green-500 dark:text-green-400 text-xs">{{ $t("auths.plan") }}</span>
                  <div class="font-mono text-xs">{{ codexParsedInfo.planType || '-' }}</div>
                </div>
                <div class="col-span-2">
                  <span class="text-green-500 dark:text-green-400 text-xs">{{ $t("auths.expires") }}</span>
                  <div class="font-mono text-xs">{{ codexParsedInfo.expiresAt ? new Date(codexParsedInfo.expiresAt).toLocaleString() : '-' }}</div>
                </div>
              </div>
            </div>
          </template>
        </template>

        <!-- 名称（可选） -->
        <div>
          <label class="form-label">{{ $t("auths.name") }}</label>
          <input
            v-model="oauthName"
            type="text"
            class="input"
            :placeholder="$t('auths.namePlaceholder')"
          />
        </div>

        <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            class="btn-secondary"
            @click="cancelCodexOAuth()"
          >
            {{ $t("common.cancel") }}
          </button>
          <button
            v-if="selectedFlowType === 'codex' && codexSubTab === 'paste'"
            class="btn-primary"
            :disabled="!codexParsedInfo"
            @click="importCodexJson"
          >
            {{ $t("auths.importBtn") }}
          </button>
          <button
            v-if="codexSubTab === 'oauth' && codexOAuthStatus === 'completed'"
            class="btn-primary"
            @click="confirmOAuthSave"
          >
            <span class="i-tabler-check text-sm mr-1" />
            {{ $t("auths.confirmSave") }}
          </button>
        </div>
      </div>
    </AppModal>

    <!-- Delete Confirmation -->
    <ConfirmDialog
      :open="deleteConfirm.show"
      :title="$t('confirm.deleteTitle')"
      :message="$t('confirm.deleteMessage', { key: deleteConfirm.key.slice(0, 6) + '...' })"
      confirm-text="删除"
      confirm-class="bg-red-600 hover:bg-red-700 text-white"
      @confirm="handleDeleteConfirmed"
      @cancel="deleteConfirm = { show: false, providerId: '', key: '' }"
      @update:open="deleteConfirm.show = $event"
    />
  </div>
</template>
