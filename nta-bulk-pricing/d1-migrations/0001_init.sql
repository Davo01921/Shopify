-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" DATETIME
);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "targetType" TEXT NOT NULL,
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiscountTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "ruleId" TEXT NOT NULL,
    CONSTRAINT "DiscountTarget_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DiscountRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscountTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "minimum" INTEGER NOT NULL,
    "maximum" INTEGER,
    "title" TEXT NOT NULL DEFAULT '',
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL,
    "message" TEXT NOT NULL DEFAULT '',
    "ruleId" TEXT NOT NULL,
    CONSTRAINT "DiscountTier_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DiscountRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscountDeployment" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "discountId" TEXT,
    "configHash" TEXT,
    "configJson" TEXT,
    "ruleCount" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "DiscountRule_shop_enabled_priority_idx" ON "DiscountRule"("shop", "enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountTarget_ruleId_shopifyId_key" ON "DiscountTarget"("ruleId", "shopifyId");

-- CreateIndex
CREATE INDEX "DiscountTier_ruleId_minimum_idx" ON "DiscountTier"("ruleId", "minimum");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountTier_ruleId_minimum_key" ON "DiscountTier"("ruleId", "minimum");

