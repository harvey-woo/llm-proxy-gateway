<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const STORAGE_KEY = "llm-proxy-theme";

type Theme = "light" | "dark" | "auto";

const theme = ref<Theme>("auto");

let mediaQuery: MediaQueryList | null = null;
let mediaListener: (() => void) | null = null;

function applyTheme(t: Theme) {
  theme.value = t;
  localStorage.setItem(STORAGE_KEY, t);

  if (t === "auto") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    document.documentElement.classList.toggle("dark", prefersDark);
    // Listen for system changes
    listenToSystem();
  } else {
    document.documentElement.classList.toggle("dark", t === "dark");
    // Stop listening in manual mode
    stopListening();
  }
}

function listenToSystem() {
  stopListening();
  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaListener = () => {
    if (theme.value === "auto") {
      document.documentElement.classList.toggle("dark", mediaQuery!.matches);
    }
  };
  mediaQuery.addEventListener("change", mediaListener);
}

function stopListening() {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener("change", mediaListener);
    mediaListener = null;
  }
}

const nextLabel: Record<Theme, string> = {
  light: "切换深色模式",
  dark: "跟随系统",
  auto: "切换亮色模式",
};

const nextIcon: Record<Theme, string> = {
  light: "i-tabler-moon",
  dark: "i-tabler-brightness-auto",
  auto: "i-tabler-sun",
};

function cycle() {
  const order: Theme[] = ["light", "dark", "auto"];
  const idx = order.indexOf(theme.value);
  applyTheme(order[(idx + 1) % 3]);
}

onMounted(() => {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  applyTheme(stored || "auto");
});

onUnmounted(() => {
  stopListening();
});
</script>

<template>
  <button
    class="px-2 py-1.5 rounded-lg text-sm transition-colors inline-flex items-center gap-1.5
           text-gray-500 hover:bg-gray-100 hover:text-gray-800
           dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
    :data-testid="'theme-toggle'"
    :title="nextLabel[theme]"
    @click="cycle"
  >
    <span v-if="theme === 'light'" class="text-base i-tabler-moon" />
    <span v-else-if="theme === 'dark'" class="text-base i-tabler-brightness-auto" />
    <span v-else class="text-base i-tabler-sun" />
  </button>
</template>
