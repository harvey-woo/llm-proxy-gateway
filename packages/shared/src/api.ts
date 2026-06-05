import type { ModelConfig, ProxyRoute, GatewayConfig } from "./types.js";

const API_BASE = "/api";

export async function fetchConfig(): Promise<GatewayConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`);
  return res.json();
}

export async function updateConfig(
  config: Partial<GatewayConfig>,
): Promise<void> {
  const res = await fetch(`${API_BASE}/config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to update config: ${res.status}`);
}

export async function listModels(): Promise<ModelConfig[]> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json();
}

export async function listRoutes(): Promise<ProxyRoute[]> {
  const res = await fetch(`${API_BASE}/routes`);
  if (!res.ok) throw new Error(`Failed to fetch routes: ${res.status}`);
  return res.json();
}
