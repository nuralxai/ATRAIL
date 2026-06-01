import { Router } from "express";
import { prisma } from "../../db.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { ApiError } from "../../utils/errors.js";

export const assetsRouter = Router();

// Apply auth middleware to all routes
assetsRouter.use(requireAuth);

// Helper function to seed initial data for a wow factor
async function seedDefaultAssetData(orgId: string, userId: string) {
  // Check if categories already exist
  const existingCat = await prisma.category.findFirst({
    where: { organizationId: orgId, type: "HARDWARE" }
  });
  if (existingCat) return;

  // 1. Seed Categories & Subcategories
  const catLaptops = await prisma.category.create({
    data: { organizationId: orgId, name: "Laptops", type: "HARDWARE" }
  });
  const subUltrabook = await prisma.subCategory.create({
    data: { categoryId: catLaptops.id, name: "Ultrabook" }
  });
  const subWorkstation = await prisma.subCategory.create({
    data: { categoryId: catLaptops.id, name: "Workstation" }
  });

  const catMobiles = await prisma.category.create({
    data: { organizationId: orgId, name: "Mobile Devices", type: "HARDWARE" }
  });
  const subSmartphones = await prisma.subCategory.create({
    data: { categoryId: catMobiles.id, name: "Smartphones" }
  });

  const catMonitors = await prisma.category.create({
    data: { organizationId: orgId, name: "Monitors", type: "HARDWARE" }
  });
  const sub4kMonitor = await prisma.subCategory.create({
    data: { categoryId: catMonitors.id, name: "4K Displays" }
  });

  // Software Categories (for the licenses page)
  const catDevTools = await prisma.category.create({
    data: { organizationId: orgId, name: "Developer Tools", type: "SOFTWARE" }
  });
  const subIdes = await prisma.subCategory.create({
    data: { categoryId: catDevTools.id, name: "IDE Licenses" }
  });

  const catDesign = await prisma.category.create({
    data: { organizationId: orgId, name: "Design Suites", type: "SOFTWARE" }
  });
  const subVector = await prisma.subCategory.create({
    data: { categoryId: catDesign.id, name: "Vector Graphics" }
  });

  // 2. Seed Vendors
  const vendorApple = await prisma.vendor.create({
    data: {
      organizationId: orgId,
      name: "Apple Inc.",
      contactPerson: "Tim Cook",
      email: "enterprise@apple.com",
      phone: "+1-800-MY-APPLE",
      address: "One Apple Park Way, Cupertino, CA"
    }
  });

  const vendorDell = await prisma.vendor.create({
    data: {
      organizationId: orgId,
      name: "Dell Technologies",
      contactPerson: "Michael Dell",
      email: "corporate@dell.com",
      phone: "+1-800-456-3355",
      address: "One Dell Way, Round Rock, TX"
    }
  });

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

  // 3. Seed Branches
  const branchHq = await prisma.branch.create({
    data: { organizationId: orgId, name: "HQ - London", location: "Mayfair, London" }
  });
  const branchNy = await prisma.branch.create({
    data: { organizationId: orgId, name: "NY Office", location: "Manhattan, New York" }
  });

  // 4. Seed Departments
  const deptEng = await prisma.department.create({
    data: { organizationId: orgId, name: "Engineering", branchId: branchHq.id }
  });
  const deptDesign = await prisma.department.create({
    data: { organizationId: orgId, name: "Product Design", branchId: branchHq.id }
  });

  // 5. Seed Assets
  const asset1 = await prisma.asset.create({
    data: {
      organizationId: orgId,
      name: "MacBook Pro 16\"",
      brand: "Apple",
      model: "M3 Max (64GB, 2TB)",
      assetTag: "AST-MBP-001",
      serialNumber: "C02F1234Q05D",
      categoryId: catLaptops.id,
      subCategoryId: subUltrabook.id,
      vendorId: vendorApple.id,
      branchId: branchHq.id,
      departmentId: deptEng.id,
      custodianId: userId,
      status: "ACTIVE",
      purchaseDate: new Date("2025-10-15"),
      warrantyStart: new Date("2025-10-15"),
      warrantyEnd: new Date("2028-10-15"),
      purchaseCost: 3999.00,
      currentValue: 3600.00,
      assetCondition: "EXCELLENT",
      ipAddress: "192.168.1.45",
      macAddress: "3B:89:D2:C1:90:AF",
      osInstalled: "macOS Sequoia",
      remarks: "Allocated to Lead Developer for heavy compilation work."
    }
  });

  // Create initial AssetAllocation log
  await prisma.assetAllocation.create({
    data: {
      assetId: asset1.id,
      userId: userId,
      allocatedAt: new Date("2025-10-15"),
      remarks: "Initial setup and onboarding assignment."
    }
  });

  const asset2 = await prisma.asset.create({
    data: {
      organizationId: orgId,
      name: "Dell Precision 5690",
      brand: "Dell",
      model: "Intel i9, RTX 4080 (32GB, 1TB)",
      assetTag: "AST-DEL-002",
      serialNumber: "98G4HS3",
      categoryId: catLaptops.id,
      subCategoryId: subWorkstation.id,
      vendorId: vendorDell.id,
      branchId: branchHq.id,
      departmentId: deptDesign.id,
      status: "REPAIR",
      purchaseDate: new Date("2025-11-01"),
      warrantyStart: new Date("2025-11-01"),
      warrantyEnd: new Date("2028-11-01"),
      purchaseCost: 2899.00,
      currentValue: 2600.00,
      assetCondition: "GOOD",
      remarks: "Sent to vendor for fan replacement and battery inspection."
    }
  });

  // Create Maintenance log
  await prisma.maintenanceRecord.create({
    data: {
      assetId: asset2.id,
      maintenanceDate: new Date("2026-05-10"),
      description: "Thermal repasting and battery health calibration. Cleaned interior dust.",
      cost: 150.00,
      performedBy: "Dell On-Site Support",
      nextDueDate: new Date("2026-11-10")
    }
  });

  const asset3 = await prisma.asset.create({
    data: {
      organizationId: orgId,
      name: "Studio Display 27\"",
      brand: "Apple",
      model: "5K Retina Tilt-Adjustable",
      assetTag: "AST-MON-003",
      serialNumber: "APMON-558291",
      categoryId: catMonitors.id,
      subCategoryId: sub4kMonitor.id,
      vendorId: vendorApple.id,
      branchId: branchHq.id,
      departmentId: deptDesign.id,
      status: "ACTIVE",
      purchaseDate: new Date("2025-10-20"),
      warrantyStart: new Date("2025-10-20"),
      warrantyEnd: new Date("2026-10-20"),
      purchaseCost: 1599.00,
      currentValue: 1450.00,
      assetCondition: "EXCELLENT",
      remarks: "Connected as secondary monitor for designing."
    }
  });

  // 6. Seed Licenses (so Licenses tab looks wonderful too!)
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
      notes: "Allows full access to IntelliJ, WebStorm, PyCharm, and CLion."
    }
  });

  await prisma.licenseAssignment.create({
    data: {
      licenseId: lic1.id,
      userId: userId,
      deviceId: asset1.id,
      assignedAt: new Date("2026-01-02"),
      remarks: "Primary developer workspace license."
    }
  });
}

