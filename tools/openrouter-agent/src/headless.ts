import { createAgent } from "./agent.js";
import { defaultTools } from "./tools.js";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

async function runOnce(prompt: string): Promise<void> {
  const agent = createAgent({
    apiKey: requiredEnv("OPENROUTER_API_KEY"),
    model: process.env.OPENROUTER_MODEL ?? "openrouter/auto",
    instructions:
      "You are a practical engineering research assistant. " +
      "Prefer concrete recommendations, model IDs, costs, and constraints.",
    tools: defaultTools,
    maxSteps: 8,
  });

  agent.on("thinking:start", () => console.error("[thinking]"));
  agent.on("error", (err: Error) => console.error(`[error] ${err.message}`));

  const out = await agent.sendSync(prompt);
  process.stdout.write(out.trimEnd() + "\n");
}

async function interactive(): Promise<void> {
  const agent = createAgent({
    apiKey: requiredEnv("OPENROUTER_API_KEY"),
    model: process.env.OPENROUTER_MODEL ?? "openrouter/auto",
    instructions: "You are a helpful assistant with access to tools.",
    tools: defaultTools,
    maxSteps: 6,
  });

  agent.on("thinking:start", () => console.error("[thinking]"));
  agent.on("error", (err: Error) => console.error(`[error] ${err.message}`));

  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("Agent ready. Type your message (Ctrl+C to exit).\n");

  const ask = () => {
    rl.question("You: ", async (input: string) => {
      if (!input.trim()) {
        ask();
        return;
      }

      const out = await agent.sendSync(input);
      console.log(`\nAssistant: ${out.trim()}\n`);
      ask();
    });
  };

  ask();
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));

  if (args.has("--recommend-inplain")) {
    await runOnce(
      [
        "We are building Inplain.ai: a privacy policy change tracker.",
        "Recommend an LLM model policy for: (1) diff meaningfulness classification (cheap) and (2) citation-backed summaries.",
        "We use OpenRouter. Use the openrouter_models tool to fetch current pricing.",
        "Output: a tier table (Free/Pro/Business) with model chains, max_tokens, and brief rationale.",
      ].join("\n"),
    );
    return;
  }

  await interactive();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
