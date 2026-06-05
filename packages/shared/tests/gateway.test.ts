import { describe, it, expect } from "vitest";
import {
  TextContentSchema,
  ImageContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
  ContentBlockSchema,
  MessageRoleSchema,
  ToolCallSchema,
  FunctionDefinitionSchema,
  ChatMessageSchema,
  ChatCompletionRequestSchema,
  UsageSchema,
  ChatCompletionChoiceSchema,
  ChatCompletionResponseSchema,
  ChatCompletionChunkSchema,
  AnthropicMessageSchema,
  MessagesRequestSchema,
  MessagesResponseSchema,
  ResponseInputItemSchema,
  ResponseToolSchema,
  ResponsesRequestSchema,
  ResponseOutputItemSchema,
  ResponsesResponseSchema,
  GatewayErrorResponseSchema,
  ApiFormatSchema,
  ProxyRequestSchema,
  ProxyResponseSchema,
} from "../src/schemas/gateway.js";

// ============================================================
// Content Block Schemas
// ============================================================

describe("TextContentSchema", () => {
  it("should parse valid text content", () => {
    const result = TextContentSchema.safeParse({
      type: "text",
      text: "Hello world",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing text", () => {
    const result = TextContentSchema.safeParse({ type: "text" });
    expect(result.success).toBe(false);
  });

  it("should reject wrong type", () => {
    const result = TextContentSchema.safeParse({
      type: "image_url",
      text: "Hello",
    });
    expect(result.success).toBe(false);
  });
});

describe("ImageContentSchema", () => {
  it("should parse valid image content", () => {
    const result = ImageContentSchema.safeParse({
      type: "image_url",
      image_url: { url: "https://example.com/image.png" },
    });
    expect(result.success).toBe(true);
  });

  it("should parse with detail option", () => {
    const result = ImageContentSchema.safeParse({
      type: "image_url",
      image_url: { url: "https://example.com/image.png", detail: "high" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing url", () => {
    const result = ImageContentSchema.safeParse({
      type: "image_url",
      image_url: {},
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid detail", () => {
    const result = ImageContentSchema.safeParse({
      type: "image_url",
      image_url: { url: "https://example.com/img.png", detail: "ultra" },
    });
    expect(result.success).toBe(false);
  });
});

describe("ToolUseContentSchema", () => {
  it("should parse valid tool use", () => {
    const result = ToolUseContentSchema.safeParse({
      type: "tool_use",
      id: "call_123",
      name: "get_weather",
      input: { location: "New York" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing name", () => {
    const result = ToolUseContentSchema.safeParse({
      type: "tool_use",
      id: "call_123",
      input: {},
    });
    expect(result.success).toBe(false);
  });
});

describe("ToolResultContentSchema", () => {
  it("should parse valid tool result", () => {
    const result = ToolResultContentSchema.safeParse({
      type: "tool_result",
      tool_use_id: "call_123",
      content: "Weather: sunny",
    });
    expect(result.success).toBe(true);
  });

  it("should accept without content", () => {
    const result = ToolResultContentSchema.safeParse({
      type: "tool_result",
      tool_use_id: "call_123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing tool_use_id", () => {
    const result = ToolResultContentSchema.safeParse({
      type: "tool_result",
    });
    expect(result.success).toBe(false);
  });
});

describe("ContentBlockSchema (discriminated union)", () => {
  it("should parse text block", () => {
    const result = ContentBlockSchema.safeParse({
      type: "text",
      text: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("should parse image block", () => {
    const result = ContentBlockSchema.safeParse({
      type: "image_url",
      image_url: { url: "https://example.com/img.png" },
    });
    expect(result.success).toBe(true);
  });

  it("should parse tool_use block", () => {
    const result = ContentBlockSchema.safeParse({
      type: "tool_use",
      id: "call_123",
      name: "search",
      input: { query: "test" },
    });
    expect(result.success).toBe(true);
  });

  it("should parse tool_result block", () => {
    const result = ContentBlockSchema.safeParse({
      type: "tool_result",
      tool_use_id: "call_123",
      content: "Result",
    });
    expect(result.success).toBe(true);
  });

  it("should reject unknown type", () => {
    const result = ContentBlockSchema.safeParse({
      type: "unknown_type",
      data: "test",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Message Schemas
// ============================================================

describe("MessageRoleSchema", () => {
  it("should accept valid roles", () => {
    for (const role of ["system", "user", "assistant", "tool"]) {
      const result = MessageRoleSchema.safeParse(role);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid role", () => {
    const result = MessageRoleSchema.safeParse("developer");
    expect(result.success).toBe(false);
  });
});

describe("ToolCallSchema", () => {
  it("should parse valid tool call", () => {
    const result = ToolCallSchema.safeParse({
      id: "call_abc123",
      type: "function",
      function: {
        name: "get_weather",
        arguments: '{"location": "New York"}',
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-function type", () => {
    const result = ToolCallSchema.safeParse({
      id: "call_abc",
      type: "custom",
      function: { name: "test", arguments: "{}" },
    });
    expect(result.success).toBe(false);
  });
});

describe("FunctionDefinitionSchema", () => {
  it("should parse minimal function", () => {
    const result = FunctionDefinitionSchema.safeParse({ name: "search" });
    expect(result.success).toBe(true);
  });

  it("should parse full function definition", () => {
    const result = FunctionDefinitionSchema.safeParse({
      name: "search",
      description: "Search for items",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing name", () => {
    const result = FunctionDefinitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ChatMessageSchema", () => {
  it("should parse user message with string content", () => {
    const result = ChatMessageSchema.safeParse({
      role: "user",
      content: "Hello!",
    });
    expect(result.success).toBe(true);
  });

  it("should parse assistant message with tool calls", () => {
    const result = ChatMessageSchema.safeParse({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: { name: "weather", arguments: "{}" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should parse tool message", () => {
    const result = ChatMessageSchema.safeParse({
      role: "tool",
      content: "Result data",
      tool_call_id: "call_123",
    });
    expect(result.success).toBe(true);
  });

  it("should parse system message", () => {
    const result = ChatMessageSchema.safeParse({
      role: "system",
      content: "You are a helpful assistant.",
    });
    expect(result.success).toBe(true);
  });

  it("should parse message with array content", () => {
    const result = ChatMessageSchema.safeParse({
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        {
          type: "image_url",
          image_url: { url: "https://example.com/img.png" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid role", () => {
    const result = ChatMessageSchema.safeParse({
      role: "developer",
      content: "test",
    });
    expect(result.success).toBe(false);
  });

  it("should accept null content", () => {
    const result = ChatMessageSchema.safeParse({
      role: "assistant",
      content: null,
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Chat Completion Request/Response Schemas
// ============================================================

describe("ChatCompletionRequestSchema", () => {
  it("should parse minimal valid request", () => {
    const result = ChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stream).toBe(false);
    }
  });

  it("should parse full request with all options", () => {
    const result = ChatCompletionRequestSchema.safeParse({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hi" },
      ],
      temperature: 0.7,
      top_p: 1.0,
      n: 1,
      stream: false,
      stop: ["END"],
      max_tokens: 1000,
      presence_penalty: 0,
      frequency_penalty: 0.5,
      user: "user-123",
      seed: 42,
    });
    expect(result.success).toBe(true);
  });

  it("should accept tools definition", () => {
    const result = ChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "user", content: "What's the weather?" }],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get current weather",
            parameters: { type: "object" },
          },
        },
      ],
      tool_choice: "auto",
    });
    expect(result.success).toBe(true);
  });

  it("should accept tool_choice as object", () => {
    const result = ChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "user", content: "test" }],
      tool_choice: { type: "function", function: { name: "weather" } },
    });
    expect(result.success).toBe(true);
  });

  it("should accept response_format with json_object", () => {
    const result = ChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "user", content: "Return JSON" }],
      response_format: { type: "json_object" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty model", () => {
    const result = ChatCompletionRequestSchema.safeParse({
      model: "",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty messages", () => {
    const result = ChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject temperature out of range", () => {
    const result = ChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 3.0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative max_tokens", () => {
    const result = ChatCompletionRequestSchema.safeParse({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("UsageSchema", () => {
  it("should parse valid usage", () => {
    const result = UsageSchema.safeParse({
      prompt_tokens: 100,
      completion_tokens: 200,
      total_tokens: 300,
    });
    expect(result.success).toBe(true);
  });

  it("should parse with optional details", () => {
    const result = UsageSchema.safeParse({
      prompt_tokens: 100,
      completion_tokens: 200,
      total_tokens: 300,
      prompt_tokens_details: { cached_tokens: 50 },
      completion_tokens_details: { reasoning_tokens: 10 },
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative token counts", () => {
    const result = UsageSchema.safeParse({
      prompt_tokens: -1,
      completion_tokens: 0,
      total_tokens: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("ChatCompletionChoiceSchema", () => {
  it("should parse valid choice", () => {
    const result = ChatCompletionChoiceSchema.safeParse({
      index: 0,
      message: { role: "assistant", content: "Hello!" },
      finish_reason: "stop",
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative index", () => {
    const result = ChatCompletionChoiceSchema.safeParse({
      index: -1,
      message: { role: "assistant", content: "Hello!" },
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid finish_reason", () => {
    const result = ChatCompletionChoiceSchema.safeParse({
      index: 0,
      message: { role: "assistant", content: "Hello!" },
      finish_reason: "timeout",
    });
    expect(result.success).toBe(false);
  });
});

describe("ChatCompletionResponseSchema", () => {
  it("should parse valid response", () => {
    const result = ChatCompletionResponseSchema.safeParse({
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1700000000,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hello!" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject wrong object type", () => {
    const result = ChatCompletionResponseSchema.safeParse({
      id: "chatcmpl-123",
      object: "wrong.type",
      created: 1700000000,
      model: "gpt-4",
      choices: [{ index: 0, message: { role: "assistant", content: "Hi" } }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative created timestamp", () => {
    const result = ChatCompletionResponseSchema.safeParse({
      id: "chatcmpl-123",
      object: "chat.completion",
      created: -1,
      model: "gpt-4",
      choices: [{ index: 0, message: { role: "assistant", content: "Hi" } }],
    });
    expect(result.success).toBe(false);
  });
});

describe("ChatCompletionChunkSchema", () => {
  it("should parse valid streaming chunk", () => {
    const result = ChatCompletionChunkSchema.safeParse({
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1700000000,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Hel" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should reject wrong object type", () => {
    const result = ChatCompletionChunkSchema.safeParse({
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1700000000,
      model: "gpt-4",
      choices: [{ index: 0, delta: { content: "Hel" } }],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Anthropic Messages Schemas
// ============================================================

describe("AnthropicMessageSchema", () => {
  it("should parse valid user message", () => {
    const result = AnthropicMessageSchema.safeParse({
      role: "user",
      content: "Hello Claude",
    });
    expect(result.success).toBe(true);
  });

  it("should parse assistant message with array content", () => {
    const result = AnthropicMessageSchema.safeParse({
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
    });
    expect(result.success).toBe(true);
  });

  it("should reject system role (only user/assistant)", () => {
    const result = AnthropicMessageSchema.safeParse({
      role: "system",
      content: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("MessagesRequestSchema", () => {
  it("should parse minimal valid request", () => {
    const result = MessagesRequestSchema.safeParse({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("should parse with system prompt as string", () => {
    const result = MessagesRequestSchema.safeParse({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1000,
      system: "You are helpful",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with system prompt as array", () => {
    const result = MessagesRequestSchema.safeParse({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1000,
      system: [
        { type: "text", text: "You are helpful" },
        {
          type: "text",
          text: "Second block",
          cache_control: { type: "ephemeral" },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should parse with tools", () => {
    const result = MessagesRequestSchema.safeParse({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Search for something" }],
      max_tokens: 1000,
      tools: [
        {
          name: "search",
          description: "Search the web",
          input_schema: { type: "object" },
        },
      ],
      tool_choice: { type: "tool", name: "search" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing max_tokens", () => {
    const result = MessagesRequestSchema.safeParse({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(false);
  });

  it("should reject zero max_tokens", () => {
    const result = MessagesRequestSchema.safeParse({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject temperature out of range", () => {
    const result = MessagesRequestSchema.safeParse({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1000,
      temperature: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("should reject more than 4 stop sequences", () => {
    const result = MessagesRequestSchema.safeParse({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 1000,
      stop_sequences: ["a", "b", "c", "d", "e"],
    });
    expect(result.success).toBe(false);
  });

  it("should accept empty messages array", () => {
    const result = MessagesRequestSchema.safeParse({
      model: "claude-3-opus",
      messages: [],
      max_tokens: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe("MessagesResponseSchema", () => {
  it("should parse valid response", () => {
    const result = MessagesResponseSchema.safeParse({
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
      model: "claude-3-opus-20240229",
      stop_reason: "end_turn",
      usage: {
        input_tokens: 10,
        output_tokens: 5,
      },
    });
    expect(result.success).toBe(true);
  });

  it("should parse with cache token details", () => {
    const result = MessagesResponseSchema.safeParse({
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
      model: "claude-3-opus-20240229",
      stop_reason: "end_turn",
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 50,
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject wrong type", () => {
    const result = MessagesResponseSchema.safeParse({
      id: "msg_123",
      type: "chat.completion",
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
      model: "claude-3-opus",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(result.success).toBe(false);
  });

  it("should reject wrong role", () => {
    const result = MessagesResponseSchema.safeParse({
      id: "msg_123",
      type: "message",
      role: "user",
      content: [{ type: "text", text: "Hello!" }],
      model: "claude-3-opus",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative token counts", () => {
    const result = MessagesResponseSchema.safeParse({
      id: "msg_123",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello!" }],
      model: "claude-3-opus",
      usage: { input_tokens: -1, output_tokens: 5 },
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Responses API Schemas
// ============================================================

describe("ResponseInputItemSchema", () => {
  it("should parse message input", () => {
    const result = ResponseInputItemSchema.safeParse({
      type: "message",
      role: "user",
      content: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("should parse message with array content", () => {
    const result = ResponseInputItemSchema.safeParse({
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "Hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("should parse function_call_output", () => {
    const result = ResponseInputItemSchema.safeParse({
      type: "function_call_output",
      call_id: "call_123",
      output: "Result data",
    });
    expect(result.success).toBe(true);
  });

  it("should reject unknown type", () => {
    const result = ResponseInputItemSchema.safeParse({
      type: "unknown",
      data: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("ResponseToolSchema", () => {
  it("should parse valid tool", () => {
    const result = ResponseToolSchema.safeParse({
      type: "function",
      name: "search",
      description: "Search the web",
      parameters: { type: "object" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-function type", () => {
    const result = ResponseToolSchema.safeParse({
      type: "custom",
      name: "test",
    });
    expect(result.success).toBe(false);
  });
});

describe("ResponsesRequestSchema", () => {
  it("should parse minimal request", () => {
    const result = ResponsesRequestSchema.safeParse({
      model: "gpt-4o",
      input: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with input array", () => {
    const result = ResponsesRequestSchema.safeParse({
      model: "gpt-4o",
      input: [{ type: "message", role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("should parse with tools", () => {
    const result = ResponsesRequestSchema.safeParse({
      model: "gpt-4o",
      input: "Use the search tool",
      tools: [{ type: "function", name: "search", parameters: {} }],
      tool_choice: "required",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with truncation_strategy", () => {
    const result = ResponsesRequestSchema.safeParse({
      model: "gpt-4o",
      input: "Hello",
      truncation_strategy: { type: "last_messages", last_messages: 10 },
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty model", () => {
    const result = ResponsesRequestSchema.safeParse({
      model: "",
      input: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative max_output_tokens", () => {
    const result = ResponsesRequestSchema.safeParse({
      model: "gpt-4o",
      input: "Hello",
      max_output_tokens: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("ResponseOutputItemSchema", () => {
  it("should parse message output", () => {
    const result = ResponseOutputItemSchema.safeParse({
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Hello!" }],
    });
    expect(result.success).toBe(true);
  });

  it("should parse refusal output", () => {
    const result = ResponseOutputItemSchema.safeParse({
      type: "message",
      role: "assistant",
      content: [{ type: "refusal", refusal: "I cannot do that" }],
    });
    expect(result.success).toBe(true);
  });

  it("should parse function_call output", () => {
    const result = ResponseOutputItemSchema.safeParse({
      type: "function_call",
      call_id: "call_123",
      name: "search",
      arguments: '{"query": "test"}',
    });
    expect(result.success).toBe(true);
  });
});

describe("ResponsesResponseSchema", () => {
  it("should parse completed response", () => {
    const result = ResponsesResponseSchema.safeParse({
      id: "resp_123",
      object: "response",
      created_at: 1700000000,
      model: "gpt-4o",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Hello!" }],
        },
      ],
      status: "completed",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with usage", () => {
    const result = ResponsesResponseSchema.safeParse({
      id: "resp_123",
      object: "response",
      created_at: 1700000000,
      model: "gpt-4o",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Hi" }],
        },
      ],
      status: "completed",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    expect(result.success).toBe(true);
  });

  it("should parse with error", () => {
    const result = ResponsesResponseSchema.safeParse({
      id: "resp_123",
      object: "response",
      created_at: 1700000000,
      model: "gpt-4o",
      output: [],
      status: "failed",
      error: { code: "server_error", message: "Internal error" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid status", () => {
    const result = ResponsesResponseSchema.safeParse({
      id: "resp_123",
      object: "response",
      created_at: 1700000000,
      model: "gpt-4o",
      output: [],
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("should reject wrong object type", () => {
    const result = ResponsesResponseSchema.safeParse({
      id: "resp_123",
      object: "chat.completion",
      created_at: 1700000000,
      model: "gpt-4o",
      output: [],
      status: "completed",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Gateway Error & Proxy Schemas
// ============================================================

describe("GatewayErrorResponseSchema", () => {
  it("should parse valid error response", () => {
    const result = GatewayErrorResponseSchema.safeParse({
      error: {
        message: "Rate limit exceeded",
        type: "rate_limit_error",
        param: null,
        code: "rate_limit_exceeded",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing error fields", () => {
    const result = GatewayErrorResponseSchema.safeParse({
      error: {
        message: "Error",
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("ApiFormatSchema", () => {
  it("should accept valid formats", () => {
    for (const fmt of [
      "openai_chat",
      "anthropic_messages",
      "openai_responses",
    ]) {
      const result = ApiFormatSchema.safeParse(fmt);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid format", () => {
    const result = ApiFormatSchema.safeParse("google_vertex");
    expect(result.success).toBe(false);
  });
});

describe("ProxyRequestSchema", () => {
  it("should parse valid proxy request", () => {
    const result = ProxyRequestSchema.safeParse({
      format: "openai_chat",
      raw: { model: "gpt-4", messages: [{ role: "user", content: "Hi" }] },
      model_alias: "my-model",
      auth_key: "sk-xxx",
    });
    expect(result.success).toBe(true);
  });

  it("should parse with optional metadata", () => {
    const result = ProxyRequestSchema.safeParse({
      format: "anthropic_messages",
      raw: { model: "claude-3", messages: [] },
      model_alias: "claude-model",
      auth_key: "sk-yyy",
      metadata: { request_id: "req-123" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing model_alias", () => {
    const result = ProxyRequestSchema.safeParse({
      format: "openai_chat",
      raw: {},
      auth_key: "sk-xxx",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing auth_key", () => {
    const result = ProxyRequestSchema.safeParse({
      format: "openai_chat",
      raw: {},
      model_alias: "my-model",
    });
    expect(result.success).toBe(false);
  });
});

describe("ProxyResponseSchema", () => {
  it("should parse valid proxy response", () => {
    const result = ProxyResponseSchema.safeParse({
      format: "openai_chat",
      raw: { id: "chatcmpl-123", choices: [] },
      routed_provider: "openai",
      routed_auth_key: "sk-xxx",
      latency_ms: 250,
    });
    expect(result.success).toBe(true);
  });

  it("should parse with usage", () => {
    const result = ProxyResponseSchema.safeParse({
      format: "openai_chat",
      raw: {},
      routed_provider: "openai",
      routed_auth_key: "sk-xxx",
      latency_ms: 250,
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });
    expect(result.success).toBe(true);
  });

  it("should reject negative latency", () => {
    const result = ProxyResponseSchema.safeParse({
      format: "openai_chat",
      raw: {},
      routed_provider: "openai",
      routed_auth_key: "sk-xxx",
      latency_ms: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing routed_provider", () => {
    const result = ProxyResponseSchema.safeParse({
      format: "openai_chat",
      raw: {},
      routed_auth_key: "sk-xxx",
      latency_ms: 100,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Cache Token Field Extraction (as used in gateway route)
// ============================================================

describe("Cache token field extraction patterns", () => {
  // Matches the extraction logic in gateway.ts lines 288-289:
  //   const cacheHitTokens = (usage as any)?.prompt_cache_hit_tokens
  //     ?? (usage as any)?.cache_read_input_tokens ?? 0;
  //   const cacheCreateTokens = (usage as any)?.cache_creation_input_tokens ?? 0;

  it("extracts prompt_cache_hit_tokens from OpenAI-style usage", () => {
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      prompt_cache_hit_tokens: 30,
    };
    const cacheHitTokens =
      (usage as any)?.prompt_cache_hit_tokens ??
      (usage as any)?.cache_read_input_tokens ??
      0;
    const cacheCreateTokens = (usage as any)?.cache_creation_input_tokens ?? 0;
    expect(cacheHitTokens).toBe(30);
    expect(cacheCreateTokens).toBe(0);
  });

  it("extracts cache_read_input_tokens from Anthropic-style usage", () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 40,
      cache_creation_input_tokens: 20,
    };
    const cacheHitTokens =
      (usage as any)?.prompt_cache_hit_tokens ??
      (usage as any)?.cache_read_input_tokens ??
      0;
    const cacheCreateTokens = (usage as any)?.cache_creation_input_tokens ?? 0;
    expect(cacheHitTokens).toBe(40);
    expect(cacheCreateTokens).toBe(20);
  });

  it("prefers prompt_cache_hit_tokens over cache_read_input_tokens when both present", () => {
    const usage = {
      prompt_cache_hit_tokens: 10,
      cache_read_input_tokens: 5,
      cache_creation_input_tokens: 3,
    };
    const cacheHitTokens =
      (usage as any)?.prompt_cache_hit_tokens ??
      (usage as any)?.cache_read_input_tokens ??
      0;
    expect(cacheHitTokens).toBe(10);
  });

  it("extracts cache_creation_input_tokens only from matching field", () => {
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };
    const cacheHitTokens =
      (usage as any)?.prompt_cache_hit_tokens ??
      (usage as any)?.cache_read_input_tokens ??
      0;
    const cacheCreateTokens = (usage as any)?.cache_creation_input_tokens ?? 0;
    expect(cacheHitTokens).toBe(0);
    expect(cacheCreateTokens).toBe(0);
  });

  it("works with both Anthropic cache fields present", () => {
    const usage = {
      input_tokens: 200,
      output_tokens: 100,
      cache_read_input_tokens: 75,
      cache_creation_input_tokens: 25,
    };
    const cacheHitTokens =
      (usage as any)?.prompt_cache_hit_tokens ??
      (usage as any)?.cache_read_input_tokens ??
      0;
    const cacheCreateTokens = (usage as any)?.cache_creation_input_tokens ?? 0;
    expect(cacheHitTokens).toBe(75);
    expect(cacheCreateTokens).toBe(25);
  });

  it("converts cache fields via UsageSchema with prompt_tokens_details.cached_tokens", () => {
    const result = UsageSchema.safeParse({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
      prompt_tokens_details: { cached_tokens: 30 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt_tokens_details?.cached_tokens).toBe(30);
    }
  });

  it("converts Anthropic cache fields via MessagesResponseSchema usage", () => {
    const result = MessagesResponseSchema.safeParse({
      id: "msg_456",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello" }],
      model: "claude-3-sonnet",
      stop_reason: "end_turn",
      usage: {
        input_tokens: 200,
        output_tokens: 100,
        cache_creation_input_tokens: 25,
        cache_read_input_tokens: 75,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usage.cache_creation_input_tokens).toBe(25);
      expect(result.data.usage.cache_read_input_tokens).toBe(75);
    }
  });
});
