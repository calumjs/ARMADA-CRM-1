-- CreateTable
CREATE TABLE "Port" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Captain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "portId" TEXT,
    CONSTRAINT "Captain_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Voyage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'CHARTED',
    "value" INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "expectedClose" DATETIME,
    "closedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "portId" TEXT,
    "captainId" TEXT,
    CONSTRAINT "Voyage_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Voyage_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "Captain" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "portId" TEXT,
    "captainId" TEXT,
    "voyageId" TEXT,
    CONSTRAINT "Activity_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "Captain" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_voyageId_fkey" FOREIGN KEY ("voyageId") REFERENCES "Voyage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Port_name_idx" ON "Port"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Captain_email_key" ON "Captain"("email");

-- CreateIndex
CREATE INDEX "Captain_portId_idx" ON "Captain"("portId");

-- CreateIndex
CREATE INDEX "Captain_lastName_idx" ON "Captain"("lastName");

-- CreateIndex
CREATE INDEX "Voyage_stage_idx" ON "Voyage"("stage");

-- CreateIndex
CREATE INDEX "Voyage_portId_idx" ON "Voyage"("portId");

-- CreateIndex
CREATE INDEX "Voyage_captainId_idx" ON "Voyage"("captainId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_occurredAt_idx" ON "Activity"("occurredAt");

-- CreateIndex
CREATE INDEX "Activity_portId_idx" ON "Activity"("portId");

-- CreateIndex
CREATE INDEX "Activity_captainId_idx" ON "Activity"("captainId");

-- CreateIndex
CREATE INDEX "Activity_voyageId_idx" ON "Activity"("voyageId");
