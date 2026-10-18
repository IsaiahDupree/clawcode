import { bashTool } from "./bash.js";
import { fileReadTool, fileWriteTool, fileEditTool, globTool, grepTool } from "./file-ops.js";
import { webFetchTool, webSearchTool } from "./web.js";
import { discordTools } from "./discord-tools.js";
import type { Tool } from "../types.js";

export function getAllBuiltinTools(): Tool[] {
  return [
    // Coding tools
    bashTool,
    fileReadTool,
    fileWriteTool,
    fileEditTool,
    globTool,
    grepTool,

    // Web tools
    webFetchTool,
    webSearchTool,

    // Discord tools
    ...discordTools,
  ];
}

export {
  bashTool,
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  webFetchTool,
  webSearchTool,
  discordTools,
};
