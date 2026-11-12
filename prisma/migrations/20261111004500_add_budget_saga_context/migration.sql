ALTER TABLE "Budget"
ADD COLUMN "sagaId" TEXT,
ADD COLUMN "correlationId" TEXT;

CREATE INDEX "Budget_sagaId_idx" ON "Budget"("sagaId");
