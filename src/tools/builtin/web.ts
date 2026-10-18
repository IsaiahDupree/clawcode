import type { Tool } from "../types.js";

export const webFetchTool: Tool = {
  definition: {
    name: "web_fetch",
    description: "Fetch a URL and return its text content. Useful for reading documentation, APIs, or web pages.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch" },
        maxLength: { type: "number", description: "Max response length (default 20000)" },
      },
      required: ["url"],
    },
    category: "web",
    minPolicy: "readonly",
  },
  handler: async (input) => {
    const url = input.url as string;
    const maxLen = (input.maxLength as number) || 20_000;

    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "ClawCode/0.1" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) {
        return { output: `HTTP ${resp.status}: ${resp.statusText}`, isError: true };
      }
      let text = await resp.text();
      if (text.length > maxLen) {
        text = text.slice(0, maxLen) + "\n...(truncated)";
      }
      return { output: text, isError: false };
    } catch (err) {
      return { output: `Fetch error: ${err}`, isError: true };
    }
  },
};

export const webSearchTool: Tool = {
  definition: {
    name: "web_search",
    description: "Search the web using a query. Returns search results with titles, URLs, and snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
    category: "web",
    minPolicy: "readonly",
  },
  handler: async (input) => {
    // Placeholder — integrate with Brave/Google/SerpAPI
    return {
      output: `Web search for "${input.query}" — configure BRAVE_API_KEY or similar for real results. For now, use web_fetch with a specific URL.`,
      isError: false,
    };
  },
};
