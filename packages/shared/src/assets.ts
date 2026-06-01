import { z } from "zod";

export const AssetStatusEnum = z.enum(["ACTIVE", "INACTIVE", "REPAIR", "DISPOSED"]);
export type AssetStatus = z.infer<typeof AssetStatusEnum>;

export const LicenseTypeEnum = z.enum(["SUBSCRIPTION", "PERPETUAL"]);
export type LicenseType = z.infer<typeof LicenseTypeEnum>;

export const CategorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(["HARDWARE", "SOFTWARE"]),
});

export const SubCategorySchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1),
  name: z.string().min(1),
});

export const VendorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxNumber: z.string().optional(),
  contractStart: z.coerce.date().optional(),
  contractEnd: z.coerce.date().optional(),
  paymentTerms: z.string().optional(),
  bankingDetails: z.string().optional(),
});

export const AssetSchema = z.object({
  id: z.string().optional(),
  assetTag: z.string().optional(),
  serialNumber: z.string().optional(),
  name: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  categoryId: z.string().min(1),
  subCategoryId: z.string().optional(),
  vendorId: z.string().optional(),
  
  purchaseDate: z.coerce.date().optional(),
  warrantyStart: z.coerce.date().optional(),
  warrantyEnd: z.coerce.date().optional(),
  amcStart: z.coerce.date().optional(),
  amcEnd: z.coerce.date().optional(),
  invoiceNumber: z.string().optional(),
  purchaseCost: z.coerce.number().optional(),
  currentValue: z.coerce.number().optional(),
  
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  custodianId: z.string().optional(),
  
  status: AssetStatusEnum.default("ACTIVE"),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  osInstalled: z.string().optional(),
  
  assetCondition: z.string().optional(),
  disposalDate: z.coerce.date().optional(),
  disposalMethod: z.string().optional(),
  remarks: z.string().optional(),
});

export const LicenseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  categoryId: z.string().min(1),
  subCategoryId: z.string().optional(),
  version: z.string().optional(),
  type: LicenseTypeEnum.default("SUBSCRIPTION"),
  licenseKey: z.string().optional(),
  
  numberOfSeats: z.coerce.number().min(1).default(1),
  assignedSeats: z.coerce.number().min(0).default(0),
  
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  renewalType: z.string().optional(),
  vendorId: z.string().optional(),
  
  invoiceNumber: z.string().optional(),
  paymentAmount: z.coerce.number().optional(),
  currency: z.string().default("USD"),
  paymentFrequency: z.string().optional(),
  
  notes: z.string().optional(),
});
