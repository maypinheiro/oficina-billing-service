resource "random_password" "database" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "billing" {
  name       = "${var.project}-${var.environment}"
  subnet_ids = var.private_subnet_ids
  tags       = local.common_tags
}

resource "aws_security_group" "database" {
  name        = "${var.project}-${var.environment}-postgresql"
  description = "PostgreSQL privado e exclusivo do Billing Service"
  vpc_id      = var.vpc_id
  tags        = local.common_tags
}

resource "aws_vpc_security_group_ingress_rule" "database" {
  for_each = var.allowed_security_group_ids

  security_group_id            = aws_security_group.database.id
  referenced_security_group_id = each.value
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_db_parameter_group" "billing" {
  name   = "${var.project}-${var.environment}-postgres16"
  family = "postgres16"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  tags = local.common_tags
}

resource "aws_db_instance" "billing" {
  identifier = "${var.project}-${var.environment}-postgresql"

  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t3.micro"
  db_name        = "billing"
  username       = "billing_admin"
  password       = random_password.database.result

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.billing.name
  vpc_security_group_ids = [aws_security_group.database.id]
  parameter_group_name   = aws_db_parameter_group.billing.name
  publicly_accessible    = false

  backup_retention_period      = 7
  skip_final_snapshot          = true
  apply_immediately            = true
  auto_minor_version_upgrade   = true
  performance_insights_enabled = true
  tags                         = local.common_tags
}

resource "aws_secretsmanager_secret" "database" {
  name                    = "${var.project}-${var.environment}/database"
  recovery_window_in_days = 7
  tags                    = local.common_tags
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    BILLING_DATABASE_URL = "postgresql://${aws_db_instance.billing.username}:${random_password.database.result}@${aws_db_instance.billing.address}:${aws_db_instance.billing.port}/${aws_db_instance.billing.db_name}?sslmode=require"
  })
}

output "database_instance_identifier" {
  value = aws_db_instance.billing.identifier
}

output "database_secret_arn" {
  value = aws_secretsmanager_secret.database.arn
}
