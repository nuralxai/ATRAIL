import { Router } from "express";
import { prisma } from "../../db.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { ApiError } from "../../utils/errors.js";

export const licensesRouter = Router();

// Apply auth middleware to all routes
licensesRouter.use(requireAuth);

// Helper function to seed initial data if needed
async function seedDefaultLicenseData(orgId: string, userId: string) {
  // Check if SOFTWARE categories already exist
  const existingCat = await prisma.category.findFirst({
    where: { organizationId: orgId, type: "SOFTWARE" }
  });
  if (existingCat) return;

  // Let's seed core categories
  const catDevTools = await prisma.category.create({
    data: { organizationId: orgId, name: "Developer Tools", type: "SOFTWARE" }
  });
  const subIdes = await prisma.subCategory.create({
    data: { categoryId: catDevTools.id, name: "IDE Licenses" }
  });
  const subCloud = await prisma.subCategory.create({
    data: { categoryId: catDevTools.id, name: "Cloud Tools" }
  });

  const catOffice = await prisma.category.create({
    data: { organizationId: orgId, name: "Office Productivity", type: "SOFTWARE" }
  });
  const subSuite = await prisma.subCategory.create({
    data: { categoryId: catOffice.id, name: "Office Suites" }
  });

  const catDesign = await prisma.category.create({
    data: { organizationId: orgId, name: "Design Suites", type: "SOFTWARE" }
  });
  const subVector = await prisma.subCategory.create({
    data: { categoryId: catDesign.id, name: "Vector Graphics" }
  });

  // Seed Vendors
  const vendorJetbrains = await prisma.vendor.create({
    data: {
      organizationId: orgId,
      name: "JetBrains s.r.o.",
      contactPerson: "Sales Admin",
      email: "sales@jetbrains.com",
      phone: "+420 241 722 501",
      address: "Na Hrebenech II 1718/10, Prague, Czech Republic"
    }
  });

  const vendorMicrosoft = await prisma.vendor.create({
    data: {
      organizationId: orgId,
      name: "Microsoft Corp.",
      contactPerson: "Satya Nadella",
      email: "billing@microsoft.com",
      phone: "+1-800-MICROSOFT",
      address: "One Microsoft Way, Redmond, WA"
    }
  });

  const vendorFigma = await prisma.vendor.create({
    data: {
      organizationId: orgId,
      name: "Figma Inc.",
      contactPerson: "Dylan Field",
      email: "support@figma.com",
      phone: "+1-800-FIGMA-00",
      address: "85 2nd St, San Francisco, CA"
    }
  });

  // Seed default Licenses
  const lic1 = await prisma.license.create({
    data: {
      organizationId: orgId,
      name: "JetBrains All Products Pack",
      categoryId: catDevTools.id,
      subCategoryId: subIdes.id,
      vendorId: vendorJetbrains.id,
      version: "2026.1",
      type: "SUBSCRIPTION",
      licenseKey: "JB-98382-EXPIRED-NOT-REALLY-8928",
      numberOfSeats: 10,
      assignedSeats: 1,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2027-01-01"),
      renewalType: "AUTO",
      invoiceNumber: "INV-JB-992",
      paymentAmount: 2490.00,
      paymentFrequency: "ANNUAL",
      notes: "Allows full access to IntelliJ, WebStorm, PyCharm, and CLion for engineering team."
    }
  });

  await prisma.licenseAssignment.create({
    data: {
      licenseId: lic1.id,
      userId: userId,
      assignedAt: new Date("2026-01-02"),
      remarks: "Primary developer workspace license."
    }
  });

  await prisma.license.create({
    data: {
      organizationId: orgId,
      name: "Microsoft 365 Enterprise E5",
      categoryId: catOffice.id,
      subCategoryId: subSuite.id,
      vendorId: vendorMicrosoft.id,
      version: "Latest",
      type: "SUBSCRIPTION",
      licenseKey: "M365-55429-BBCE9-FFD82-1102A",
      numberOfSeats: 50,
      assignedSeats: 0,
      startDate: new Date("2026-02-15"),
      endDate: new Date("2027-02-15"),
      renewalType: "AUTO",
      invoiceNumber: "INV-MS-5528",
      paymentAmount: 18000.00,
      paymentFrequency: "ANNUAL",
      notes: "Office applications, security, and compliance features for all staff."
    }
  });

  await prisma.license.create({
    data: {
      organizationId: orgId,
      name: "Figma Professional",
      categoryId: catDesign.id,
      subCategoryId: subVector.id,
      vendorId: vendorFigma.id,
      version: "Cloud-Based",
      type: "SUBSCRIPTION",
      licenseKey: "FIG-PRO-ORG-2026-SEAMLESS",
      numberOfSeats: 5,
      assignedSeats: 0,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2027-03-01"),
      renewalType: "MANUAL",
      invoiceNumber: "INV-FG-0012",
      paymentAmount: 900.00,
      paymentFrequency: "ANNUAL",
      notes: "Design licenses for core UI/UX team."
    }
  });
}

