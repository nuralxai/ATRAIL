import { PrismaClient } from "./src/generated/client";

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE;');
    console.log("SUCCESS: All users and their related records have been truncated.");
  } catch (error) {
    console.error("FAILED to truncate users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
