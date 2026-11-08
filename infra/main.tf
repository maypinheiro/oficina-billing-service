locals {
  common_tags = { Project = var.project, Environment = var.environment, ManagedBy = "terraform", Phase = "4" }
}
resource "aws_sqs_queue" "messages_dlq" {
  name                      = "${var.project}-${var.environment}-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  tags                      = local.common_tags
}
resource "aws_sqs_queue" "messages" {
  name                       = "${var.project}-${var.environment}-commands"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true
  redrive_policy             = jsonencode({ deadLetterTargetArn = aws_sqs_queue.messages_dlq.arn, maxReceiveCount = 5 })
  tags                       = local.common_tags
}
data "aws_iam_policy_document" "allow_domain_events" {
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.messages.arn]
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [var.domain_events_topic_arn]
    }
  }
}
resource "aws_sqs_queue_policy" "allow_domain_events" {
  queue_url = aws_sqs_queue.messages.id
  policy    = data.aws_iam_policy_document.allow_domain_events.json
}
resource "aws_sns_topic_subscription" "domain_events" {
  topic_arn            = var.domain_events_topic_arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.messages.arn
  raw_message_delivery = true
}
output "messages_queue_url" { value = aws_sqs_queue.messages.url }
output "messages_queue_arn" { value = aws_sqs_queue.messages.arn }
output "messages_dlq_url" { value = aws_sqs_queue.messages_dlq.url }
