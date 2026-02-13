import https from "node:https";
import type { IncomingMessage } from "node:http";

import { tool } from "@openrouter/sdk";
import { z } from "zod";

function getJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "user-agent": "inplain-openrouter-agent/0.1",
        },
      },
      (res: IncomingMessage) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode ?? "?"} for ${url}`));
          res.resume();
          return;
        }

        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      },
    );

    req.on("error", (err: Error) => reject(err));
    req.end();
  });
}

export const timeTool = tool({
  name: "get_current_time",
  description: "Get the current date and time",
  inputSchema: z.object({
    timezone: z.string().optional().describe('Timezone (e.g., "UTC", "America/New_York")'),
  }),
  execute: async ({ timezone }) => {
    return {
      time: new Date().toLocaleString("en-US", { timeZone: timezone || "UTC" }),
      timezone: timezone || "UTC",
    };
  },
});

export const calculatorTool = tool({
  name: "calculate",
  description: "Perform mathematical calculations",
  inputSchema: z.object({
    expression: z.string().describe('Math expression (e.g., "2 + 2", "sqrt(16)")'),
  }),
  execute: async ({ expression }) => {
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
    const result = Function(`"use strict"; return (${sanitized})`)();
    return { expression, result };
  },
});

export const openrouterModelsTool = tool({
  name: "openrouter_models",
  description: "Fetch OpenRouter models metadata (pricing, context length, structured outputs support)",
  inputSchema: z.object({
    ids: z.array(z.string()).optional().describe("Optional list of model IDs to filter to"),
    limit: z.number().int().min(1).max(50).optional().describe("Max models to return"),
  }),
  execute: async ({ ids, limit }) => {
    const payload = await getJson("https://openrouter.ai/api/v1/models");

    const parsed = z
      .object({
        data: z.array(
          z.object({
            id: z.string(),
            name: z.string().optional(),
            context_length: z.number().int().optional(),
            pricing: z
              .object({
                prompt: z.string().optional(),
                completion: z.string().optional(),
              })
              .optional(),
            supported_parameters: z.array(z.string()).optional(),
          }),
        ),
      })
      .parse(payload);

    const wanted = new Set(ids ?? []);
    const out = parsed.data
      .filter((m) => (wanted.size > 0 ? wanted.has(m.id) : true))
      .slice(0, limit ?? 25)
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        context_length: m.context_length ?? null,
        pricing: m.pricing ?? null,
        supports_structured_outputs:
          (m.supported_parameters ?? []).includes("structured_outputs") &&
          (m.supported_parameters ?? []).includes("response_format"),
      }));

    return { count: out.length, models: out };
  },
});

export const defaultTools = [timeTool, calculatorTool, openrouterModelsTool];
