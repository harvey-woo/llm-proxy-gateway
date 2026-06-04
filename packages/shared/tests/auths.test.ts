import { describe, it, expect } from "vitest";
import {
  AuthSchema,
  CreateAuthSchema,
  UpdateAuthSchema,
  AuthWithMetaSchema,
  AuthKeyValidationSchema,
} from "../src/schemas/auths.js";

describe("AuthSchema", () => {
  const validAuth = {
    key: "sk-tes...5678",
    name: "Test Key",
  };

  it("should parse a minimal valid api_key auth (backward compat)", () => {
    const result = AuthSchema.safeParse(validAuth);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auth_type).toBe("api_key"); // default
    }
  });

  it("should parse auth without name (optional)", () => {
    const result = AuthSchema.safeParse({
      key: "sk-tes...5678",
    });
    expect(result.success).toBe(true);
  });

  it("should parse auth with empty name", () => {
    const result = AuthSchema.safeParse({
      key: "sk-tes...5678",
      name: "",
    });
    expect(result.success).toBe(true);
  });

  it("should accept short keys (access tokens can be short)", () => {
    const result = AuthSchema.safeParse({ key: "short", name: "Test" });
    expect(result.success).toBe(true);
  });

  it("should accept long keys up to 512 chars", () => {
    const result = AuthSchema.safeParse({
      key: "a".repeat(512),
      name: "Test",
    });
    expect(result.success).toBe(true);
  });

  it("should reject key longer than 512 chars", () => {
    const result = AuthSchema.safeParse({
      key: "a".repeat(513),
      name: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("should reject name longer than 128 chars", () => {
    const result = AuthSchema.safeParse({
      key: "sk-tes...5678",
      name: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing key", () => {
    const result = AuthSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("should ignore unknown fields gracefully", () => {
    const result = AuthSchema.safeParse({
      key: "sk-tes...5678",
      name: "Test",
      role: "admin",
    });
    expect(result.success).toBe(true);
  });

  // ── OAuth auth type tests ──

  it("should parse OAuth auth with valid fields", () => {
    const result = AuthSchema.safeParse({
      key: "access-token-here",
      name: "Codex Key",
      auth_type: "oauth",
      oauth_provider: "codex",
      oauth_metadata: JSON.stringify({
        access_token: "access-token-here",
        refresh_token: "refresh-token-here",
        id_token: "eyJ...xxx",
        account_id: "acc_123",
        email: "user@example.com",
        plan_type: "plus",
        expires_at: "2026-09-02T08:49:20.840Z",
      }),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auth_type).toBe("oauth");
      expect(result.data.oauth_provider).toBe("codex");
    }
  });

  it("should default auth_type to api_key when omitted", () => {
    const result = AuthSchema.safeParse({ key: "sk-test...1234" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.auth_type).toBe("api_key");
    }
  });

  it("should allow explicit api_key auth_type", () => {
    const result = AuthSchema.safeParse({
      key: "sk-test...1234",
      auth_type: "api_key",
    });
    expect(result.success).toBe(true);
  });
});

describe("CreateAuthSchema", () => {
  it("should parse a valid create auth input", () => {
    const result = CreateAuthSchema.safeParse({
      key: "sk-new...5678",
      name: "New Key",
    });
    expect(result.success).toBe(true);
  });

  it("should parse create without name", () => {
    const result = CreateAuthSchema.safeParse({
      key: "sk-new...5678",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing key", () => {
    const result = CreateAuthSchema.safeParse({ name: "New Key" });
    expect(result.success).toBe(false);
  });

  it("should parse create with OAuth fields", () => {
    const result = CreateAuthSchema.safeParse({
      key: "oauth-access-token",
      auth_type: "oauth",
      oauth_provider: "codex",
      oauth_metadata: JSON.stringify({ access_token: "oauth-access-token" }),
    });
    expect(result.success).toBe(true);
  });
});

describe("UpdateAuthSchema", () => {
  it("should accept name update", () => {
    const result = UpdateAuthSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("should accept key update", () => {
    const result = UpdateAuthSchema.safeParse({ key: "sk-updated...9999" });
    expect(result.success).toBe(true);
  });

  it("should accept empty object", () => {
    const result = UpdateAuthSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept oauth_type update", () => {
    const result = UpdateAuthSchema.safeParse({
      auth_type: "oauth",
      oauth_provider: "codex",
      oauth_metadata: JSON.stringify({ access_token: "new-token" }),
    });
    expect(result.success).toBe(true);
  });
});

describe("AuthWithMetaSchema", () => {
  it("should parse auth with metadata", () => {
    const result = AuthWithMetaSchema.safeParse({
      key: "sk-tes...5678",
      name: "Test Key",
      id: "550e8400-e29b-41d4-a716-446655440000",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
      total_requests: 0,
    });
    expect(result.success).toBe(true);
  });

  it("should accept null last_used_at", () => {
    const result = AuthWithMetaSchema.safeParse({
      key: "sk-tes...5678",
      name: "Test",
      id: "550e8400-e29b-41d4-a716-446655440000",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
      last_used_at: null,
      total_requests: 0,
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid uuid", () => {
    const result = AuthWithMetaSchema.safeParse({
      key: "sk-tes...5678",
      name: "Test",
      id: "not-a-uuid",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
      total_requests: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative request counts", () => {
    const result = AuthWithMetaSchema.safeParse({
      key: "sk-tes...5678",
      name: "Test",
      id: "550e8400-e29b-41d4-a716-446655440000",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
      total_requests: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should parse is_rate_limited flag", () => {
    const result = AuthWithMetaSchema.safeParse({
      key: "sk-tes...5678",
      name: "Test",
      id: "550e8400-e29b-41d4-a716-446655440000",
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-02T00:00:00.000Z",
      total_requests: 50,
      is_rate_limited: true,
      limited_by: "requests/5h",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_rate_limited).toBe(true);
      expect(result.data.limited_by).toBe("requests/5h");
    }
  });
});

describe("AuthKeyValidationSchema", () => {
  it("should parse a valid validation response", () => {
    const result = AuthKeyValidationSchema.safeParse({
      valid: true,
      key_name: "Test Key",
      rate_limited: false,
    });
    expect(result.success).toBe(true);
  });

  it("should parse minimal validation response", () => {
    const result = AuthKeyValidationSchema.safeParse({ valid: false });
    expect(result.success).toBe(true);
  });

  it("should reject non-boolean valid", () => {
    const result = AuthKeyValidationSchema.safeParse({ valid: "yes" });
    expect(result.success).toBe(false);
  });

  it("should parse rate_limited flag", () => {
    const result = AuthKeyValidationSchema.safeParse({
      valid: true,
      rate_limited: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rate_limited).toBe(true);
    }
  });
});
