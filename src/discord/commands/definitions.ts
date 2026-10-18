import { SlashCommandBuilder } from "discord.js";

// ── Slash command definitions ──────────────────────────────────────────
export const commands = [
  new SlashCommandBuilder()
    .setName("claw")
    .setDescription("Send a prompt to the ClawCode agent")
    .addStringOption((opt) =>
      opt.setName("prompt").setDescription("What to ask or do").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("claw-status")
    .setDescription("Show agent status, active sessions, and system info"),

  new SlashCommandBuilder()
    .setName("claw-session")
    .setDescription("Manage your agent session")
    .addSubcommand((sub) => sub.setName("clear").setDescription("Clear your current session"))
    .addSubcommand((sub) =>
      sub.setName("info").setDescription("Show info about your current session"),
    ),

  new SlashCommandBuilder()
    .setName("claw-model")
    .setDescription("Switch the AI model")
    .addStringOption((opt) =>
      opt
        .setName("model")
        .setDescription("Model ID to use")
        .setRequired(true)
        .addChoices(
          { name: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
          { name: "Claude Opus 4", value: "claude-opus-4-20250514" },
          { name: "Claude Haiku 3.5", value: "claude-haiku-4-5-20251001" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("claw-tools")
    .setDescription("List available tools and their status"),

  new SlashCommandBuilder()
    .setName("claw-cron")
    .setDescription("Manage scheduled tasks")
    .addSubcommand((sub) => sub.setName("list").setDescription("List all cron jobs"))
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new cron job")
        .addStringOption((o) => o.setName("schedule").setDescription("Cron expression").setRequired(true))
        .addStringOption((o) => o.setName("prompt").setDescription("Agent prompt to run").setRequired(true))
        .addStringOption((o) => o.setName("name").setDescription("Job name").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a cron job")
        .addStringOption((o) => o.setName("name").setDescription("Job name to remove").setRequired(true)),
    ),
];
