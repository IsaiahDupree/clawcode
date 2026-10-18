import {
  type Interaction,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { log } from "../../config/logger.js";
import type { ClawConfig } from "../../config/index.js";
import { SessionStore } from "../../agent/session/store.js";
import { runAgentLoop, createSession } from "../../agent/loop.js";
import { ToolRegistry } from "../../tools/registry.js";
import { getAllBuiltinTools } from "../../tools/builtin/index.js";
import { cronManager } from "../../cron/manager.js";

const sessionStore = new SessionStore();
const toolRegistry = new ToolRegistry();
let toolsRegistered = false;

function ensureTools() {
  if (toolsRegistered) return;
  toolRegistry.registerMany(getAllBuiltinTools());
  toolsRegistered = true;
}

// ── Main interaction handler ───────────────────────────────────────────
export async function handleInteraction(
  interaction: Interaction,
  config: ClawConfig,
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction as ChatInputCommandInteraction;

  switch (cmd.commandName) {
    case "claw":
      return handleClaw(cmd, config);
    case "claw-status":
      return handleStatus(cmd, config);
    case "claw-session":
      return handleSession(cmd, config);
    case "claw-model":
      return handleModel(cmd, config);
    case "claw-tools":
      return handleTools(cmd, config);
    case "claw-cron":
      return handleCron(cmd, config);
    default:
      await cmd.reply({ content: "Unknown command", ephemeral: true });
  }
}

// ── /claw <prompt> ─────────────────────────────────────────────────────
async function handleClaw(cmd: ChatInputCommandInteraction, config: ClawConfig) {
  ensureTools();
  const prompt = cmd.options.getString("prompt", true);
  await cmd.deferReply();

  const sessionKey = sessionStore.resolveSessionKey({
    userId: cmd.user.id,
    channelId: cmd.channelId,
    guildId: cmd.guildId ?? undefined,
  });

  let session = await sessionStore.get(sessionKey);
  if (session && !sessionStore.isExpired(session, config.agent.sessionTtlMs)) {
    session.messages.push({ role: "user", content: prompt, timestamp: Date.now() });
  } else {
    session = createSession({
      sessionKey,
      channelId: cmd.channelId,
      userId: cmd.user.id,
      guildId: cmd.guildId ?? undefined,
      model: config.ai.model,
      prompt,
    });
  }

  try {
    const result = await runAgentLoop(session, config, toolRegistry);
    await sessionStore.save(session);

    const response = result.response.slice(0, 1900);
    const footer = result.toolsUsed.length > 0
      ? `\n\n*${result.toolsUsed.join(", ")} | ${result.iterationsUsed} iters*`
      : "";
    await cmd.editReply(response + footer);
  } catch (err) {
    await cmd.editReply("Agent execution failed. Check logs.");
    log.error(`/claw failed: ${err}`);
  }
}

// ── /claw-status ───────────────────────────────────────────────────────
async function handleStatus(cmd: ChatInputCommandInteraction, config: ClawConfig) {
  const uptime = process.uptime();
  const mem = process.memoryUsage();
  const guilds = cmd.client.guilds.cache.size;

  await cmd.reply({
    embeds: [
      {
        title: "ClawCode Status",
        color: 0x00ff88,
        fields: [
          { name: "Model", value: config.ai.model, inline: true },
          { name: "Provider", value: config.ai.provider, inline: true },
          { name: "Tool Policy", value: config.agent.toolPolicy, inline: true },
          { name: "Guilds", value: String(guilds), inline: true },
          { name: "Uptime", value: `${Math.floor(uptime / 60)}m`, inline: true },
          { name: "Memory", value: `${Math.floor(mem.heapUsed / 1024 / 1024)}MB`, inline: true },
          { name: "Cron Jobs", value: String(cronManager.listJobs().length), inline: true },
        ],
      },
    ],
    ephemeral: true,
  });
}

// ── /claw-session ──────────────────────────────────────────────────────
async function handleSession(cmd: ChatInputCommandInteraction, config: ClawConfig) {
  const sub = cmd.options.getSubcommand();
  const sessionKey = sessionStore.resolveSessionKey({
    userId: cmd.user.id,
    channelId: cmd.channelId,
    guildId: cmd.guildId ?? undefined,
  });

  if (sub === "clear") {
    await sessionStore.delete(sessionKey);
    await cmd.reply({ content: "Session cleared.", ephemeral: true });
  } else if (sub === "info") {
    const session = await sessionStore.get(sessionKey);
    if (!session) {
      await cmd.reply({ content: "No active session.", ephemeral: true });
      return;
    }
    await cmd.reply({
      content: [
        `**Session:** ${session.id}`,
        `**Messages:** ${session.messages.length}`,
        `**Model:** ${session.model}`,
        `**Created:** <t:${Math.floor(session.createdAt / 1000)}:R>`,
        `**Updated:** <t:${Math.floor(session.updatedAt / 1000)}:R>`,
        `**Iterations:** ${session.iterationCount}`,
      ].join("\n"),
      ephemeral: true,
    });
  }
}

// ── /claw-model ────────────────────────────────────────────────────────
async function handleModel(cmd: ChatInputCommandInteraction, config: ClawConfig) {
  const model = cmd.options.getString("model", true);
  // In a real implementation, persist per-user model preference
  config.ai.model = model;
  await cmd.reply({ content: `Model switched to **${model}**`, ephemeral: true });
}

// ── /claw-tools ────────────────────────────────────────────────────────
async function handleTools(cmd: ChatInputCommandInteraction, config: ClawConfig) {
  ensureTools();
  const defs = toolRegistry.getToolDefinitions();
  const grouped = new Map<string, string[]>();
  for (const d of defs) {
    const list = grouped.get(d.category) ?? [];
    list.push(`\`${d.name}\` — ${d.description.slice(0, 60)}`);
    grouped.set(d.category, list);
  }

  const fields = [...grouped.entries()].map(([cat, tools]) => ({
    name: cat.toUpperCase(),
    value: tools.join("\n"),
  }));

  await cmd.reply({
    embeds: [
      {
        title: `ClawCode Tools (${defs.length})`,
        color: 0x5865f2,
        fields,
      },
    ],
    ephemeral: true,
  });
}

// ── /claw-cron ─────────────────────────────────────────────────────────
async function handleCron(cmd: ChatInputCommandInteraction, config: ClawConfig) {
  const sub = cmd.options.getSubcommand();

  if (sub === "list") {
    const jobs = cronManager.listJobs();
    if (jobs.length === 0) {
      await cmd.reply({ content: "No cron jobs configured.", ephemeral: true });
      return;
    }
    const lines = jobs.map((j) => `**${j.name}** — \`${j.schedule}\` → ${j.prompt.slice(0, 50)}`);
    await cmd.reply({ content: lines.join("\n"), ephemeral: true });
  } else if (sub === "add") {
    const name = cmd.options.getString("name", true);
    const schedule = cmd.options.getString("schedule", true);
    const prompt = cmd.options.getString("prompt", true);
    try {
      cronManager.addJob({
        name,
        schedule,
        prompt,
        channelId: cmd.channelId,
        enabled: true,
      });
      await cmd.reply({ content: `Cron job **${name}** added: \`${schedule}\``, ephemeral: true });
    } catch (err) {
      await cmd.reply({ content: `Failed: ${err}`, ephemeral: true });
    }
  } else if (sub === "remove") {
    const name = cmd.options.getString("name", true);
    cronManager.removeJob(name);
    await cmd.reply({ content: `Removed job **${name}**`, ephemeral: true });
  }
}
