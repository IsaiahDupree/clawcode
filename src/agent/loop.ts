import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";
import { log } from "../config/logger.js";
import { ToolRegistry } from "../tools/registry.js";
import type {
  AgentSession,
  AgentRunResult,
  AgentEventHandler,
  AgentMessage,
  ToolCall,
  ToolResult,
} from "./types.js";
import type { ClawConfig } from "../config/index.js";

// ── System prompt ──────────────────────────────────────────────────────
function buildSystemPrompt(config: ClawConfig, session: AgentSession): string {
  const base =
    config.agent.systemPrompt ??
    `You are ClawCode, an agentic AI assistant operating inside a Discord server.
You have access to tools for executing code, reading/writing files, searching the web, and managing Discord.
Use tools when the user's request requires action. Be concise and direct.
When executing code or commands, show the user what you're doing.
Always prioritize safety — never run destructive commands without explicit confirmation.`;

  const context = `
Current context:
- Channel: ${session.channelId}
- User: ${session.userId}
- Guild: ${session.guildId ?? "DM"}
- Session: ${session.id}
- Tool policy: ${config.agent.toolPolicy}
- Time: ${new Date().toISOString()}`;

  return base + context;
}

// ── Convert session messages to Anthropic format ───────────────────────
function toAnthropicMessages(
  messages: AgentMessage[],
): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue;

    if (msg.role === "user") {
      if (msg.toolResults && msg.toolResults.length > 0) {
        // Tool results go as user messages with tool_result content blocks
        result.push({
          role: "user",
          content: msg.toolResults.map((tr) => ({
            type: "tool_result" as const,
            tool_use_id: tr.toolCallId,
            content: tr.output,
            is_error: tr.isError,
          })),
        });
      } else {
        result.push({ role: "user", content: msg.content });
      }
    } else if (msg.role === "assistant") {
      const content: Anthropic.MessageParam["content"] = [];
      if (msg.content) {
        (content as Anthropic.TextBlockParam[]).push({ type: "text", text: msg.content });
      }
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          (content as Anthropic.ToolUseBlockParam[]).push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.input,
          });
        }
      }
      if ((content as unknown[]).length > 0) {
        result.push({ role: "assistant", content });
      }
    }
  }

  return result;
}

// ── The agentic loop ───────────────────────────────────────────────────
export async function runAgentLoop(
  session: AgentSession,
  config: ClawConfig,
  toolRegistry: ToolRegistry,
  onEvent?: AgentEventHandler,
): Promise<AgentRunResult> {
  const client = new Anthropic({ apiKey: config.ai.apiKey });
  const systemPrompt = buildSystemPrompt(config, session);
  const toolsUsed: string[] = [];
  let iterations = 0;
  let truncated = false;

  await onEvent?.({ type: "start", data: { sessionId: session.id } });

  // Convert tool definitions to Anthropic format
  const tools: Anthropic.Tool[] = toolRegistry.getToolDefinitions().map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  while (iterations < config.agent.maxIterations) {
    iterations++;
    session.iterationCount++;

    const messages = toAnthropicMessages(session.messages);

    log.debug(`Iteration ${iterations}, ${messages.length} messages, ${tools.length} tools`);

    // ── Call the model ────────────────────────────────────────────────
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        system: systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await onEvent?.({ type: "error", data: { error: errorMsg } });
      // Save error context and break
      session.messages.push({
        role: "assistant",
        content: `Error calling model: ${errorMsg}`,
        timestamp: Date.now(),
      });
      break;
    }

    // ── Process response ─────────────────────────────────────────────
    const assistantText: string[] = [];
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        assistantText.push(block.text);
        await onEvent?.({ type: "text_delta", data: { text: block.text } });
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
        await onEvent?.({
          type: "tool_call",
          data: {
            toolName: block.name,
            toolInput: block.input as Record<string, unknown>,
          },
        });
      }
    }

    // Save assistant message
    session.messages.push({
      role: "assistant",
      content: assistantText.join("\n"),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      timestamp: Date.now(),
    });

    // ── If no tool calls, we're done ─────────────────────────────────
    if (response.stop_reason === "end_turn" && toolCalls.length === 0) {
      break;
    }

    // ── Execute tools ────────────────────────────────────────────────
    if (toolCalls.length > 0) {
      const toolResults: ToolResult[] = [];

      for (const tc of toolCalls) {
        toolsUsed.push(tc.name);
        log.info(`Executing tool: ${tc.name}`);

        const result = await toolRegistry.execute(tc.name, tc.input, {
          sessionId: session.id,
          userId: session.userId,
          channelId: session.channelId,
          guildId: session.guildId,
          policy: config.agent.toolPolicy,
        });

        toolResults.push({
          toolCallId: tc.id,
          name: tc.name,
          output: result.output,
          isError: result.isError,
        });

        await onEvent?.({
          type: "tool_result",
          data: {
            toolName: tc.name,
            toolOutput: result.output.slice(0, 500),
          },
        });
      }

      // Add tool results as a user message (Anthropic format)
      session.messages.push({
        role: "user",
        content: "",
        toolResults,
        timestamp: Date.now(),
      });
    }

    // Check if model wants to stop
    if (response.stop_reason === "end_turn") break;
  }

  if (iterations >= config.agent.maxIterations) {
    truncated = true;
    log.warn(`Session ${session.id} hit max iterations (${config.agent.maxIterations})`);
  }

  // Extract final response text
  const lastAssistant = [...session.messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.content);
  const finalResponse = lastAssistant?.content ?? "(No response generated)";

  await onEvent?.({ type: "end", data: { sessionId: session.id } });

  return {
    response: finalResponse,
    toolsUsed: [...new Set(toolsUsed)],
    iterationsUsed: iterations,
    sessionId: session.id,
    truncated,
  };
}

// ── Create a new session ───────────────────────────────────────────────
export function createSession(opts: {
  sessionKey: string;
  channelId: string;
  userId: string;
  guildId?: string;
  model: string;
  prompt: string;
}): AgentSession {
  return {
    id: uuid(),
    sessionKey: opts.sessionKey,
    channelId: opts.channelId,
    userId: opts.userId,
    guildId: opts.guildId,
    messages: [
      {
        role: "user",
        content: opts.prompt,
        timestamp: Date.now(),
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model: opts.model,
    iterationCount: 0,
    isActive: true,
  };
}