// ─────────────────────────────────────────────
// LICENSE LIST ROUTE
// ─────────────────────────────────────────────
licensesRouter.get("/", async (req, res, next) => {
  try {
    const u = (req as any).user;
    const orgId = u.orgId;

    // Check if we need to auto-seed
    await seedDefaultLicenseData(orgId, u.id);

    const licenses = await prisma.license.findMany({
      where: { organizationId: orgId },
      include: {
        category: true,
        subCategory: true,
        vendor: true,
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ok: true, licenses });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// METADATA ENDPOINTS
// ─────────────────────────────────────────────
licensesRouter.get("/categories", async (req, res, next) => {
  try {
    const u = (req as any).user;
    const categories = await prisma.category.findMany({
      where: { organizationId: u.orgId, type: "SOFTWARE" },
      include: { subCategories: true },
      orderBy: { name: "asc" }
    });
    res.json({ ok: true, categories });
  } catch (e) {
    next(e);
  }
});

licensesRouter.post("/categories", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const { name, subCategoryNames } = req.body;
    if (!name) throw new ApiError(400, "Category name is required");

    const category = await prisma.category.create({
      data: {
        organizationId: u.orgId,
        name,
        type: "SOFTWARE"
      }
    });

    if (Array.isArray(subCategoryNames)) {
      for (const subName of subCategoryNames) {
        if (subName) {
          await prisma.subCategory.create({
            data: {
              categoryId: category.id,
              name: subName
            }
          });
        }
      }
    }

    res.json({ ok: true, category });
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// LICENSE CRUD ENDPOINTS
// ─────────────────────────────────────────────
licensesRouter.post("/", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const orgId = u.orgId;

    const {
      name,
      categoryId,
      subCategoryId,
      vendorId,
      version,
      type,
      licenseKey,
      numberOfSeats,
      startDate,
      endDate,
      renewalType,
      invoiceNumber,
      paymentAmount,
      currency,
      paymentFrequency,
      notes,
    } = req.body;

    if (!name || !categoryId) {
      throw new ApiError(400, "Name and Category are required");
    }

    // Resolve or create Category
    let resolvedCategoryId = categoryId;
    if (categoryId && categoryId.trim() !== "") {
      const existingCat = await prisma.category.findFirst({
        where: {
          OR: [
            { id: categoryId },
            { name: { equals: categoryId.trim(), mode: "insensitive" }, type: "SOFTWARE" }
          ],
          organizationId: orgId
        }
      });
      if (existingCat) {
        resolvedCategoryId = existingCat.id;
      } else {
        const newCat = await prisma.category.create({
          data: {
            organizationId: orgId,
            name: categoryId.trim(),
            type: "SOFTWARE"
          }
        });
        resolvedCategoryId = newCat.id;
      }
    }

    // Resolve or create SubCategory
    let resolvedSubCategoryId = subCategoryId;
    if (subCategoryId && subCategoryId.trim() !== "" && resolvedCategoryId) {
      const existingSub = await prisma.subCategory.findFirst({
        where: {
          OR: [
            { id: subCategoryId },
            { name: { equals: subCategoryId.trim(), mode: "insensitive" } }
          ],
          categoryId: resolvedCategoryId
        }
      });
      if (existingSub) {
        resolvedSubCategoryId = existingSub.id;
      } else {
        const newSub = await prisma.subCategory.create({
          data: {
            categoryId: resolvedCategoryId,
            name: subCategoryId.trim()
          }
        });
        resolvedSubCategoryId = newSub.id;
      }
    }

    // Resolve or create Vendor
    let resolvedVendorId = vendorId;
    if (vendorId && vendorId.trim() !== "") {
      const existingVendor = await prisma.vendor.findFirst({
        where: {
          OR: [
            { id: vendorId },
            { name: { equals: vendorId.trim(), mode: "insensitive" } }
          ],
          organizationId: orgId
        }
      });
      if (existingVendor) {
        resolvedVendorId = existingVendor.id;
      } else {
        const newVendor = await prisma.vendor.create({
          data: {
            organizationId: orgId,
            name: vendorId.trim()
          }
        });
        resolvedVendorId = newVendor.id;
      }
    }

    const license = await prisma.license.create({
      data: {
        organizationId: orgId,
        name,
        categoryId: resolvedCategoryId,
        subCategoryId: resolvedSubCategoryId || null,
        vendorId: resolvedVendorId || null,
        version,
        type: type || "SUBSCRIPTION",
        licenseKey,
        numberOfSeats: numberOfSeats ? parseInt(numberOfSeats) : 1,
        assignedSeats: 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        renewalType,
        invoiceNumber,
        paymentAmount: paymentAmount ? parseFloat(paymentAmount) : null,
        currency: currency || "USD",
        paymentFrequency,
        notes,
      },
    });

    res.json({ ok: true, license });
  } catch (error) {
    next(error);
  }
});

licensesRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const licenseId = req.params.id;

    // Verify ownership
    const existing = await prisma.license.findFirst({
      where: { id: licenseId, organizationId: u.orgId }
    });
    if (!existing) throw new ApiError(404, "License not found");

    const {
      name,
      categoryId,
      subCategoryId,
      vendorId,
      version,
      type,
      licenseKey,
      numberOfSeats,
      startDate,
      endDate,
      renewalType,
      invoiceNumber,
      paymentAmount,
      currency,
      paymentFrequency,
      notes,
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (subCategoryId !== undefined) data.subCategoryId = subCategoryId || null;
    if (vendorId !== undefined) data.vendorId = vendorId || null;
    if (version !== undefined) data.version = version;
    if (type !== undefined) data.type = type;
    if (licenseKey !== undefined) data.licenseKey = licenseKey;
    if (numberOfSeats !== undefined) data.numberOfSeats = numberOfSeats ? parseInt(numberOfSeats) : 1;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (renewalType !== undefined) data.renewalType = renewalType;
    if (invoiceNumber !== undefined) data.invoiceNumber = invoiceNumber;
    if (paymentAmount !== undefined) data.paymentAmount = paymentAmount ? parseFloat(paymentAmount) : null;
    if (currency !== undefined) data.currency = currency;
    if (paymentFrequency !== undefined) data.paymentFrequency = paymentFrequency;
    if (notes !== undefined) data.notes = notes;

    const license = await prisma.license.update({
      where: { id: licenseId },
      data,
    });

    res.json({ ok: true, license });
  } catch (error) {
    next(error);
  }
});

licensesRouter.delete("/:id", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const licenseId = req.params.id;

    // Verify ownership
    const existing = await prisma.license.findFirst({
      where: { id: licenseId, organizationId: u.orgId }
    });
    if (!existing) throw new ApiError(404, "License not found");

    await prisma.license.delete({
      where: { id: licenseId }
    });

    res.json({ ok: true, message: "License successfully deleted" });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// ASSIGNMENT / REVOCATION ENDPOINTS
// ─────────────────────────────────────────────
licensesRouter.post("/:id/assign", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const licenseId = req.params.id;
    const { userId, deviceId, remarks } = req.body;

    if (!userId) throw new ApiError(400, "User ID is required for assignment");

    // Verify license ownership and limits
    const license = await prisma.license.findFirst({
      where: { id: licenseId, organizationId: u.orgId }
    });
    if (!license) throw new ApiError(404, "License not found");

    if (license.assignedSeats >= license.numberOfSeats) {
      throw new ApiError(400, `No seats available. Max seat capacity of ${license.numberOfSeats} has been reached.`);
    }

    const recipient = await prisma.user.findFirst({
      where: { id: userId, organizationId: u.orgId }
    });
    if (!recipient) throw new ApiError(404, "Recipient user not found in this organization");

    // Check if user is already assigned to this license actively
    const alreadyAssigned = await prisma.licenseAssignment.findFirst({
      where: { licenseId, userId, revokedAt: null }
    });
    if (alreadyAssigned) throw new ApiError(400, "This software license is already assigned to this user");

    // Create assignment record
    const assignment = await prisma.licenseAssignment.create({
      data: {
        licenseId,
        userId,
        deviceId: deviceId || null,
        remarks,
        assignedAt: new Date()
      }
    });

    // Increment assigned seat counter
    await prisma.license.update({
      where: { id: licenseId },
      data: { assignedSeats: { increment: 1 } }
    });

    res.json({ ok: true, assignment });
  } catch (error) {
    next(error);
  }
});

licensesRouter.post("/:id/revoke", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const licenseId = req.params.id;
    const { assignmentId, userId } = req.body;

    if (!assignmentId && !userId) {
      throw new ApiError(400, "Either assignmentId or userId is required to revoke");
    }

    // Verify ownership of license
    const license = await prisma.license.findFirst({
      where: { id: licenseId, organizationId: u.orgId }
    });
    if (!license) throw new ApiError(404, "License not found");

    // Find the active assignment
    const activeAssign = await prisma.licenseAssignment.findFirst({
      where: {
        licenseId,
        ...(assignmentId ? { id: assignmentId } : { userId, revokedAt: null })
      },
      orderBy: { assignedAt: "desc" }
    });

    if (!activeAssign || activeAssign.revokedAt) {
      throw new ApiError(404, "No active assignment found to revoke");
    }

    // Update assignment record to set revokedAt
    await prisma.licenseAssignment.update({
      where: { id: activeAssign.id },
      data: { revokedAt: new Date() }
    });

    // Decrement assigned seats on license
    await prisma.license.update({
      where: { id: licenseId },
      data: { assignedSeats: { decrement: 1 } }
    });

    res.json({ ok: true, message: "License seat assignment successfully revoked" });
  } catch (error) {
    next(error);
  }
});
