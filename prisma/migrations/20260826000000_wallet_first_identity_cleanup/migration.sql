-- Wallet-first authentication cleanup.
-- Apply this only through `prisma migrate deploy` to the dedicated public
-- playtest database. It removes unused Privy/Google identity columns; game
-- state, canonical data, Users with wallet identities, and Trainers remain.

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "privyDid",
  DROP COLUMN IF EXISTS "walletNonce",
  DROP COLUMN IF EXISTS "walletNonceExpiresAt";

ALTER TABLE "users"
  ALTER COLUMN "walletAddress" SET NOT NULL;
