<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useApi } from "../composables/useApi";
import { useToast } from "../composables/useToast";

import LoadingSpinner from "../components/LoadingSpinner.vue";
import EmptyState from "../components/EmptyState.vue";
import AppModal from "../components/AppModal.vue";

interface AuthDisplay {
  provider_id: string;
  provider_name: string;
  key: string;
  name?: string;
  auth_type: "api_key" | "oauth";
  oauth_metadata?: string;
  status?: "healthy" | "warning" | "rate_limited";
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

const authsList = ref<AuthDisplay[]>([]);
const providers = ref<ProviderOption[]>([]);
const showAddModal = ref(false);
const activeTab = ref<"api_key" | "oauth">("api_key");

// API Key form
const formProviderId = ref("");
const formKey = ref("");
const formName = ref("");

// ── OAuth import ──
// OAuth provider presets. Add new entries here when a new provider is supported.
// codex: ChatGPT session JSON → accessToken → api.openai.com Bearer auth
const OAUTH_TYPE_PRESETS: Record<string, { label: string; baseUrlPattern: string }> = {
  codex: { label: "OpenAI Codex", baseUrlPattern: "api.openai.com" },
};

const oauthTypes = Object.entries(OAUTH_TYPE_PRESETS).map(([key, val]) => ({
  id: key,
  label: val.label,
  baseUrlPattern: val.baseUrlPattern,
}));

const selectedOauthType = ref("");
const oauthProviderId = ref("");
const oauthSessionJson = ref("");
const parsedInfo = ref<ParsedSession | null>(null);

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
  oauthSessionJson.value = "";
  parsedInfo.value = null;
}

function copyUrl() {
  navigator.clipboard.writeText("https://chatgpt.com/api/auth/session").then(() => {
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  }).catch(() => {
    // fallback: select the code element manually
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  });
}

function parseSessionJson(raw: string): void {
  parsedInfo.value = null;
  if (!raw.trim()) return;
  try {
    const data = JSON.parse(raw.trim());
    // ChatGPT session JSON: { user: {id, name, email}, expires, accessToken, sessionToken, account: {planType} }
    const accessToken = data.accessToken ?? data.access_token ?? "";
    if (!accessToken) {
      toast.error("JSON 中未找到 accessToken");
      return;
    }
    const sessionToken = data.sessionToken ?? data.refresh_token;
    const user = data.user ?? {};
    const account = data.account ?? {};
    const expires = data.expires ?? data.expires_at;

    // Parse JWT accessToken for plan type if not in top-level
    let planType = account.planType ?? account.plan_type ?? "";
    if (!planType && accessToken.includes(".")) {
      try {
        const parts = accessToken.split(".");
        const jwt = JSON.parse(atob(parts[1]));
        const codexAuth = jwt["https://api.openai.com/auth"];
        if (codexAuth?.chatgpt_plan_type) {
          planType = codexAuth.chatgpt_plan_type;
        }
      } catch { /* ignore JWT parse errors */ }
    }

    parsedInfo.value = {
      accessToken,
      sessionToken,
      email: user.email ?? "",
      planType,
      userName: user.name ?? user.id ?? "",
      userId: user.id ?? "",
      expiresAt: expires ?? "",
    };
    toast.success(t("auths.oauthParseSuccess"));
  } catch {
    toast.warning("JSON 格式错误，请粘贴有效的 Session JSON");
  }
}

const oauthPreview = computed(() => {
  const p = parsedInfo.value;
  if (!p) return null;
  const planLabel: Record<string, string> = {
    free: "Free",
    plus: "Plus",
    pro: "Pro",
    team: "Team",
    enterprise: "Enterprise",
  };
  return {
    email: p.email || "-",
    plan: (planLabel[p.planType?.toLowerCase() ?? ""] ?? p.planType) || "-",
    expires: p.expiresAt ? new Date(p.expiresAt).toLocaleString() : "-",
    isFree: (p.planType?.toLowerCase() ?? "") === "free",
  };
});

