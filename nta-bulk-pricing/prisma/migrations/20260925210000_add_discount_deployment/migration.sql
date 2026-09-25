CREATE TABLE "DiscountDeployment" (
  "shop" TEXT NOT NULL PRIMARY KEY,
  "discountId" TEXT,
  "configHash" TEXT,
  "ruleCount" INTEGER NOT NULL DEFAULT 0,
  "syncedAt" DATETIME,
  "lastError" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
