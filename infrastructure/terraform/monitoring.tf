resource "aws_cloudwatch_log_group" "policydiff" {
  name              = "/aws/lambda/policydiff-${var.environment}"
  retention_in_days = 30
}

resource "aws_sns_topic" "alerts" {
  name = "policydiff-alerts-${var.environment}"
}

resource "aws_sns_topic_subscription" "alert_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "policydiff-high-error-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = "policydiff-${var.environment}"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_duration" {
  alarm_name          = "policydiff-high-duration-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "3000"
  alarm_description   = "This metric monitors function duration"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = "policydiff-${var.environment}"
  }
}