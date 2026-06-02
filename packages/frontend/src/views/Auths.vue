<script setup lang="ts">
import { ref, onMounted } from "vue";
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
  status?: "healthy" | "warning" | "rate_limited";
  limits?: Array<{ type: string; period?: string; used: number; max: number; remaining: number; usage_pct: number }>;
}

interface ProviderOption {
  id: string;
  name: string;
}

const api = useApi();
const toast = useToast();
const { t } = useI18n();

const authsList = ref<AuthDisplay[]>([]);
const providers = ref<ProviderOption[]>([]);
const showAddModal = ref(false);
const formProviderId = ref("");
const formKey = ref("");
const formName = ref("");

async function fetchProviders() {
  const res = await api.get<{ data: { id: string; name: string }[] }>("/api/providers");
  if (res.success) {
    const list = res.data.data ?? (res.data as any);
    providers.value = list.map((p: any) => ({ id: p.id, name: p.name }));
  }
}

async function fetchAuths() {
  // Load all providers and fetch auths for each
  const res = await api.get<{ data: { id: string; name: string }[] }>("/api/providers");
  if (!res.success) {
    toast.error(t("auths.getProvidersFailed"));
    return;
  }

  // Also fetch dashboard stats for rate limit info
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
    const authRes = await api.get<{ data: Array<{ key: string; name?: string }> }>(`/api/providers/${p.id}/auths`);
    if (authRes.success) {
      const auths = authRes.data.data ?? (authRes.data as any);
      for (const a of auths) {
        items.push({
          provider_id: p.id,
          provider_name: p.name,
          key: a.key,
          name: a.name,
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
  formProviderId.value = "";
  formKey.value = "";
  formName.value = "";
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
    <AppModal v-model:open="showAddModal" :title="$t('auths.addTitle')" width="max-w-md" data-testid="auth-add-modal">
      <div class="space-y-4">
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
    </AppModal>
  </div>
</template>
