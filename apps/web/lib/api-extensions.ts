import { apiFetch } from "./api";

// -- TOTP 2FA --
export async function setup2fa(token: string) {
  return await apiFetch<{ ok: boolean; qrCode: string; secret: string }>("/auth/2fa/setup", { method: "POST" }, token);
}

export async function verify2fa(token: string, code: string) {
  return await apiFetch<{ ok: boolean; message: string }>("/auth/2fa/verify", {
    method: "POST", body: JSON.stringify({ token: code })
  }, token);
}

export async function disable2fa(token: string, code: string) {
  return await apiFetch<{ ok: boolean }>("/auth/2fa/disable", {
    method: "POST", body: JSON.stringify({ token: code })
  }, token);
}

// -- HR & PROFILES --
export async function getProfile(token: string, userId: string) {
  return await apiFetch<{ ok: boolean; user: any }>(`/hr/profile/${userId}`, {}, token);
}

export async function updateProfile(token: string, userId: string, data: any) {
  return await apiFetch<{ ok: boolean; profile: any }>(`/hr/profile/${userId}`, {
    method: "PATCH", body: JSON.stringify(data)
  }, token);
}

export async function getOrgEmployees(token: string) {
  return await apiFetch<{ ok: boolean; employees: any[] }>("/hr/employees", {}, token);
}

// -- LEAVES --
export async function applyLeave(token: string, data: { type: string, fromDate: string, toDate: string, reason: string }) {
  return await apiFetch<{ ok: boolean; leave: any }>("/hr/leave", {
    method: "POST", body: JSON.stringify(data)
  }, token);
}

export async function getLeaves(token: string) {
  return await apiFetch<{ ok: boolean; leaves: any[] }>("/hr/leave", {}, token);
}

export async function reviewLeave(token: string, id: string, data: { status: string; reviewNote?: string }) {
  return await apiFetch<{ ok: boolean; leave: any }>(`/hr/leave/${id}`, {
    method: "PATCH", body: JSON.stringify(data)
  }, token);
}

// -- ANALYTICS --
export async function getAnalyticsOverview(token: string) {
  return await apiFetch<{ ok: boolean; overview: any }>("/analytics/overview", {}, token);
}

export async function getTaskStats(token: string) {
  return await apiFetch<{ ok: boolean; stats: any[] }>("/analytics/task-stats", {}, token);
}

export async function getAttendanceStats(token: string) {
  return await apiFetch<{ ok: boolean; summary: any[] }>("/analytics/attendance-summary", {}, token);
}

// -- DOCUMENTS --
export async function getDocuments(token: string, projectId?: string) {
  const query = projectId ? `?projectId=${projectId}` : "";
  return await apiFetch<{ ok: boolean; documents: any[] }>(`/documents${query}`, {}, token);
}

// Note: upload document uses FormData, so we fetch directly
export async function uploadDocument(token: string, formData: FormData) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return res.json();
}

export async function deleteDocument(token: string, id: string) {
  return await apiFetch<{ ok: boolean }>(`/documents/${id}`, { method: "DELETE" }, token);
}

// -- AUDIT LOGS --
export async function getAuditLogs(token: string, page = 1) {
  return await apiFetch<{ ok: boolean; logs: any[]; total: number }>(`/notifications/audit-logs?page=${page}`, {}, token);
}

// -- SUPER ADMIN --
export async function getOrganizations(token: string) {
  return await apiFetch<{ ok: boolean; organizations: any[] }>("/organizations", {}, token);
}

export async function updateOrganization(token: string, orgId: string, data: { name?: string; logoUrl?: string | null }) {
  return await apiFetch<{ ok: boolean; organization?: any; message?: string }>(`/organizations/${orgId}`, {
    method: "PUT",
    body: JSON.stringify(data)
  }, token);
}

// -- PROJECT ASSIGNMENT --
export async function assignProjectAdmin(token: string, projectId: string, adminId: string | null) {
  return await apiFetch<{ ok: boolean; project?: any; message?: string }>(`/projects/${projectId}/assign-admin`, {
    method: "POST", body: JSON.stringify({ adminId })
  }, token);
}

export async function assignProjectElite(token: string, projectId: string, eliteId: string | null) {
  return await apiFetch<{ ok: boolean; project?: any; message?: string }>(`/projects/${projectId}/assign-elite`, {
    method: "POST", body: JSON.stringify({ eliteId })
  }, token);
}

// -- HR EXTENSIONS (PHASE 2) --
export async function getOrgChart(token: string) {
  return await apiFetch<{ ok: boolean; users: any[] }>("/hr/orgchart", {}, token);
}

// SKILLS
export async function getSkills(token: string) {
  return await apiFetch<{ ok: boolean; skills: any[] }>("/hr/skills", {}, token);
}
export async function createSkill(token: string, data: { name: string; category?: string }) {
  return await apiFetch<{ ok: boolean; skill: any; message?: string }>("/hr/skills", {
    method: "POST", body: JSON.stringify(data)
  }, token);
}
export async function getUserSkills(token: string) {
  return await apiFetch<{ ok: boolean; userSkills: any[] }>("/hr/user-skills", {}, token);
}
export async function updateUserSkill(token: string, data: { userId: string; skillId: string; proficiencyLevel: number }) {
  return await apiFetch<{ ok: boolean; userSkill: any }>("/hr/user-skills", {
    method: "POST", body: JSON.stringify(data)
  }, token);
}

// ONBOARDING
export async function getOnboarding(token: string) {
  return await apiFetch<{ ok: boolean; steps: any[]; progress: any[] }>("/hr/onboarding", {}, token);
}
export async function createOnboardingStep(token: string, data: { title: string; description?: string; roleRequirement?: string }) {
  return await apiFetch<{ ok: boolean; step: any }>("/hr/onboarding", {
    method: "POST", body: JSON.stringify(data)
  }, token);
}
export async function updateOnboardingProgress(token: string, stepId: string, completed: boolean) {
  return await apiFetch<{ ok: boolean; progress: any }>(`/hr/onboarding/${stepId}/complete`, {
    method: "PATCH", body: JSON.stringify({ completed })
  }, token);
}

// OKRs
export async function getOkrs(token: string, userId?: string) {
  const query = userId ? `?userId=${userId}` : "";
  return await apiFetch<{ ok: boolean; objectives: any[] }>(`/hr/okrs${query}`, {}, token);
}
export async function createObjective(token: string, data: { title: string; description?: string; quarter: number; year: number }) {
  return await apiFetch<{ ok: boolean; objective: any }>("/hr/okrs", {
    method: "POST", body: JSON.stringify(data)
  }, token);
}
export async function createKeyResult(token: string, objectiveId: string, data: { title: string; targetValue: number; unit?: string }) {
  return await apiFetch<{ ok: boolean; keyResult: any }>(`/hr/okrs/${objectiveId}/key-results`, {
    method: "POST", body: JSON.stringify(data)
  }, token);
}
export async function updateKeyResult(token: string, keyResultId: string, currentValue: number) {
  return await apiFetch<{ ok: boolean; keyResult: any }>(`/hr/okrs/key-results/${keyResultId}`, {
    method: "PATCH", body: JSON.stringify({ currentValue })
  }, token);
}
