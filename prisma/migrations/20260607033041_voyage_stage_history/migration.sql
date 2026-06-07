-- CreateTable
CREATE TABLE "VoyageStageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "toStage" TEXT NOT NULL,
    "fromStage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voyageId" TEXT NOT NULL,
    CONSTRAINT "VoyageStageEvent_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VoyageStageEvent_voyageId_idx" ON "VoyageStageEvent"("voyageId");

-- CreateIndex
CREATE INDEX "VoyageStageEvent_createdAt_idx" ON "VoyageStageEvent"("createdAt");
