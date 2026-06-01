import { apiFetch } from "./api";
import { useAuthStore } from "./auth-store";

type Role = "SUPER_ADMIN" | "ADMIN" | "ELITE" | "USER";

// Mutex to prevent concurrent refresh attempts
let refreshPromise: Promise<string> | null = null;

export async function login(email: string, password: string) {
  const result = await apiFetch<{
    ok: true;
    twoFactorRequired?: boolean;
    loginToken?: string;
    accessToken?: string;
    user?: { id: string; fullName: string; email: string; role: Role; twoFactorEnabled: boolean };
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (result.twoFactorRequired) {
    return { twoFactorRequired: true as const, loginToken: result.loginToken! };
  }

  useAuthStore.getState().setAuth(result.accessToken!, result.user!);
  return { twoFactorRequired: false as const, user: result.user! };
}

export async function verifyLogin2fa(loginToken: string, code: string) {
  const result = await apiFetch<{
    ok: true;
    accessToken: string;
    user: { id: string; fullName: string; email: string; role: Role; twoFactorEnabled: boolean };
  }>("/auth/login/totp", {
    method: "POST",
    body: JSON.stringify({ loginToken, code }),
  });

  useAuthStore.getState().setAuth(result.accessToken, result.user);
  return result.user;
}

export async function refreshAccessToken(): Promise<string> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const result = await apiFetch<{ ok: true; accessToken: string }>(
        "/auth/refresh",
        {
          method: "POST",
        }
      );
      const store = useAuthStore.getState();
      store.setAuth(result.accessToken, store.user);
      return result.accessToken;
    } finally {
      // Clear the promise after completion (success or failure)
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function getMe(accessToken: string) {
  return apiFetch<{
    ok: true;
    user: { id: string; fullName: string; email: string; role: Role };
  }>("/auth/me", { method: "GET" }, accessToken);
}

export async function logout() {
  await apiFetch("/auth/logout", { method: "POST" });
  useAuthStore.getState().clear();
}
