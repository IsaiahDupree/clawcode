import { Message, ChannelType, TextChannel } from "discord.js";
import { log } from "../../config/logger.js";
import type { ClawConfig } from "../../config/index.js";
import { SessionStore } from "../../agent/session/store.js";
import { runAgentLoop, createSession } from "../../agent/loop.js";
import { ToolRegistry } from "../../tools/registry.js";
import { getAllBuiltinTools } from "../../tools/builtin/index.js";
import type { AgentEvent } from "../../agent/types.js";

const sessionStore = new SessionStore();
const toolRegistry = new ToolRegistry();
let toolsRegistered = false;

function ensureTools() {
  if (toolsRegistered) return;
  toolRegistry.registerMany(getAllBuiltinTools());
  toolsRegistered = true;
}

// ── Active runs — prevent duplicate processing per channel ─────────────
const activeRuns = new Set<string>();

// ── Preflight checks ───────────────────────────────────────────────────
function shouldProcess(message: Message, config: ClawConfig): boolean {
  // Ignore bots
  if (message.author.bot) return false;

  // Must mention the bot OR be a DM
  const isDM = message.channel.type === ChannelType.DM;
  const isMentioned = message.mentions.has(message.client.user!);
  if (!isDM && !isMentioned) return false;

  // Guild allowlist
  if (
    message.guild &&
    config.discord.allowedGuilds.length > 0 &&
    !config.discord.allowedGuilds.includes(message.guild.id)
  ) {
    return false;
  }

  // User allowlist
  if (
    config.discord.allowedUsers.length > 0 &&
    !config.discord.allowedUsers.includes(message.author.id)
  ) {
    return false;
  }

  // Group policy
  if (!isDM && config.discord.groupPolicy === "disabled") return false;

  // DM policy
  if (isDM && config.discord.dmPolicy === "disabled") return false;

  return true;
}

// ── Strip bot mention from message text ────────────────────────────────
function cleanPrompt(message: Message): string {
  let text = message.content;
  if (message.client.user) {
    text = text.replace(new RegExp(`<@!?${message.client.user.id}>`, "g"), "").trim();
  }
  return text || "(empty message)";
}

// ── Chunk long responses for Discord's 2000-char limit ─────────────────
function chunkText(text: string, maxLen = 2000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to break at a newline
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}

// ── Main message handler ───────────────────────────────────────────────
export async function handleMessage(
  message: Message,
  config: ClawConfig,
): Promise<void> {
  if (!shouldProcess(message, config)) return;

  ensureTools();

  const sessionKey = sessionStore.resolveSessionKey({
    userId: message.author.id,
    channelId: message.channelId,
    guildId: message.guild?.id,
    threadId:
      message.channel.type === ChannelType.PublicThread ||
      message.channel.type === ChannelType.PrivateThread
        ? message.channelId
        : undefined,
  });

  // Prevent concurrent runs in same session
  if (activeRuns.has(sessionKey)) {
    await message.reply("I'm still working on your previous request. Please wait.");
    return;
  }

  activeRuns.add(sessionKey);

  try {
    const prompt = cleanPrompt(message);
    log.info(`[${message.author.tag}] ${prompt.slice(0, 80)}`);

    // Show typing indicator
    const textChannel = message.channel as TextChannel;
    await textChannel.sendTyping();
    const typingInterval = setInterval(() => {
      textChannel.sendTyping().catch(() => {});
    }, 8_000);

    // Resolve or create session
    let session = await sessionStore.get(sessionKey);
    if (session && !sessionStore.isExpired(session, config.agent.sessionTtlMs)) {
      // Append new user message to existing session
      session.messages.push({
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      });
    } else {
      session = createSession({
        sessionKey,
        channelId: message.channelId,
        userId: message.author.id,
        guildId: message.guild?.id,
        model: config.ai.model,
        prompt,
      });
    }

    // ── Stream events as status reactions ─────────────────────────────
    const statusEmojis: Record<string, string> = {
      thinking: "🤔",
      tool_call: "⚙️",
      error: "❌",
    };

    const onEvent = async (event: AgentEvent) => {
      const emoji = statusEmojis[event.type];
      if (emoji) {
        await message.react(emoji).catch(() => {});
      }
    };

    // ── Run the agent loop ───────────────────────────────────────────
    const result = await runAgentLoop(session, config, toolRegistry, onEvent);

    clearInterval(typingInterval);

    // ── Deliver response ─────────────────────────────────────────────
    const chunks = chunkText(result.response);
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        await message.reply(chunks[i]);
      } else {
        await textChannel.send(chunks[i]);
      }
    }

    // Show tool usage footer if tools were used
    if (result.toolsUsed.length > 0) {
      const footer = `*Tools used: ${result.toolsUsed.join(", ")} | ${result.iterationsUsed} iterations${result.truncated ? " (truncated)" : ""}*`;
      if (footer.length < 2000) {
        await textChannel.send(footer);
      }
    }

    // Persist session
    await sessionStore.save(session);
  } catch (err) {
    log.error(`Agent run failed: ${err}`);
    await message.reply("Something went wrong while processing your request.").catch(() => {});
  } finally {
    activeRuns.delete(sessionKey);
  }
}
