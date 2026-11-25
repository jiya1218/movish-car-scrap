import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function resolveVercelDatabaseUrl(): string | undefined {
  if (!process.env.VERCEL) {
    return undefined;
  }
  const configured = process.env.DATABASE_URL;
  if (configured && !configured.startsWith("file:")) {
    return configured;
  }

  const tmpDbPath = path.join(
    process.platform === "win32" ? os.tmpdir() : "/tmp",
    "movish-bms.db",
  );
  if (!fs.existsSync(tmpDbPath)) {
    const candidates = [
      path.join(process.cwd(), "prisma", "clean-template.db"),
      path.join(process.cwd(), "prisma", "movish-bms.db"),
    ];
    for (const src of candidates) {
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, tmpDbPath);
        break;
      }
    }
  }
  return `file:${tmpDbPath}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const resolvedUrl = resolveVercelDatabaseUrl();

/**
 * Shared Prisma client instance across server routes and components.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
