import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import YAML from "yaml";
import type { AgentSession } from "../types.js";

// ── Session Store ──────────────────────────────────────────────────────
// Persists sessions to YAML files, one per session key.
// Mirrors openclaw's session persistence pattern.

export class SessionStore {
  private sessions = new Map<string, AgentSession>();
  private stateDir: string;

  constructor(stateDir: string = "~/.clawcode") {
    this.stateDir = stateDir.replace("~", homedir());
  }

  private get sessionsDir(): string {
    return join(this.stateDir, "sessions");
  }

  private sessionPath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.sessionsDir, `${safeKey}.yaml`);
  }

  async init(): Promise<void> {
    if (!existsSync(this.sessionsDir)) {
      await mkdir(this.sessionsDir, { recursive: true });
    }
  }

  async get(sessionKey: string): Promise<AgentSession | null> {
    // Check in-memory cache first
    const cached = this.sessions.get(sessionKey);
    if (cached) return cached;

    // Try disk
    const path = this.sessionPath(sessionKey);
    if (!existsSync(path)) return null;

    try {
      const raw = await readFile(path, "utf-8");
      const session = YAML.parse(raw) as AgentSession;
      this.sessions.set(sessionKey, session);
      return session;
    } catch {
      return null;
    }
  }

  async save(session: AgentSession): Promise<void> {
    await this.init();
    session.updatedAt = Date.now();
    this.sessions.set(session.sessionKey, session);
    const path = this.sessionPath(session.sessionKey);
    await writeFile(path, YAML.stringify(session), "utf-8");
  }

  async delete(sessionKey: string): Promise<void> {
    this.sessions.delete(sessionKey);
    const path = this.sessionPath(sessionKey);
    if (existsSync(path)) {
      const { unlink } = await import("node:fs/promises");
      await unlink(path);
    }
  }

  isExpired(session: AgentSession, ttlMs: number): boolean {
    return Date.now() - session.updatedAt > ttlMs;
  }

  resolveSessionKey(opts: {
    userId: string;
    channelId: string;
    guildId?: string;
    threadId?: string;
  }): string {
    // Thread-scoped > channel-scoped > DM-scoped
    if (opts.threadId) return `thread:${opts.threadId}`;
    if (opts.guildId) return `guild:${opts.guildId}:channel:${opts.channelId}`;
    return `dm:${opts.userId}`;
  }
}
