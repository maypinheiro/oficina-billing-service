CREATE TYPE "BudgetStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'); -- NOSONAR: immutable database migration intentionally repeats status literals
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

CREATE TABLE "Budget" (
  "id" TEXT PRIMARY KEY,
  "externalOrderId" TEXT NOT NULL UNIQUE,
  "externalOrderNumber" TEXT NOT NULL,
  "status" "BudgetStatus" NOT NULL DEFAULT 'PENDING',
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Budget_status_createdAt_idx" ON "Budget"("status", "createdAt");

CREATE TABLE "BudgetService" (
  "id" TEXT PRIMARY KEY,
  "budgetId" TEXT NOT NULL REFERENCES "Budget"("id") ON DELETE CASCADE,
  "externalItemId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  UNIQUE ("budgetId", "externalItemId")
);

CREATE TABLE "BudgetPart" (
  "id" TEXT PRIMARY KEY,
  "budgetId" TEXT NOT NULL REFERENCES "Budget"("id") ON DELETE CASCADE,
  "externalItemId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "quantity" INTEGER NOT NULL,
  UNIQUE ("budgetId", "externalItemId")
);

CREATE TABLE "Payment" (
  "id" TEXT PRIMARY KEY,
  "budgetId" TEXT NOT NULL REFERENCES "Budget"("id"),
  "externalPaymentId" TEXT UNIQUE,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "provider" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Payment_budgetId_status_idx" ON "Payment"("budgetId", "status");

CREATE TABLE "OutboxMessage" (
  "id" TEXT PRIMARY KEY, "aggregateId" TEXT NOT NULL, "type" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "payload" JSONB NOT NULL,
  "correlationId" TEXT NOT NULL, "sagaId" TEXT, "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "publishedAt" TIMESTAMP(3)
);
CREATE INDEX "OutboxMessage_status_nextAttemptAt_createdAt_idx" ON "OutboxMessage"("status", "nextAttemptAt", "createdAt");

CREATE TABLE "InboxMessage" (
  "messageId" TEXT PRIMARY KEY, "type" TEXT NOT NULL, "correlationId" TEXT NOT NULL,
  "sagaId" TEXT, "payloadHash" TEXT NOT NULL, "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "InboxMessage_correlationId_processedAt_idx" ON "InboxMessage"("correlationId", "processedAt");
