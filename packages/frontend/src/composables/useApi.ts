import { ref, type Ref } from "vue";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
  total?: number;
  page?: number;
  page_size?: number;
}

/**
 * Backend API base URL.
 *
 * Default is empty string (same-origin), which works in two scenarios:
 *
 * 1. Development (Vite proxy): Vite dev server on :5173 proxies
 *    /api, /v1, /health to backend on :9000 — same-origin, no CORS needed.
 *
 * 2. Production desktop: Backend serves frontend on :9000 from the
 *    same HTTP server — naturally same-origin.
 *
 * Override with VITE_API_BASE env var at build time if needed
 * (e.g., standalone dev without proxy).
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

export function useApi() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  function apiUrl(path: string): string {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (API_BASE) return `${API_BASE}${path}`;
    return path;
  }

  async function request<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(apiUrl(url), {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      const data = (await res.json()) as ApiResponse<T>;
      if (!res.ok || !data.success) {
        error.value = data.error ?? "Request failed";
        return { success: false, data: data.data, error: data.error, code: data.code };
      }
      return data;
    }
    catch (e: any) {
      error.value = e.message ?? "Network error";
      return { success: false, data: null as unknown as T, error: error.value };
    }
    finally {
      loading.value = false;
    }
  }

  async function get<T>(url: string): Promise<ApiResponse<T>> {
    return request<T>(url);
  }

  async function post<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async function patch<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(url, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async function put<T>(url: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(url, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async function remove<T>(url: string): Promise<ApiResponse<T>> {
    return request<T>(url, { method: "DELETE" });
  }

  return { loading, error, get, post, patch, put, remove };
}
