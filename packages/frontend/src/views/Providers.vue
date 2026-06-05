<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import type {
  RateLimit,
  ProviderModel,
  ModelAliasWithMeta,
} from "@llm-proxy/shared/schemas";
import { useApi } from "../composables/useApi";
import { useToast } from "../composables/useToast";
import { useExchangeRates } from "../composables/useExchangeRates";

import AppModal from "../components/AppModal.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import LoadingSpinner from "../components/LoadingSpinner.vue";
import EmptyState from "../components/EmptyState.vue";

interface ModelRow {
  name: string;
  alias: string;
  weight: number;
  input_price: number | undefined;
  output_price: number | undefined;
  cache_hit_price: number | undefined;
  cache_create_price: number | undefined;
}

interface Provider {
  id: string;
  name: string;
  base_url: string;
  models: ProviderModel[];
  rate_limits?: RateLimit[];
  enabled: boolean;
  description?: string;
  health_check_endpoint?: string;
  created_at?: string;
  updated_at?: string;
  last_health_check?: string | null;
  health_status?: "healthy" | "unhealthy" | "unknown";
}

interface RateLimitForm {
  type: "weighted_requests" | "concurrency" | "tokens";
  max: number;
  period?: string;
}

const api = useApi();
const toast = useToast();
const exchangeRates = useExchangeRates();
const { t } = useI18n();

const providers = ref<Provider[]>([]);
const modelAliases = ref<ModelAliasWithMeta[]>([]);
const aliasOptions = computed(() => modelAliases.value.map((m) => m.alias));
const showModal = ref(false);
const isEditing = computed(() => editingProvider.value !== null);
const templateDropdownOpen = ref(false);
const templates = ref<{ id: string; name: string; [key: string]: unknown }[]>(
  [],
);
const templatesLoading = ref(false);
const showDeleteDialog = ref(false);
const editingProvider = ref<Provider | null>(null);
const deletingProvider = ref<Provider | null>(null);

// Form state
const formId = ref("");
const formName = ref("");
const formBaseUrl = ref("");
const formEnabled = ref(true);
const formDescription = ref("");
const formMaxRetries = ref(3);
const formRequestTimeout = ref(60000);
const formPricingModel = ref("per_request_weighted");
const formUnitPrice = ref(0.001);
const formSubscriptionPrice = ref(0);
const formSubscriptionPeriod = ref("month");
const formSubscriptionUnlimited = ref(false);
const formSubscriptionIncludedRequests = ref(0);
const formSubscriptionOveragePrice = ref(0.001);
const formSubscriptionAllowOverage = ref(false);
const formSubscriptionBillingType = ref("weighted_requests");
const formSubscriptionIncludedTokens = ref(0);
const formHeaders = ref("{}");
const formApiFormat = ref("openai_chat");

const apiFormatOptions = [
  { value: "openai_chat", label: t("apiFormat.openai") },
  { value: "anthropic_messages", label: t("apiFormat.anthropic") },
  { value: "openai_responses", label: t("apiFormat.responses") },
];

const apiFormatHints: Record<string, string> = {
  openai_chat: t("providers.apiFormatHint", {
    url: "https://api.openai.com/v1",
    examples: "OpenAI / DeepSeek / StepFun / Aliyun",
  }),
  anthropic_messages: t("providers.apiFormatHint", {
    url: "https://api.anthropic.com/v1",
    examples: "Anthropic / IKunCode",
  }),
  openai_responses: t("providers.apiFormatHint", {
    url: "https://api.openai.com/v1",
    examples: "OpenAI Responses API",
  }),
};

const knownUrlPatterns: Record<string, string> = {
  anthropic: "anthropic_messages",
  ikuncode: "anthropic_messages",
};
function onBaseUrlChange() {
  const url = formBaseUrl.value.toLowerCase();
  for (const [keyword, format] of Object.entries(knownUrlPatterns)) {
    if (url.includes(keyword)) {
      formApiFormat.value = format;
      return;
    }
  }
  if (
    url.includes("openai") ||
    url.includes("deepseek") ||
    url.includes("dashscope") ||
    url.includes("stepfun")
  ) {
    formApiFormat.value = "openai_chat";
  }
}

const billingTypeOptions = [
  {
    value: "unlimited",
    label: t("providers.subscriptionBillingTypeUnlimited"),
  },
  {
    value: "weighted_requests",
    label: t("providers.subscriptionBillingTypeWeighted"),
  },
  { value: "tokens", label: t("providers.subscriptionBillingTypeTokens") },
];

const pricingModelOptions = [
  { value: "no_billing", label: t("providers.noBilling") },
  { value: "per_request_weighted", label: t("providers.perRequestWeighted") },
  { value: "per_model_token", label: t("providers.perModelToken") },
  { value: "subscription", label: t("providers.subscription") },
];

const formCurrency = ref("USD");
const formModels = ref<ModelRow[]>([
  {
    name: "",
    alias: "",
    weight: undefined,
    input_price: undefined,
    output_price: undefined,
    cache_hit_price: undefined,
    cache_create_price: undefined,
  },
]);
const formRateLimits = ref<RateLimitForm[]>([
  { type: "weighted_requests", max: 100, period: "minute" },
]);

const formCurrencyOptions = exchangeRates.supportedCurrencies.map((c) => ({
  value: c,
  label: `${c} (${exchangeRates.currencySymbols[c] || "$"})`,
}));

