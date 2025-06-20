resource "vercel_project" "policydiff" {
  name            = "policydiff"
  framework       = "nextjs"
  team_id         = var.vercel_team_id
  
  git_repository = {
    type = "github"
    repo = "policydiff/policydiff"
  }
  
  build_command    = "pnpm build"
  dev_command      = "pnpm dev"
  install_command  = "pnpm install"
  output_directory = "apps/web/.next"
  
  environment = [
    {
      key    = "OPENROUTER_API_KEY"
      value  = var.openrouter_api_key
      target = ["production", "preview"]
    },
    {
      key    = "DEFAULT_AI_MODEL"
      value  = var.default_ai_model
      target = ["production", "preview"]
    },
    {
      key    = "NEXT_PUBLIC_API_URL"
      value  = "https://${var.domain_name}/api"
      target = ["production"]
    },
    {
      key    = "CRON_SECRET"
      value  = random_password.cron_secret.result
      target = ["production"]
    },
    {
      key    = "AI_RATE_LIMIT_PER_MINUTE"
      value  = "60"
      target = ["production", "preview"]
    },
    {
      key    = "AI_CACHE_EXPIRY_HOURS"
      value  = "24"
      target = ["production", "preview"]
    }
  ]
}

resource "vercel_project_domain" "policydiff" {
  project_id = vercel_project.policydiff.id
  domain     = var.domain_name
  team_id    = var.vercel_team_id
}

resource "vercel_edge_config" "policydiff" {
  name    = "policydiff-config"
  team_id = var.vercel_team_id
}

resource "vercel_edge_config_item" "companies" {
  edge_config_id = vercel_edge_config.policydiff.id
  key            = "companies"
  value = jsonencode([
    {
      slug         = "google"
      name         = "Google"
      url          = "https://policies.google.com/privacy"
      checkInterval = 3600
      active       = true
    },
    {
      slug         = "facebook"
      name         = "Facebook"
      url          = "https://www.facebook.com/privacy/policy"
      checkInterval = 3600
      active       = true
    },
    {
      slug         = "amazon"
      name         = "Amazon"
      url          = "https://www.amazon.com/gp/help/customer/display.html?nodeId=468496"
      checkInterval = 3600
      active       = true
    },
    {
      slug         = "microsoft"
      name         = "Microsoft"
      url          = "https://privacy.microsoft.com/en-us/privacystatement"
      checkInterval = 3600
      active       = true
    },
    {
      slug         = "apple"
      name         = "Apple"
      url          = "https://www.apple.com/legal/privacy/"
      checkInterval = 3600
      active       = true
    }
  ])
}

resource "random_password" "cron_secret" {
  length  = 32
  special = true
}