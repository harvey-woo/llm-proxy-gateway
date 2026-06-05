<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const { locale } = useI18n();
const STORAGE_KEY = "llm-proxy-locale";

type Lang = "zh" | "en";

const lang = ref<Lang>("en");

function applyLang(l: Lang) {
  lang.value = l;
  locale.value = l;
  localStorage.setItem(STORAGE_KEY, l);
  document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
}

const nextLang: Record<Lang, Lang> = {
  zh: "en",
  en: "zh",
};

const displayText: Record<Lang, string> = {
  zh: "中",
  en: "EN",
};

const title: Record<Lang, string> = {
  zh: "Switch to English",
  en: "切换到中文",
};

function cycle() {
  applyLang(nextLang[lang.value]);
}

onMounted(() => {
  const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
  applyLang(
    stored ||
      (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en"),
  );
});
</script>

<template>
  <button
    class="px-2 py-1.5 rounded-lg text-sm font-semibold tracking-wide transition-colors inline-flex items-center justify-center min-w-[36px]
           text-gray-500 hover:bg-gray-100 hover:text-gray-800
           dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
    :data-testid="'locale-toggle'"
    :title="title[lang]"
    @click="cycle"
  >
    {{ displayText[lang] }}
  </button>
</template>
