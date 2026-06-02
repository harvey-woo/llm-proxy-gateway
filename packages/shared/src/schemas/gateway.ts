import { z } from "zod";

/**
 * Gateway Proxy Schemas
 *
 * Defines the OpenAI-compatible request/response formats for the proxy gateway.
 * Supports three endpoint formats:
 *   - /v1/chat/completions (OpenAI Chat Completions)
 *   - /v1/messages (Anthropic Messages)
 *   - /v1/responses (OpenAI Responses API)
 */

// ============================================================
// Content Types
// ============================================================

/**
 * Text content block
 */
export const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export type TextContent = z.infer<typeof TextContentSchema>;

/**
 * Image content block (base64 or URL)
 */
export const ImageContentSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string(),
    detail: z.enum(["auto", "low", "high"]).optional(),
  }),
});

export type ImageContent = z.infer<typeof ImageContentSchema>;

/**
 * Tool use content block
 */
export const ToolUseContentSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

export type ToolUseContent = z.infer<typeof ToolUseContentSchema>;

/**
 * Tool result content block
 */
export const ToolResultContentSchema = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
  content: z.string().optional(),
});

export type ToolResultContent = z.infer<typeof ToolResultContentSchema>;

/**
 * Union of all content block types
 */
export const ContentBlockSchema = z.discriminatedUnion("type", [
  TextContentSchema,
  ImageContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
]);

export type ContentBlock = z.infer<typeof ContentBlockSchema>;

// ============================================================
// Message Types
// ============================================================

/**
 * Chat message role
 */
export const MessageRoleSchema = z.enum(["system", "user", "assistant", "tool"]);

export type MessageRole = z.infer<typeof MessageRoleSchema>;

/**
 * Tool call definition (for assistant messages)
 */
export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

/**
 * Function definition for tool use
 */
export const FunctionDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export type FunctionDefinition = z.infer<typeof FunctionDefinitionSchema>;

/**
 * Chat message in OpenAI format
 */
export const ChatMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.union([z.string(), z.array(ContentBlockSchema)]).nullable(),
  name: z.string().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
  tool_call_id: z.string().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ============================================================
// Proxy Request Schemas
// ============================================================

/**
 * Proxy request format for /v1/chat/completions endpoint
 */
export const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1, "Model is required"),
  messages: z.array(ChatMessageSchema).min(1, "At least one message is required"),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().min(1).max(128).optional(),
  stream: z.boolean().default(false),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  max_tokens: z.number().int().positive().optional(),
  max_completion_tokens: z.number().int().positive().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  logit_bias: z.record(z.string(), z.number()).optional(),
  user: z.string().optional(),
  tools: z.array(
    z.object({
      type: z.literal("function"),
      function: FunctionDefinitionSchema,
    }),
  ).optional(),
  tool_choice: z.union([
    z.literal("auto"),
    z.literal("none"),
    z.literal("required"),
    z.object({
      type: z.literal("function"),
      function: z.object({ name: z.string() }),
    }),
  ]).optional(),
  response_format: z.object({
    type: z.enum(["text", "json_object", "json_schema"]),
    json_schema: z.object({
      name: z.string(),
      description: z.string().optional(),
      schema: z.record(z.string(), z.unknown()),
      strict: z.boolean().optional(),
    }).optional(),
  }).optional(),
  seed: z.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;

/**
 * Usage statistics in response
 */
export const UsageSchema = z.object({
  prompt_tokens: z.number().int().min(0),
  completion_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
  prompt_tokens_details: z.object({
    cached_tokens: z.number().int().min(0).optional(),
  }).optional(),
  completion_tokens_details: z.object({
    reasoning_tokens: z.number().int().min(0).optional(),
  }).optional(),
});

export type Usage = z.infer<typeof UsageSchema>;

/**
 * Single choice in chat completion response
 */
export const ChatCompletionChoiceSchema = z.object({
  index: z.number().int().min(0),
  message: ChatMessageSchema,
  finish_reason: z.enum([
    "stop",
    "length",
    "tool_calls",
    "content_filter",
    "function_call",
  ]).optional(),
});

export type ChatCompletionChoice = z.infer<typeof ChatCompletionChoiceSchema>;

/**
 * Chat completion response (non-streaming)
 */
export const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion"),
  created: z.number().int().min(0),
  model: z.string(),
  choices: z.array(ChatCompletionChoiceSchema),
  usage: UsageSchema.optional(),
  system_fingerprint: z.string().optional(),
});

export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;

/**
 * Streaming chunk for chat completions
 */
export const ChatCompletionChunkSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion.chunk"),
  created: z.number().int().min(0),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number().int().min(0),
      delta: z.object({
        role: MessageRoleSchema.optional(),
        content: z.string().nullable().optional(),
        tool_calls: z.array(ToolCallSchema).optional(),
      }),
      finish_reason: z.enum([
        "stop",
        "length",
        "tool_calls",
        "content_filter",
      ]).optional(),
    }),
  ),
  usage: UsageSchema.optional(),
  system_fingerprint: z.string().optional(),
});

export type ChatCompletionChunk = z.infer<typeof ChatCompletionChunkSchema>;

// ============================================================
// Anthropic Messages Format
// ============================================================

/**
 * Anthropic-style message
 */
export const AnthropicMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
});

export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;

/**
 * Proxy request format for /v1/messages endpoint (Anthropic compatible)
 */
