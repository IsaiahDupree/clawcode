import { readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { glob } from "glob";
import type { Tool } from "../types.js";

const MAX_READ = 50_000;

export const fileReadTool: Tool = {
  definition: {
    name: "file_read",
    description: "Read the contents of a file. Returns the text content with line numbers.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative file path" },
        startLine: { type: "number", description: "Start reading from this line (1-based)" },
        endLine: { type: "number", description: "Stop reading at this line (inclusive)" },
      },
      required: ["path"],
    },
    category: "coding",
    minPolicy: "readonly",
  },
  handler: async (input) => {
    const path = input.path as string;
    if (!existsSync(path)) {
      return { output: `File not found: ${path}`, isError: true };
    }
    try {
      let content = await readFile(path, "utf-8");
      const lines = content.split("\n");
      const start = ((input.startLine as number) || 1) - 1;
      const end = (input.endLine as number) || lines.length;
      const slice = lines.slice(start, end);
      const numbered = slice.map((line, i) => `${start + i + 1}\t${line}`).join("\n");
      const output = numbered.length > MAX_READ ? numbered.slice(0, MAX_READ) + "\n...(truncated)" : numbered;
      return { output, isError: false };
    } catch (err) {
      return { output: `Error reading file: ${err}`, isError: true };
    }
  },
};

export const fileWriteTool: Tool = {
  definition: {
    name: "file_write",
    description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write to" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
    category: "coding",
    minPolicy: "safe",
  },
  handler: async (input) => {
    try {
      await writeFile(input.path as string, input.content as string, "utf-8");
      return { output: `Written to ${input.path}`, isError: false };
    } catch (err) {
      return { output: `Error writing file: ${err}`, isError: true };
    }
  },
};

export const fileEditTool: Tool = {
  definition: {
    name: "file_edit",
    description: "Replace a specific string in a file with new content. The old_string must be unique in the file.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path" },
        old_string: { type: "string", description: "Exact text to find and replace" },
        new_string: { type: "string", description: "Replacement text" },
      },
      required: ["path", "old_string", "new_string"],
    },
    category: "coding",
    minPolicy: "safe",
  },
  handler: async (input) => {
    const path = input.path as string;
    try {
      const content = await readFile(path, "utf-8");
      const old = input.old_string as string;
      const occurrences = content.split(old).length - 1;
      if (occurrences === 0) return { output: `"${old.slice(0, 50)}..." not found in file`, isError: true };
      if (occurrences > 1) return { output: `"${old.slice(0, 50)}..." found ${occurrences} times — must be unique`, isError: true };
      const updated = content.replace(old, input.new_string as string);
      await writeFile(path, updated, "utf-8");
      return { output: `Edited ${path}`, isError: false };
    } catch (err) {
      return { output: `Error editing file: ${err}`, isError: true };
    }
  },
};

export const globTool: Tool = {
  definition: {
    name: "glob",
    description: "Find files matching a glob pattern. Returns a list of matching file paths.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (e.g., '**/*.ts')" },
        cwd: { type: "string", description: "Base directory to search from" },
      },
      required: ["pattern"],
    },
    category: "coding",
    minPolicy: "readonly",
  },
  handler: async (input) => {
    try {
      const files = await glob(input.pattern as string, {
        cwd: (input.cwd as string) || process.cwd(),
        ignore: ["node_modules/**", ".git/**"],
      });
      if (files.length === 0) return { output: "No files matched", isError: false };
      return { output: files.slice(0, 200).join("\n"), isError: false };
    } catch (err) {
      return { output: `Glob error: ${err}`, isError: true };
    }
  },
};

export const grepTool: Tool = {
  definition: {
    name: "grep",
    description: "Search for a regex pattern in files. Returns matching lines with file paths and line numbers.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        path: { type: "string", description: "File or directory to search in" },
        glob: { type: "string", description: "File glob filter (e.g., '*.ts')" },
      },
      required: ["pattern"],
    },
    category: "coding",
    minPolicy: "readonly",
  },
  handler: async (input, ctx) => {
    // Use ripgrep via bash for real searching
    const { exec } = await import("node:child_process");
    const searchPath = (input.path as string) || process.cwd();
    const globFilter = input.glob ? `--glob '${input.glob}'` : "";
    const cmd = `rg --line-number --max-count 50 ${globFilter} "${input.pattern}" "${searchPath}" 2>/dev/null || grep -rn "${input.pattern}" "${searchPath}" --include="${input.glob || '*'}" 2>/dev/null | head -50`;

    return new Promise((resolve) => {
      exec(cmd, { maxBuffer: 512 * 1024, timeout: 15_000 }, (err, stdout) => {
        if (!stdout?.trim()) {
          resolve({ output: "No matches found", isError: false });
        } else {
          resolve({ output: stdout.trim().slice(0, 10_000), isError: false });
        }
      });
    });
  },
};
