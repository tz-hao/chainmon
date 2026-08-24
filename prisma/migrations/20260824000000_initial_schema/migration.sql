-- CreateEnum
CREATE TYPE "Element" AS ENUM ('FIRE', 'WATER', 'NATURE', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('ACTIVE', 'CAPTURED', 'FLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "walletAddress" TEXT,
    "privyDid" TEXT,
    "walletNonce" TEXT,
    "walletNonceExpiresAt" TIMESTAMP(3),
    "walletVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "battleCount" INTEGER NOT NULL DEFAULT 0,
    "captures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "worldMap" TEXT NOT NULL DEFAULT 'chainmon-valley',
    "worldX" INTEGER NOT NULL DEFAULT 30,
    "worldY" INTEGER NOT NULL DEFAULT 24,
    "lastDailySupplyAt" TIMESTAMP(3),
    "starterSupplyClaimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_spawns" (
    "id" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "zoneId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_spawns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_pickup_claims" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "pickupKey" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "world_pickup_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monster_species" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "element" "Element" NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "baseHp" INTEGER NOT NULL,
    "baseAttack" INTEGER NOT NULL,
    "baseDefense" INTEGER NOT NULL,
    "baseSpeed" INTEGER NOT NULL,
    "catchRate" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "evolvesFromId" INTEGER,
    "evolveLevel" INTEGER,
    "evolveItem" TEXT,

    CONSTRAINT "monster_species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monsters" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "speciesId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "hp" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "dna" JSONB NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "fatherId" TEXT,
    "motherId" TEXT,
    "ownerId" TEXT,
    "onchainOwnerAddress" TEXT,
    "battleCount" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mintStatus" TEXT NOT NULL DEFAULT 'OFFCHAIN',
    "mintTxHash" TEXT,
    "mintChainId" INTEGER,
    "mintContractAddress" TEXT,
    "mintRecipient" TEXT,
    "mintError" TEXT,
    "mintSubmittedAt" TIMESTAMP(3),
    "mintConfirmedAt" TIMESTAMP(3),
    "mintUpdatedAt" TIMESTAMP(3),
    "ownershipMismatch" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "monsters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "element" "Element" NOT NULL,
    "power" INTEGER NOT NULL,
    "accuracy" INTEGER NOT NULL DEFAULT 100,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monster_skills" (
    "monsterId" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "monster_skills_pkey" PRIMARY KEY ("monsterId","skillId")
);

-- CreateTable
CREATE TABLE "monster_species_skills" (
    "speciesId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "learnLevel" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "monster_species_skills_pkey" PRIMARY KEY ("speciesId","skillId")
);

-- CreateTable
CREATE TABLE "battles" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "opponentName" TEXT NOT NULL DEFAULT 'AI Trainer',
    "status" TEXT NOT NULL DEFAULT 'active',
    "turn" INTEGER NOT NULL DEFAULT 1,
    "winner" TEXT,
    "result" TEXT NOT NULL DEFAULT '',
    "goldReward" INTEGER NOT NULL DEFAULT 0,
    "expReward" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "rewards" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_monsters" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT NOT NULL DEFAULT '',
    "expGained" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "battle_monsters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "currentHp" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_slots" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "team_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monster_evolutions" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "fromSpeciesId" INTEGER NOT NULL,
    "toSpeciesId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monster_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onchain_evolutions" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "fromSpeciesId" INTEGER NOT NULL,
    "toSpeciesId" INTEGER NOT NULL,
    "fromStage" INTEGER NOT NULL,
    "toStage" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EVOLUTION_PENDING',
    "txHash" TEXT,
    "chainId" INTEGER,
    "contractAddress" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "onchain_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "trainerId" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("trainerId","itemId")
);

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "tokenId" TEXT,
    "priceWei" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETH',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "chainId" INTEGER,
    "nftContractAddress" TEXT,
    "marketplaceAddress" TEXT,
    "listingTxHash" TEXT,
    "cancelTxHash" TEXT,
    "saleTxHash" TEXT,
    "buyerWallet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "soldAt" TIMESTAMP(3),
    "cancelAt" TIMESTAMP(3),

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "users_privyDid_key" ON "users"("privyDid");

-- CreateIndex
CREATE UNIQUE INDEX "trainers_userId_key" ON "trainers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trainers_nickname_key" ON "trainers"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "world_pickup_claims_trainerId_pickupKey_key" ON "world_pickup_claims"("trainerId", "pickupKey");

-- CreateIndex
CREATE UNIQUE INDEX "monster_species_slug_key" ON "monster_species"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "monster_species_name_key" ON "monster_species"("name");

-- CreateIndex
CREATE UNIQUE INDEX "monsters_tokenId_key" ON "monsters"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "team_slots_trainerId_slot_key" ON "team_slots"("trainerId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "team_slots_trainerId_monsterId_key" ON "team_slots"("trainerId", "monsterId");

-- CreateIndex
CREATE UNIQUE INDEX "items_slug_key" ON "items"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "items_name_key" ON "items"("name");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_monsterId_key" ON "marketplace_listings"("monsterId");

-- AddForeignKey
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_species" ADD CONSTRAINT "monster_species_evolvesFromId_fkey" FOREIGN KEY ("evolvesFromId") REFERENCES "monster_species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "monster_species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_fatherId_fkey" FOREIGN KEY ("fatherId") REFERENCES "monsters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "monsters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_skills" ADD CONSTRAINT "monster_skills_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_skills" ADD CONSTRAINT "monster_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_species_skills" ADD CONSTRAINT "monster_species_skills_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "monster_species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_species_skills" ADD CONSTRAINT "monster_species_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_monsters" ADD CONSTRAINT "battle_monsters_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_monsters" ADD CONSTRAINT "battle_monsters_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "monster_species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_slots" ADD CONSTRAINT "team_slots_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_slots" ADD CONSTRAINT "team_slots_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monster_evolutions" ADD CONSTRAINT "monster_evolutions_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onchain_evolutions" ADD CONSTRAINT "onchain_evolutions_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "monsters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
