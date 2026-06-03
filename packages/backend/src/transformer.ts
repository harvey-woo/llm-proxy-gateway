import type { ApiFormat } from "@llm-proxy/shared/schemas";

export type { ApiFormat };

// ============================================================
// Response format conversion
// ============================================================

export function transformResponse(
  clientFormat: ApiFormat,
  upstreamFormat: ApiFormat,
  responseData: unknown,
  model: string,
): unknown {
  // No conversion needed
  if (clientFormat === upstreamFormat) return responseData;

  // Guard: only attempt conversion if the response is a non-null object
  if (!responseData || typeof responseData !== "object") return responseData;

  try {
    // Client expects OpenAI Chat, upstream returned different format
    if (clientFormat === "openai_chat" && upstreamFormat === "anthropic_messages") {
      return messagesResponseToChatResponse(responseData as any, model);
    }
    if (clientFormat === "openai_chat" && upstreamFormat === "openai_responses") {
      return responsesResponseToChatResponse(responseData as any, model);
    }

    // Client expects Anthropic Messages, upstream returned different format
    if (clientFormat === "anthropic_messages" && upstreamFormat === "openai_chat") {
      return chatResponseToMessagesResponse(responseData as any, model);
    }
    if (clientFormat === "anthropic_messages" && upstreamFormat === "openai_responses") {
      return responsesResponseToChatResponse(responseData as any, model);
    }

    // Client expects OpenAI Responses
    if (clientFormat === "openai_responses") {
      if (upstreamFormat === "openai_chat" || upstreamFormat === "anthropic_messages") {
        return chatResponseToMessagesResponse(responseData as any, model);
      }
    }

    // Unknown conversion, pass through
    return responseData;
  } catch {
    // If conversion fails, pass through raw response rather than crashing
    return responseData;
  }
}

// ============================================================
// Request/Response type definitions
// ============================================================

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | Array<{ type: string; [key: string]: unknown }> | null;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  [key: string]: unknown;
}

export interface MessagesRequest {
  model: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string | Array<{ type: string; [key: string]: unknown }>;
  }>;
  system?: string | Array<{ type: "text"; text: string }>;
  max_tokens: number;
  [key: string]: unknown;
}

export interface MessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: string; [key: string]: unknown }>;
  model: string;
  stop_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  [key: string]: unknown;
}

export interface ResponsesRequest {
  model: string;
  input: string | Array<{ type: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface ResponsesResponse {
  id: string;
  object: "response";
  created_at: number;
  model: string;
  output: Array<{ type: string; [key: string]: unknown }>;
  status: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  [key: string]: unknown;
}

// ============================================================
// Format detection
// ============================================================

export function detectFormat(urlPath: string): ApiFormat {
  if (urlPath.includes("/chat/completions")) {
    return "openai_chat";
  }
  if (urlPath.includes("/messages")) {
    return "anthropic_messages";
  }
  if (urlPath.includes("/responses")) {
    return "openai_responses";
  }
  // Default to OpenAI chat
  return "openai_chat";
}

// ============================================================
// Format conversion
// ============================================================

/**
 * Convert from OpenAI Chat format to Anthropic Messages format.
 */
export function chatToMessages(body: ChatCompletionRequest): MessagesRequest {
  const systemMessages = body.messages.filter((m) => m.role === "system");
  const nonSystemMessages = body.messages.filter((m) => m.role !== "system");

  const system = systemMessages.length > 0
    ? systemMessages
        .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
        .join("\n")
    : undefined;

  const messages = nonSystemMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content ?? "",
  }));

  return {
    model: body.model,
    messages,
    system,
    max_tokens: (body.max_tokens as number) ?? (body.max_completion_tokens as number) ?? 4096,
    temperature: body.temperature,
    top_p: body.top_p,
    stop_sequences: Array.isArray(body.stop)
      ? body.stop
      : body.stop
        ? [body.stop]
        : undefined,
    stream: body.stream ?? false,
  };
}

/**
 * Convert from Anthropic Messages format to OpenAI Chat format.
 */
export function messagesToChat(body: MessagesRequest): ChatCompletionRequest {
  const messages: ChatCompletionRequest["messages"] = [];

  // Convert system to a system message
  if (body.system) {
    if (typeof body.system === "string") {
      messages.push({ role: "system", content: body.system });
    } else {
      messages.push({
        role: "system",
        content: body.system.map((s) => s.text).join("\n"),
      });
    }
  }

  // Convert messages
  for (const m of body.messages) {
    messages.push({
      role: m.role,
      content: m.content,
    });
  }

  return {
    model: body.model,
    messages,
    temperature: body.temperature,
    top_p: body.top_p,
    max_tokens: body.max_tokens,
    stream: body.stream ?? false,
  };
}

/**
 * Convert from OpenAI Chat format to OpenAI Responses format.
 */
export function chatToResponses(body: ChatCompletionRequest): ResponsesRequest {
  const input = body.messages.map((m) => ({
    type: "message" as const,
    role: m.role,
    content:
      typeof m.content === "string"
        ? m.content
        : JSON.stringify(m.content),
  }));

  return {
    model: body.model,
    input,
    temperature: body.temperature,
    top_p: body.top_p,
    max_output_tokens: body.max_tokens ?? body.max_completion_tokens,
    stream: body.stream ?? false,
  };
}

/**
 * Convert from OpenAI Responses format to OpenAI Chat format.
 */
