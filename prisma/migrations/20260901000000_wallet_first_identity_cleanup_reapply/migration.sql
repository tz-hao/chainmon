ALTER TABLE "users"
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "privyDid",
  DROP COLUMN IF EXISTS "walletNonce",
  DROP COLUMN IF EXISTS "walletNonceExpiresAt";

ALTER TABLE "users"
  ALTER COLUMN "walletAddress" SET NOT NULL;
