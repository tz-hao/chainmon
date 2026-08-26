-- Public Playtest four-world state and wallet-first SIWE challenges.
-- This migration never deletes player data or canonical game definitions.

ALTER TABLE "trainers"
  ADD COLUMN "starterMonsterClaimed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "world_spawns"
  ADD COLUMN "worldMap" TEXT NOT NULL DEFAULT 'whispering-forest';

ALTER TABLE "trainers"
  ALTER COLUMN "worldMap" SET DEFAULT 'whispering-forest';

CREATE TABLE "wallet_login_challenges" (
  "id" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wallet_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallet_login_challenges_nonce_key" ON "wallet_login_challenges"("nonce");
CREATE INDEX "wallet_login_challenges_address_expiresAt_idx" ON "wallet_login_challenges"("address", "expiresAt");
