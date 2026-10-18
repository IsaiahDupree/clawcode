import { Cron } from "croner";
import { log } from "../config/logger.js";
import { SessionStore } from "../agent/session/store.js";
import { runAgentLoop, createSession } from "../agent/loop.js";
import { ToolRegistry } from "../tools/registry.js";
import { getAllBuiltinTools } from "../tools/builtin/index.js";
import type { ClawConfig } from "../config/index.js";
import type { Client, TextChannel } from "discord.js";

// ── Cron Job Definition ────────────────────────────────────────────────
export interface CronJobDef {
  name: string;
  schedule: string; // cron expression (e.g., "*/5 * * * *")
  prompt: string;
  channelId: string;
  enabled: boolean;
}

interface ActiveJob {
  def: CronJobDef;
  cron: Cron;
}

// ── Cron Manager ───────────────────────────────────────────────────────
// Manages scheduled agent tasks. Each job runs the agent loop with a
// prompt and delivers results to a Discord channel.

class CronManager {
  private jobs = new Map<string, ActiveJob>();
  private client: Client | null = null;
  private config: ClawConfig | null = null;
  private toolRegistry: ToolRegistry | null = null;
  private sessionStore = new SessionStore();

  init(client: Client, config: ClawConfig) {
    this.client = client;
    this.config = config;
    this.toolRegistry = new ToolRegistry();
    this.toolRegistry.registerMany(getAllBuiltinTools());

    // Load configured jobs
    for (const jobDef of config.cron.jobs) {
      if (jobDef.enabled) {
        this.addJob(jobDef);
      }
    }

    log.info(`Cron manager initialized with ${this.jobs.size} jobs`);
  }

  addJob(def: CronJobDef): void {
    if (this.jobs.has(def.name)) {
      this.removeJob(def.name);
    }

    const cron = new Cron(def.schedule, { name: def.name }, async () => {
      await this.executeJob(def);
    });

    this.jobs.set(def.name, { def, cron });
    log.info(`Cron job "${def.name}" scheduled: ${def.schedule}`);
  }

  removeJob(name: string): void {
    const job = this.jobs.get(name);
    if (job) {
      job.cron.stop();
      this.jobs.delete(name);
      log.info(`Cron job "${name}" removed`);
    }
  }

  listJobs(): CronJobDef[] {
    return [...this.jobs.values()].map((j) => j.def);
  }

  private async executeJob(def: CronJobDef): Promise<void> {
    if (!this.client || !this.config || !this.toolRegistry) {
      log.warn(`Cron "${def.name}": not initialized, skipping`);
      return;
    }

    log.info(`Cron executing: ${def.name}`);

    try {
      const channel = await this.client.channels.fetch(def.channelId);
      if (!channel?.isTextBased()) {
        log.error(`Cron "${def.name}": channel ${def.channelId} not found`);
        return;
      }

      const session = createSession({
        sessionKey: `cron:${def.name}`,
        channelId: def.channelId,
        userId: "cron-system",
        model: this.config.ai.model,
        prompt: def.prompt,
      });

      const result = await runAgentLoop(session, this.config, this.toolRegistry);

      // Deliver to channel
      const header = `**[Cron: ${def.name}]**\n`;
      const text = header + result.response;
      const chunks = text.match(/.{1,2000}/gs) ?? [text];
      for (const chunk of chunks) {
        await (channel as TextChannel).send(chunk);
      }
    } catch (err) {
      log.error(`Cron "${def.name}" failed: ${err}`);
    }
  }

  shutdown(): void {
    for (const [name, job] of this.jobs) {
      job.cron.stop();
    }
    this.jobs.clear();
    log.info("Cron manager shut down");
  }
}

export const cronManager = new CronManager();
