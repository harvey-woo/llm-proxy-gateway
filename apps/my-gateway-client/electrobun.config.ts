import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "LLM Proxy Gateway",
    identifier: "com.llm-proxy.gateway",
    version: "0.1.0",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
  },
} satisfies ElectrobunConfig;
