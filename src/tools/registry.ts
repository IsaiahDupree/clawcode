import { log } from "../config/logger.js";
import type {
  Tool,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolHandler,
} from "./types.js";

// ── Policy enforcement ─────────────────────────────────────────────────
const POLICY_RANK: Record<string, number> = { readonly: 0, safe: 1, full: 2 };

function policyAllows(
  required: string,
  active: string,
): boolean {
  return POLICY_RANK[active] >= POLICY_RANK[required];
}

// ── Tool Registry ──────────────────────────────────────────────────────
// Central registry for all tools. Handles registration, policy checks,
// and dispatching execution.

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.definition.name)) {
      log.warn(`Tool "${tool.definition.name}" already registered, overwriting`);
    }
    this.tools.set(tool.definition.name, tool);
    log.debug(`Registered tool: ${tool.definition.name} [${tool.definition.category}]`);
  }

  registerMany(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getToolDefinitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  listByCategory(category: string): ToolDefinition[] {
    return [...this.tools.values()]
      .filter((t) => t.definition.category === category)
      .map((t) => t.definition);
  }

  async execute(
    name: string,
    input: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { output: `Unknown tool: "${name}"`, isError: true };
    }

    // Policy check
    if (!policyAllows(tool.definition.minPolicy, ctx.policy)) {
      return {
        output: `Tool "${name}" requires "${tool.definition.minPolicy}" policy, but current policy is "${ctx.policy}"`,
        isError: true,
      };
    }

    try {
      const result = await tool.handler(input, ctx);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Tool "${name}" failed: ${msg}`);
      return { output: `Tool execution error: ${msg}`, isError: true };
    }
  }
}
