import { OpenAITool, OpenAIFunctionParameters } from "../unified-ai-service";

export const COMPREHENSIVE_POLICY_ANALYSIS_TOOL_NAME = "extract_comprehensive_policy_analysis";

const comprehensiveAnalysisParameters: OpenAIFunctionParameters = {
  type: "object",
  properties: {
    executive_summary: {
      type: "string",
      description: "2-3 sentence overview capturing the policy's overall approach to privacy, key strengths, and main concerns.",
    },
    key_highlights: {
      type: "array",
      description: "List of the most significant findings (e.g., data collection, user rights, sharing practices).",
      items: { type: "string" },
    },
    data_collected: {
      type: "object",
      description: "Details about the types of data collected.",
      properties: {
        personal_info: { type: "array", items: { type: "string" }, description: "Specific types like name, email, phone, address, SSN, etc." },
        usage_data: { type: "array", items: { type: "string" }, description: "Browsing history, search queries, app usage, interaction data, etc." },
        device_data: { type: "array", items: { type: "string" }, description: "IP address, device ID, browser type, OS, location data, etc." },
        third_party_data: { type: "array", items: { type: "string" }, description: "Data from social media, partners, data brokers, etc." },
      },
    },
    user_rights: {
      type: "array",
      description: "Specific user rights mentioned and how to exercise them.",
      items: {
        type: "object",
        properties: {
            right_name: { type: "string", description: "Name of the right (e.g., Access, Deletion)." },
            description: { type: "string", description: "How to exercise the right and any limitations." },
            geographic_restrictions: { type: "string", description: "Any geographic restrictions, if mentioned." }
        },
        required: ["right_name", "description"]
      }
    },
    data_sharing: {
      type: "object",
      description: "Details about data sharing practices.",
      properties: {
        with_whom: { type: "array", items: { type: "string" }, description: "Specific categories like advertisers, analytics providers, law enforcement, affiliates." },
        purposes: { type: "array", items: { type: "string" }, description: "Purposes for sharing, e.g., advertising, analytics, legal compliance." },
        opt_out_available: { type: "boolean", description: "Is an opt-out available for data sharing?" },
        opt_out_method: { type: "string", description: "How users can opt out if available." },
      },
    },
    retention_period: {
      type: "string",
      description: "Specific timeframes or criteria for data retention.",
    },
    security_measures: {
      type: "array",
      items: {type: "string"},
      description: "Specific security practices mentioned (encryption, access controls, audits, etc.).",
    },
    cookies_tracking: {
      type: "object",
      description: "Information about cookies and tracking technologies.",
      properties: {
        uses_cookies: { type: "boolean" },
        tracking_technologies: { type: "array", items: { type: "string" }, description: "Cookies, pixels, beacons, fingerprinting, etc." },
        third_party_analytics: { type: "boolean" },
        analytics_providers: { type: "array", items: { type: "string" }, description: "Google Analytics, Facebook Pixel, etc. if named." },
      },
    },
    gdpr_compliant: { type: "string", enum: ["compliant", "partially_compliant", "not_compliant", "unclear"], description: "Assessment of GDPR compliance." },
    gdpr_features: { type: "array", items: { type: "string" }, description: "List specific GDPR compliance features if any." },
    ccpa_compliant: { type: "string", enum: ["compliant", "partially_compliant", "not_compliant", "unclear"], description: "Assessment of CCPA/CPRA compliance." },
    ccpa_features: { type: "array", items: { type: "string" }, description: "List specific CCPA/CPRA compliance features if any." },
    contact_info: { type: "string", description: "Privacy contact email, address, or form URL." },
    notable_concerns: {
      type: "array",
      items: { type: "string" },
      description: "Specific concerning practices, missing protections, or vague language.",
    },
    positive_aspects: {
      type: "array",
      items: { type: "string" },
      description: "Strong privacy protections, transparency features, or user-friendly practices.",
    },
    overall_privacy_score: {
      type: "string",
      enum: ["poor", "fair", "good", "excellent"],
      description: "Overall assessment of the policy's privacy implications.",
    },
    score_reasoning: {
      type: "string",
      description: "Brief explanation of the overall privacy score.",
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "Specific actions users should take, settings to review, or rights to exercise.",
    },
  },
  required: [
    "executive_summary", "key_highlights", "data_collected", "user_rights", "data_sharing",
    "retention_period", "security_measures", "cookies_tracking", "contact_info",
    "notable_concerns", "positive_aspects", "overall_privacy_score", "score_reasoning", "recommendations"
  ],
};

export const comprehensivePolicyAnalysisTool: OpenAITool = {
  type: "function",
  function: {
    name: COMPREHENSIVE_POLICY_ANALYSIS_TOOL_NAME,
    description: "Extracts a comprehensive, structured analysis from a privacy policy document.",
    parameters: comprehensiveAnalysisParameters,
  },
};
