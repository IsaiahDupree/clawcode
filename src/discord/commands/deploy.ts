import { REST, Routes } from "discord.js";
import { commands } from "./definitions.js";
import { loadConfig } from "../../config/index.js";
import { log } from "../../config/logger.js";

// ── Deploy slash commands to Discord ───────────────────────────────────
async function deploy() {
  const config = loadConfig();
  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  const body = commands.map((cmd) => cmd.toJSON());

  try {
    if (config.discord.guildId) {
      // Guild-scoped (instant, good for dev)
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body },
      );
      log.info(`Deployed ${body.length} commands to guild ${config.discord.guildId}`);
    } else {
      // Global (takes up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
      log.info(`Deployed ${body.length} commands globally`);
    }
  } catch (err) {
    log.error(`Command deploy failed: ${err}`);
    process.exit(1);
  }
}

deploy();
