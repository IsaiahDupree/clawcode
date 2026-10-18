import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  type Message,
  type Interaction,
} from "discord.js";
import { log } from "../config/logger.js";
import type { ClawConfig } from "../config/index.js";
import { setDiscordClient } from "../tools/builtin/discord-tools.js";
import { handleMessage } from "./monitor/message-handler.js";
import { handleInteraction } from "./commands/handler.js";

// ── Create and configure the Discord client ────────────────────────────
export function createDiscordBot(config: ClawConfig) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
  });

  // ── Ready ──────────────────────────────────────────────────────────
  client.once(Events.ClientReady, (c) => {
    log.info(`Bot online as ${c.user.tag} — ${c.guilds.cache.size} guilds`);
    setDiscordClient(client);
  });

  // ── Message Create ─────────────────────────────────────────────────
  client.on(Events.MessageCreate, (message: Message) => {
    handleMessage(message, config).catch((err) => {
      log.error(`Message handler error: ${err}`);
    });
  });

  // ── Interaction Create (slash commands) ────────────────────────────
  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    handleInteraction(interaction, config).catch((err) => {
      log.error(`Interaction handler error: ${err}`);
    });
  });

  // ── Error handling ─────────────────────────────────────────────────
  client.on(Events.Error, (err) => {
    log.error(`Discord client error: ${err.message}`);
  });

  return client;
}

// ── Connect ────────────────────────────────────────────────────────────
export async function startDiscordBot(config: ClawConfig): Promise<Client> {
  const client = createDiscordBot(config);
  await client.login(config.discord.token);
  return client;
}
