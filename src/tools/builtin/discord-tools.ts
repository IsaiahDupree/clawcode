import type { Tool, ToolExecutionContext, ToolExecutionResult } from "../types.js";
import {
  Client,
  TextChannel,
  ChannelType,
  PermissionsBitField,
  type Guild,
} from "discord.js";

// Discord client ref — set by the bot at startup
let discordClient: Client | null = null;

export function setDiscordClient(client: Client) {
  discordClient = client;
}

function requireClient(): Client {
  if (!discordClient) throw new Error("Discord client not initialized");
  return discordClient;
}

// ── Send Message ───────────────────────────────────────────────────────
export const discordSendTool: Tool = {
  definition: {
    name: "discord_send",
    description: "Send a message to a Discord channel. Supports text and embeds.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Target channel ID" },
        content: { type: "string", description: "Message text" },
        replyTo: { type: "string", description: "Message ID to reply to (optional)" },
      },
      required: ["channelId", "content"],
    },
    category: "discord",
    minPolicy: "safe",
  },
  handler: async (input) => {
    const client = requireClient();
    const channel = await client.channels.fetch(input.channelId as string);
    if (!channel?.isTextBased()) return { output: "Channel not found or not text-based", isError: true };
    const msg = await (channel as TextChannel).send({
      content: (input.content as string).slice(0, 2000),
      ...(input.replyTo ? { reply: { messageReference: input.replyTo as string } } : {}),
    });
    return { output: `Sent message ${msg.id} to #${(channel as TextChannel).name}`, isError: false };
  },
};

// ── React to Message ───────────────────────────────────────────────────
export const discordReactTool: Tool = {
  definition: {
    name: "discord_react",
    description: "Add a reaction emoji to a message.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID" },
        messageId: { type: "string", description: "Message ID to react to" },
        emoji: { type: "string", description: "Emoji to react with (unicode or custom)" },
      },
      required: ["channelId", "messageId", "emoji"],
    },
    category: "discord",
    minPolicy: "safe",
  },
  handler: async (input) => {
    const client = requireClient();
    const channel = await client.channels.fetch(input.channelId as string);
    if (!channel?.isTextBased()) return { output: "Channel not found", isError: true };
    const msg = await (channel as TextChannel).messages.fetch(input.messageId as string);
    await msg.react(input.emoji as string);
    return { output: `Reacted with ${input.emoji}`, isError: false };
  },
};

// ── List Channels ──────────────────────────────────────────────────────
export const discordListChannelsTool: Tool = {
  definition: {
    name: "discord_list_channels",
    description: "List all channels in a guild with their types and IDs.",
    inputSchema: {
      type: "object",
      properties: {
        guildId: { type: "string", description: "Guild (server) ID" },
      },
      required: ["guildId"],
    },
    category: "discord",
    minPolicy: "readonly",
  },
  handler: async (input) => {
    const client = requireClient();
    const guild = await client.guilds.fetch(input.guildId as string);
    const channels = await guild.channels.fetch();
    const lines = channels
      .filter((c) => c !== null)
      .map((c) => `${c!.id} | ${c!.name} | ${ChannelType[c!.type]}`)
      .join("\n");
    return { output: lines || "No channels found", isError: false };
  },
};

// ── Create Thread ──────────────────────────────────────────────────────
export const discordCreateThreadTool: Tool = {
  definition: {
    name: "discord_create_thread",
    description: "Create a new thread in a channel.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Parent channel ID" },
        name: { type: "string", description: "Thread name" },
        messageId: { type: "string", description: "Message ID to create thread from (optional)" },
      },
      required: ["channelId", "name"],
    },
    category: "discord",
    minPolicy: "safe",
  },
  handler: async (input) => {
    const client = requireClient();
    const channel = await client.channels.fetch(input.channelId as string);
    if (!channel || channel.type !== ChannelType.GuildText) {
      return { output: "Channel not found or not a text channel", isError: true };
    }
    const thread = await (channel as TextChannel).threads.create({
      name: input.name as string,
      ...(input.messageId ? { startMessage: input.messageId as string } : {}),
    });
    return { output: `Created thread "${thread.name}" (${thread.id})`, isError: false };
  },
};

// ── Manage Roles ───────────────────────────────────────────────────────
export const discordRoleTool: Tool = {
  definition: {
    name: "discord_role",
    description: "Add or remove a role from a guild member.",
    inputSchema: {
      type: "object",
      properties: {
        guildId: { type: "string", description: "Guild ID" },
        userId: { type: "string", description: "Target user ID" },
        roleId: { type: "string", description: "Role ID" },
        action: { type: "string", enum: ["add", "remove"], description: "add or remove" },
      },
      required: ["guildId", "userId", "roleId", "action"],
    },
    category: "discord",
    minPolicy: "full",
  },
  handler: async (input) => {
    const client = requireClient();
    const guild = await client.guilds.fetch(input.guildId as string);
    const member = await guild.members.fetch(input.userId as string);
    if (input.action === "add") {
      await member.roles.add(input.roleId as string);
      return { output: `Added role to ${member.user.tag}`, isError: false };
    } else {
      await member.roles.remove(input.roleId as string);
      return { output: `Removed role from ${member.user.tag}`, isError: false };
    }
  },
};

// ── Read Messages ──────────────────────────────────────────────────────
export const discordReadMessagesTool: Tool = {
  definition: {
    name: "discord_read_messages",
    description: "Read recent messages from a channel.",
    inputSchema: {
      type: "object",
      properties: {
        channelId: { type: "string", description: "Channel ID" },
        limit: { type: "number", description: "Number of messages to fetch (max 100)" },
      },
      required: ["channelId"],
    },
    category: "discord",
    minPolicy: "readonly",
  },
  handler: async (input) => {
    const client = requireClient();
    const channel = await client.channels.fetch(input.channelId as string);
    if (!channel?.isTextBased()) return { output: "Channel not found", isError: true };
    const limit = Math.min((input.limit as number) || 20, 100);
    const messages = await (channel as TextChannel).messages.fetch({ limit });
    const lines = messages
      .reverse()
      .map((m) => `[${m.author.tag}] ${m.content.slice(0, 200)}`)
      .join("\n");
    return { output: lines || "(no messages)", isError: false };
  },
};

// ── Export all Discord tools ───────────────────────────────────────────
export const discordTools: Tool[] = [
  discordSendTool,
  discordReactTool,
  discordListChannelsTool,
  discordCreateThreadTool,
  discordRoleTool,
  discordReadMessagesTool,
];
