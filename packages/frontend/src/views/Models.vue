<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useApi } from "../composables/useApi";
import { useToast } from "../composables/useToast";

import AppModal from "../components/AppModal.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import LoadingSpinner from "../components/LoadingSpinner.vue";
import EmptyState from "../components/EmptyState.vue";

interface ProviderModel {
  name: string;
  display_name?: string;
  enabled?: boolean;
}

interface Provider {
  id: string;
  name: string;
  models: ProviderModel[];
}

interface ModelAliasEntry {
  provider_id: string;
  model_name: string;
}

interface ModelAlias {
  id?: string;
  alias: string;
  strategy: string;
  models: ModelAliasEntry[];
  queue_timeout: number;
  session_affinity: boolean;
  enabled: boolean;
  description?: string;
  headers?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

interface ProviderSelection {
  providerId: string;
  selectedModels: string[];
}

const api = useApi();
const toast = useToast();
const { t } = useI18n();

const models = ref<ModelAlias[]>([]);
const providers = ref<Provider[]>([]);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showDeleteDialog = ref(false);
const editingModel = ref<ModelAlias | null>(null);
const deletingModel = ref<ModelAlias | null>(null);

// Strategy options
const strategyOptions = [
  { value: "proportional", label: t('models.strategyProportionalLabel') },
  { value: "priority", label: t('models.strategyPriorityLabel') },
  { value: "round_robin", label: t('models.strategyRoundRobinLabel') },
  { value: "random", label: t('models.strategyRandomLabel') },
  { value: "least_loaded", label: t('models.strategyLeastLoadedLabel') },
];

const strategyDescriptions: Record<string, string> = {
  proportional: t('models.strategyProportional'),
  priority: t('models.strategyPriority'),
  round_robin: t('models.strategyRoundRobin'),
  random: t('models.strategyRandom'),
  least_loaded: t('models.strategyLeastLoaded'),
};

const selectedStrategyDesc = computed(() => strategyDescriptions[formStrategy.value] || "");

// Form state
const formAlias = ref("");
const formStrategy = ref("proportional");
const formQueueTimeout = ref(30000);
const formEnabled = ref(true);
const formSessionAffinity = ref(true);
const formDescription = ref("");
const formHeaders = ref("{}");

// Multi-provider model selection
const providerSelections = ref<ProviderSelection[]>([]);
const selectedProviderToAdd = ref("");

// Computed: available model names for a given provider
function getProviderModels(providerId: string): string[] {
  const provider = providers.value.find((p) => p.id === providerId);
  return provider ? provider.models.map((m) => m.name) : [];
}

// Selected provider IDs (from providerSelections)
const selectedProviderIds = computed(() =>
  providerSelections.value.map((s) => s.providerId)
);

// Available providers (those not already selected)
const availableProviders = computed(() =>
  providers.value.filter((p) => !selectedProviderIds.value.includes(p.id))
);

// Flattened list of all selected model entries for summary display
const selectedModelEntries = computed(() => {
  const entries: ModelAliasEntry[] = [];
  for (const sel of providerSelections.value) {
    for (const modelName of sel.selectedModels) {
      entries.push({ provider_id: sel.providerId, model_name: modelName });
    }
  }
  return entries;
});

function addProviderSelection(providerId: string) {
  if (!providerId) return;
  if (selectedProviderIds.value.includes(providerId)) return;
  providerSelections.value.push({
    providerId,
    selectedModels: [],
  });
}

function removeProviderSelection(index: number) {
  providerSelections.value.splice(index, 1);
}

function toggleModel(providerIndex: number, modelName: string) {
  const sel = providerSelections.value[providerIndex];
  if (!sel) return;
  const idx = sel.selectedModels.indexOf(modelName);
  if (idx >= 0) {
    sel.selectedModels.splice(idx, 1);
  } else {
    sel.selectedModels.push(modelName);
  }
}

// Load existing model entries into provider selections for edit
function loadModelsIntoSelections(entries: ModelAliasEntry[]) {
  providerSelections.value = [];
  const grouped: Record<string, string[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.provider_id]) {
      grouped[entry.provider_id] = [];
    }
    grouped[entry.provider_id].push(entry.model_name);
  }
  for (const [providerId, modelNames] of Object.entries(grouped)) {
    providerSelections.value.push({
      providerId,
      selectedModels: modelNames,
    });
  }
}

