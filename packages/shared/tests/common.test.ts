import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  ErrorResponseSchema,
  SuccessResponseSchema,
  PaginatedResponseSchema,
  ApiResponseSchema,
  IdParamSchema,
  PaginationQuerySchema,
  EmptySuccessSchema,
} from "../src/schemas/common.js";

describe("ErrorResponseSchema", () => {
  it("should parse a valid error response", () => {
    const result = ErrorResponseSchema.safeParse({
      success: false,
      error: "Something went wrong",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe("Something went wrong");
    }
  });

  it("should accept optional details and code", () => {
    const result = ErrorResponseSchema.safeParse({
      success: false,
      error: "Validation failed",
      details: ["field1 is required", "field2 is invalid"],
      code: "VALIDATION_ERROR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.details).toEqual([
        "field1 is required",
        "field2 is invalid",
      ]);
      expect(result.data.code).toBe("VALIDATION_ERROR");
    }
  });

  it("should reject missing error field", () => {
    const result = ErrorResponseSchema.safeParse({ success: false });
    expect(result.success).toBe(false);
  });

  it("should reject success: true", () => {
    const result = ErrorResponseSchema.safeParse({
      success: true,
      error: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("SuccessResponseSchema", () => {
  it("should wrap a valid data object", () => {
    const schema = SuccessResponseSchema(
      ErrorResponseSchema.extend({ extra: z.string() }),
    );
    // Using a simpler inner schema for testing
    const simple = SuccessResponseSchema(z.string());
    const result = simple.safeParse({ success: true, data: "hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(true);
      expect(result.data.data).toBe("hello");
    }
  });

  it("should reject success: false", () => {
    const simple = SuccessResponseSchema(z.string());
    const result = simple.safeParse({ success: false, data: "hello" });
    expect(result.success).toBe(false);
  });
});

describe("PaginatedResponseSchema", () => {
  it("should parse a valid paginated response", () => {
    const schema = PaginatedResponseSchema(z.string());
    const result = schema.safeParse({
      success: true,
      data: ["a", "b", "c"],
      total: 100,
      page: 1,
      page_size: 20,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual(["a", "b", "c"]);
      expect(result.data.total).toBe(100);
      expect(result.data.page).toBe(1);
      expect(result.data.page_size).toBe(20);
    }
  });

  it("should reject page less than 1", () => {
    const schema = PaginatedResponseSchema(z.string());
    const result = schema.safeParse({
      success: true,
      data: [],
      total: 0,
      page: 0,
      page_size: 20,
    });
    expect(result.success).toBe(false);
  });

  it("should reject page_size less than 1", () => {
    const schema = PaginatedResponseSchema(z.string());
    const result = schema.safeParse({
      success: true,
      data: [],
      total: 0,
      page: 1,
      page_size: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject non-integer page", () => {
    const schema = PaginatedResponseSchema(z.string());
    const result = schema.safeParse({
      success: true,
      data: [],
      total: 0,
      page: 1.5,
      page_size: 20,
    });
    expect(result.success).toBe(false);
  });
});

describe("ApiResponseSchema", () => {
  it("should accept a success response", () => {
    const schema = ApiResponseSchema(z.string());
    const result = schema.safeParse({ success: true, data: "hello" });
    expect(result.success).toBe(true);
  });

  it("should accept an error response", () => {
    const schema = ApiResponseSchema(z.string());
    const result = schema.safeParse({
      success: false,
      error: "not found",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid data", () => {
    const schema = ApiResponseSchema(z.string());
    const result = schema.safeParse({ success: true, data: 123 });
    expect(result.success).toBe(false);
  });
});

describe("IdParamSchema", () => {
  it("should parse a valid id", () => {
    const result = IdParamSchema.safeParse({ id: "abc123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("abc123");
    }
  });

  it("should reject empty id", () => {
    const result = IdParamSchema.safeParse({ id: "" });
    expect(result.success).toBe(false);
  });

  it("should reject missing id", () => {
    const result = IdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("PaginationQuerySchema", () => {
  it("should parse valid pagination params", () => {
    const result = PaginationQuerySchema.safeParse({ page: 2, page_size: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.page_size).toBe(50);
    }
  });

  it("should apply defaults when params are missing", () => {
    const result = PaginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.page_size).toBe(20);
    }
  });

  it("should coerce string numbers", () => {
    const result = PaginationQuerySchema.safeParse({
      page: "3",
      page_size: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.page_size).toBe(10);
    }
  });

  it("should reject page_size > 100", () => {
    const result = PaginationQuerySchema.safeParse({ page_size: 200 });
    expect(result.success).toBe(false);
  });

  it("should reject page < 1", () => {
    const result = PaginationQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });
});

describe("EmptySuccessSchema", () => {
  it("should parse { success: true }", () => {
    const result = EmptySuccessSchema.safeParse({ success: true });
    expect(result.success).toBe(true);
  });

  it("should reject { success: false }", () => {
    const result = EmptySuccessSchema.safeParse({ success: false });
    expect(result.success).toBe(false);
  });

  it("should reject missing success field", () => {
    const result = EmptySuccessSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
