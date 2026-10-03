CREATE TABLE "DiscountDeployment" (
  "shop" TEXT NOT NULL,
  "discountId" TEXT,
  "configHash" TEXT,
  "ruleCount" INTEGER NOT NULL DEFAULT 0,
  "syncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscountDeployment_pkey" PRIMARY KEY ("shop")
);
