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
output "messages_queue_url" { value = aws_sqs_queue.messages.url }
output "messages_queue_arn" { value = aws_sqs_queue.messages.arn }
output "messages_dlq_url" { value = aws_sqs_queue.messages_dlq.url }
