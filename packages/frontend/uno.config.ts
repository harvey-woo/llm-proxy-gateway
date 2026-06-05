import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetIcons,
} from "unocss";

export default defineConfig({
  presets: [
    presetUno({ dark: "class" }),
    presetAttributify(),
    presetIcons({
      collections: {
        tabler: () =>
          import("@iconify-json/tabler/icons.json").then((i) => i.default),
      },
    }),
  ],
  shortcuts: {
    // ============================
    //  Page Layout
    // ============================
    "page-container": "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6",
    "page-header": "flex items-center justify-between mb-6",
    "page-title": "text-2xl font-bold text-gray-900 dark:text-gray-100",
    "page-subtitle": "text-gray-500 dark:text-gray-400 mt-1",

    // ============================
    //  Cards
    // ============================
    card: "bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-gray-900/30 transition-shadow duration-200",
    "card-header": "px-6 py-4 border-b border-gray-200 dark:border-gray-700",
    "card-body": "p-5",
    "card-section":
      "bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6 shadow-sm dark:shadow-gray-900/30 transition-shadow duration-200",

    // ============================
    //  Tables
    // ============================
    "table-wrap": "w-full text-sm",
    "table-head":
      "bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10",
    "table-th":
      "text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider whitespace-nowrap",
    "table-td": "px-4 py-3 text-sm text-gray-700 dark:text-gray-300",
    "table-row":
      "hover:bg-blue-50/40 dark:hover:bg-blue-900/20 border-b border-gray-100 dark:border-gray-700/50 transition-colors duration-150",

    // ============================
    //  Buttons — Base & Size System
    // ============================
    btn: "rounded-lg font-medium transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 cursor-pointer select-none whitespace-nowrap",

    "btn-sm":
      "rounded-lg font-medium transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 cursor-pointer select-none px-3 py-1.5 text-xs gap-1 whitespace-nowrap border border-solid border-transparent",
    "btn-md":
      "rounded-lg font-medium transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 cursor-pointer select-none px-4 py-2 text-sm gap-1.5 whitespace-nowrap",
    "btn-lg":
      "rounded-lg font-medium transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 cursor-pointer select-none px-5 py-2.5 text-base gap-2 whitespace-nowrap",

    "btn-solid-blue":
      "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700 shadow-sm",
    "btn-outline":
      "bg-white dark:bg-gray-800 border border-solid border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600",
    "btn-ghost-blue":
      "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30",
    "btn-ghost-red":
      "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30",

    "btn-primary":
      "rounded-lg font-medium transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 cursor-pointer select-none px-4 py-2 text-sm gap-1.5 bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700 shadow-sm whitespace-nowrap border border-solid border-transparent",
    "btn-secondary":
      "rounded-lg font-medium transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 cursor-pointer select-none px-4 py-2 text-sm gap-1.5 bg-white dark:bg-gray-800 border border-solid border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 whitespace-nowrap",

    "btn-ghost":
      "rounded-lg font-medium transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 cursor-pointer select-none px-3 py-1.5 text-xs gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 whitespace-nowrap border border-solid border-transparent",
    "btn-danger":
      "rounded-lg font-medium transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 cursor-pointer select-none px-3 py-1.5 text-xs gap-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 whitespace-nowrap border border-solid border-transparent",

    // ============================
    //  Form Controls — Base & Size System
    // ============================
    "input-sm":
      "w-full px-3 py-1.5 border border-solid border-gray-300 dark:border-gray-600 rounded-lg text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 box-border dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500",
    input:
      "w-full px-3 py-2 border border-solid border-gray-300 dark:border-gray-600 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 box-border dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500",
    "input-lg":
      "w-full px-4 py-2.5 border border-solid border-gray-300 dark:border-gray-600 rounded-lg text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 box-border dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500",

    "input-disabled":
      "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 placeholder-gray-300 dark:placeholder-gray-600",

    "select-sm":
      "w-full px-3 py-1.5 pr-7 border border-solid border-gray-300 dark:border-gray-600 rounded-lg text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 box-border appearance-none bg-no-repeat bg-[length:16px] text-gray-900 dark:text-gray-200 dark:bg-gray-700",
    select:
      "w-full px-3 py-2 pr-7 border border-solid border-gray-300 dark:border-gray-600 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 box-border appearance-none bg-no-repeat bg-[length:16px] text-gray-900 dark:text-gray-200 dark:bg-gray-700",
    "select-lg":
      "w-full px-4 py-2.5 pr-7 border border-solid border-gray-300 dark:border-gray-600 rounded-lg text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 box-border appearance-none bg-no-repeat bg-[length:16px] text-gray-900 dark:text-gray-200 dark:bg-gray-700",

    "select-disabled":
      "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-75",

    // ============================
    //  Badges
    // ============================
    badge:
      "inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
    "badge-green":
      "badge bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300",
    "badge-red":
      "badge bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300",
    "badge-gray":
      "badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
    "badge-blue":
      "badge bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    "badge-yellow":
      "badge bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300",
    "badge-oauth":
      "badge bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",

    // ============================
    //  Labels
    // ============================
    "form-label":
      "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1",
    "form-label-xs": "text-xs text-gray-500 dark:text-gray-400 mb-0.5",

    // ============================
    //  Sticky First Column (for scrollable tables)
    // ============================
    "table-th-sticky":
      "table-th sticky left-0 z-20 bg-gray-50 dark:bg-gray-800/60 after:absolute after:inset-y-0 after:right-0 after:w-3 after:shadow-[3px_0_6px_-3px_rgba(0,0,0,0.12)] after:pointer-events-none",
    "table-td-sticky":
      "table-td sticky left-0 z-10 bg-white dark:bg-gray-800 after:absolute after:inset-y-0 after:right-0 after:w-3 after:shadow-[3px_0_6px_-3px_rgba(0,0,0,0.12)] after:pointer-events-none",
  },
  theme: {
    fontFamily: {
      sans: [
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Noto Sans"',
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ],
      mono: [
        '"SF Mono"',
        '"JetBrains Mono"',
        '"Cascadia Code"',
        '"Fira Code"',
        '"Source Code Pro"',
        "ui-monospace",
        "monospace",
      ],
    },
  },
  rules: [
    [
      /^scroll-thin$/,
      () => ({
        "scrollbar-width": "thin",
      }),
    ],
  ],
});
