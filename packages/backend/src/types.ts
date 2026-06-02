import type { ModelAlias, Provider, Auth } from "@llm-proxy/shared/schemas";

export interface GatewayConfig {
  port: number;
  configDir: string;
  dbPath: string;
}

export interface ProxyRequest {
  modelAlias: string;
  body: unknown;
  format: "openai_chat" | "anthropic_messages" | "openai_responses";
  headers: Record<string, string>;
}

export interface ProxyResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

export interface RouteResult {
  providerId: string;
  authKey: string;
  realModel: string;
  upstreamUrl: string;
}

export { ModelAlias, Provider, Auth };
