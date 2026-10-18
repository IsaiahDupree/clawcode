// ── Core agent types ───────────────────────────────────────────────────

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  output: string;
  isError: boolean;
}

export interface AgentSession {
  id: string;
  sessionKey: string;
  channelId: string;
  userId: string;
  guildId?: string;
  messages: AgentMessage[];
  createdAt: number;
  updatedAt: number;
  model: string;
  iterationCount: number;
  isActive: boolean;
}

export interface AgentRunResult {
  response: string;
  toolsUsed: string[];
  iterationsUsed: number;
  sessionId: string;
  truncated: boolean;
}

export type AgentEventType =
  | "start"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "text_delta"
  | "end"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  data: {
    text?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: string;
    error?: string;
    sessionId?: string;
  };
}

export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;
