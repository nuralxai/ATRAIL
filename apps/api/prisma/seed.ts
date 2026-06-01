import "dotenv/config";
import { PrismaClient, Role, UserStatus } from "../src/generated/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const orgName = "ATRAIL";
  const org = await prisma.organization.upsert({
    where: { name: orgName },
    update: {},
    create: { name: orgName },
  });

  const passwordPlain = "Pass@12345";
  const passwordHash = await bcrypt.hash(passwordPlain, 12);

  // ── Super Admins ──
  const superAdmins = [
    { email: "arunkumar.natraj@atrail.com", fullName: "Arunkumar Natraj", password: "Pass@12345" },
    { email: "abishekmurugan@atrail.com",   fullName: "Abishek Murugan", password: "Pass@12345" },
    { email: "thejitha@atrail.com",         fullName: "Thejitha", password: "Pass12345" },
  ];

  // ── Admins ──
  const admins = [
    { email: "shanmugapriya@atrail.com", fullName: "Shanmugapriya" },
    { email: "sara@atrail.com",          fullName: "Sara" },
    { email: "kisshore@atrail.com",      fullName: "Kisshore" },
    { email: "anushri@atrail.com",       fullName: "Anushri" },
    { email: "ajay@atrail.com",          fullName: "Ajay" },
  ];

  console.log(`Seeding ${superAdmins.length} Super Admins and ${admins.length} Admins...`);

  const createdSuperAdmins = [];
  for (const { email, fullName, password } of superAdmins) {
    const uPasswordHash = await bcrypt.hash(password, 12);
    const u = await prisma.user.upsert({
      where: { email },
      update: { status: UserStatus.ACTIVE, role: Role.SUPER_ADMIN, passwordHash: uPasswordHash },
      create: {
        organizationId: org.id,
        role: Role.SUPER_ADMIN,
        fullName,
        email,
        passwordHash: uPasswordHash,
        status: UserStatus.ACTIVE,
        isAccountManager: false,
      },
    });
    createdSuperAdmins.push(u);
    console.log(`  ✅ Super Admin: ${fullName} (${email})`);
  }

  const createdAdmins = [];
  for (const { email, fullName } of admins) {
    const u = await prisma.user.upsert({
      where: { email },
      update: { status: UserStatus.ACTIVE, role: Role.ADMIN, passwordHash },
      create: {
        organizationId: org.id,
        role: Role.ADMIN,
        fullName,
        email,
        passwordHash,
        status: UserStatus.ACTIVE,
        isAccountManager: false,
      },
    });
    createdAdmins.push(u);
    console.log(`  ✅ Admin: ${fullName} (${email})`);
  }

  // Create sample project
  const existingProject = await prisma.project.findFirst({
    where: { name: "Core Infrastructure", organizationId: org.id },
  });

  if (!existingProject) {
    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: "Core Infrastructure",
        description: "Initial infrastructure project for ATRAIL",
        createdById: createdSuperAdmins[0].id,
        headId: createdSuperAdmins[1].id,
        members: {
          create: [
            { userId: createdSuperAdmins[1].id, role: "HEAD" },
            { userId: createdAdmins[0].id, role: "MEMBER" },
          ],
        },
      },
    });

    // Create sample task
    await prisma.task.create({
      data: {
        projectId: project.id,
        title: "Rebrand Audit",
        description: "Verify all branding assets are updated to ATRAIL",
        assignedToId: createdAdmins[0].id,
        assignedById: createdSuperAdmins[0].id,
        status: "ASSIGNED",
      },
    });
    console.log("  ✅ Sample project & task created");
  } else {
    console.log("  ℹ️  Sample project already exists, skipping");
  }

  // Create welcome notice
  const existingNotice = await prisma.notice.findFirst({
    where: { title: "Welcome to ATRAIL WORKFLOW" },
  });

  if (!existingNotice) {
    await prisma.notice.create({
      data: {
        organizationId: org.id,
        createdById: createdSuperAdmins[0].id,
        title: "Welcome to ATRAIL WORKFLOW",
        content: "We have successfully launched ATRAIL. Explore the new portal features and manage your workflows efficiently.",
        pinned: true,
      },
    });
    console.log("  ✅ Welcome notice created");
  }

  console.log("\n🎉 Seed completed successfully!");
  console.log("   Login with any account using password: Pass@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
