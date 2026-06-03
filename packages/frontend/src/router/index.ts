import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", name: "Dashboard", component: () => import("../views/Dashboard.vue") },
    { path: "/models", name: "Models", component: () => import("../views/Models.vue") },
    { path: "/providers", name: "Providers", component: () => import("../views/Providers.vue") },
    { path: "/auths", name: "Auths", component: () => import("../views/Auths.vue") },
    { path: "/stats", name: "Stats", component: () => import("../views/Stats.vue") },
    { path: "/settings", name: "Settings", component: () => import("../views/Settings.vue") },
  ],
});

export default router;
