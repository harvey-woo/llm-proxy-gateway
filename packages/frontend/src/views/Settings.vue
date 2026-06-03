<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useExchangeRates } from "../composables/useExchangeRates";
import { useToast } from "../composables/useToast";

const { t, locale } = useI18n();
const { preferredCurrency, supportedCurrencies, setCurrency } = useExchangeRates();
const { success } = useToast();

// ── Language ──
type Lang = "zh" | "en";
const lang = ref<Lang>("en");
const STORAGE_LANG = "llm-proxy-locale";

function applyLang(l: Lang) {
  lang.value = l;
  locale.value = l;
  localStorage.setItem(STORAGE_LANG, l);
  document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
}

const langDisplay: Record<Lang, string> = { zh: "中", en: "EN" };
const langOptions: { value: Lang; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

// ── Theme ──
type Theme = "light" | "dark" | "auto";
const theme = ref<Theme>("auto");
const STORAGE_THEME = "llm-proxy-theme";

function applyTheme(t: Theme) {
  theme.value = t;
  localStorage.setItem(STORAGE_THEME, t);
  if (t === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", prefersDark);
  } else {
    document.documentElement.classList.toggle("dark", t === "dark");
  }
}

const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "light", icon: "i-tabler-sun" },
  { value: "dark", label: "dark", icon: "i-tabler-moon" },
  { value: "auto", label: "auto", icon: "i-tabler-brightness-auto" },
];

// ── Port (desktop only) ──
const isDesktop = typeof window !== "undefined" && !!(window as any).__electrobun;
const mode = isDesktop && (window as any).__electrobun?.env === "production" ? "production" : "development";
const port = ref(mode === "production" ? 9000 : 9001);
const STORAGE_PORT = "llm-proxy-port";
const portInput = ref("");
const portSaved = ref(true);

function loadPort() {
  const stored = localStorage.getItem(STORAGE_PORT);
  const p = stored ? parseInt(stored, 10) : 9000;
  port.value = p;
  portInput.value = String(p);
}

function savePort() {
  const p = parseInt(portInput.value, 10);
  if (isNaN(p) || p < 1 || p > 65535) return;
  port.value = p;
  // Send to host via Electrobun IPC
  if (isDesktop && (window as any).__electrobunSendToHost) {
    (window as any).__electrobunSendToHost({ type: "save-port", port: String(p) });
  }
  localStorage.setItem(STORAGE_PORT, String(p));
  portSaved.value = true;
  success(t("settings.portSaved"));
}

function needsRestart() {
  return parseInt(portInput.value, 10) !== port.value;
}

// ── Init ──
onMounted(() => {
  lang.value = (localStorage.getItem(STORAGE_LANG) as Lang) || (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en");
  theme.value = (localStorage.getItem(STORAGE_THEME) as Theme) || "auto";
  if (isDesktop) loadPort();
});
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-6">
    <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ t("settings.title") }}</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t("settings.subtitle") }}</p>

    <!-- Language -->
    <section class="mt-6">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ t("settings.language") }}</h2>
      <div class="flex gap-2">
        <button
          v-for="opt in langOptions"
          :key="opt.value"
          :class="[
            'px-2 py-2 rounded-lg text-sm font-semibold tracking-wide transition-colors inline-flex items-center justify-center min-w-[44px] cursor-pointer',
            lang === opt.value
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200',
          ]"
          @click="applyLang(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </section>

    <!-- Theme -->
    <section class="mt-6">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ t("settings.theme") }}</h2>
      <div class="flex gap-2">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          :class="[
            'px-2 py-2 rounded-lg text-sm transition-colors inline-flex items-center gap-1.5 cursor-pointer',
            theme === opt.value
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200',
          ]"
          @click="applyTheme(opt.value)"
        >
          <span :class="['text-base', opt.icon]" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </section>

    <!-- Currency -->
    <section class="mt-6">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ t("settings.currency") }}</h2>
      <select
        :value="preferredCurrency"
        @change="setCurrency(($event.target as HTMLSelectElement).value)"
        class="select w-auto min-w-[80px]"
      >
        <option v-for="c in supportedCurrencies" :key="c" :value="c">{{ c }}</option>
      </select>
    </section>

    <!-- Port (desktop only) -->
    <section v-if="isDesktop" class="mt-6">
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{{ t("settings.port") }}</h2>
      <div class="flex items-center gap-3">
        <input
          v-model="portInput"
          type="number"
          min="1"
          max="65535"
          class="input w-28"
          @input="portSaved = false"
        />
        <button
          :class="[
            'btn',
            needsRestart()
              ? 'btn-primary'
              : 'btn-secondary opacity-50 cursor-not-allowed',
          ]"
          :disabled="!needsRestart()"
          @click="savePort"
        >
          {{ t("common.save") }}
        </button>
      </div>
      <p v-if="!portSaved" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
        {{ t("settings.restartRequired") }}
      </p>
    </section>
  </div>
</template>
