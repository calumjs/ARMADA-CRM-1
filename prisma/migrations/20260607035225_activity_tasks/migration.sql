-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "Activity" ADD COLUMN "dueAt" DATETIME;

-- CreateIndex
CREATE INDEX "Activity_done_dueAt_idx" ON "Activity"("done", "dueAt");
