import { PrismaClient } from "@prisma/client";

// Singleton Prisma client to avoid exhausting DB connections during dev HMR.
// Phase 1: imported but not yet queried by any page (no DB access at build time).

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
