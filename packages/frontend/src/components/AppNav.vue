<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import CurrencySwitcher from "./CurrencySwitcher.vue";
import ThemeToggle from "./ThemeToggle.vue";
import LanguageSwitcher from "./LanguageSwitcher.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const isDesktop = typeof window !== "undefined" && !!(window as any).__electrobun;
const isMac = isDesktop && navigator.platform.includes("Mac");
const isWindows = isDesktop && navigator.platform.includes("Win");

const tabs = [
  { key: "nav.dashboard", path: "/dashboard", testId: "nav-dashboard-tab", icon: "i-tabler-layout-dashboard" },
  { key: "nav.models", path: "/models", testId: "nav-models-tab", icon: "i-tabler-settings" },
  { key: "nav.providers", path: "/providers", testId: "nav-providers-tab", icon: "i-tabler-server" },
  { key: "nav.auths", path: "/auths", testId: "nav-auths-tab", icon: "i-tabler-key" },
  { key: "nav.stats", path: "/stats", testId: "nav-stats-tab", icon: "i-tabler-chart-bar" },
];

function isActive(path: string) {
  return route.path === path;
}

function navigate(path: string) {
  router.push(path);
}
</script>

<template>
  <header class="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 select-none electrobun-webkit-app-region-drag">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div :class="['flex items-center justify-between h-14', isMac ? 'pl-[60px]' : '', isWindows ? 'pr-[72px]' : '']">
        <div class="flex items-center gap-3 shrink-0">
          <span class="text-sm lg:text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight whitespace-nowrap select-none">LLM Proxy Gateway</span>
        </div>
        <nav class="flex items-center gap-1 electrobun-webkit-app-region-no-drag">
          <button
            v-for="tab in tabs"
            :key="tab.path"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer',
              isActive(tab.path)
                ? 'bg-blue-100 text-blue-700 shadow-sm dark:bg-blue-900/40 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
            ]"
            :data-testid="tab.testId"
            @click="navigate(tab.path)"
          >
            <span :class="['text-base', tab.icon]" />
            <span class="hidden lg:inline">{{ t(tab.key) }}</span>
          </button>
        </nav>
        <div class="flex items-center gap-2 electrobun-webkit-app-region-no-drag">
          <CurrencySwitcher />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </div>
  </header>
</template>
