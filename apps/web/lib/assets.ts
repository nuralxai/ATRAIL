import { authedFetch } from "./authed-fetch";

export type Asset = {
  id: string;
  organizationId: string;
  name: string;
  assetTag: string | null;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  purchaseDate: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  amcStart: string | null;
  amcEnd: string | null;
  invoiceNumber: string | null;
  purchaseCost: number | null;
  currentValue: number | null;
  status: "ACTIVE" | "INACTIVE" | "REPAIR" | "DISPOSED";
  ipAddress: string | null;
  macAddress: string | null;
  osInstalled: string | null;
  assetCondition: string | null;
  remarks: string | null;
  categoryId: string;
  category?: { id: string; name: string };
  subCategory?: { id: string; name: string };
  vendor?: { id: string; name: string };
  branch?: { id: string; name: string };
  department?: { id: string; name: string };
  custodianId: string | null;
  custodian?: { id: string; fullName: string; email: string; role: string };
  allocations: {
    id: string;
    allocatedAt: string;
    returnedAt: string | null;
    remarks: string | null;
    user: { id: string; fullName: string; email: string };
  }[];
  maintenance: {
    id: string;
    maintenanceDate: string;
    description: string;
    cost: number | null;
    performedBy: string | null;
    nextDueDate: string | null;
  }[];
};

export async function getAssets(query?: { status?: string; branchId?: string; categoryId?: string; search?: string }) {
  const params = new URLSearchParams();
  if (query?.status) params.append("status", query.status);
  if (query?.branchId) params.append("branchId", query.branchId);
  if (query?.categoryId) params.append("categoryId", query.categoryId);
  if (query?.search) params.append("search", query.search);
  
  return authedFetch<{ ok: true; assets: Asset[] }>(`/assets?${params.toString()}`);
}

export async function createAsset(data: any) {
  return authedFetch<{ ok: true; asset: Asset }>("/assets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAsset(id: string, data: any) {
  return authedFetch<{ ok: true; asset: Asset }>(`/assets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAsset(id: string) {
  return authedFetch<{ ok: true; message: string }>(`/assets/${id}`, {
    method: "DELETE",
  });
}

export async function allocateAsset(id: string, userId: string, remarks?: string) {
  return authedFetch<{ ok: true; allocation: any }>(`/assets/${id}/allocate`, {
    method: "POST",
    body: JSON.stringify({ userId, remarks }),
  });
}

export async function returnAsset(id: string, remarks?: string) {
  return authedFetch<{ ok: true; message: string }>(`/assets/${id}/return`, {
    method: "POST",
    body: JSON.stringify({ remarks }),
  });
}

export async function addMaintenance(id: string, data: any) {
  return authedFetch<{ ok: true; record: any }>(`/assets/${id}/maintenance`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Meta endpoints
export async function getAssetCategories() {
  return authedFetch<{ ok: true; categories: any[] }>("/assets/categories");
}

export async function getBranches() {
  return authedFetch<{ ok: true; branches: any[] }>("/assets/branches");
}

export async function getDepartments() {
  return authedFetch<{ ok: true; departments: any[] }>("/assets/departments");
}

export async function getVendors() {
  return authedFetch<{ ok: true; vendors: any[] }>("/assets/vendors");
}
