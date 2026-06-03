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

function sendWindowControl(action: "minimize" | "maximize" | "close") {
  if (isDesktop && (window as any).__electrobunSendToHost) {
    (window as any).__electrobunSendToHost({ type: "window-control", action });
  }
}

const tabs = [
  { key: "nav.dashboard", path: "/dashboard", testId: "nav-dashboard-tab", icon: "i-tabler-layout-dashboard" },
  { key: "nav.models", path: "/models", testId: "nav-models-tab", icon: "i-tabler-route-2" },
  { key: "nav.providers", path: "/providers", testId: "nav-providers-tab", icon: "i-tabler-server" },
  { key: "nav.auths", path: "/auths", testId: "nav-auths-tab", icon: "i-tabler-key" },
  { key: "nav.stats", path: "/stats", testId: "nav-stats-tab", icon: "i-tabler-chart-bar" },
  { key: "nav.settings", path: "/settings", testId: "nav-settings-tab", icon: "i-tabler-settings" },
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
      <div :class="['flex items-center justify-between h-14', isMac ? 'pl-[60px]' : '', isWindows ? 'pr-[108px]' : '']">
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
          <!-- Windows window controls -->
          <template v-if="isWindows">
            <button class="w-9 h-9 flex items-center justify-center rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors" @click="sendWindowControl('minimize')" title="Minimize">
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
            <button class="w-9 h-9 flex items-center justify-center rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors" @click="sendWindowControl('maximize')" title="Maximize">
              <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" stroke="currentColor" stroke-width="1.2" fill="none" rx="1"/></svg>
            </button>
            <button class="w-9 h-9 flex items-center justify-center rounded-md text-gray-600 dark:text-gray-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 cursor-pointer transition-colors" @click="sendWindowControl('close')" title="Close">
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </template>
        </div>
      </div>
    </div>
  </header>
</template>
