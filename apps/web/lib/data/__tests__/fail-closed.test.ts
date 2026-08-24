import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Production fail-closed tests (Phase 9, sections 67 / 82):
 * With CHAINMON_DATA_MODE=prisma (or NODE_ENV=production without an explicit
 * memory mode), a database outage must NEVER silently fall back to the
 * in-memory repository. It must fail closed.
 *
 * The Prisma client is mocked to throw — simulating a database outage while
 * the repository resolution code runs for real.
 */

function mockUnreachablePrisma() {
  vi.doMock("@/lib/prisma", () => ({
    prisma: {
      $queryRaw: vi.fn().mockRejectedValue(
        new Error("connect ECONNREFUSED 127.0.0.1:5432"),
      ),
    },
  }));
}

async function loadIndex() {
  vi.resetModules();
  mockUnreachablePrisma();
  return import("@/lib/data");
}

describe("production database fail-closed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CHAINMON_DATA_MODE=prisma + unreachable DB → getRepository rejects (no memory fallback)", async () => {
    process.env.CHAINMON_DATA_MODE = "prisma";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const index = await loadIndex();
    await expect(index.getRepository()).rejects.toThrow(/Database unavailable/);
  });

  it("NODE_ENV=production without explicit mode → fail closed, never memory", async () => {
    vi.resetModules();
    mockUnreachablePrisma();
    delete process.env.CHAINMON_DATA_MODE;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const index = await import("@/lib/data");
    await expect(index.getRepository()).rejects.toThrow(/production requires/);
  });

  it("explicit CHAINMON_DATA_MODE=memory still works in development (fallback is opt-in)", async () => {
    vi.resetModules();
    mockUnreachablePrisma();
    process.env.CHAINMON_DATA_MODE = "memory";
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    const index = await import("@/lib/data");
    const repository = await index.getRepository();
    expect(repository.kind).toBe("memory");
  });
});
