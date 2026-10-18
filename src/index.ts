// ── ClawCode — Public API ──────────────────────────────────────────────

// Config
export { loadConfig, ConfigSchema } from "./config/index.js";
export type { ClawConfig } from "./config/index.js";
export { log, setLogLevel } from "./config/logger.js";

// Agent
export { runAgentLoop, createSession } from "./agent/loop.js";
export { SessionStore } from "./agent/session/store.js";
export type {
  AgentSession,
  AgentRunResult,
  AgentEvent,
  AgentEventHandler,
  AgentMessage,
} from "./agent/types.js";

// Tools
export { ToolRegistry } from "./tools/registry.js";
export { getAllBuiltinTools } from "./tools/builtin/index.js";
export type {
  Tool,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolHandler,
} from "./tools/types.js";

// Discord
export { startDiscordBot, createDiscordBot } from "./discord/client.js";
export { setDiscordClient } from "./tools/builtin/discord-tools.js";

// Cron
export { cronManager } from "./cron/manager.js";
export type { CronJobDef } from "./cron/manager.js";