const formCurrencySymbol = computed(() =>
  exchangeRates.getCurrencySymbol(formCurrency.value),
);

const subscriptionRateLimit = computed(() => {
  if (
    formPricingModel.value !== "subscription" ||
    formSubscriptionBillingType.value === "unlimited"
  )
    return null;
  const period = formSubscriptionPeriod.value === "year" ? "month" : "month";
  if (formSubscriptionBillingType.value === "weighted_requests") {
    return {
      type: "weighted_requests" as const,
      max: formSubscriptionIncludedRequests.value || 0,
      period,
      _auto: true,
    };
  }
  return {
    type: "tokens" as const,
    max: formSubscriptionIncludedTokens.value || 0,
    period,
    _auto: true,
  };
});

const rateLimitTypes: { value: string; label: string; hasPeriod: boolean }[] = [
  {
    value: "weighted_requests",
    label: t("providers.subscriptionBillingTypeWeighted"),
    hasPeriod: true,
  },
  {
    value: "tokens",
    label: t("providers.subscriptionBillingTypeTokens"),
    hasPeriod: true,
  },
  {
    value: "concurrency",
    label: t("providers.subscriptionBillingTypeUnlimited"),
    hasPeriod: false,
  },
];

const periodOptions = [
  { value: "second", label: t("common.second") },
  { value: "minute", label: t("common.minute") },
  { value: "hour", label: t("common.hour") },
  { value: "day", label: t("common.day") },
  { value: "5h", label: t("common.every5Hours") },
  { value: "week", label: t("common.week") },
  { value: "month", label: t("common.month") },
];

function getRateLimitConfig(type: string) {
  return rateLimitTypes.find((r) => r.value === type);
}
function hasPeriod(type: string): boolean {
  return getRateLimitConfig(type)?.hasPeriod ?? true;
}
function onRateLimitTypeChange(rl: RateLimitForm) {
  if (!hasPeriod(rl.type)) {
    delete (rl as any).period;
  } else if (!rl.period) {
    rl.period = "minute";
  }
}
function addRateLimit() {
  formRateLimits.value.push({
    type: "weighted_requests",
    max: 100,
    period: "minute",
  });
}
function removeRateLimit(index: number) {
  formRateLimits.value.splice(index, 1);
}
function addModelRow() {
  formModels.value.push({
    name: "",
    alias: "",
    weight: undefined,
    input_price: undefined,
    output_price: undefined,
    cache_hit_price: undefined,
    cache_create_price: undefined,
  });
}
function removeModelRow(index: number) {
  formModels.value.splice(index, 1);
}

async function fetchProviders() {
  const res = await api.get<{ data: Provider[] }>("/api/providers");
  if (res.success) providers.value = res.data.data ?? res.data;
}
async function fetchModelAliases() {
  const res = await api.get<{ data: ModelAliasWithMeta[] }>("/api/models");
  if (res.success) modelAliases.value = res.data.data ?? res.data;
}

function resetForm() {
  formId.value = "";
  formName.value = "";
  formBaseUrl.value = "";
  formEnabled.value = true;
  formDescription.value = "";
  formMaxRetries.value = 3;
  formRequestTimeout.value = 60000;
  formPricingModel.value = "no_billing";
  formUnitPrice.value = 0.001;
  formSubscriptionPrice.value = 0;
  formSubscriptionPeriod.value = "month";
  formSubscriptionUnlimited.value = false;
  formSubscriptionIncludedRequests.value = 0;
  formSubscriptionOveragePrice.value = 0.001;
  formSubscriptionAllowOverage.value = false;
  formSubscriptionBillingType.value = "weighted_requests";
  formSubscriptionIncludedTokens.value = 0;
  formCurrency.value = "USD";
  formModels.value = [
    {
      name: "",
      alias: "",
      weight: undefined,
      input_price: undefined,
      output_price: undefined,
      cache_hit_price: undefined,
      cache_create_price: undefined,
    },
  ];
  formRateLimits.value = [];
  formHeaders.value = "{}";
  formApiFormat.value = "openai_chat";
}

function openCreate() {
  editingProvider.value = null;
  resetForm();
  showModal.value = true;
}

