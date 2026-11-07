locals {
  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Phase       = "4"
  }
}

# O RDS PostgreSQL, filas SQS e DLQ serão adicionados na fase de infraestrutura.
# Este módulo inicial fixa provider, variáveis e tags sem criar custo na AWS.
