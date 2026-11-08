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
variable "vpc_id" {
  type        = string
  description = "VPC compartilhada do EKS; o banco permanece privado."
}
variable "private_subnet_ids" {
  type        = list(string)
  description = "Sub-redes privadas em ao menos duas zonas de disponibilidade."
}
variable "allowed_security_group_ids" {
  type        = set(string)
  description = "Security groups dos workloads autorizados a acessar o PostgreSQL."
}
