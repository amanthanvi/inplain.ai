import { OpenRouter, stepCountIs } from "@openrouter/sdk";
import type { Tool } from "@openrouter/sdk";
import { EventEmitter } from "eventemitter3";

export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export interface AgentConfig {
  apiKey: string;
  model?: string;
  instructions?: string;
  tools?: Tool[];
  maxSteps?: number;
}

export class Agent extends EventEmitter {
  private client: OpenRouter;
  private config: Required<Omit<AgentConfig, "apiKey">> & { apiKey: string };
  private messages: Message[] = [];

  constructor(config: AgentConfig) {
    super();
    this.client = new OpenRouter({ apiKey: config.apiKey });
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? "openrouter/auto",
      instructions: config.instructions ?? "You are a helpful assistant.",
      tools: config.tools ?? [],
      maxSteps: config.maxSteps ?? 5,
    };
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clearHistory(): void {
    this.messages = [];
  }

  setInstructions(instructions: string): void {
    this.config.instructions = instructions;
  }

  addTool(newTool: Tool): void {
    this.config.tools.push(newTool);
  }

  async sendSync(content: string): Promise<string> {
    const userMessage: Message = { role: "user", content };
    this.messages.push(userMessage);
    this.emit("message:user", userMessage);
    this.emit("thinking:start");

    try {
      const result = this.client.callModel({
        model: this.config.model,
        instructions: this.config.instructions,
        input: this.messages.map((m) => ({ role: m.role, content: m.content })),
        tools: this.config.tools.length > 0 ? this.config.tools : undefined,
        stopWhen: [stepCountIs(this.config.maxSteps)],
      });

      const fullText = await result.getText();
      const assistantMessage: Message = { role: "assistant", content: fullText };
      this.messages.push(assistantMessage);
      this.emit("message:assistant", assistantMessage);
      return fullText;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit("error", error);
      throw error;
    } finally {
      this.emit("thinking:end");
    }
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}
