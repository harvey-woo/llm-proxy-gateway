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

  it("should parse a minimal valid auth", () => {
    const result = AuthSchema.safeParse(validAuth);
    expect(result.success).toBe(true);
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

  it("should reject key shorter than 8 chars", () => {
    const result = AuthSchema.safeParse({ key: "short", name: "Test" });
    expect(result.success).toBe(false);
  });

  it("should reject key longer than 256 chars", () => {
    const result = AuthSchema.safeParse({
      key: "a".repeat(257),
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

  it("should accept key at max length (256)", () => {
    const result = AuthSchema.safeParse({
      key: "a".repeat(256),
      name: "Test",
    });
    expect(result.success).toBe(true);
  });

  it("should ignore unknown fields gracefully", () => {
    const result = AuthSchema.safeParse({
      key: "sk-tes...5678",
      name: "Test",
      role: "admin",
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

  it("should reject short key in update", () => {
    const result = UpdateAuthSchema.safeParse({ key: "short" });
    expect(result.success).toBe(false);
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
