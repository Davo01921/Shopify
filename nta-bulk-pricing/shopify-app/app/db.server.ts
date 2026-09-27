import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var ntaBulkPricingPrisma: PrismaClient | undefined;
}

const prisma =
  global.ntaBulkPricingPrisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.ntaBulkPricingPrisma = prisma;
}

export default prisma;