async function fetchModels() {
  const res = await api.get<{ data: ModelAlias[] }>("/api/models");
  if (res.success) {
    models.value = res.data.data ?? res.data;
  }
}

async function fetchProviders() {
  const res = await api.get<{ data: Provider[] }>("/api/providers");
  if (res.success) {
    providers.value = res.data.data ?? res.data;
  }
}

function resetForm() {
  formAlias.value = "";
  formStrategy.value = "proportional";
  formQueueTimeout.value = 30000;
  formEnabled.value = true;
  formSessionAffinity.value = true;
  formDescription.value = "";
  formHeaders.value = "{}";
  providerSelections.value = [];
}

function openCreate() {
  resetForm();
  showCreateModal.value = true;
}

function openEdit(m: ModelAlias) {
  editingModel.value = m;
  formAlias.value = m.alias;
  formStrategy.value = m.strategy;
  formQueueTimeout.value = m.queue_timeout;
  formEnabled.value = m.enabled;
  formSessionAffinity.value = m.session_affinity;
  formDescription.value = m.description ?? "";
  formHeaders.value = JSON.stringify(m.headers ?? {}, null, 2);
  loadModelsIntoSelections(m.models);
  showEditModal.value = true;
}

function openDelete(m: ModelAlias) {
  deletingModel.value = m;
  showDeleteDialog.value = true;
}

function buildModelEntries(): ModelAliasEntry[] {
  const entries: ModelAliasEntry[] = [];
  for (const sel of providerSelections.value) {
    for (const modelName of sel.selectedModels) {
      entries.push({ provider_id: sel.providerId, model_name: modelName });
    }
  }
  return entries;
}

async function handleCreate() {
  if (!formAlias.value.trim()) {
    toast.error(t('models.aliasRequired'));
    return;
  }
  const entries = buildModelEntries();
  if (entries.length === 0) {
    toast.error(t('models.selectRequired'));
    return;
  }
  const body: Record<string, unknown> = {
    alias: formAlias.value.trim(),
    strategy: formStrategy.value,
    queue_timeout: formQueueTimeout.value,
    models: entries,
    enabled: formEnabled.value,
    session_affinity: formSessionAffinity.value,
    description: formDescription.value.trim() || undefined,
  };
  // Parse headers from JSON string
  try {
    const parsed = JSON.parse(formHeaders.value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body.headers = parsed;
    }
  } catch {
    toast.error(t('errors.jsonFormat'));
    return;
  }
  const res = await api.post<ModelAlias>("/api/models", body);
  if (res.success) {
    toast.success(t('models.createSuccess'));
    showCreateModal.value = false;
    resetForm();
    await fetchModels();
  } else {
    toast.error(res.error ?? t('models.createFailed'));
  }
}

async function handleUpdate() {
  if (!editingModel.value) return;
  const body: Record<string, unknown> = {};
  if (formAlias.value !== editingModel.value.alias) body.alias = formAlias.value.trim();
  body.strategy = formStrategy.value;
  body.queue_timeout = formQueueTimeout.value;
  body.models = buildModelEntries();
  body.enabled = formEnabled.value;
  body.session_affinity = formSessionAffinity.value;
  body.description = formDescription.value.trim() || undefined;

  // Parse headers from JSON string
  try {
    const parsed = JSON.parse(formHeaders.value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body.headers = parsed;
    }
  } catch {
    toast.error(t('errors.jsonFormat'));
    return;
  }

  const res = await api.patch<ModelAlias>(`/api/models/${editingModel.value.id}`, body);
  if (res.success) {
    toast.success(t('models.updateSuccess'));
    showEditModal.value = false;
    editingModel.value = null;
    resetForm();
    await fetchModels();
  } else {
    toast.error(res.error ?? t('models.updateFailed'));
  }
}

