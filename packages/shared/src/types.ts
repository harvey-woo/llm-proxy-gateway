export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  apiKey?: string;
  maxTokens?: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface ProxyRoute {
  path: string;
  modelId: string;
  methods: string[];
}

export interface RequestStats {
  id: string;
  modelId: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "success" | "error" | "rate_limited";
}

export interface GatewayConfig {
  port: number;
  routes: ProxyRoute[];
  models: ModelConfig[];
}
