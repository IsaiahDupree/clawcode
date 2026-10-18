import { exec } from "node:child_process";
import type { Tool } from "../types.js";

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT = 10_000;

export const bashTool: Tool = {
  definition: {
    name: "bash",
    description:
      "Execute a shell command and return stdout/stderr. Use for running code, git operations, file manipulation, and system commands.",
    inputSchema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        cwd: {
          type: "string",
          description: "Working directory (optional)",
        },
        timeout: {
          type: "number",
          description: "Timeout in ms (default 30000)",
        },
      },
      required: ["command"],
    },
    category: "coding",
    minPolicy: "safe",
  },

  handler: async (input) => {
    const command = input.command as string;
    const cwd = (input.cwd as string) || process.cwd();
    const timeout = (input.timeout as number) || TIMEOUT_MS;

    // Block destructive patterns in safe mode
    const dangerous = [
      /rm\s+-rf\s+[\/~]/,
      /mkfs/,
      /dd\s+if=/,
      /:(){ :|:& };:/,
      />\s*\/dev\/sd/,
    ];
    for (const pattern of dangerous) {
      if (pattern.test(command)) {
        return {
          output: `Blocked: command matches dangerous pattern. Use "full" tool policy to override.`,
          isError: true,
        };
      }
    }

    return new Promise((resolve) => {
      exec(command, { cwd, timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        let output = "";
        if (stdout) output += stdout;
        if (stderr) output += (output ? "\n--- stderr ---\n" : "") + stderr;
        if (!output && err) output = err.message;
        if (!output) output = "(no output)";

        // Truncate
        if (output.length > MAX_OUTPUT) {
          output = output.slice(0, MAX_OUTPUT) + "\n... (truncated)";
        }

        resolve({
          output,
          isError: !!err,
          metadata: { exitCode: err?.code ?? 0 },
        });
      });
    });
  },
};
