import { randomBytes, createHash } from "node:crypto";

// ============================================================
// Codex OAuth 2.0 PKCE Flow — Session Store & Helpers
// ============================================================
//
// References:
//   - CPA OAuth flow: https://github.com/router-for-me/CLIProxyAPIHome
//   - Codex OAuth client_id: app_EMoamEEZ73f0CkXaXp7hrann
//   - Authorize endpoint: https://auth.openai.com/oauth/authorize
//   - Token endpoint:     https://auth.openai.com/oauth/token
//
// Flow:
//   1. GET /api/oauth/codex/authorize → generate PKCE+state, return auth URL
//   2. User opens auth URL, authorizes → redirect to callback
//   3. GET /api/oauth/codex/callback → exchange code → store tokens → done
//   4. GET /api/oauth/codex/status → poll for completion
// ============================================================

// ── Constants ──

export const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const CODEX_AUTH_URL = "https://auth.openai.com/oauth/authorize";
export const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
// CPA 固定的回调地址 — 必须在 OAuth app 注册列表中
export const CODEX_REDIRECT_URI = "http://localhost:1455/auth/callback";
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── PKCE helpers ──

/**
 * Generate a cryptographically random code_verifier (RFC 7636).
 * 64 bytes → base64url-encoded → ~86 characters.
 */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(64));
}

/**
 * Derive S256 code_challenge from code_verifier.
 */
export function generateCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate a random state string for CSRF protection.
 */
export function generateState(): string {
  return base64url(randomBytes(32));
}

// ── OAuth Session ──

export interface OAuthSession {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  providerId: string;
  redirectUri: string;
  status: "pending" | "completed" | "error";
  error?: string;
  createdAt: number;
}

/**
 * In-memory OAuth session store.
 * Sessions expire after SESSION_TTL_MS.
 */
class OAuthSessionStore {
  private sessions = new Map<string, OAuthSession>();

  set(session: OAuthSession): void {
    this.cleanup();
    this.sessions.set(session.state, session);
  }

  get(state: string): OAuthSession | undefined {
    this.cleanup();
    return this.sessions.get(state);
  }

  updateStatus(
    state: string,
    status: "completed" | "error",
    error?: string,
  ): void {
    const session = this.sessions.get(state);
    if (session) {
      session.status = status;
      session.error = error;
    }
  }

  /** Remove expired sessions. */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, s] of this.sessions) {
      if (now - s.createdAt > SESSION_TTL_MS) {
        this.sessions.delete(key);
      }
    }
  }
}

export const oauthSessionStore = new OAuthSessionStore();

// ── Build Codex authorization URL ──

export function buildCodexAuthURL(params: {
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(CODEX_AUTH_URL);
  url.searchParams.set("client_id", CODEX_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", CODEX_REDIRECT_URI);
  url.searchParams.set("scope", "openid email profile offline_access");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "login");
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  return url.toString();
}

// ── Token exchange ──

export interface CodexTokenData {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  email: string;
  accountId: string;
  planType: string;
  expiresAt: string;
}

/**
 * Exchange authorization code for tokens via auth.openai.com/oauth/token.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<CodexTokenData> {
  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("client_id", CODEX_CLIENT_ID);
  form.set("code", code);
  form.set("redirect_uri", redirectUri);
  form.set("code_verifier", codeVerifier);

  const response = await fetch(CODEX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    id_token: string;
    token_type: string;
    expires_in: number;
  };

  // Parse ID token JWT for account info
  let email = "";
  let accountId = "";
  let planType = "free";
  try {
    const parts = data.id_token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );
      email = payload.email ?? "";
      accountId = payload.sub ?? "";
      // Extract ChatGPT plan type from custom claim
      const codexAuth = payload["https://api.openai.com/auth"];
      if (codexAuth?.chatgpt_plan_type) {
        planType = codexAuth.chatgpt_plan_type;
      }
    }
  } catch {
    // Non-fatal: fall through with empty values
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    email,
    accountId,
    planType,
    expiresAt,
  };
}

// ── Token refresh ──

/**
 * Refresh OAuth tokens using refresh_token.
 */
export async function refreshOAuthTokens(
  refreshToken: string,
): Promise<CodexTokenData> {
  const form = new URLSearchParams();
  form.set("client_id", CODEX_CLIENT_ID);
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", refreshToken);
  form.set("scope", "openid profile email");

  const response = await fetch(CODEX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    id_token: string;
    token_type: string;
    expires_in: number;
  };

  let email = "";
  let accountId = "";
  let planType = "free";
  try {
    const parts = data.id_token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf-8"),
      );
      email = payload.email ?? "";
      accountId = payload.sub ?? "";
      const codexAuth = payload["https://api.openai.com/auth"];
      if (codexAuth?.chatgpt_plan_type) {
        planType = codexAuth.chatgpt_plan_type;
      }
    }
  } catch {
    // non-fatal
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    email,
    accountId,
    planType,
    expiresAt,
  };
}