async function fetchProviders() {
  const res = await api.get<{ data: { id: string; name: string; base_url?: string }[] }>("/api/providers");
  if (res.success) {
    const list = res.data.data ?? (res.data as any);
    providers.value = list.map((p: any) => ({ id: p.id, name: p.name, base_url: p.base_url }));
  }
}

async function fetchAuths() {
  const res = await api.get<{ data: { id: string; name: string }[] }>("/api/providers");
  if (!res.success) {
    toast.error(t("auths.getProvidersFailed"));
    return;
  }

  const statsRes = await api.get<any>("/api/stats/dashboard");
  const rateLimitedAuths: string[] = [];
  if (statsRes.success) {
    const stats = statsRes.data.data ?? statsRes.data;
    if (Array.isArray(stats.rate_limited_auths)) {
      rateLimitedAuths.push(...stats.rate_limited_auths.map((r: any) => r.auth_key));
    }
  }

  const list = res.data.data ?? (res.data as any);
  const items: AuthDisplay[] = [];
  for (const p of list) {
    const authRes = await api.get<{
      data: Array<{ key: string; name?: string; auth_type?: string; oauth_metadata?: string }>;
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

async function importOAuth() {
  if (!oauthProviderId.value) {
    toast.error(t("auths.providerRequired"));
    return;
  }
  if (!parsedInfo.value) {
    toast.error("请先粘贴 Session JSON 并等待解析完成");
    return;
  }

  const res = await api.post("/api/oauth/import", {
    provider_id: oauthProviderId.value,
    access_token: parsedInfo.value.accessToken,
    refresh_token: parsedInfo.value.sessionToken || undefined,
    email: parsedInfo.value.email || undefined,
    plan_type: parsedInfo.value.planType || undefined,
    expires_at: parsedInfo.value.expiresAt || undefined,
    name: parsedInfo.value.userName
      ? `Codex (${parsedInfo.value.email || parsedInfo.value.userName})`
      : "Codex OAuth",
  });
  if (res.success) {
    toast.success(t("auths.oauthImportSuccess"));
    showAddModal.value = false;
    resetOAuthForm();
    await fetchAuths();
  } else {
    toast.error(res.error ?? t("auths.oauthImportFailed"));
  }
}

function resetOAuthForm() {
  selectedOauthType.value = "";
  oauthProviderId.value = "";
  oauthSessionJson.value = "";
  parsedInfo.value = null;
}

async function deleteAuth(providerId: string, key: string) {
  if (!confirm(t("confirm.deleteMessage", { key: key.slice(0, 6) + "..." }))) return;
  const res = await api.remove(`/api/providers/${providerId}/auths/${encodeURIComponent(key)}`);
  if (res.success) {
    toast.success(t("auths.deleteSuccess"));
    await fetchAuths();
  } else {
    toast.error(res.error ?? t("common.delete"));
  }
}

function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return key.slice(0, 6) + "..." + key.slice(-4);
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
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title" data-testid="auths-title">{{ $t("auths.title") }}</h1>
        <p class="page-subtitle">{{ $t("auths.subtitle") }}</p>
      </div>
      <button
        class="btn-primary"
        data-testid="auth-add-btn"
        @click="openAddModal"
      >
        + {{ $t("common.add") }}
      </button>
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
            <td class="table-td text-right">
              <button
                class="btn-danger"
                data-testid="auth-delete-btn"
                @click="deleteAuth(a.provider_id, a.key)"
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
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === 'api_key'
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
          @click="activeTab = 'api_key'"
        >
          {{ $t("auths.addTabApiKey") }}
        </button>
        <button
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
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
            @click="showAddModal = false"
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
          <label class="form-label">OAuth 类型</label>
          <select
            v-model="selectedOauthType"
            class="select"
            @change="onOauthTypeChange"
          >
            <option value="">请选择 OAuth 类型</option>
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
            <option value="">请选择供应商</option>
            <option v-for="p in filteredProviders" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
          </select>
          <p v-if="filteredProviders.length === 0" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
            没有匹配的供应商。请先在「供应商」页面创建一个 base_url 包含 <code class="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">{{ oauthTypes.find(o => o.id === selectedOauthType)?.baseUrlPattern }}</code> 的供应商。
          </p>
        </div>

        <!-- 引导卡片（仅在选中类型后显示） -->
        <div v-if="selectedOauthType && oauthProviderId" class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
          <div class="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-1.5">
            <span class="i-tabler-brand-openai text-base" />
            {{ selectedOauthTypeLabel }} 导入步骤
          </div>
          <div class="space-y-2.5 text-sm text-indigo-700 dark:text-indigo-300">
            <div class="flex gap-2.5">
              <span class="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-200 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-200 flex items-center justify-center text-xs font-bold mt-0.5">1</span>
              <div>
                <span class="font-medium">登录并打开 Session 页面</span>
                <p class="text-indigo-500 dark:text-indigo-400 text-xs mt-0.5">浏览器访问以下地址（确保已登录）：</p>
                <code class="block mt-1 bg-indigo-100 dark:bg-indigo-800/60 px-2 py-1 rounded text-xs font-mono select-all">https://chatgpt.com/api/auth/session</code>
              </div>
            </div>
            <div class="flex gap-2.5">
              <span class="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-200 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-200 flex items-center justify-center text-xs font-bold mt-0.5">2</span>
              <div>
                <span class="font-medium">复制返回的 JSON</span>
                <p class="text-indigo-500 dark:text-indigo-400 text-xs mt-0.5">全选（Cmd+A）并复制（Cmd+C）完整的 JSON 文本</p>
              </div>
            </div>
            <div class="flex gap-2.5">
              <span class="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-200 dark:bg-indigo-700 text-indigo-700 dark:text-indigo-200 flex items-center justify-center text-xs font-bold mt-0.5">3</span>
              <div>
                <span class="font-medium">粘贴到下方文本框</span>
                <p class="text-indigo-500 dark:text-indigo-400 text-xs mt-0.5">系统会自动解析你的账号信息</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Session JSON 粘贴框 -->
        <div>
          <label class="form-label flex items-center gap-1.5">
            Session JSON
            <span v-if="parsedInfo" class="text-green-600 dark:text-green-400 text-xs font-normal flex items-center gap-0.5">
              <span class="i-tabler-circle-check text-xs" /> 解析成功
            </span>
          </label>
          <textarea
            v-model="oauthSessionJson"
            class="input font-mono text-xs h-36 resize-y"
            :class="parsedInfo ? 'border-green-300 dark:border-green-700 focus:border-green-500' : ''"
            :disabled="!selectedOauthType || !oauthProviderId"
            placeholder='先选择 OAuth 类型和供应商，然后将 Session JSON 粘贴到这里……'
            @input="parseSessionJson(oauthSessionJson)"
          />
        </div>

        <!-- 解析结果预览 -->
        <div v-if="oauthPreview" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm">
          <div class="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-1.5">
            <span class="i-tabler-user-check text-base" />
            已识别账号信息
          </div>
          <div class="grid grid-cols-2 gap-2 text-green-700 dark:text-green-300">
            <div>
              <span class="text-green-500 dark:text-green-400 text-xs">邮箱</span>
              <div class="font-mono text-xs truncate">{{ oauthPreview.email }}</div>
            </div>
            <div>
              <span class="text-green-500 dark:text-green-400 text-xs">套餐</span>
              <div class="flex items-center gap-1 mt-0.5">
                <span class="inline-block w-1.5 h-1.5 rounded-full" :class="oauthPreview.isFree ? 'bg-gray-400' : 'bg-green-500'" />
                <span class="font-medium">{{ oauthPreview.plan }}</span>
              </div>
            </div>
            <div class="col-span-2">
              <span class="text-green-500 dark:text-green-400 text-xs">Token 过期时间</span>
              <div class="font-mono text-xs">{{ oauthPreview.expires }}</div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            class="btn-secondary"
            @click="showAddModal = false"
          >
            {{ $t("common.cancel") }}
          </button>
          <button
            class="btn-primary"
            :disabled="!parsedInfo"
            @click="importOAuth"
          >
            {{ $t("common.save") }}
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>