// ─────────────────────────────────────────────
// ASSET LIST ROUTE
// ─────────────────────────────────────────────
assetsRouter.get("/", async (req, res, next) => {
  try {
    const u = (req as any).user;
    const orgId = u.orgId;

    // Check if we need to auto-seed standard profiles
    await seedDefaultAssetData(orgId, u.id);

    const { status, branchId, categoryId, search } = req.query;

    const assets = await prisma.asset.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as any } : {}),
        ...(branchId ? { branchId: branchId as string } : {}),
        ...(categoryId ? { categoryId: categoryId as string } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search as string, mode: "insensitive" } },
                { assetTag: { contains: search as string, mode: "insensitive" } },
                { serialNumber: { contains: search as string, mode: "insensitive" } },
                { brand: { contains: search as string, mode: "insensitive" } },
                { model: { contains: search as string, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        subCategory: true,
        vendor: true,
        branch: true,
        department: true,
        custodian: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        allocations: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: { allocatedAt: "desc" },
        },
        maintenance: {
          orderBy: { maintenanceDate: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ok: true, assets });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// METADATA ENDPOINTS
// ─────────────────────────────────────────────
assetsRouter.get("/categories", async (req, res, next) => {
  try {
    const u = (req as any).user;
    const categories = await prisma.category.findMany({
      where: { organizationId: u.orgId, type: "HARDWARE" },
      include: { subCategories: true },
      orderBy: { name: "asc" }
    });
    res.json({ ok: true, categories });
  } catch (e) {
    next(e);
  }
});

assetsRouter.post("/categories", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const { name, subCategoryNames } = req.body;
    if (!name) throw new ApiError(400, "Category name is required");

    const category = await prisma.category.create({
      data: {
        organizationId: u.orgId,
        name,
        type: "HARDWARE"
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

assetsRouter.get("/branches", async (req, res, next) => {
  try {
    const u = (req as any).user;
    const branches = await prisma.branch.findMany({
      where: { organizationId: u.orgId },
      orderBy: { name: "asc" }
    });
    res.json({ ok: true, branches });
  } catch (e) {
    next(e);
  }
});

assetsRouter.post("/branches", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const { name, location } = req.body;
    if (!name) throw new ApiError(400, "Branch name is required");

    const branch = await prisma.branch.create({
      data: { organizationId: u.orgId, name, location }
    });
    res.json({ ok: true, branch });
  } catch (e) {
    next(e);
  }
});

assetsRouter.get("/departments", async (req, res, next) => {
  try {
    const u = (req as any).user;
    const departments = await prisma.department.findMany({
      where: { organizationId: u.orgId },
      include: { branch: true },
      orderBy: { name: "asc" }
    });
    res.json({ ok: true, departments });
  } catch (e) {
    next(e);
  }
});

assetsRouter.post("/departments", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const { name, branchId } = req.body;
    if (!name) throw new ApiError(400, "Department name is required");

    const department = await prisma.department.create({
      data: { organizationId: u.orgId, name, branchId }
    });
    res.json({ ok: true, department });
  } catch (e) {
    next(e);
  }
});

assetsRouter.get("/vendors", async (req, res, next) => {
  try {
    const u = (req as any).user;
    const vendors = await prisma.vendor.findMany({
      where: { organizationId: u.orgId },
      orderBy: { name: "asc" }
    });
    res.json({ ok: true, vendors });
  } catch (e) {
    next(e);
  }
});

assetsRouter.post("/vendors", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const { name, contactPerson, email, phone, address } = req.body;
    if (!name) throw new ApiError(400, "Vendor name is required");

    const vendor = await prisma.vendor.create({
      data: { organizationId: u.orgId, name, contactPerson, email, phone, address }
    });
    res.json({ ok: true, vendor });
  } catch (e) {
    next(e);
  }
});