function openEdit(p: Provider) {
  editingProvider.value = p;
  showModal.value = true;
  formId.value = p.id;
  formName.value = p.name;
  formBaseUrl.value = p.base_url;
  formEnabled.value = p.enabled;
  formDescription.value = p.description ?? "";
  formPricingModel.value = (p as any).pricing_model ?? "no_billing";
  formUnitPrice.value = (p as any).unit_price ?? 0.001;
  formCurrency.value = (p as any).currency ?? "USD";
  const sub = (p as any).subscription;
  if (sub) {
    formSubscriptionPrice.value = sub.price ?? 0;
    formSubscriptionPeriod.value = sub.period ?? "month";
    formSubscriptionBillingType.value = sub.billing_type ?? "weighted_requests";
    formSubscriptionUnlimited.value =
      sub.billing_type === "unlimited" || sub.included_requests === undefined;
    formSubscriptionIncludedRequests.value = sub.included_requests ?? 0;
    formSubscriptionOveragePrice.value = sub.overage_unit_price ?? 0.001;
    formSubscriptionAllowOverage.value = (sub.overage_unit_price ?? 0) > 0;
    formSubscriptionIncludedTokens.value = sub.included_tokens ?? 0;
  } else {
    formSubscriptionPrice.value = 0;
    formSubscriptionPeriod.value = "month";
    formSubscriptionBillingType.value = "weighted_requests";
    formSubscriptionIncludedRequests.value = 0;
    formSubscriptionOveragePrice.value = 0.001;
    formSubscriptionAllowOverage.value = false;
    formSubscriptionIncludedTokens.value = 0;
  }
  if (p.models && p.models.length > 0) {
    formModels.value = p.models.map((m) => ({
      name: m.name,
      alias: (m as any).alias ?? "",
      weight: (m as any).weight ?? undefined,
      input_price:
        (m as any).input_price ??
        (m as any).input_price_per_million ??
        undefined,
      output_price:
        (m as any).output_price ??
        (m as any).output_price_per_million ??
        undefined,
      cache_hit_price: (m as any).cache_hit_price ?? undefined,
      cache_create_price: (m as any).cache_create_price ?? undefined,
    }));
  } else {
    formModels.value = [
      {
        name: "",
        alias: "",
        weight: undefined,
        input_price: undefined,
        output_price: undefined,
        cache_hit_price: undefined,
        cache_create_price: undefined,
      },
    ];
  }
  if (p.rate_limits && p.rate_limits.length > 0) {
    const subRl = subscriptionRateLimit.value;
    formRateLimits.value = p.rate_limits
      .filter((rl) => {
        if (!subRl) return true;
        const period = "period" in rl ? rl.period : undefined;
        const max = "max" in rl ? rl.max : 0;
        return !(
          rl.type === subRl.type &&
          period === subRl.period &&
          max === subRl.max
        );
      })
      .map((rl) => {
        const base: RateLimitForm = {
          type: rl.type,
          max: "max" in rl ? rl.max : 100,
        };
        if ("period" in rl && rl.period) (base as any).period = rl.period;
        return base;
      }) as RateLimitForm[];
  } else {
    formRateLimits.value = [];
  }
  formHeaders.value = JSON.stringify((p as any).headers ?? {}, null, 2);
  formApiFormat.value = (p as any).api_format ?? "openai_chat";
}

function openDelete(p: Provider) {
  deletingProvider.value = p;
  showDeleteDialog.value = true;
}

async function fetchTemplates(refresh = false) {
  templatesLoading.value = true;
  try {
    const res = await api.get<{
      data: {
        templates: { id: string; name: string; [key: string]: unknown }[];
      };
    }>(`/api/templates${refresh ? "?refresh=true" : ""}`);
    if (res.success) {
      const list =
        (res.data as any).data?.templates ?? (res.data as any).templates ?? [];
      templates.value = list;
      localStorage.setItem(
        "template-cache",
        JSON.stringify({ templates: list, cached_at: Date.now() }),
      );
      if (refresh) toast.success(t("providers.refreshTemplates"));
    } else if (refresh) toast.error(t("providers.createFailed"));
  } catch {
    if (refresh) toast.error(t("providers.createFailed"));
  } finally {
    templatesLoading.value = false;
  }
}

function applyTemplate(tpl: {
  id: string;
  name: string;
  [key: string]: unknown;
}) {
  templateDropdownOpen.value = false;
  // Build provider body directly from template
  const models: Record<string, unknown>[] = (
    (tpl.models as Record<string, unknown>[]) ?? []
  ).map((m) => {
    const entry: Record<string, unknown> = {
      name: m.name as string,
      enabled: true,
    };
    if (m.alias) entry.alias = m.alias as string;
    if (m.weight && m.weight !== 1) entry.weight = m.weight;
    if (m.input_price != null) entry.input_price = m.input_price;
    if (m.output_price != null) entry.output_price = m.output_price;
    if (m.cache_hit_price != null) entry.cache_hit_price = m.cache_hit_price;
    if (m.cache_create_price != null)
      entry.cache_create_price = m.cache_create_price;
    return entry;
  });
  const rateLimits: Record<string, unknown>[] = (
    (tpl.rate_limits as Record<string, unknown>[]) ?? []
  ).map((rl) => {
    const base: Record<string, unknown> = { type: rl.type, max: rl.max ?? 100 };
    if (rl.period) base.period = rl.period;
    return base;
  });
  const body: Record<string, unknown> = {
    id: tpl.id as string,
    name: (tpl.name as string) ?? "",
    base_url: (tpl.base_url as string) ?? "",
    models,
    rate_limits: rateLimits,
    enabled: (tpl.enabled as boolean) ?? true,
    pricing_model: (tpl.pricing_model as string) ?? "no_billing",
    unit_price: (tpl.unit_price as number) ?? 0.001,
    currency: (tpl.currency as string) ?? "USD",
    api_format: (tpl.api_format as string) ?? "openai_chat",
    headers: (tpl.headers as Record<string, string>) ?? {},
    description: (tpl.description as string) ?? "",
  };
  const sub = tpl.subscription as Record<string, unknown> | undefined;
  if (sub) {
    body.subscription = sub;
    if ((sub.billing_type as string) === "unlimited") {
      body.subscription = { ...sub, billing_type: "unlimited" };
    }
  }
  api.post("/api/providers", body).then((res) => {
    if (res.success) {
      toast.success(t("providers.createSuccess"));
      fetchProviders();
    } else {
      toast.error(res.error ?? t("providers.createFailed"));
    }
  });
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest("[data-testid='provider-template-btn']")) {
    templateDropdownOpen.value = false;
  }
}