export function responsesToChat(body: ResponsesRequest): ChatCompletionRequest {
  const messages: ChatCompletionRequest["messages"] = [];

  if (typeof body.input === "string") {
    messages.push({ role: "user", content: body.input });
  } else {
    for (const item of body.input) {
      if (item.type === "message") {
        messages.push({
          role: item.role as "system" | "user" | "assistant",
          content: item.content as string,
        });
      } else if (item.type === "function_call_output") {
        messages.push({
          role: "tool",
          content: item.output as string,
          tool_call_id: item.call_id as string,
        });
      }
    }
  }

  return {
    model: body.model,
    messages,
    temperature: body.temperature,
    top_p: body.top_p,
    max_tokens: body.max_output_tokens,
    stream: body.stream ?? false,
  };
}

/**
 * Convert from Anthropic Messages format to OpenAI Responses format.
 */
export function messagesToResponses(body: MessagesRequest): ResponsesRequest {
  const chatBody = messagesToChat(body);
  return chatToResponses(chatBody);
}

/**
 * Convert from OpenAI Responses format to Anthropic Messages format.
 */
export function responsesToMessages(body: ResponsesRequest): MessagesRequest {
  const chatBody = responsesToChat(body);
  return chatToMessages(chatBody);
}

// ============================================================
// Response conversion
// ============================================================

/**
 * Convert an Anthropic Messages response to OpenAI Chat response.
 */
export function messagesResponseToChatResponse(
  response: MessagesResponse,
  model: string,
): ChatCompletionResponse {
  const textBlock = response.content.find((c) => c.type === "text");
  const content = textBlock && "text" in textBlock ? textBlock.text : "";

  return {
    id: response.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: response.stop_reason ?? "stop",
      },
    ],
    usage: response.usage
      ? {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens:
            response.usage.input_tokens + response.usage.output_tokens,
        }
      : undefined,
  };
}

/**
 * Convert an OpenAI Responses response to OpenAI Chat response.
 */
export function responsesResponseToChatResponse(
  response: ResponsesResponse,
  model: string,
): ChatCompletionResponse {
  const messageOutput = response.output.find((o) => o.type === "message");
  let content = "";

  if (messageOutput && "content" in messageOutput) {
    const contentArray = messageOutput.content as Array<{
      type: string;
      text?: string;
    }>;
    const textBlock = contentArray.find((c) => c.type === "output_text");
    content = textBlock?.text ?? "";
  }

  return {
    id: response.id,
    object: "chat.completion",
    created: response.created_at,
    model: model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: response.status === "completed" ? "stop" : response.status,
      },
    ],
    usage: response.usage,
  };
}

/**
 * Convert an OpenAI Chat response to Anthropic Messages response.
 */
export function chatResponseToMessagesResponse(
  response: ChatCompletionResponse,
  model: string,
): MessagesResponse {
  if (!response.choices || !response.choices[0]) {
    return {
      id: response.id ?? "unknown",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "" }],
      model: model,
      stop_reason: "end_turn",
      usage: undefined,
    };
  }

  const choice = response.choices[0];

  return {
    id: response.id,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: choice.message.content ?? "",
      },
    ],
    model: model,
    stop_reason:
      choice.finish_reason === "stop"
        ? "end_turn"
        : (choice.finish_reason as string),
    usage: response.usage
      ? {
          input_tokens: response.usage.prompt_tokens ?? 0,
          output_tokens: response.usage.completion_tokens ?? 0,
        }
      : undefined,
  };
}

// ============================================================
// Header injection
// ============================================================

export function injectHeaders(
  headers: Record<string, string>,
  customHeaders: Record<string, string> = {},
): Record<string, string> {
  return { ...headers, ...customHeaders };
}

// ============================================================
// Unified transform function
// ============================================================

export interface TransformResult {
  targetFormat: ApiFormat;
  transformedBody: unknown;
  headers: Record<string, string>;
}

export function transformRequest(
  sourceFormat: ApiFormat,
  targetFormat: ApiFormat,
  body: unknown,
  customHeaders: Record<string, string> = {},
): TransformResult {
  if (sourceFormat === targetFormat) {
    return {
      targetFormat,
      transformedBody: body,
      headers: customHeaders,
    };
  }

  let transformedBody: unknown;

  switch (sourceFormat) {
    case "openai_chat":
      if (targetFormat === "anthropic_messages") {
        transformedBody = chatToMessages(body as ChatCompletionRequest);
      } else if (targetFormat === "openai_responses") {
        transformedBody = chatToResponses(body as ChatCompletionRequest);
      } else {
        transformedBody = body;
      }
      break;

    case "anthropic_messages":
      if (targetFormat === "openai_chat") {
        transformedBody = messagesToChat(body as MessagesRequest);
      } else if (targetFormat === "openai_responses") {
        transformedBody = messagesToResponses(body as MessagesRequest);
      } else {
        transformedBody = body;
      }
      break;

    case "openai_responses":
      if (targetFormat === "openai_chat") {
        transformedBody = responsesToChat(body as ResponsesRequest);
      } else if (targetFormat === "anthropic_messages") {
        transformedBody = responsesToMessages(body as ResponsesRequest);
      } else {
        transformedBody = body;
      }
      break;

    default:
      transformedBody = body;
  }

  return {
    targetFormat,
    transformedBody,
    headers: customHeaders,
  };
}
