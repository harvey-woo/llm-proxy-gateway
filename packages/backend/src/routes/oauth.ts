import { Hono, type Context } from "hono";
import type { StoreState } from "./admin.js";
import { getDb } from "../db/database.js";
import { randomUUID } from "node:crypto";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildCodexAuthURL,
  exchangeCodeForTokens,
  oauthSessionStore,
  CODEX_REDIRECT_URI,
  startCodexCallbackServer,
  stopCodexCallbackServer,
  isCodexCallbackServerRunning,
} from "../oauth.js";

export function createOAuthRoutes(
  storeRef: { current: StoreState },
  onAuthChange?: () => void,
): Hono {
  const router = new Hono();

  // ============================================================
  // GET /api/oauth/codex/authorize
  // 生成 PKCE + state，返回 auth.openai.com 授权 URL
  // ============================================================
  router.get("/api/oauth/codex/authorize", async (c) => {
    const providerId = c.req.query("provider_id");
    if (!providerId) {
      return c.json(
        {
          success: false,
          error: "provider_id is required",
          code: "MISSING_PROVIDER",
        },
        400,
      );
    }

    // Verify provider exists
    const provider = storeRef.current.providers.get(providerId);
    if (!provider) {
      return c.json(
        { success: false, error: "Provider not found", code: "NOT_FOUND" },
        404,
      );
    }

    // 使用 CPA 注册的固定回调地址
    const redirectUri = CODEX_REDIRECT_URI;

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Store session
    oauthSessionStore.set({
      state,
      codeVerifier,
      codeChallenge,
      providerId,
      redirectUri,
      status: "pending",
      createdAt: Date.now(),
    });

    // Build authorization URL（无需传 redirectUri，已硬编码）
    const authUrl = buildCodexAuthURL({
      state,
      codeChallenge,
    });

    // 启动临时回调服务器（port 1455）
    if (!(await startCodexCallbackServer())) {
      return c.json({
        success: false,
        error: "端口 1455 已被占用，无法启动 Codex OAuth 回调服务。请释放该端口后重试。",
        code: "PORT_1455_BUSY",
      });
    }

    return c.json({
      success: true,
      data: {
        url: authUrl,
        state,
      },
    });
  });

  // ============================================================
  // GET /auth/callback 和 /api/oauth/codex/callback
  // OpenAI 回调处理：交换授权码获取 token，存入数据库
  // 注意：redirect_uri 固定为 http://localhost:1455/auth/callback（CPA OAuth app 注册地址）
  // 因此需要在 /auth/callback 和 /api/oauth/codex/callback 两个路径都注册处理函数
  // ============================================================
  async function handleCodexCallback(c: Context) {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");

    if (error) {
      oauthSessionStore.updateStatus(state ?? "", "error", error);
      stopCodexCallbackServer();
      return c.html(successPage("授权失败", `OpenAI 返回错误: ${error}`));
    }

    if (!code || !state) {
      stopCodexCallbackServer();
      return c.html(errorPage("缺少参数", "回调缺少 code 或 state 参数。"));
    }

    // Look up session
    const session = oauthSessionStore.get(state);
    if (!session) {
      stopCodexCallbackServer();
      return c.html(
        errorPage(
          "会话过期",
          "OAuth 会话已过期或 state 无效。请重新发起授权。",
        ),
      );
    }

    try {
      // Exchange code for tokens
      const tokenData = await exchangeCodeForTokens(
        code,
        session.codeVerifier,
        session.redirectUri,
      );

      // Build OAuth metadata
      const oauthMetadata = JSON.stringify({
        access_token: tokenData.accessToken,
        refresh_token: tokenData.refreshToken,
        id_token: tokenData.idToken,
        account_id: tokenData.accountId,
        email: tokenData.email,
        plan_type: tokenData.planType,
        type: "codex",
        last_refresh: new Date().toISOString(),
        expired: tokenData.expiresAt,
      });

      // Store in database
      const db = await getDb();
      const authKey = tokenData.accessToken;

      // Check if this auth already exists for this provider
      const existing = await db
        .selectFrom("provider_auths")
        .selectAll()
        .where("provider_id", "=", session.providerId)
        .where("key", "=", authKey)
        .executeTakeFirst();

      if (!existing) {
        await db
          .insertInto("provider_auths")
          .values({
            id: randomUUID(),
            provider_id: session.providerId,
            key: authKey,
            name:
              `Codex ${tokenData.email || tokenData.planType || ""}`.trim() ||
              "Codex OAuth",
            auth_type: "oauth",
            metadata: oauthMetadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute();

        // Update in-memory store
        const provider = storeRef.current.providers.get(session.providerId);
        if (provider) {
          if (!provider.auths) provider.auths = [];
          provider.auths.push({
            key: authKey,
            name: `Codex ${tokenData.email || ""}`.trim() || "Codex OAuth",
            auth_type: "oauth",
            oauth_metadata: oauthMetadata,
          } as any);
        }
      }

      // Mark session as completed
      oauthSessionStore.updateStatus(state, "completed");

      // Notify pool to refresh
      onAuthChange?.();

      // OAuth 完成，关闭临时回调服务器
      stopCodexCallbackServer();

      // Show success page
      return c.html(
        successPage(
          "✅ Codex 授权成功",
          `账号: ${tokenData.email || "未知"}<br>套餐: ${tokenData.planType}<br>有效期至: ${new Date(tokenData.expiresAt).toLocaleString()}<br><br>你可以关闭此标签页了。`,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      oauthSessionStore.updateStatus(state, "error", msg);
      stopCodexCallbackServer();
      return c.html(errorPage("Token 交换失败", msg));
    }
  }

  // 注册回调处理到两个路径：
  // - /auth/callback: 这是 redirect_uri 中的实际路径（固定为 CPA OAuth app 注册地址）
  // - /api/oauth/codex/callback: API 调试路径
  router.get("/auth/callback", handleCodexCallback);
  router.get("/api/oauth/codex/callback", handleCodexCallback);

  // ============================================================
  // GET /api/oauth/codex/status?state=xxx
  // 轮询 OAuth 会话状态
  // ============================================================
  router.get("/api/oauth/codex/status", (c) => {
    const state = c.req.query("state");
    if (!state) {
      return c.json(
        { success: false, error: "state is required", code: "MISSING_STATE" },
        400,
      );
    }

    const session = oauthSessionStore.get(state);
    if (!session) {
      return c.json({
        success: false,
        data: { status: "expired" },
      });
    }

    return c.json({
      success: true,
      data: {
        status: session.status,
        error: session.error,
      },
    });
  });
  // ============================================================
  // POST /api/oauth/codex/cancel
  // 取消当前的 OAuth 授权流程，关闭 1455 回调服务器
  // ============================================================
  router.post("/api/oauth/codex/cancel", (c) => {
    stopCodexCallbackServer();
    return c.json({ success: true });
  });
  return router;
}

// ── HTML pages for callback ──

function pageStyle(): string {
  return `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex; align-items: center; justify-content: center;
        min-height: 100vh; margin: 0; background: #f5f5f5;
      }
      .card {
        background: white; border-radius: 12px; padding: 40px;
        max-width: 480px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.1);
        text-align: center;
      }
      .card.success { border-top: 4px solid #22c55e; }
      .card.error { border-top: 4px solid #ef4444; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      p { font-size: 14px; color: #666; line-height: 1.6; margin: 0; }
      .badge {
        display: inline-block; font-size: 12px; padding: 2px 8px;
        border-radius: 4px; margin-top: 8px;
      }
      .badge.success { background: #dcfce7; color: #166534; }
      .badge.error { background: #fef2f2; color: #991b1b; }
      .countdown { font-size: 12px; color: #999; margin-top: 16px; }
    </style>
    <script>
      let count = 10;
      function closeTab() { window.close(); }
      function tick() {
        count--;
        const el = document.getElementById('countdown');
        if (el) el.textContent = count + '秒后自动关闭';
        if (count <= 0) closeTab();
        else setTimeout(tick, 1000);
      }
      setTimeout(tick, 1000);
    <\/script>
  `;
}

function successPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>${pageStyle()}</head>
<body><div class="card success">
  <h1>${title}</h1>
  <p>${message}</p>
  <p class="countdown"><span id="countdown">10秒后自动关闭</span></p>
</div></body></html>`;
}

function errorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>${pageStyle()}</head>
<body><div class="card error">
  <h1>${title}</h1>
  <p>${message}</p>
  <p class="countdown"><span id="countdown">10秒后自动关闭</span></p>
</div></body></html>`;
}
