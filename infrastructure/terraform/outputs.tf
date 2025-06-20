output "project_url" {
  description = "The URL of the deployed Vercel project"
  value       = "https://${var.domain_name}"
}

output "vercel_project_id" {
  description = "The ID of the Vercel project"
  value       = vercel_project.policydiff.id
}

output "backup_bucket_name" {
  description = "The name of the S3 backup bucket"
  value       = aws_s3_bucket.backup.id
}

output "alerts_topic_arn" {
  description = "The ARN of the SNS alerts topic"
  value       = aws_sns_topic.alerts.arn
}

output "cron_secret" {
  description = "The secret for authenticating cron jobs"
  value       = random_password.cron_secret.result
  sensitive   = true
}