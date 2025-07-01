import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// GET /api/v1/docs
export async function GET(request: NextRequest) {
	const openApiSpec = {
		openapi: "3.0.0",
		info: {
			title: "Inplain.ai API",
			version: "1.0.0",
			description:
				"API for accessing privacy policy monitoring and analysis services",
			contact: {
				name: "Inplain.ai Support",
				email: "support@inplain.ai",
				url: "https://inplain.ai/support",
			},
			license: {
				name: "MIT",
				url: "https://opensource.org/licenses/MIT",
			},
		},
		servers: [
			{
				url: "https://inplain.ai/api/v1",
				description: "Production server",
			},
			{
				url: "http://localhost:3000/api/v1",
				description: "Development server",
			},
		],
		tags: [
			{
				name: "Companies",
				description: "Company information and privacy policies",
			},
			{
				name: "Policies",
				description: "Policy analysis and summarization",
			},
			{
				name: "Changes",
				description: "Policy change tracking",
			},
			{
				name: "Watchlist",
				description: "User watchlist management",
			},
			{
				name: "Notifications",
				description: "Notification preferences",
			},
		],
		security: [
			{
				apiKey: [],
			},
		],
		components: {
			securitySchemes: {
				apiKey: {
					type: "apiKey",
					in: "header",
					name: "x-api-key",
					description: "API key for authentication",
				},
			},
			schemas: {
				Error: {
					type: "object",
					properties: {
						error: {
							type: "string",
							description: "Error message",
						},
						code: {
							type: "string",
							description: "Error code",
						},
						details: {
							type: "object",
							description: "Additional error details",
						},
					},
					required: ["error", "code"],
				},
				Company: {
					type: "object",
					properties: {
						slug: { type: "string" },
						name: { type: "string" },
						description: { type: "string" },
						category: { type: "string" },
						website: { type: "string" },
						privacyPolicyUrl: { type: "string" },
						lastChecked: { type: "string", format: "date-time" },
						metadata: {
							type: "object",
							properties: {
								headquarters: { type: "string" },
								founded: { type: "number" },
								employees: { type: "string" },
							},
						},
					},
				},
				PolicySummary: {
					type: "object",
					properties: {
						executive: { type: "string" },
						keyPoints: {
							type: "array",
							items: { type: "string" },
						},
						dataCollection: {
							type: "object",
							properties: {
								types: {
									type: "array",
									items: { type: "string" },
								},
								purposes: {
									type: "array",
									items: { type: "string" },
								},
								retention: { type: "string" },
							},
						},
						userRights: {
							type: "array",
							items: { type: "string" },
						},
						risks: {
							type: "object",
							properties: {
								level: {
									type: "string",
									enum: ["low", "medium", "high"],
								},
								factors: {
									type: "array",
									items: { type: "string" },
								},
							},
						},
						recommendations: {
							type: "array",
							items: { type: "string" },
						},
						readingTime: { type: "number" },
						complexity: {
							type: "string",
							enum: ["simple", "moderate", "complex"],
						},
					},
				},
				PolicyChange: {
					type: "object",
					properties: {
						companySlug: { type: "string" },
						url: { type: "string" },
						previousHash: { type: "string" },
						currentHash: { type: "string" },
						changeType: {
							type: "string",
							enum: ["content", "structure", "minor"],
						},
						changedSections: {
							type: "array",
							items: { type: "string" },
						},
						timestamp: { type: "string", format: "date-time" },
						company: {
							type: "object",
							properties: {
								name: { type: "string" },
								slug: { type: "string" },
								category: { type: "string" },
								logo: { type: "string" },
							},
						},
						severity: {
							type: "string",
							enum: ["minor", "significant", "critical"],
						},
						diffUrl: { type: "string" },
					},
				},
				Watchlist: {
					type: "object",
					properties: {
						id: { type: "string" },
						name: { type: "string" },
						description: { type: "string" },
						settings: {
							type: "object",
							properties: {
								emailAlerts: { type: "boolean" },
								webhookEnabled: { type: "boolean" },
								alertThreshold: {
									type: "string",
									enum: ["any", "significant", "critical"],
								},
							},
						},
						companies: {
							type: "array",
							items: {
								type: "object",
								properties: {
									slug: { type: "string" },
									name: { type: "string" },
									addedAt: {
										type: "string",
										format: "date-time",
									},
									lastChecked: {
										type: "string",
										format: "date-time",
									},
									lastChange: {
										type: "string",
										format: "date-time",
									},
									tags: {
										type: "array",
										items: { type: "string" },
									},
									customNotes: { type: "string" },
								},
							},
						},
						stats: {
							type: "object",
							properties: {
								totalCompanies: { type: "number" },
								createdAt: {
									type: "string",
									format: "date-time",
								},
								updatedAt: {
									type: "string",
									format: "date-time",
								},
							},
						},
					},
				},
				NotificationPreferences: {
					type: "object",
					properties: {
						channels: {
							type: "object",
							properties: {
								email: { type: "boolean" },
								push: { type: "boolean" },
								inApp: { type: "boolean" },
								sound: { type: "boolean" },
							},
						},
						quietHours: {
							type: "object",
							properties: {
								enabled: { type: "boolean" },
								start: {
									type: "string",
									pattern: "^[0-2][0-9]:[0-5][0-9]$",
								},
								end: {
									type: "string",
									pattern: "^[0-2][0-9]:[0-5][0-9]$",
								},
							},
						},
						subscriptions: {
							type: "array",
							items: {
								type: "object",
								properties: {
									companySlug: { type: "string" },
									companyName: { type: "string" },
									notificationTypes: {
										type: "array",
										items: {
											type: "string",
											enum: [
												"policy-change",
												"risk-alert",
												"analysis-complete",
												"system",
											],
										},
									},
									severityLevels: {
										type: "array",
										items: {
											type: "string",
											enum: [
												"critical",
												"warning",
												"info",
												"success",
											],
										},
									},
									deliveryChannels: {
										type: "array",
										items: {
											type: "string",
											enum: ["email", "push", "in-app"],
										},
									},
								},
							},
						},
					},
				},
			},
			responses: {
				UnauthorizedError: {
					description: "Authentication required",
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							example: {
								error: "Invalid or missing API key",
								code: "AUTHENTICATION_ERROR",
							},
						},
					},
				},
				RateLimitError: {
					description: "Rate limit exceeded",
					headers: {
						"Retry-After": {
							description: "Seconds until rate limit resets",
							schema: { type: "integer" },
						},
					},
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							example: {
								error: "Too many requests",
								code: "RATE_LIMIT_EXCEEDED",
								details: { retryAfter: 3600 },
							},
						},
					},
				},
				ValidationError: {
					description: "Invalid request data",
					content: {
						"application/json": {
							schema: {
								$ref: "#/components/schemas/Error",
							},
							example: {
								error: "Validation failed",
								code: "VALIDATION_ERROR",
								details: [
									{
										path: ["policyText"],
										message:
											"String must contain at least 100 character(s)",
									},
								],
							},
						},
					},
				},
			},
		},
		paths: {
			"/companies/{slug}": {
				get: {
					tags: ["Companies"],
					summary: "Get company information",
					description:
						"Retrieve detailed information about a specific company",
					parameters: [
						{
							name: "slug",
							in: "path",
							required: true,
							description: "Company slug identifier",
							schema: { type: "string" },
						},
					],
					responses: {
						"200": {
							description:
								"Company information retrieved successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											success: { type: "boolean" },
											data: {
												$ref: "#/components/schemas/Company",
											},
											cached: { type: "boolean" },
										},
									},
								},
							},
						},
						"401": {
							$ref: "#/components/responses/UnauthorizedError",
						},
						"404": {
							description: "Company not found",
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/Error",
									},
								},
							},
						},
					},
				},
			},
			"/policies/summarize": {
				post: {
					tags: ["Policies"],
					summary: "Summarize a privacy policy",
					description:
						"Generate an AI-powered summary of a privacy policy text",
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										policyText: {
											type: "string",
											minLength: 100,
											maxLength: 100000,
											description:
												"The privacy policy text to summarize",
										},
										options: {
											type: "object",
											properties: {
												companyName: { type: "string" },
												industry: { type: "string" },
												targetAudience: {
													type: "string",
													enum: [
														"general",
														"technical",
														"legal",
													],
												},
												language: { type: "string" },
											},
										},
									},
									required: ["policyText"],
								},
							},
						},
					},
					responses: {
						"200": {
							description: "Policy summarized successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											success: { type: "boolean" },
											data: {
												$ref: "#/components/schemas/PolicySummary",
											},
											metadata: {
												type: "object",
												properties: {
													timestamp: {
														type: "string",
														format: "date-time",
													},
													version: { type: "string" },
												},
											},
										},
									},
								},
							},
						},
						"400": {
							$ref: "#/components/responses/ValidationError",
						},
						"401": {
							$ref: "#/components/responses/UnauthorizedError",
						},
						"429": {
							$ref: "#/components/responses/RateLimitError",
						},
					},
				},
			},
			"/changes/recent": {
				get: {
					tags: ["Changes"],
					summary: "Get recent policy changes",
					description:
						"Retrieve recent policy changes across all monitored companies",
					parameters: [
						{
							name: "limit",
							in: "query",
							description: "Number of results to return (1-100)",
							schema: {
								type: "integer",
								minimum: 1,
								maximum: 100,
								default: 10,
							},
						},
						{
							name: "offset",
							in: "query",
							description: "Number of results to skip",
							schema: { type: "integer", minimum: 0, default: 0 },
						},
						{
							name: "severity",
							in: "query",
							description: "Filter by change severity",
							schema: {
								type: "string",
								enum: [
									"all",
									"minor",
									"significant",
									"critical",
								],
								default: "all",
							},
						},
						{
							name: "companySlug",
							in: "query",
							description: "Filter by company",
							schema: { type: "string" },
						},
						{
							name: "startDate",
							in: "query",
							description: "Start date for filtering (ISO 8601)",
							schema: { type: "string", format: "date-time" },
						},
						{
							name: "endDate",
							in: "query",
							description: "End date for filtering (ISO 8601)",
							schema: { type: "string", format: "date-time" },
						},
					],
					responses: {
						"200": {
							description:
								"Recent changes retrieved successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											success: { type: "boolean" },
											data: {
												type: "array",
												items: {
													$ref: "#/components/schemas/PolicyChange",
												},
											},
											pagination: {
												type: "object",
												properties: {
													limit: { type: "integer" },
													offset: { type: "integer" },
													total: { type: "integer" },
													hasMore: {
														type: "boolean",
													},
												},
											},
											metadata: {
												type: "object",
												properties: {
													timestamp: {
														type: "string",
														format: "date-time",
													},
													version: { type: "string" },
												},
											},
										},
									},
								},
							},
						},
						"400": {
							$ref: "#/components/responses/ValidationError",
						},
						"401": {
							$ref: "#/components/responses/UnauthorizedError",
						},
						"429": {
							$ref: "#/components/responses/RateLimitError",
						},
					},
				},
			},
			"/watchlist": {
				get: {
					tags: ["Watchlist"],
					summary: "Get user watchlists",
					description:
						"Retrieve all watchlists for the authenticated user",
					responses: {
						"200": {
							description: "Watchlists retrieved successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											success: { type: "boolean" },
											data: {
												type: "array",
												items: {
													$ref: "#/components/schemas/Watchlist",
												},
											},
											metadata: {
												type: "object",
												properties: {
													timestamp: {
														type: "string",
														format: "date-time",
													},
													version: { type: "string" },
												},
											},
										},
									},
								},
							},
						},
						"401": {
							$ref: "#/components/responses/UnauthorizedError",
						},
						"429": {
							$ref: "#/components/responses/RateLimitError",
						},
					},
				},
				post: {
					tags: ["Watchlist"],
					summary: "Manage watchlist",
					description:
						"Create watchlist, add/remove companies from watchlist",
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									oneOf: [
										{
											type: "object",
											properties: {
												action: {
													type: "string",
													enum: ["create"],
												},
												name: {
													type: "string",
													minLength: 1,
													maxLength: 100,
												},
												description: {
													type: "string",
													maxLength: 500,
												},
												emailAlerts: {
													type: "boolean",
												},
												alertThreshold: {
													type: "string",
													enum: [
														"any",
														"significant",
														"critical",
													],
												},
											},
											required: ["action", "name"],
										},
										{
											type: "object",
											properties: {
												action: {
													type: "string",
													enum: ["add"],
												},
												companySlug: {
													type: "string",
													minLength: 1,
												},
												watchlistId: { type: "string" },
												tags: {
													type: "array",
													items: { type: "string" },
												},
												customNotes: {
													type: "string",
													maxLength: 1000,
												},
											},
											required: ["action", "companySlug"],
										},
										{
											type: "object",
											properties: {
												action: {
													type: "string",
													enum: ["remove"],
												},
												companySlug: {
													type: "string",
													minLength: 1,
												},
												watchlistId: { type: "string" },
											},
											required: ["action", "companySlug"],
										},
									],
								},
							},
						},
					},
					responses: {
						"200": {
							description: "Watchlist operation successful",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											success: { type: "boolean" },
											data: { type: "object" },
											metadata: {
												type: "object",
												properties: {
													timestamp: {
														type: "string",
														format: "date-time",
													},
													version: { type: "string" },
												},
											},
										},
									},
								},
							},
						},
						"400": {
							$ref: "#/components/responses/ValidationError",
						},
						"401": {
							$ref: "#/components/responses/UnauthorizedError",
						},
						"404": {
							description: "Resource not found",
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/Error",
									},
								},
							},
						},
						"409": {
							description: "Conflict",
							content: {
								"application/json": {
									schema: {
										$ref: "#/components/schemas/Error",
									},
								},
							},
						},
						"429": {
							$ref: "#/components/responses/RateLimitError",
						},
					},
				},
			},
			"/notifications/settings": {
				get: {
					tags: ["Notifications"],
					summary: "Get notification preferences",
					description:
						"Retrieve notification preferences for the authenticated user",
					responses: {
						"200": {
							description: "Preferences retrieved successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											success: { type: "boolean" },
											data: {
												$ref: "#/components/schemas/NotificationPreferences",
											},
											metadata: {
												type: "object",
												properties: {
													timestamp: {
														type: "string",
														format: "date-time",
													},
													version: { type: "string" },
												},
											},
										},
									},
								},
							},
						},
						"401": {
							$ref: "#/components/responses/UnauthorizedError",
						},
						"429": {
							$ref: "#/components/responses/RateLimitError",
						},
					},
				},
				put: {
					tags: ["Notifications"],
					summary: "Update notification preferences",
					description:
						"Update notification preferences for the authenticated user",
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										channels: {
											type: "object",
											properties: {
												email: { type: "boolean" },
												push: { type: "boolean" },
												inApp: { type: "boolean" },
												sound: { type: "boolean" },
											},
										},
										quietHours: {
											type: "object",
											properties: {
												enabled: { type: "boolean" },
												start: {
													type: "string",
													pattern:
														"^[0-2][0-9]:[0-5][0-9]$",
												},
												end: {
													type: "string",
													pattern:
														"^[0-2][0-9]:[0-5][0-9]$",
												},
											},
										},
										subscriptions: {
											type: "array",
											items: {
												type: "object",
												properties: {
													companySlug: {
														type: "string",
													},
													companyName: {
														type: "string",
													},
													notificationTypes: {
														type: "array",
														items: {
															type: "string",
														},
													},
													severityLevels: {
														type: "array",
														items: {
															type: "string",
														},
													},
													deliveryChannels: {
														type: "array",
														items: {
															type: "string",
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
					responses: {
						"200": {
							description: "Preferences updated successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											success: { type: "boolean" },
											data: {
												$ref: "#/components/schemas/NotificationPreferences",
											},
											metadata: {
												type: "object",
												properties: {
													timestamp: {
														type: "string",
														format: "date-time",
													},
													version: { type: "string" },
												},
											},
										},
									},
								},
							},
						},
						"401": {
							$ref: "#/components/responses/UnauthorizedError",
						},
						"429": {
							$ref: "#/components/responses/RateLimitError",
						},
					},
				},
			},
		},
	};

	return NextResponse.json(openApiSpec, {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600", // Cache for 1 hour
		},
	});
}
