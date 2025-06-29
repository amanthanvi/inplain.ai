// Defines tools for policy analysis, to be used with UnifiedAIService

import { OpenAITool, OpenAIFunctionParameters } from "../unified-ai-service";

export const POLICY_ANALYSIS_TOOL_NAME = "extract_policy_analysis";

const policyAnalysisParameters: OpenAIFunctionParameters = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "A 2-3 sentence summary of what changed in the policy.",
    },
    key_highlights: {
      type: "array",
      description: "Up to 5 most important changes.",
      items: {
        type: "string",
      },
    },
    risk_assessment: {
      type: "string",
      description: "Overall risk assessment of the policy changes.",
      enum: ["low", "medium", "high"],
    },
    categories: {
      type: "array",
      description: "Relevant categories for the policy changes.",
      items: {
        type: "string",
        enum: [
          "data_collection",
          "data_sharing",
          "data_retention",
          "user_rights",
          "security",
          "cookies_tracking", // Renamed for clarity from 'cookies'
          "third_parties",
          "childrens_privacy", // Renamed for clarity from 'children'
          "policy_scope_changes",
          "user_consent_changes",
          "data_transfer_changes",
          "other",
        ],
      },
    },
    detailed_changes: {
        type: "array",
        description: "A list of specific changes found in the policy.",
        items: {
            type: "object",
            properties: {
                area_of_change: {
                    type: "string",
                    description: "The section or aspect of the policy that changed (e.g., 'Data Collection - Personal Information')."
                },
                description_of_change: {
                    type: "string",
                    description: "A detailed description of what specifically changed."
                },
                implication_for_user: {
                    type: "string",
                    description: "How this change impacts the user's privacy or rights."
                },
                sentiment: {
                    type: "string",
                    description: "The sentiment of the change from a user privacy perspective.",
                    enum: ["positive", "negative", "neutral", "mixed"]
                }
            },
            required: ["area_of_change", "description_of_change", "implication_for_user", "sentiment"]
        }
    }
  },
  required: ["summary", "key_highlights", "risk_assessment", "categories", "detailed_changes"],
};

export const policyAnalysisTool: OpenAITool = {
  type: "function",
  function: {
    name: POLICY_ANALYSIS_TOOL_NAME,
    description: "Extracts structured information about privacy policy changes.",
    parameters: policyAnalysisParameters,
  },
};

// Example of how you might call this with UnifiedAIService:
/*
async function analyzePolicyWithTool(service: UnifiedAIService, policyDiffText: string) {
  const systemPrompt = "You are an expert privacy policy analyst. Your role is to analyze changes to privacy policies and terms of service documents, providing clear, accurate assessments of how changes affect user privacy and rights. Focus on practical implications for users, use clear language, assess privacy risks objectively, categorize changes, and highlight the most important changes. Use the provided tool to structure your output.";

  const request: UnifiedAIRequest = {
    prompt: `Analyze the following privacy policy changes and extract the information using the provided tool:\n\n${policyDiffText}`,
    systemPrompt: systemPrompt,
    tools: [policyAnalysisTool],
    toolChoice: { type: "function", function: { name: POLICY_ANALYSIS_TOOL_NAME } }, // Force the model to use this tool
    modelConfig: { performanceTier: "balanced" }, // Or specific model known for good tool use
    temperature: 0.1, // Low temperature for structured output
  };

  try {
    const response = await service.request(request);
    if (response.toolCalls && response.toolCalls.length > 0) {
      const toolCall = response.toolCalls[0];
      if (toolCall.function.name === POLICY_ANALYSIS_TOOL_NAME && toolCall.function.arguments) {
        const analysisResult = JSON.parse(toolCall.function.arguments);
        console.log("Structured Analysis Result:", analysisResult);
        // Now you have a clean JavaScript object, no more brittle parsing!
        // analysisResult.summary, analysisResult.key_highlights, etc.
        return analysisResult;
      }
    } else if (response.content) {
      console.warn("Model did not use the tool, returned text content:", response.content);
      // Fallback logic or error
    } else {
      console.error("No tool call or content in response", response);
    }
  } catch (error) {
    console.error("Error analyzing policy with tool:", error);
    throw error;
  }
}
*/