// ─────────────────────────────────────────────
// ASSET CRUD ENDPOINTS
// ─────────────────────────────────────────────
assetsRouter.post("/", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const orgId = u.orgId;

    const {
      name,
      assetTag,
      serialNumber,
      brand,
      model,
      categoryId,
      subCategoryId,
      vendorId,
      branchId,
      departmentId,
      purchaseDate,
      warrantyStart,
      warrantyEnd,
      amcStart,
      amcEnd,
      invoiceNumber,
      purchaseCost,
      currentValue,
      status,
      ipAddress,
      macAddress,
      osInstalled,
      assetCondition,
      remarks,
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
            { name: { equals: categoryId.trim(), mode: "insensitive" }, type: "HARDWARE" }
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
            type: "HARDWARE"
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

    const asset = await prisma.asset.create({
      data: {
        organizationId: orgId,
        name,
        assetTag,
        serialNumber,
        brand,
        model,
        categoryId: resolvedCategoryId,
        subCategoryId: resolvedSubCategoryId || null,
        vendorId: resolvedVendorId || null,
        branchId: branchId || null,
        departmentId: departmentId || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyStart: warrantyStart ? new Date(warrantyStart) : null,
        warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null,
        amcStart: amcStart ? new Date(amcStart) : null,
        amcEnd: amcEnd ? new Date(amcEnd) : null,
        invoiceNumber,
        purchaseCost: purchaseCost ? parseFloat(purchaseCost) : null,
        currentValue: currentValue ? parseFloat(currentValue) : null,
        status: status || "ACTIVE",
        ipAddress,
        macAddress,
        osInstalled,
        assetCondition,
        remarks,
      },
    });

    res.json({ ok: true, asset });
  } catch (error) {
    next(error);
  }
});

assetsRouter.patch("/:id", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const assetId = req.params.id;

    // Verify ownership
    const existing = await prisma.asset.findFirst({
      where: { id: assetId, organizationId: u.orgId }
    });
    if (!existing) throw new ApiError(404, "Asset not found");

    const {
      name,
      assetTag,
      serialNumber,
      brand,
      model,
      categoryId,
      subCategoryId,
      vendorId,
      branchId,
      departmentId,
      purchaseDate,
      warrantyStart,
      warrantyEnd,
      amcStart,
      amcEnd,
      invoiceNumber,
      purchaseCost,
      currentValue,
      status,
      ipAddress,
      macAddress,
      osInstalled,
      assetCondition,
      remarks,
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (assetTag !== undefined) data.assetTag = assetTag;
    if (serialNumber !== undefined) data.serialNumber = serialNumber;
    if (brand !== undefined) data.brand = brand;
    if (model !== undefined) data.model = model;
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (subCategoryId !== undefined) data.subCategoryId = subCategoryId || null;
    if (vendorId !== undefined) data.vendorId = vendorId || null;
    if (branchId !== undefined) data.branchId = branchId || null;
    if (departmentId !== undefined) data.departmentId = departmentId || null;
    if (purchaseDate !== undefined) data.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    if (warrantyStart !== undefined) data.warrantyStart = warrantyStart ? new Date(warrantyStart) : null;
    if (warrantyEnd !== undefined) data.warrantyEnd = warrantyEnd ? new Date(warrantyEnd) : null;
    if (amcStart !== undefined) data.amcStart = amcStart ? new Date(amcStart) : null;
    if (amcEnd !== undefined) data.amcEnd = amcEnd ? new Date(amcEnd) : null;
    if (invoiceNumber !== undefined) data.invoiceNumber = invoiceNumber;
    if (purchaseCost !== undefined) data.purchaseCost = purchaseCost ? parseFloat(purchaseCost) : null;
    if (currentValue !== undefined) data.currentValue = currentValue ? parseFloat(currentValue) : null;
    if (status !== undefined) data.status = status;
    if (ipAddress !== undefined) data.ipAddress = ipAddress;
    if (macAddress !== undefined) data.macAddress = macAddress;
    if (osInstalled !== undefined) data.osInstalled = osInstalled;
    if (assetCondition !== undefined) data.assetCondition = assetCondition;
    if (remarks !== undefined) data.remarks = remarks;

    const asset = await prisma.asset.update({
      where: { id: assetId },
      data,
    });

    res.json({ ok: true, asset });
  } catch (error) {
    next(error);
  }
});

