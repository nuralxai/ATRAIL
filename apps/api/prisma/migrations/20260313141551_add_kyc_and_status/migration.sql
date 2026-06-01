-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "securityAnswer" TEXT,
ADD COLUMN     "securityQuestion" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING';
