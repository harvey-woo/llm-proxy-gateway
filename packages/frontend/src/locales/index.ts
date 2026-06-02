import { createI18n } from "vue-i18n";
import zh from "./zh.json";
import en from "./en.json";

const STORAGE_KEY = "llm-proxy-locale";

function getDefaultLocale(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "zh" || stored === "en") return stored;
  const browserLang = navigator.language?.toLowerCase() || "";
  if (browserLang.startsWith("zh")) return "zh";
  return "en";
}

const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: "en",
  messages: { zh, en },
});

export function setLocale(locale: "zh" | "en") {
  i18n.global.locale.value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
}

export default i18n;
