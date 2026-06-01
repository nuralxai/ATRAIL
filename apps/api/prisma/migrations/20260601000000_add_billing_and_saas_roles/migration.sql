-- Add GOD and DEVELOPER to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GOD';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEVELOPER';

-- Create OrgType enum
DO $$ BEGIN
  CREATE TYPE "OrgType" AS ENUM ('INTERNAL', 'RESELLER', 'CLIENT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create BillingStatus enum
DO $$ BEGIN
  CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add billing + SaaS fields to Organization
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "orgType"          "OrgType"       NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS "billingStatus"    "BillingStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "billingDueDate"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "billingAmount"    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "billingNote"      TEXT,
  ADD COLUMN IF NOT EXISTS "billingUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "billingUpdatedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "trialEndsAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "planName"         TEXT DEFAULT 'Starter';

-- Index for fast billing lookups
CREATE INDEX IF NOT EXISTS "Organization_billingStatus_idx" ON "Organization"("billingStatus");
CREATE INDEX IF NOT EXISTS "Organization_orgType_idx" ON "Organization"("orgType");
