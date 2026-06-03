<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { RouterView } from "vue-router";
import AppNav from "./components/AppNav.vue";
import ToastContainer from "./components/ToastContainer.vue";

const isDesktop = ref(false);
const { locale } = useI18n();

// ── Theme init ──
type Theme = "light" | "dark" | "auto";
const THEME_KEY = "llm-proxy-theme";

function applyTheme(t: Theme) {
  localStorage.setItem(THEME_KEY, t);
  if (t === "auto") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", prefersDark);
  } else {
    document.documentElement.classList.toggle("dark", t === "dark");
  }
}

// ── Locale init ──
type Lang = "zh" | "en";
const LANG_KEY = "llm-proxy-locale";

function applyLang(l: Lang) {
  locale.value = l;
  localStorage.setItem(LANG_KEY, l);
  document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
}

onMounted(() => {
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  applyTheme(stored || "auto");

  const lang = localStorage.getItem(LANG_KEY) as Lang | null;
  applyLang(lang || (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en"));

  isDesktop.value = typeof window !== "undefined" && !!(window as any).__electrobun;
});
</script>

<template>
  <div class="min-h-screen h-screen flex flex-col bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 text-gray-900 dark:text-gray-100">
    <AppNav />
    <main class="flex-1 overflow-y-auto">
      <div :class="isDesktop ? '' : 'page-container'">
        <router-view v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </router-view>
      </div>
    </main>
    <ToastContainer />
  </div>
</template>

<style>
/* Select dropdown arrow — uses currentColor so dark mode just changes color */
select[class*="select"] {
  color: #111827;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22currentColor%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E");
  background-position: right 10px center;
  background-size: 16px;
  background-repeat: no-repeat;
}
.dark select[class*="select"] {
  color: #e5e7eb;
}

/* Explicit body reset */
html, body {
  margin: 0;
  padding: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
}

/* Progressive enhancement: base-select */
@supports (appearance: base-select) {
  select.select, select.select-sm, select.select-lg {
    appearance: base-select;
    background-image: none;
    padding-right: 0.375rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Dark mode select background */
  .dark select.select, .dark select.select-sm, .dark select.select-lg {
    background-color: #374151;
    color: #e5e7eb;
  }

  /* Arrow SVG — currentColor adapts to dark mode */
  select.select-lg::picker-icon {
    content: "";
    width: 20px;
    height: 20px;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22currentColor%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    transition: rotate 0.2s;
    color: #9ca3af;
  }
  .dark select.select-lg::picker-icon {
    color: #6b7280;
  }

  select.select-sm::picker-icon {
    content: "";
    width: 14px;
    height: 14px;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22currentColor%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    transition: rotate 0.2s;
    color: #9ca3af;
  }
  .dark select.select-sm::picker-icon {
    color: #6b7280;
  }

  select.select::picker-icon {
    content: "";
    width: 16px;
    height: 16px;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22currentColor%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    align-self: center;
    transition: rotate 0.2s;
    color: #9ca3af;
  }
  .dark select.select::picker-icon {
    color: #6b7280;
  }

  select.select:open::picker-icon,
  select.select-sm:open::picker-icon,
  select.select-lg:open::picker-icon {
    rotate: 180deg;
  }

  /* Dropdown panel */
  select.select::picker(select),
  select.select-sm::picker(select),
  select.select-lg::picker(select) {
    appearance: base-select;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    background: white;
    max-height: 240px;
  }
  .dark select.select::picker(select),
  .dark select.select-sm::picker(select),
  .dark select.select-lg::picker(select) {
    border-color: #374151;
    background: #1f2937;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  select.select-sm option { padding: 6px 10px; font-size: 0.75rem; border-radius: 4px; color: #374151; }
  select.select option { padding: 8px 12px; font-size: 0.875rem; border-radius: 4px; color: #374151; }
  select.select-lg option { padding: 10px 14px; font-size: 1rem; border-radius: 4px; color: #374151; }
  .dark select.select-sm option,
  .dark select.select option,
  .dark select.select-lg option { color: #d1d5db; }

  select.select-sm option:hover,
  select.select option:hover,
  select.select-lg option:hover {
    background: #eff6ff;
    color: #2563eb;
  }
  .dark select.select-sm option:hover,
  .dark select.select option:hover,
  .dark select.select-lg option:hover {
    background: #1e3a5f;
    color: #93c5fd;
  }

  select.select-sm option:checked,
  select.select option:checked,
  select.select-lg option:checked {
    background: #dbeafe;
    color: #1d4ed8;
    font-weight: 500;
  }
  .dark select.select-sm option:checked,
  .dark select.select option:checked,
  .dark select.select-lg option:checked {
    background: #1e3a5f;
    color: #60a5fa;
  }
}

/* Page transition */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Scrollbar colors — follow theme */
html {
  scrollbar-color: #d1d5db transparent;
  scrollbar-width: thin;
}
.dark html {
  scrollbar-color: #4b5563 transparent;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}
.dark ::-webkit-scrollbar-thumb {
  background: #4b5563;
}

/* Button reset */
button {
  background: none;
  border: 1px solid transparent;
}
</style>
