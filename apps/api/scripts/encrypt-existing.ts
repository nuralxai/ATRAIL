import { prisma } from "../src/db.js";
import { encrypt } from "../src/utils/encrypt.js";

async function main() {
  console.log("Starting credentials encryption script...");
  const accounts = await prisma.connectedAccount.findMany();
  console.log(`Found ${accounts.length} accounts to process.`);

  let count = 0;
  for (const account of accounts) {
    // Check if the token is already encrypted (encrypted tokens have two dots: iv.tag.enc)
    const isEncrypted = account.accessToken.split(".").length === 3;
    if (isEncrypted) {
      console.log(`Account ${account.id} for ${account.provider} (${account.email}) is already encrypted.`);
      continue;
    }

    const encryptedAccessToken = encrypt(account.accessToken);
    const encryptedRefreshToken = account.refreshToken ? encrypt(account.refreshToken) : null;

    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
      },
    });

    console.log(`Encrypted account ${account.id} for ${account.provider} (${account.email}).`);
    count++;
  }

  console.log(`Successfully encrypted ${count} connected accounts.`);
}

main()
  .catch((e) => {
    console.error("Encryption script failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
