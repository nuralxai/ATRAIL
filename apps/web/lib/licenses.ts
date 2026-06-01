import { authedFetch } from "./authed-fetch";

export type License = {
  id: string;
  name: string;
  categoryId: string;
  subCategoryId: string | null;
  vendorId: string | null;
  version: string | null;
  type: "SUBSCRIPTION" | "PERPETUAL";
  licenseKey: string | null;
  numberOfSeats: number;
  assignedSeats: number;
  startDate: string | null;
  endDate: string | null;
  renewalType: string | null;
  invoiceNumber: string | null;
  paymentAmount: number | null;
  currency: string | null;
  paymentFrequency: string | null;
  notes: string | null;
  category?: { id: string; name: string };
  subCategory?: { id: string; name: string };
  vendor?: { id: string; name: string };
  assignments: {
    id: string;
    userId: string;
    deviceId: string | null;
    assignedAt: string;
    revokedAt: string | null;
    remarks: string | null;
    user: { id: string; fullName: string; email: string };
  }[];
};

export async function getLicenses() {
  return authedFetch<{ ok: true; licenses: License[] }>("/licenses");
}

export async function createLicense(data: any) {
  return authedFetch<{ ok: true; license: License }>("/licenses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateLicense(id: string, data: any) {
  return authedFetch<{ ok: true; license: License }>(`/licenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteLicense(id: string) {
  return authedFetch<{ ok: true; message: string }>(`/licenses/${id}`, {
    method: "DELETE",
  });
}

export async function assignLicenseSeat(id: string, userId: string, deviceId?: string, remarks?: string) {
  return authedFetch<{ ok: true; assignment: any }>(`/licenses/${id}/assign`, {
    method: "POST",
    body: JSON.stringify({ userId, deviceId, remarks }),
  });
}

export async function revokeLicenseSeat(id: string, assignmentId?: string, userId?: string) {
  return authedFetch<{ ok: true; message: string }>(`/licenses/${id}/revoke`, {
    method: "POST",
    body: JSON.stringify({ assignmentId, userId }),
  });
}

export async function getLicenseCategories() {
  return authedFetch<{ ok: true; categories: any[] }>("/licenses/categories");
}
