import { z } from "zod";
import "dotenv/config";

// ── Config Schema ──────────────────────────────────────────────────────
export const ConfigSchema = z.object({
  discord: z.object({
    token: z.string().min(1),
    clientId: z.string().min(1),
    guildId: z.string().optional(),
    allowedGuilds: z.array(z.string()).default([]),
    allowedUsers: z.array(z.string()).default([]),
    groupPolicy: z.enum(["open", "allowlist", "disabled"]).default("open"),
    dmPolicy: z.enum(["open", "pairing", "allowlist", "disabled"]).default("open"),
    maxMessageLength: z.number().default(2000),
  }),

  ai: z.object({
    provider: z.enum(["anthropic", "openai"]).default("anthropic"),
    apiKey: z.string().min(1),
    model: z.string().default("claude-sonnet-4-20250514"),
    maxTokens: z.number().default(8192),
    thinkingEnabled: z.boolean().default(false),
  }),

  agent: z.object({
    maxIterations: z.number().default(50),
    timeoutMs: z.number().default(300_000), // 5 min
    sessionTtlMs: z.number().default(3_600_000), // 1 hour
    systemPrompt: z.string().optional(),
    toolPolicy: z.enum(["full", "safe", "readonly"]).default("safe"),
  }),

  cron: z.object({
    enabled: z.boolean().default(false),
    jobs: z
      .array(
        z.object({
          name: z.string(),
          schedule: z.string(), // cron expression
          channelId: z.string(),
          prompt: z.string(),
          enabled: z.boolean().default(true),
        }),
      )
      .default([]),
  }),

  stateDir: z.string().default("~/.clawcode"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ClawConfig = z.infer<typeof ConfigSchema>;

// ── Load from env ──────────────────────────────────────────────────────
function splitList(val: string | undefined): string[] {
  if (!val) return [];
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(): ClawConfig {
  const raw = {
    discord: {
      token: process.env.DISCORD_BOT_TOKEN ?? "",
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      guildId: process.env.DISCORD_GUILD_ID,
      allowedGuilds: splitList(process.env.CLAWCODE_ALLOWED_GUILDS),
      allowedUsers: splitList(process.env.CLAWCODE_ALLOWED_USERS),
    },
    ai: {
      provider: process.env.CLAWCODE_AI_PROVIDER ?? "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
      model: process.env.CLAWCODE_MODEL,
    },
    agent: {
      maxIterations: process.env.CLAWCODE_MAX_ITERATIONS
        ? Number(process.env.CLAWCODE_MAX_ITERATIONS)
        : undefined,
      toolPolicy: process.env.CLAWCODE_TOOL_POLICY,
      systemPrompt: process.env.CLAWCODE_SYSTEM_PROMPT,
    },
    cron: {
      enabled: process.env.CLAWCODE_CRON_ENABLED === "true",
    },
    stateDir: process.env.CLAWCODE_STATE_DIR,
    logLevel: process.env.CLAWCODE_LOG_LEVEL,
  };

  return ConfigSchema.parse(raw);
}