export const MessagesRequestSchema = z.object({
  model: z.string().min(1, "Model is required"),
  messages: z.array(AnthropicMessageSchema).min(1, "At least one message is required"),
  system: z.union([
    z.string(),
    z.array(
      z.object({
        type: z.literal("text"),
        text: z.string(),
        cache_control: z.object({ type: z.literal("ephemeral") }).optional(),
      }),
    ),
  ]).optional(),
  max_tokens: z.number().int().positive("max_tokens must be positive"),
  temperature: z.number().min(0).max(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().positive().optional(),
  stop_sequences: z.array(z.string()).max(4).optional(),
  stream: z.boolean().default(false),
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      input_schema: z.record(z.string(), z.unknown()),
      cache_control: z.object({ type: z.literal("ephemeral") }).optional(),
    }),
  ).optional(),
  tool_choice: z.union([
    z.literal("auto"),
    z.literal("any"),
    z.literal("tool"),
    z.object({
      type: z.literal("tool"),
      name: z.string(),
    }),
  ]).optional(),
  metadata: z.object({
    user_id: z.string().optional(),
  }).optional(),
});

export type MessagesRequest = z.infer<typeof MessagesRequestSchema>;

/**
 * Anthropic-style content block in response
 */
export const AnthropicResponseContentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.unknown()),
  }),
]);

/**
 * Anthropic messages response (non-streaming)
 */
export const MessagesResponseSchema = z.object({
  id: z.string(),
  type: z.literal("message"),
  role: z.literal("assistant"),
  content: z.array(AnthropicResponseContentBlockSchema),
  model: z.string(),
  stop_reason: z.enum(["end_turn", "max_tokens", "stop_sequence", "tool_use"]).optional(),
  stop_sequence: z.string().nullable().optional(),
  usage: z.object({
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
    cache_creation_input_tokens: z.number().int().min(0).optional(),
    cache_read_input_tokens: z.number().int().min(0).optional(),
  }),
});

export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;

// ============================================================
// OpenAI Responses API Format
// ============================================================

/**
 * Input item for Responses API
 */
export const ResponseInputItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    role: z.enum(["user", "assistant", "system"]),
    content: z.union([
      z.string(),
      z.array(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("input_text"), text: z.string() }),
          z.object({ type: z.literal("input_image"), image_url: z.string(), detail: z.string().optional() }),
        ]),
      ),
    ]),
  }),
  z.object({
    type: z.literal("function_call_output"),
    call_id: z.string(),
    output: z.string(),
  }),
]);

export type ResponseInputItem = z.infer<typeof ResponseInputItemSchema>;

/**
 * Tool definition for Responses API
 */
export const ResponseToolSchema = z.object({
  type: z.literal("function"),
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  strict: z.boolean().optional(),
});

export type ResponseTool = z.infer<typeof ResponseToolSchema>;

/**
 * Proxy request format for /v1/responses endpoint (OpenAI Responses API)
 */
export const ResponsesRequestSchema = z.object({
  model: z.string().min(1, "Model is required"),
  input: z.union([z.string(), z.array(ResponseInputItemSchema)]),
  max_output_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stream: z.boolean().default(false),
  tools: z.array(ResponseToolSchema).optional(),
  tool_choice: z.enum(["auto", "required", "none"]).optional(),
  truncation_strategy: z.object({
    type: z.enum(["auto", "last_messages"]),
    last_messages: z.number().int().positive().optional(),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ResponsesRequest = z.infer<typeof ResponsesRequestSchema>;

/**
 * Output item in Responses API response
 */
export const ResponseOutputItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    role: z.literal("assistant"),
    content: z.array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("output_text"), text: z.string() }),
        z.object({ type: z.literal("refusal"), refusal: z.string() }),
      ]),
    ),
  }),
  z.object({
    type: z.literal("function_call"),
    call_id: z.string(),
    name: z.string(),
    arguments: z.string(),
  }),
]);

export type ResponseOutputItem = z.infer<typeof ResponseOutputItemSchema>;

/**
 * Responses API response (non-streaming)
 */
export const ResponsesResponseSchema = z.object({
  id: z.string(),
  object: z.literal("response"),
  created_at: z.number().int().min(0),
  model: z.string(),
  output: z.array(ResponseOutputItemSchema),
  status: z.enum(["completed", "failed", "in_progress", "incomplete"]),
  usage: UsageSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});

export type ResponsesResponse = z.infer<typeof ResponsesResponseSchema>;

// ============================================================
// Gateway Error Response
// ============================================================

/**
 * Gateway error response (OpenAI compatible)
 */
export const GatewayErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    param: z.string().nullable(),
    code: z.string().nullable(),
  }),
});

export type GatewayErrorResponse = z.infer<typeof GatewayErrorResponseSchema>;

// ============================================================
// Proxy Route Config
// ============================================================

/**
 * API endpoint format type
 */
export const ApiFormatSchema = z.enum(["openai_chat", "anthropic_messages", "openai_responses"]);

export type ApiFormat = z.infer<typeof ApiFormatSchema>;

/**
 * Unified proxy request that accepts any format
 */
export const ProxyRequestSchema = z.object({
  format: ApiFormatSchema,
  raw: z.unknown(),
  model_alias: z.string().min(1),
  auth_key: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ProxyRequest = z.infer<typeof ProxyRequestSchema>;

/**
 * Proxy response with routing metadata
 */
export const ProxyResponseSchema = z.object({
  format: ApiFormatSchema,
  raw: z.unknown(),
  routed_provider: z.string(),
  routed_auth_key: z.string(),
  latency_ms: z.number().nonnegative(),
  usage: UsageSchema.optional(),
});

export type ProxyResponse = z.infer<typeof ProxyResponseSchema>;
