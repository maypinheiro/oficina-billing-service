variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "environment" {
  type    = string
  default = "hml"
}
variable "project" {
  type    = string
  default = "oficina-billing"
}
variable "domain_events_topic_arn" {
  type        = string
  description = "ARN do topico SNS de eventos de dominio criado pelo OS Service."
}
