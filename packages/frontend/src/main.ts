import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index.js";
import i18n from "./locales/index.js";
import "virtual:uno.css";

const app = createApp(App);
app.use(router);
app.use(i18n);
app.mount("#app");