async function handleDelete() {
  if (!deletingModel.value) return;
  const res = await api.remove(`/api/models/${deletingModel.value.id}`);
  if (res.success) {
    toast.success(t('models.deleteSuccess'));
    showDeleteDialog.value = false;
    deletingModel.value = null;
    await fetchModels();
  } else {
    toast.error(res.error ?? t('models.deleteFailed'));
  }
}

onMounted(async () => {
  await fetchProviders();
  await fetchModels();
});
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title" data-testid="models-title">{{ $t('models.title') }}</h1>
        <p class="page-subtitle">{{ $t('models.subtitle') }}</p>
      </div>
      <button
        class="btn-primary"
        data-testid="model-add-btn"
        @click="openCreate"
      >
        + {{ $t('models.createTitle') }}
      </button>
    </div>

    <LoadingSpinner v-if="api.loading.value && models.length === 0" />

    <EmptyState
      v-else-if="models.length === 0"
      :message="$t('models.empty')"
      :action-text="$t('models.createFirst')"
      data-testid="model-empty-state"
      @action="openCreate"
    />

    <div v-else class="card overflow-x-auto" data-testid="model-list-table">
      <table class="table-wrap">
        <thead class="table-head">
          <tr>
            <th class="table-th-sticky">{{ $t('models.alias') }}</th>
            <th class="table-th">{{ $t('models.strategy') }}</th>
            <th class="table-th">{{ $t('models.associatedModels') }}</th>
            <th class="table-th">{{ $t('common.status') }}</th>
            <th class="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="m in models" :key="m.alias" class="table-row" :data-testid="`model-table-row`">
            <td class="table-td-sticky">
              <div class="font-medium text-gray-900 dark:text-gray-100">{{ m.alias }}</div>
              <div v-if="m.description" class="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{{ m.description }}</div>
            </td>
            <td class="table-td">
              <span class="badge-gray">{{ m.strategy }}</span>
            </td>
            <td class="table-td">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="entry in m.models"
                  :key="`${entry.provider_id}-${entry.model_name}`"
                  class="badge-blue"
                >
                  {{ entry.provider_id }} / {{ entry.model_name }}
                </span>
              </div>
            </td>
            <td class="table-td">
              <span :class="m.enabled ? 'badge-green' : 'badge-gray'">
                {{ m.enabled ? $t('common.enabled') : $t('common.disabled') }}
              </span>
            </td>
            <td class="table-td text-right">
              <div class="flex items-center justify-end gap-2">
                <button
                  class="btn-ghost"
                  :data-testid="`model-edit-btn`"
                  @click="openEdit(m)"
                >
                  {{ $t('common.edit') }}
                </button>
                <button
                  class="btn-danger"
                  :data-testid="`model-delete-btn`"
                  @click="openDelete(m)"
                >
                  {{ $t('common.delete') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Modal -->
    <AppModal v-model:open="showCreateModal" :title="$t('models.createTitle')" width="max-w-xl" data-testid="model-add-modal">
      <div class="space-y-4">
        <div>
          <label class="form-label">{{ $t('models.alias') }}</label>
          <input v-model="formAlias" type="text" class="input" data-testid="model-alias-input" :placeholder="$t('providers.aliasPlaceholder')" />
        </div>
        <div>
          <label class="form-label">{{ $t('models.strategy') }}</label>
          <select v-model="formStrategy" class="select" data-testid="model-strategy-select">
            <option v-for="opt in strategyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ selectedStrategyDesc }}</p>
        </div>
        <div>
          <label class="form-label">{{ $t('models.queueTimeout') }}</label>
          <input v-model.number="formQueueTimeout" type="number" min="0" class="input" data-testid="model-queue-timeout-input" />
        </div>
        <div class="flex items-start gap-2">
          <input v-model="formSessionAffinity" type="checkbox" class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-testid="model-session-affinity-checkbox" />
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('models.sessionAffinity') }}</label>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('models.sessionAffinityDesc') }}</p>
          </div>
        </div>

        <!-- Associated Models Section -->
        <div>
          <label class="form-label mb-2">{{ $t('models.associatedModels') }}</label>

          <!-- Provider selector (only show if there are available providers) -->
          <div v-if="availableProviders.length > 0" class="flex items-center gap-2 mb-3">
            <select v-model="selectedProviderToAdd" class="select" @change="addProviderSelection(selectedProviderToAdd); selectedProviderToAdd = ''">
              <option value="" disabled>{{ $t('models.selectProvider') }}</option>
              <option v-for="p in availableProviders" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
            </select>
          </div>

          <!-- Provider model selection blocks -->
          <div v-for="(sel, pIdx) in providerSelections" :key="pIdx" class="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300" :data-testid="`model-provider-tag`">
                {{ sel.providerId }}
              </span>
              <button type="button" class="btn btn-sm btn-ghost-red" @click="removeProviderSelection(pIdx)">{{ $t('common.remove') }}</button>
            </div>
            <div v-if="getProviderModels(sel.providerId).length > 0" class="flex flex-wrap gap-2">
              <label
                v-for="mn in getProviderModels(sel.providerId)"
                :key="mn"
                class="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded border border-gray-200 cursor-pointer hover:border-blue-300 text-sm"
                :class="{ 'border-blue-500 bg-blue-50 dark:bg-blue-900/30': sel.selectedModels.includes(mn) }"
              >
                <input
                  type="checkbox"
                  :checked="sel.selectedModels.includes(mn)"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  @change="toggleModel(pIdx, mn)"
                />
                {{ mn }}
              </label>
            </div>
            <div v-else class="text-xs text-gray-400 dark:text-gray-500">{{ $t('models.noModelsForProvider') }}</div>
          </div>

          <!-- Summary of selected models -->
          <div v-if="selectedModelEntries.length > 0" class="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200">
            <div class="text-xs font-medium text-blue-700 mb-1">{{ $t('models.selectedModels') }}</div>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="entry in selectedModelEntries"
                :key="`${entry.provider_id}-${entry.model_name}`"
                class="badge-blue"
              >
                {{ entry.provider_id }} / {{ entry.model_name }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input v-model="formEnabled" type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-testid="model-enabled-checkbox" />
          <label class="text-sm text-gray-700 dark:text-gray-300">{{ $t('common.enabled') }}</label>
        </div>
        <div>
          <label class="form-label">{{ $t('common.description') }}</label>
          <textarea v-model="formDescription" class="input" data-testid="model-description-input" rows="2" :placeholder="$t('common.optional')" />
        </div>
        <div>
          <label class="form-label">{{ $t('models.customHeaders') }}</label>
          <textarea v-model="formHeaders" class="input font-mono" data-testid="model-headers-input" rows="3" :placeholder="$t('models.customHeadersPlaceholder')" />
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button class="btn-secondary" data-testid="model-cancel-btn" @click="showCreateModal = false">{{ $t('common.cancel') }}</button>
          <button class="btn-primary" data-testid="model-save-btn" @click="handleCreate">{{ $t('common.create') }}</button>
        </div>
      </div>
    </AppModal>

    <!-- Edit Modal -->
    <AppModal v-model:open="showEditModal" :title="$t('models.editTitle')" width="max-w-xl" data-testid="model-edit-modal">
      <div class="space-y-4">
        <div>
          <label class="form-label">{{ $t('models.alias') }}</label>
          <input v-model="formAlias" type="text" class="input" data-testid="model-alias-input" :placeholder="$t('providers.aliasPlaceholder')" />
        </div>
        <div>
          <label class="form-label">{{ $t('models.strategy') }}</label>
          <select v-model="formStrategy" class="select" data-testid="model-strategy-select">
            <option v-for="opt in strategyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ selectedStrategyDesc }}</p>
        </div>
        <div>
          <label class="form-label">{{ $t('models.queueTimeout') }}</label>
          <input v-model.number="formQueueTimeout" type="number" min="0" class="input" data-testid="model-queue-timeout-input" />
        </div>
        <div class="flex items-start gap-2">
          <input v-model="formSessionAffinity" type="checkbox" class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-testid="model-session-affinity-checkbox" />
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('models.sessionAffinity') }}</label>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ $t('models.sessionAffinityDesc') }}</p>
          </div>
        </div>

        <!-- Associated Models Section -->
        <div>
          <label class="form-label mb-2">{{ $t('models.associatedModels') }}</label>

          <div v-if="availableProviders.length > 0" class="flex items-center gap-2 mb-3">
            <select v-model="selectedProviderToAdd" class="select" @change="addProviderSelection(selectedProviderToAdd); selectedProviderToAdd = ''">
              <option value="" disabled>{{ $t('models.selectProvider') }}</option>
              <option v-for="p in availableProviders" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
            </select>
          </div>

          <div v-for="(sel, pIdx) in providerSelections" :key="pIdx" class="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300" :data-testid="`model-provider-tag`">{{ sel.providerId }}</span>
              <button type="button" class="btn btn-sm btn-ghost-red" @click="removeProviderSelection(pIdx)">{{ $t('common.remove') }}</button>
            </div>
            <div v-if="getProviderModels(sel.providerId).length > 0" class="flex flex-wrap gap-2">
              <label
                v-for="mn in getProviderModels(sel.providerId)"
                :key="mn"
                class="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded border border-gray-200 cursor-pointer hover:border-blue-300 text-sm"
                :class="{ 'border-blue-500 bg-blue-50 dark:bg-blue-900/30': sel.selectedModels.includes(mn) }"
              >
                <input
                  type="checkbox"
                  :checked="sel.selectedModels.includes(mn)"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  @change="toggleModel(pIdx, mn)"
                />
                {{ mn }}
              </label>
            </div>
            <div v-else class="text-xs text-gray-400 dark:text-gray-500">{{ $t('models.noModelsForProvider') }}</div>
          </div>

          <div v-if="selectedModelEntries.length > 0" class="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200">
            <div class="text-xs font-medium text-blue-700 mb-1">{{ $t('models.selectedModels') }}</div>
            <div class="flex flex-wrap gap-1">
              <span v-for="entry in selectedModelEntries" :key="`${entry.provider_id}-${entry.model_name}`" class="badge-blue">
                {{ entry.provider_id }} / {{ entry.model_name }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input v-model="formEnabled" type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-testid="model-enabled-checkbox" />
          <label class="text-sm text-gray-700 dark:text-gray-300">{{ $t('common.enabled') }}</label>
        </div>
        <div>
          <label class="form-label">{{ $t('common.description') }}</label>
          <textarea v-model="formDescription" class="input" data-testid="model-description-input" rows="2" />
        </div>
        <div>
          <label class="form-label">{{ $t('models.customHeaders') }}</label>
          <textarea v-model="formHeaders" class="input font-mono" data-testid="model-headers-input" rows="3" />
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button class="btn-secondary" data-testid="model-cancel-btn" @click="showEditModal = false">{{ $t('common.cancel') }}</button>
          <button class="btn-primary" @click="handleUpdate" data-testid="model-save-btn">{{ $t('common.save') }}</button>
        </div>
      </div>
    </AppModal>

    <!-- Delete Confirmation -->
    <ConfirmDialog
      v-model:open="showDeleteDialog"
      :title="$t('confirm.deleteTitle')"
      :message="$t('confirm.deleteModel', { name: deletingModel?.alias || '' })"
      data-testid="model-delete-dialog"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>
