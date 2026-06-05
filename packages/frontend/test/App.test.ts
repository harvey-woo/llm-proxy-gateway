import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import App from "../src/App.vue";
import ToastContainer from "../src/components/ToastContainer.vue";
import i18n from "../src/locales/index.js";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: { template: "<div>LLM Proxy Gateway</div>" } },
  ],
});

describe("App.vue", () => {
  it("renders RouterView and ToastContainer", () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router, i18n],
      },
    });
    expect(wrapper.findComponent(ToastContainer).exists()).toBe(true);
  });
});
