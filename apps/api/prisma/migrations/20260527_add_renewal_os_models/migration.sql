-- Create Renewal OS Enums
CREATE TYPE "ChurnRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "RenewalStatus" AS ENUM ('DRAFT', 'QUOTED', 'NEGOTIATING', 'CLOSED', 'CANCELLED');
CREATE TYPE "ReminderCadence" AS ENUM ('AGGRESSIVE', 'BALANCED', 'GENTLE');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'PARTIAL');
CREATE TYPE "CommissionStatus" AS ENUM ('ACCRUED', 'PAID', 'PENDING');

-- Add new columns to User table
ALTER TABLE "User" ADD COLUMN "isAccountManager" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "territory" TEXT;
ALTER TABLE "User" ADD COLUMN "commissionTier" TEXT;

-- Add new columns to Asset table
ALTER TABLE "Asset" ADD COLUMN "doRef" TEXT;
ALTER TABLE "Asset" ADD COLUMN "invoiceRef" TEXT;

-- Add new column to Vendor table for renewal relation
-- (relation will be created with the Renewal table)

-- Create Customer table
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "healthScore" INTEGER NOT NULL DEFAULT 50,
    "churnRisk" "ChurnRiskLevel" NOT NULL DEFAULT 'LOW',
    "paymentHistory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE INDEX "Customer_organizationId_name_idx" ON "Customer"("organizationId", "name");
CREATE INDEX "Customer_organizationId_healthScore_idx" ON "Customer"("organizationId", "healthScore");
CREATE INDEX "Customer_organizationId_churnRisk_idx" ON "Customer"("organizationId", "churnRisk");

-- Create CustomerContact table
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "title" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE
);

CREATE INDEX "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");

-- Create Renewal table
CREATE TABLE "Renewal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assetId" TEXT,
    "amId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "renewalType" TEXT,
    "renewalCost" DOUBLE PRECISION NOT NULL,
    "margin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "doRef" TEXT,
    "invoiceRef" TEXT,
    "customerPORef" TEXT,
    "status" "RenewalStatus" NOT NULL DEFAULT 'DRAFT',
    "renewalLikelihood" INTEGER NOT NULL DEFAULT 50,
    "churnRisk" "ChurnRiskLevel" NOT NULL DEFAULT 'LOW',
    "upsellPotential" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DOUBLE PRECISION,
    "paymentDate" TIMESTAMP(3),
    "reminderCadence" "ReminderCadence" NOT NULL DEFAULT 'BALANCED',
    "lastOutreach" TIMESTAMP(3),
    "nextAction" TEXT,
    "quoteSent" BOOLEAN NOT NULL DEFAULT false,
    "quoteSentDate" TIMESTAMP(3),
    "notes" TEXT,
    "discountRequested" DOUBLE PRECISION,
    "discountApproved" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Renewal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
    CONSTRAINT "Renewal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE,
    CONSTRAINT "Renewal_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE SET NULL,
    CONSTRAINT "Renewal_amId_fkey" FOREIGN KEY ("amId") REFERENCES "User" ("id") ON DELETE RESTRICT,
    CONSTRAINT "Renewal_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT
);

CREATE INDEX "Renewal_organizationId_customerId_status_idx" ON "Renewal"("organizationId", "customerId", "status");
CREATE INDEX "Renewal_organizationId_amId_idx" ON "Renewal"("organizationId", "amId");
CREATE INDEX "Renewal_organizationId_renewalDate_idx" ON "Renewal"("organizationId", "renewalDate");
CREATE INDEX "Renewal_organizationId_churnRisk_idx" ON "Renewal"("organizationId", "churnRisk");
CREATE INDEX "Renewal_organizationId_paymentStatus_idx" ON "Renewal"("organizationId", "paymentStatus");

-- Create CommissionWallet table
CREATE TABLE "CommissionWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL UNIQUE,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastPayout" TIMESTAMP(3),
    "payoutSchedule" TEXT NOT NULL DEFAULT 'MONTHLY',
    "bankAccount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommissionWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "CommissionWallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE INDEX "CommissionWallet_organizationId_userId_idx" ON "CommissionWallet"("organizationId", "userId");

-- Create CommissionEvent table
CREATE TABLE "CommissionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "renewalId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION,
    "status" "CommissionStatus" NOT NULL DEFAULT 'ACCRUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidDate" TIMESTAMP(3),
    CONSTRAINT "CommissionEvent_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CommissionWallet" ("id") ON DELETE CASCADE,
    CONSTRAINT "CommissionEvent_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "Renewal" ("id") ON DELETE CASCADE
);

CREATE INDEX "CommissionEvent_walletId_renewalId_idx" ON "CommissionEvent"("walletId", "renewalId");
CREATE INDEX "CommissionEvent_walletId_status_idx" ON "CommissionEvent"("walletId", "status");

-- Add renewals relation to Asset
ALTER TABLE "Asset" ADD COLUMN "renewal_id" TEXT;

-- Update Asset table to add renewals array capability (handled through Renewal table's assetId)
