variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vercel_api_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Vercel team ID"
  type        = string
}

variable "openrouter_api_key" {
  description = "OpenRouter API key for AI models"
  type        = string
  sensitive   = true
}

variable "default_ai_model" {
  description = "Default AI model to use"
  type        = string
  default     = "google/gemini-2.5-flash-preview-05-20"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "inplain.ai"
}

variable "alert_email" {
  description = "Email for alerts"
  type        = string
}