assetsRouter.delete("/:id", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const assetId = req.params.id;

    // Verify ownership
    const existing = await prisma.asset.findFirst({
      where: { id: assetId, organizationId: u.orgId }
    });
    if (!existing) throw new ApiError(404, "Asset not found");

    await prisma.asset.delete({
      where: { id: assetId }
    });

    res.json({ ok: true, message: "Asset successfully deleted" });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// ALLOCATION / RETURN ENDPOINTS
// ─────────────────────────────────────────────
assetsRouter.post("/:id/allocate", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const assetId = req.params.id;
    const { userId, remarks } = req.body;

    if (!userId) throw new ApiError(400, "User ID is required for allocation");

    // Verify ownership & validity
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organizationId: u.orgId }
    });
    if (!asset) throw new ApiError(404, "Asset not found");

    const recipient = await prisma.user.findFirst({
      where: { id: userId, organizationId: u.orgId }
    });
    if (!recipient) throw new ApiError(404, "Recipient user not found in this organization");

    // Update custody and state
    await prisma.asset.update({
      where: { id: assetId },
      data: { custodianId: userId, status: "ACTIVE" }
    });

    // Create allocation record
    const allocation = await prisma.assetAllocation.create({
      data: {
        assetId,
        userId,
        remarks,
        allocatedAt: new Date()
      }
    });

    res.json({ ok: true, allocation });
  } catch (error) {
    next(error);
  }
});

assetsRouter.post("/:id/return", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const assetId = req.params.id;
    const { remarks } = req.body;

    // Verify ownership
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organizationId: u.orgId }
    });
    if (!asset) throw new ApiError(404, "Asset not found");
    if (!asset.custodianId) throw new ApiError(400, "Asset is not currently allocated to anyone");

    // Clear custodian on asset
    await prisma.asset.update({
      where: { id: assetId },
      data: { custodianId: null }
    });

    // Find and update the active allocation record
    const activeAlloc = await prisma.assetAllocation.findFirst({
      where: { assetId, returnedAt: null },
      orderBy: { allocatedAt: "desc" }
    });

    if (activeAlloc) {
      await prisma.assetAllocation.update({
        where: { id: activeAlloc.id },
        data: {
          returnedAt: new Date(),
          remarks: remarks ? `${activeAlloc.remarks || ""}\nReturned: ${remarks}` : activeAlloc.remarks
        }
      });
    }

    res.json({ ok: true, message: "Asset successfully returned to inventory" });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// MAINTENANCE ENDPOINTS
// ─────────────────────────────────────────────
assetsRouter.post("/:id/maintenance", requireRole("ADMIN", "SUPER_ADMIN"), async (req, res, next) => {
  try {
    const u = (req as any).user;
    const assetId = req.params.id;
    const { maintenanceDate, description, cost, performedBy, nextDueDate, updateAssetStatus } = req.body;

    if (!maintenanceDate || !description) {
      throw new ApiError(400, "Maintenance date and description are required");
    }

    // Verify ownership
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, organizationId: u.orgId }
    });
    if (!asset) throw new ApiError(404, "Asset not found");

    const record = await prisma.maintenanceRecord.create({
      data: {
        assetId,
        maintenanceDate: new Date(maintenanceDate),
        description,
        cost: cost ? parseFloat(cost) : null,
        performedBy,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null
      }
    });

    if (updateAssetStatus) {
      await prisma.asset.update({
        where: { id: assetId },
        data: { status: updateAssetStatus }
      });
    }

    res.json({ ok: true, record });
  } catch (error) {
    next(error);
  }
});
