#!/usr/bin/env tsx

import { program } from "commander";
import { loadConfig } from "./config/index.js";
import { setLogLevel, log } from "./config/logger.js";
import { startDiscordBot } from "./discord/client.js";
import { cronManager } from "./cron/manager.js";

// ── CLI ────────────────────────────────────────────────────────────────
program
  .name("clawcode")
  .description("Agentic Discord AI assistant with autonomous tool execution")
  .version("0.1.0");

program
  .command("start")
  .description("Start the ClawCode Discord bot")
  .action(async () => {
    try {
      const config = loadConfig();
      setLogLevel(config.logLevel);

      log.info("Starting ClawCode...");
      log.info(`Model: ${config.ai.model} | Provider: ${config.ai.provider}`);
      log.info(`Tool policy: ${config.agent.toolPolicy} | Max iterations: ${config.agent.maxIterations}`);

      // Start Discord bot
      const client = await startDiscordBot(config);

      // Initialize cron manager
      if (config.cron.enabled) {
        // Wait for client to be ready
        client.once("ready", () => {
          cronManager.init(client, config);
        });
      }

      // Graceful shutdown
      const shutdown = () => {
        log.info("Shutting down...");
        cronManager.shutdown();
        client.destroy();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } catch (err) {
      log.error(`Failed to start: ${err}`);
      process.exit(1);
    }
  });

program
  .command("deploy-commands")
  .description("Deploy slash commands to Discord")
  .action(async () => {
    await import("./discord/commands/deploy.js");
  });

program
  .command("status")
  .description("Show configuration status")
  .action(() => {
    try {
      const config = loadConfig();
      console.log("\nClawCode Configuration:");
      console.log("───────────────────────");
      console.log(`  Discord Token: ${config.discord.token ? "***set***" : "MISSING"}`);
      console.log(`  Discord Client ID: ${config.discord.clientId || "MISSING"}`);
      console.log(`  AI Provider: ${config.ai.provider}`);
      console.log(`  AI API Key: ${config.ai.apiKey ? "***set***" : "MISSING"}`);
      console.log(`  Model: ${config.ai.model}`);
      console.log(`  Tool Policy: ${config.agent.toolPolicy}`);
      console.log(`  Max Iterations: ${config.agent.maxIterations}`);
      console.log(`  Cron Enabled: ${config.cron.enabled}`);
      console.log(`  Cron Jobs: ${config.cron.jobs.length}`);
      console.log(`  Log Level: ${config.logLevel}`);
      console.log("");
    } catch (err) {
      console.error(`Config error: ${err}`);
    }
  });

program.parse();