onMounted(() => {
  fetchProviders();
  fetchModelAliases();
  const cached = localStorage.getItem("template-cache");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed.templates)) templates.value = parsed.templates;
    } catch {
      /* ignore */
    }
  }
  fetchTemplates();
  document.addEventListener("click", handleClickOutside);
});

function getHealthBadgeColor(status?: string) {
  switch (status) {
    case "healthy":
      return "bg-green-100 text-green-800";
    case "unhealthy":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
function getHealthLabel(status?: string) {
  switch (status) {
    case "healthy":
      return t("common.healthy");
    case "unhealthy":
      return t("common.unhealthy");
    default:
      return t("common.unknown");
  }
}

function buildProviderBody(): Record<string, unknown> {
  const models: Record<string, unknown>[] = formModels.value
    .filter((m) => m.name.trim().length > 0)
    .map((m) => {
      const entry: Record<string, unknown> = {
        name: m.name.trim(),
        enabled: true,
      };
      if (m.weight !== undefined && m.weight !== null && m.weight !== 1)
        entry.weight = m.weight;
      if (m.alias.trim()) entry.alias = m.alias.trim();
      if (m.input_price !== undefined && m.input_price !== null)
        entry.input_price = m.input_price;
      if (m.output_price !== undefined && m.output_price !== null)
        entry.output_price = m.output_price;
      if (m.cache_hit_price !== undefined && m.cache_hit_price !== null)
        entry.cache_hit_price = m.cache_hit_price;
      if (m.cache_create_price !== undefined && m.cache_create_price !== null)
        entry.cache_create_price = m.cache_create_price;
      return entry;
    });
  const rateLimits = formRateLimits.value
    .filter((rl) => rl.max > 0)
    .map((rl) => {
      const base: Record<string, unknown> = { type: rl.type, max: rl.max };
      if (hasPeriod(rl.type) && rl.period) base.period = rl.period;
      return base;
    });
  if (subscriptionRateLimit.value) {
    const rl = subscriptionRateLimit.value;
    rateLimits.push({ type: rl.type, max: rl.max, period: rl.period });
  }
  const body: Record<string, unknown> = {
    id: formId.value.trim(),
    name: formName.value.trim(),
    base_url: formBaseUrl.value.trim(),
    models,
    rate_limits: rateLimits,
    enabled: formEnabled.value,
  };
  if (formDescription.value.trim())
    body.description = formDescription.value.trim();
  if (formApiFormat.value !== "openai_chat")
    body.api_format = formApiFormat.value;
  body.pricing_model = formPricingModel.value;
  body.unit_price = formUnitPrice.value;
  body.currency = formCurrency.value;
  if (formPricingModel.value === "subscription") {
    body.subscription = {
      price: formSubscriptionPrice.value,
      period: formSubscriptionPeriod.value,
      billing_type: formSubscriptionBillingType.value,
    };
    if (formSubscriptionBillingType.value !== "unlimited") {
      if (formSubscriptionBillingType.value === "weighted_requests") {
        (body.subscription as Record<string, unknown>).included_requests =
          formSubscriptionIncludedRequests.value;
        (body.subscription as Record<string, unknown>).overage_unit_price =
          formSubscriptionAllowOverage.value
            ? formSubscriptionOveragePrice.value
            : 0;
      } else {
        (body.subscription as Record<string, unknown>).included_tokens =
          formSubscriptionIncludedTokens.value;
        (body.subscription as Record<string, unknown>).overage_unit_price =
          formSubscriptionAllowOverage.value
            ? formSubscriptionOveragePrice.value
            : 0;
      }
    }
  }
  try {
    const parsedHeaders = JSON.parse(formHeaders.value);
    if (typeof parsedHeaders === "object" && parsedHeaders !== null)
      body.headers = parsedHeaders;
  } catch {
    /* skip */
  }
  return body;
}

async function handleCreate() {
  if (
    !formId.value.trim() ||
    !formName.value.trim() ||
    !formBaseUrl.value.trim()
  ) {
    toast.error(t("providers.fieldsRequired"));
    return;
  }
  if (formModels.value.filter((m) => m.name.trim()).length === 0) {
    toast.error(t("providers.modelRequired"));
    return;
  }
  const body = buildProviderBody();
  if (Object.keys(body).length === 0) return;
  const res = await api.post<Provider>("/api/providers", body);
  if (res.success) {
    toast.success(t("providers.createSuccess"));
    showModal.value = false;
    resetForm();
    await fetchProviders();
  } else {
    toast.error(res.error ?? t("providers.createFailed"));
  }
}

async function handleUpdate() {
  if (!editingProvider.value) return;
  if (formModels.value.filter((m) => m.name.trim()).length === 0) {
    toast.error(t("providers.modelRequired"));
    return;
  }
  const body = buildProviderBody();
  if (Object.keys(body).length === 0) return;
  delete (body as any).id;
  const res = await api.patch<Provider>(
    `/api/providers/${editingProvider.value.id}`,
    body,
  );
  if (res.success) {
    toast.success(t("providers.updateSuccess"));
    showModal.value = false;
    editingProvider.value = null;
    resetForm();
    await fetchProviders();
  } else {
    toast.error(res.error ?? t("providers.updateFailed"));
  }
}

const deletingAuthCount = ref(0);
const showForceDeleteDialog = ref(false);

async function handleDelete() {
  if (!deletingProvider.value) return;
  const res = await api.remove(`/api/providers/${deletingProvider.value.id}`);
  if (res.success) {
    toast.success(t("providers.deleteSuccess"));
    showDeleteDialog.value = false;
    deletingProvider.value = null;
    await fetchProviders();
  } else if (res.code === "HAS_AUTHS") {
    deletingAuthCount.value = res.auth_count ?? 0;
    showDeleteDialog.value = false;
    showForceDeleteDialog.value = true;
  } else {
    toast.error(res.error ?? t("providers.deleteFailed"));
  }
}

async function handleForceDelete() {
  if (!deletingProvider.value) return;
  const res = await api.remove(
    `/api/providers/${deletingProvider.value.id}?force=true`,
  );
  if (res.success) {
    toast.success(t("providers.deleteSuccess"));
    showForceDeleteDialog.value = false;
    deletingProvider.value = null;
    await fetchProviders();
  } else {
    toast.error(res.error ?? t("providers.deleteFailed"));
  }
}
</script>

<template>
  <div>

    <div class="page-header">
        <div>
          <h1 class="page-title" data-testid="providers-title">{{ $t('providers.title') }}</h1>
          <p class="page-subtitle">{{ $t('providers.subtitle') }}</p>
        </div>
        <div class="relative inline-block" data-testid="provider-template-btn">
          <button class="btn-primary" @click.stop="templateDropdownOpen = !templateDropdownOpen">
            + {{ $t('providers.quickAdd') }}
            <span class="i-tabler-chevron-down ml-0.5 text-sm" :class="templateDropdownOpen ? 'rotate-180' : ''" />
          </button>
          <div v-if="templateDropdownOpen" class="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/40 z-50 py-1 max-h-80 overflow-y-auto">
            <div v-if="templatesLoading" class="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">{{ $t('common.loading') }}...</div>
            <template v-else-if="templates.length > 0">
              <div v-for="tpl in templates" :key="tpl.id" :data-testid="`provider-template-item-${tpl.id}`" class="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" @click="applyTemplate(tpl)">{{ tpl.name }}</div>
              <hr class="my-1 border-gray-100 dark:border-gray-700" />
            </template>
            <div v-else class="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic text-center">{{ $t('providers.noTemplates') }}</div>
            <div data-testid="provider-template-manual" class="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" @click="templateDropdownOpen = false; openCreate()">{{ $t('providers.manualCreate') }}</div>
            <div data-testid="provider-template-refresh" class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-t border-gray-100 dark:border-gray-700" @click="fetchTemplates(true); templateDropdownOpen = false">{{ $t('providers.refreshTemplates') }}</div>
          </div>
        </div>
      </div>

      <LoadingSpinner v-if="api.loading.value && providers.length === 0" />

      <EmptyState v-else-if="providers.length === 0" :message="$t('providers.empty')" :action-text="$t('providers.createFirst')" data-testid="provider-empty-state" @action="openCreate" />

      <div v-else class="card overflow-x-auto" data-testid="provider-list-table">
        <table class="table-wrap">
          <thead class="table-head">
            <tr>
              <th class="table-th-sticky">{{ $t('providers.id') }}</th>
              <th class="table-th">{{ $t('common.name') }}</th>
              <th class="table-th">{{ $t('providers.baseUrl') }}</th>
              <th class="table-th">{{ $t('providers.models') }}</th>
              <th class="table-th">{{ $t('common.status') }}</th>
              <th class="table-th">{{ $t('providers.enabled') }}</th>
              <th class="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">{{ $t('common.edit') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="p in providers" :key="p.id" class="table-row" :data-testid="`provider-table-row`">
              <td class="table-td-sticky font-mono text-xs text-gray-600 dark:text-gray-400">{{ p.id }}</td>
              <td class="table-td">
                <div class="font-medium text-gray-900 dark:text-gray-100">{{ p.name }}</div>
                <div v-if="p.description" class="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{{ p.description }}</div>
              </td>
              <td class="table-td font-mono text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{{ p.base_url }}</td>
              <td class="table-td">
                <div class="flex flex-wrap gap-1">
                  <span v-for="m in p.models" :key="m.name" class="badge-gray">{{ m.name }}</span>
                </div>
              </td>
              <td class="table-td">
                <span :class="getHealthBadgeColor(p.health_status)" class="badge">{{ getHealthLabel(p.health_status) }}</span>
              </td>
              <td class="table-td">
                <span :class="p.enabled ? 'badge-green' : 'badge-gray'">{{ p.enabled ? $t('providers.enabled') : $t('common.disabled') }}</span>
              </td>
              <td class="table-td text-right">
                <div class="flex items-center justify-end gap-2">
                  <button class="btn-ghost" :data-testid="`provider-edit-btn`" @click="openEdit(p)">{{ $t('common.edit') }}</button>
                  <button class="btn-danger" :data-testid="`provider-delete-btn`" @click="openDelete(p)">{{ $t('common.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Create/Edit Modal -->
      <AppModal v-model:open="showModal" :title="isEditing ? $t('providers.editTitle') : $t('providers.createTitle')" width="max-w-2xl" :data-testid="isEditing ? 'provider-edit-modal' : 'provider-add-modal'">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="form-label">{{ $t('providers.id') }}</label>
              <input v-model="formId" type="text" :disabled="isEditing" :class="isEditing ? 'input input-disabled' : 'input'" :data-testid="isEditing ? 'provider-name-edit-disabled' : 'provider-name-input'" :placeholder="$t('providers.id') + ': openai'" />
            </div>
            <div>
              <label class="form-label">{{ $t('common.name') }}</label>
              <input v-model="formName" type="text" class="input" :data-testid="isEditing ? 'provider-name-edit-input' : 'provider-display-name-input'" :placeholder="$t('common.name') + ': OpenAI'" />
            </div>
          </div>
          <div>
            <label class="form-label">{{ $t('providers.baseUrl') }}</label>
            <input v-model="formBaseUrl" type="url" :disabled="isEditing" :class="isEditing ? 'input input-disabled' : 'input'" :data-testid="isEditing ? 'provider-base-url-edit-input' : 'provider-url-input'" placeholder="https://api.openai.com" @input="onBaseUrlChange" />
            <p v-if="isEditing" class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ $t('providers.baseUrlImmutable') }}</p>
          </div>
          <div class="flex items-start gap-4">
            <div class="flex-1">
              <label class="form-label">{{ $t('providers.apiFormat') }}</label>
              <select v-model="formApiFormat" class="select" data-testid="provider-api-format-select">
                <option v-for="opt in apiFormatOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ apiFormatHints[formApiFormat] }}</p>
            </div>
            <div class="flex flex-col w-28 shrink-0">
              <label class="form-label">{{ $t('providers.currency') }}</label>
              <select v-model="formCurrency" class="select" data-testid="provider-currency-select">
                <option v-for="opt in formCurrencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
          </div>

          <!-- Pricing Model Section -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ $t('providers.pricingModel') }}</label>
            <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
              <div class="flex items-center gap-4">
                <div class="flex flex-col w-44">
                    <label class="form-label-xs">{{ $t('providers.subscriptionBillingType') }}</label>
                    <select v-model="formPricingModel" class="select-sm" data-testid="provider-pricing-model-select">
                    <option v-for="opt in pricingModelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div v-if="formPricingModel === 'per_request_weighted'" class="flex flex-col w-32">
                  <label class="form-label-xs">{{ exchangeRates.formatLabel($t('providers.unitPrice'), formCurrency) }}</label>
                  <input v-model.number="formUnitPrice" type="number" min="0" step="0.0001" class="input-sm" data-testid="provider-unit-price-input" :placeholder="exchangeRates.pricePlaceholder(0.001, formCurrency)" />
                </div>
              </div>
              <div v-if="formPricingModel === 'subscription'" class="space-y-3">
                <div class="flex items-center gap-4">
                  <div class="flex flex-col w-32">
                    <label class="form-label-xs">{{ exchangeRates.formatLabel($t('providers.subscriptionPrice'), formCurrency) }}</label>
                    <input v-model.number="formSubscriptionPrice" type="number" min="0" step="0.01" class="input-sm" data-testid="provider-subscription-price-input" :placeholder="exchangeRates.pricePlaceholder(499, formCurrency)" />
                  </div>
                  <div class="flex flex-col w-32">
                    <label class="form-label-xs">{{ $t('providers.subscriptionPeriod') }}</label>
                    <select v-model="formSubscriptionPeriod" class="select-sm" data-testid="provider-subscription-period-select"><option value="month">{{ $t('common.month') }}</option><option value="year">{{ $t('common.year') }}</option></select>
                  </div>
                  <div class="flex flex-col w-36">
                    <label class="form-label-xs">{{ $t('providers.subscriptionBillingType') }}</label>
                    <select v-model="formSubscriptionBillingType" class="select-sm" data-testid="provider-subscription-billing-type-select">
                      <option v-for="opt in billingTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                  </div>
                </div>
                <div v-if="formSubscriptionBillingType === 'weighted_requests'" class="flex items-center gap-4">
                  <div class="flex flex-col w-32">
                    <label class="form-label-xs">{{ $t('providers.subscriptionIncludeRequests') }}</label>
                    <input v-model.number="formSubscriptionIncludedRequests" type="number" min="0" class="input-sm" data-testid="provider-subscription-included-input" placeholder="10000" />
                  </div>
                  <div class="flex items-center gap-2 mt-5">
                    <input id="allow-overage" v-model="formSubscriptionAllowOverage" type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-testid="provider-subscription-allow-overage-checkbox" />
                    <label for="allow-overage" class="text-xs text-gray-600 dark:text-gray-400">{{ $t('providers.subscriptionAllowOverage') }}</label>
                  </div>
                  <div v-if="formSubscriptionAllowOverage" class="flex flex-col w-32">
                    <label class="form-label-xs">{{ exchangeRates.formatLabel($t('providers.subscriptionOveragePrice'), formCurrency) }}</label>
                    <input v-model.number="formSubscriptionOveragePrice" type="number" min="0.0001" step="0.0001" class="input-sm" data-testid="provider-subscription-overage-price-input" :placeholder="exchangeRates.pricePlaceholder(0.002, formCurrency)" />
                  </div>
                </div>
                <div v-if="formSubscriptionBillingType === 'tokens'" class="flex items-center gap-4">
                  <div class="flex flex-col w-32">
                    <label class="form-label-xs">{{ $t('providers.subscriptionIncludeTokens') }}</label>
                    <input v-model.number="formSubscriptionIncludedTokens" type="number" min="0" class="input-sm" data-testid="provider-subscription-included-tokens-input" placeholder="1000000" />
                  </div>
                  <div class="flex items-center gap-2 mt-5">
                    <input id="allow-overage-tokens" v-model="formSubscriptionAllowOverage" type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-testid="provider-subscription-allow-overage-checkbox" />
                    <label for="allow-overage-tokens" class="text-xs text-gray-600 dark:text-gray-400">{{ $t('providers.subscriptionAllowOverage') }}</label>
                  </div>
                  <div v-if="formSubscriptionAllowOverage" class="flex flex-col w-32">
                    <label class="form-label-xs">{{ exchangeRates.formatLabel($t('providers.subscriptionOveragePrice'), formCurrency) }}</label>
                    <input v-model.number="formSubscriptionOveragePrice" type="number" min="0.0001" step="0.0001" class="input-sm" data-testid="provider-subscription-overage-price-input" :placeholder="exchangeRates.pricePlaceholder(0.002, formCurrency)" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="formPricingModel === 'subscription' && formSubscriptionAllowOverage" class="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 rounded-lg px-3 py-2"><span class="i-tabler-lamp text-sm" />{{ $t('providers.subscriptionOverageHint') }}</div>

          <!-- Models Section -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('providers.models') }}</label>
              <button type="button" class="btn btn-sm btn-ghost-blue" data-testid="provider-model-map-add-btn" @click="addModelRow">+ {{ $t('providers.addModel') }}</button>
            </div>
            <div v-for="(m, idx) in formModels" :key="idx" class="flex flex-wrap items-end gap-2 mb-2 p-2.5 bg-gray-50 dark:bg-gray-700 dark:bg-gray-700 rounded-lg">
              <div class="flex flex-col w-36">
                <label class="form-label-xs">{{ $t('providers.modelName') }}</label>
                <input v-model="m.name" type="text" class="input-sm" data-testid="provider-real-model-input" :placeholder="$t('providers.modelName') + ': gpt-4o'" />
              </div>
              <div v-if="formPricingModel === 'per_request_weighted' || (formPricingModel === 'subscription' && formSubscriptionBillingType === 'weighted_requests' && formSubscriptionAllowOverage)" class="flex flex-col w-16">
                <label class="form-label-xs">{{ $t('providers.weight') }}</label>
                <input v-model.number="m.weight" type="number" min="0.1" step="0.1" class="input-sm" data-testid="provider-model-weight-input" :placeholder="$t('providers.weightPlaceholder')" />
              </div>
              <div v-if="formPricingModel === 'per_model_token' || (formPricingModel === 'subscription' && formSubscriptionBillingType === 'tokens' && formSubscriptionAllowOverage)" class="flex flex-col w-24">
                <label class="form-label-xs">{{ exchangeRates.formatLabel($t('providers.inputPrice'), formCurrency) }}</label>
                <input v-model.number="m.input_price" type="number" min="0" step="0.01" class="input-sm" data-testid="provider-model-input-price-input" :placeholder="exchangeRates.pricePlaceholder(2.5, formCurrency)" />
              </div>
              <div v-if="formPricingModel === 'per_model_token' || (formPricingModel === 'subscription' && formSubscriptionBillingType === 'tokens' && formSubscriptionAllowOverage)" class="flex flex-col w-24">
                <label class="form-label-xs">{{ exchangeRates.formatLabel($t('providers.outputPrice'), formCurrency) }}</label>
                <input v-model.number="m.output_price" type="number" min="0" step="0.01" class="input-sm" data-testid="provider-model-output-price-input" :placeholder="exchangeRates.pricePlaceholder(10, formCurrency)" />
              </div>
              <div v-if="formPricingModel === 'per_model_token' || (formPricingModel === 'subscription' && formSubscriptionBillingType === 'tokens' && formSubscriptionAllowOverage)" class="flex flex-col w-24">
                <label class="form-label-xs">{{ exchangeRates.formatLabel($t('providers.cacheHitPrice'), formCurrency) }}</label>
                <input v-model.number="m.cache_hit_price" type="number" min="0" step="0.01" class="input-sm" data-testid="provider-model-cache-hit-price-input" :placeholder="$t('providers.cacheHitPrice')" />
              </div>
              <div v-if="formPricingModel === 'per_model_token' || (formPricingModel === 'subscription' && formSubscriptionBillingType === 'tokens' && formSubscriptionAllowOverage)" class="flex flex-col w-24">
                <label class="form-label-xs">{{ exchangeRates.formatLabel($t('providers.cacheCreatePrice'), formCurrency) }}</label>
                <input v-model.number="m.cache_create_price" type="number" min="0" step="0.01" class="input-sm" data-testid="provider-model-cache-create-price-input" :placeholder="$t('providers.cacheCreatePrice')" />
              </div>
              <div class="flex flex-col w-28">
                <label class="form-label-xs">{{ $t('providers.modelAlias') }}</label>
                <select v-model="m.alias" class="select-sm" data-testid="provider-map-alias-select"><option value="">{{ $t('providers.aliasPlaceholder') }}</option><option v-for="a in aliasOptions" :key="a" :value="a">{{ a }}</option></select>
              </div>
              <button type="button" class="btn btn-sm btn-ghost-red px-1.5" @click="removeModelRow(idx)" data-testid="provider-model-remove-btn">
                <span class="i-tabler-trash" />
              </button>
            </div>
          </div>

          <!-- Rate Limits Section -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ $t('providers.rateLimits') }}</label>
              <button type="button" class="btn btn-sm btn-ghost-blue" data-testid="provider-ratelimit-add-btn" @click="addRateLimit">+ {{ $t('providers.addRateLimit') }}</button>
            </div>
            <div v-for="(rl, idx) in formRateLimits" :key="idx" class="flex flex-wrap items-end gap-2 mb-2 p-2.5 bg-gray-50 dark:bg-gray-700 dark:bg-gray-700 rounded-lg">
              <div class="flex flex-col w-28">
                <label class="form-label-xs">{{ $t('providers.rateLimitType') }}</label>
                <select v-model="rl.type" class="select-sm" data-testid="provider-ratelimit-type-select" @change="onRateLimitTypeChange(rl)">
                  <option v-for="opt in rateLimitTypes" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div class="flex flex-col w-24">
                <label class="form-label-xs">{{ $t('providers.rateLimitMax') }}</label>
                <input v-model.number="rl.max" type="number" min="1" class="input-sm" data-testid="provider-ratelimit-max-input" placeholder="100" />
              </div>
              <div v-if="hasPeriod(rl.type)" class="flex flex-col w-28">
                <label class="form-label-xs">{{ $t('providers.rateLimitPeriod') }}</label>
                <select v-model="rl.period" class="select-sm" data-testid="provider-ratelimit-period-select">
                  <option v-for="po in periodOptions" :key="po.value" :value="po.value">{{ po.label }}</option>
                </select>
              </div>
              <button type="button" class="btn btn-sm btn-ghost-red px-1.5" data-testid="provider-ratelimit-remove-btn" @click="removeRateLimit(idx)">
                <span class="i-tabler-trash" />
              </button>
            </div>
            <div v-if="subscriptionRateLimit" class="flex flex-wrap items-end gap-2 mb-2 p-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div class="flex flex-col w-28">
                <label class="form-label-xs">{{ $t('providers.subscriptionLink') }}</label>
                <select disabled class="select-sm select-disabled"><option>{{ subscriptionRateLimit.type === 'weighted_requests' ? $t('providers.subscriptionBillingTypeWeighted') : $t('providers.subscriptionBillingTypeTokens') }}</option></select>
              </div>
              <div class="flex flex-col w-24">
                <label class="form-label-xs">{{ $t('providers.rateLimitMax') }}</label>
                <input :value="subscriptionRateLimit.max" disabled type="number" class="input-sm input-disabled" />
              </div>
              <div class="flex flex-col w-28">
                <label class="form-label-xs">{{ $t('providers.rateLimitPeriod') }}</label>
                <select disabled class="select-sm select-disabled"><option>{{ subscriptionRateLimit.period === 'month' ? $t('common.month') : subscriptionRateLimit.period }}</option></select>
              </div>
              <span class="text-xs text-gray-500 italic mb-1">{{ $t('providers.subscriptionLinkDesc') }}</span>
            </div>
          </div>

          <div>
            <label class="form-label">{{ $t('providers.customHeaders') }}</label>
            <textarea v-model="formHeaders" class="input font-mono" data-testid="provider-headers-input" rows="3" placeholder='{"User-Agent": "..."}' />
          </div>

          <div class="flex items-center gap-2">
            <input v-model="formEnabled" type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-testid="provider-enabled-checkbox" />
            <label class="text-sm text-gray-700 dark:text-gray-300">{{ $t('common.enabled') }}</label>
          </div>
          <div>
            <label class="form-label">{{ $t('common.description') }}</label>
            <textarea v-model="formDescription" class="input" data-testid="provider-description-input" rows="2" />
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button class="btn-secondary" :data-testid="isEditing ? 'provider-edit-cancel-btn' : 'provider-cancel-btn'" @click="showModal = false">{{ $t('common.cancel') }}</button>
            <button class="btn-primary" :data-testid="isEditing ? 'provider-update-btn' : 'provider-save-btn'" @click="isEditing ? handleUpdate() : handleCreate()">{{ isEditing ? $t('common.update') : $t('common.create') }}</button>
          </div>
        </div>
      </AppModal>

      <ConfirmDialog
        v-model:open="showDeleteDialog"
        :title="$t('confirm.deleteTitle')"
        :message="$t('confirm.deleteProvider', { name: deletingProvider?.name })"
        data-testid="confirm-delete-dialog"
        @confirm="handleDelete"
      />

      <ConfirmDialog
        v-model:open="showForceDeleteDialog"
        :title="$t('confirm.deleteTitle')"
        :message="$t('confirm.deleteProviderWithAuths', { name: deletingProvider?.name, count: deletingAuthCount })"
        confirm-text="确认删除"
        data-testid="confirm-force-delete-dialog"
        @confirm="handleForceDelete"
      />

      </div>
</template>