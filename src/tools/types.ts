// ── Tool system types ──────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: "coding" | "discord" | "web" | "system" | "memory";
  /** Which policies allow this tool: "full" = all, "safe" = non-destructive, "readonly" = read-only */
  minPolicy: "readonly" | "safe" | "full";
}

export interface ToolExecutionContext {
  sessionId: string;
  userId: string;
  channelId: string;
  guildId?: string;
  policy: "full" | "safe" | "readonly";
}

export interface ToolExecutionResult {
  output: string;
  isError: boolean;
  metadata?: Record<string, unknown>;
}

export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolExecutionContext,
) => Promise<ToolExecutionResult>;

export interface Tool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
