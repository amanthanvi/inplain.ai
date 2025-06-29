// Central library for managing AI prompts

import { OpenAITool } from "../unified-ai-service";

export interface SystemPersona {
  id: string;
  description: string;
  content: string; // The actual system prompt text
}

export interface TaskPrompt {
  id: string;
  description: string;
  // The user-facing prompt text. This text will guide the AI on what to do.
  // It should instruct the AI to use a specific tool if structured output is needed.
  promptTemplate: (context: any) => string; // Function to generate prompt with context
  // Associated tool definition for structured output.
  // If the task doesn't require structured output, this can be omitted.
  associatedTool?: OpenAITool;
  // Recommended model configurations, e.g., performanceTier or specific models
  defaultModelConfig?: {
    performanceTier?: 'fast' | 'balanced' | 'advanced' | 'specialized';
    specificModelId?: string;
  };
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

import { ALL_SYSTEM_PERSONAS } from "./system-personas";
import { ALL_TASK_PROMPTS } from "./task-prompts";

export class PromptLibrary {
  private systemPersonas: Map<string, SystemPersona> = new Map();
  private taskPrompts: Map<string, TaskPrompt> = new Map();

  constructor() {
    this.loadSystemPersonas();
    this.loadTaskPrompts();
  }

  private loadSystemPersonas(): void {
    ALL_SYSTEM_PERSONAS.forEach(persona => {
      if (this.systemPersonas.has(persona.id)) {
        console.warn(`Duplicate system persona ID found: ${persona.id}. Overwriting.`);
      }
      this.systemPersonas.set(persona.id, persona);
    });
  }

  private loadTaskPrompts(): void {
    ALL_TASK_PROMPTS.forEach(task => {
      if (this.taskPrompts.has(task.id)) {
        console.warn(`Duplicate task prompt ID found: ${task.id}. Overwriting.`);
      }
      this.taskPrompts.set(task.id, task);
    });
  }

  getSystemPersona(id: string): SystemPersona | undefined {
    return this.systemPersonas.get(id);
  }

  getTaskPrompt(id: string): TaskPrompt | undefined {
    return this.taskPrompts.get(id);
  }

  // Method to prepare a full request for UnifiedAIService
  prepareAIRequest(
    taskPromptId: string,
    personaId: string | null,
    promptContext: any,
  ): { systemPrompt?: string; userPrompt: string; tool?: OpenAITool, modelConfig?: any, temperature?: number, maxTokens?: number, toolChoice?: any } | undefined {
    const task = this.getTaskPrompt(taskPromptId);
    if (!task) {
      console.error(`Task prompt with id "${taskPromptId}" not found.`);
      return undefined;
    }

    let systemPromptContent: string | undefined;
    if (personaId) {
      const persona = this.getSystemPersona(personaId);
      if (!persona) {
        console.warn(`System persona with id "${personaId}" not found.`);
      } else {
        systemPromptContent = persona.content;
      }
    }

    const userPrompt = task.promptTemplate(promptContext);

    return {
      systemPrompt: systemPromptContent,
      userPrompt: userPrompt,
      tool: task.associatedTool,
      toolChoice: task.associatedTool ? { type: "function", function: { name: task.associatedTool.function.name } } : undefined,
      modelConfig: task.defaultModelConfig,
      temperature: task.defaultTemperature,
      maxTokens: task.defaultMaxTokens,
    };
  }
}

// Singleton instance
let libraryInstance: PromptLibrary | null = null;

export function getPromptLibrary(): PromptLibrary {
  if (!libraryInstance) {
    libraryInstance = new PromptLibrary();
  }
  return libraryInstance;
}
