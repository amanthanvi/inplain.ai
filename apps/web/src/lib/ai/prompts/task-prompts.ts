import { TaskPrompt } from "./prompt-library";
import { policyAnalysisTool, POLICY_ANALYSIS_TOOL_NAME } from "../tools/policy-analysis-tools"; // Assuming this path

// Context interface for this specific task
export interface PolicyDiffContext {
  policyDiffHtml: string; // The HTML diff of the policy
  companyName?: string;
  previousVersionDate?: string;
  newVersionDate?: string;
}

export const ANALYZE_POLICY_CHANGES_TASK: TaskPrompt = {
  id: "analyze-policy-changes-v1",
  description: "Analyzes the textual differences between two versions of a privacy policy and extracts structured information about the changes.",
  promptTemplate: (context: PolicyDiffContext) => {
    let prompt = `Please analyze the following changes to a privacy policy.
Focus on identifying what changed, the potential impact on users, the risk level, and categorize the changes.
Use the provided "${POLICY_ANALYSIS_TOOL_NAME}" tool to structure your entire response.`;

    if (context.companyName) {
      prompt += `\nThese changes are for the company: ${context.companyName}.`;
    }
    if (context.previousVersionDate && context.newVersionDate) {
      prompt += `\nThe policy changed from version dated ${context.previousVersionDate} to ${context.newVersionDate}.`;
    }

    prompt += "\n\nHere is the diff of the policy content:\n```html\n" + context.policyDiffHtml + "\n```";
    return prompt;
  },
  associatedTool: policyAnalysisTool, // Link to the tool definition
  defaultModelConfig: { performanceTier: "balanced" }, // Or a model known for good tool use
  defaultTemperature: 0.1, // Low temperature for factual extraction using tools
  defaultMaxTokens: 2000, // Max tokens for the model's reasoning before calling the tool
};

import { comprehensivePolicyAnalysisTool, COMPREHENSIVE_POLICY_ANALYSIS_TOOL_NAME } from "../tools/comprehensive-analysis-tools";

// Context interface for comprehensive analysis
export interface ComprehensiveAnalysisContext {
  policyHtmlContent: string; // Full HTML content of the policy
  companyName?: string;
  policyTitle?: string;
  policyLastUpdated?: string;
  policyEffectiveDate?: string;
  policyWordCount?: number;
  policySections?: { title: string; characterCount: number }[]; // Summary of sections
}

export const COMPREHENSIVE_ANALYSIS_TASK: TaskPrompt = {
  id: "comprehensive-policy-analysis-v1",
  description: "Performs a comprehensive analysis of a single privacy policy document and extracts structured information.",
  promptTemplate: (context: ComprehensiveAnalysisContext) => {
    let prompt = `Please perform a thorough and comprehensive analysis of the following privacy policy.
Your goal is to help users understand their privacy rights and risks based on this document.
Extract all relevant information using the provided "${COMPREHENSIVE_POLICY_ANALYSIS_TOOL_NAME}" tool to structure your entire response.

Policy Metadata:
${context.companyName ? `- Company: ${context.companyName}` : ''}
${context.policyTitle ? `- Title: ${context.policyTitle}` : ''}
${context.policyLastUpdated ? `- Last Updated: ${context.policyLastUpdated}` : ''}
${context.policyEffectiveDate ? `- Effective Date: ${context.policyEffectiveDate}` : ''}
${context.policyWordCount ? `- Word Count: ${context.policyWordCount}` : ''}
${context.policySections && context.policySections.length > 0 ? `- Key Sections: \n${context.policySections.slice(0,10).map(s => `  - ${s.title} (${s.characterCount} chars)`).join('\n')}`: ''}

The full policy text (extracted from HTML) is provided below. Analyze it carefully.
\n\nPolicy Content:\n${context.policyHtmlContent.substring(0, 30000)} ${context.policyHtmlContent.length > 30000 ? "\n[...content truncated due to length]" : ""}`; // Add truncation notice
// Note: Actual HTML to text conversion and more sophisticated truncation/chunking
// should happen before calling this prompt template, or UnifiedAIService needs to handle it.
// For now, assuming policyHtmlContent is pre-processed text.
    return prompt;
  },
  associatedTool: comprehensivePolicyAnalysisTool,
  defaultModelConfig: { performanceTier: "advanced" }, // Typically needs a powerful model
  defaultTemperature: 0.1,
  defaultMaxTokens: 4000, // Allow more tokens for comprehensive analysis
};


// Add more task prompts as needed
// e.g., for comprehensive analysis of a single policy, quick summary, etc.
// Each would have its own context interface and potentially its own associated tool.

export const ALL_TASK_PROMPTS: TaskPrompt[] = [
  ANALYZE_POLICY_CHANGES_TASK,
  COMPREHENSIVE_ANALYSIS_TASK,
];
