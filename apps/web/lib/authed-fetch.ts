import { apiFetch } from "./api";
import { useAuthStore } from "./auth-store";
import { refreshAccessToken } from "./auth";

function mergeHeaders(
  headers: RequestInit["headers"],
  body: RequestInit["body"]
) {
  const h = new Headers(headers || undefined);

  // If body is JSON string and no content-type set, set it
  if (typeof body === "string" && !h.has("content-type")) {
    h.set("content-type", "application/json");
  }

  return h;
}

export async function authedFetch<T>(path: string, options: RequestInit = {}) {
  const store = useAuthStore.getState();

  const call = (token: string | null) => {
    const headers = mergeHeaders(options.headers, options.body);
    return apiFetch<T>(path, { ...options, headers }, token);
  };

  try {
    return await call(store.accessToken);
  } catch (e: any) {
    if (e?.status === 401) {
      try {
        const newToken = await refreshAccessToken();

        // Persist new token in zustand so we don't refresh repeatedly
        useAuthStore.setState({ accessToken: newToken });

        return await call(newToken);
      } catch (refreshError: any) {
        // Only clear auth if refresh truly failed (not just a retry of the original request)
        // If the refresh token is invalid/expired, we need to logout
        if (refreshError?.status === 401 || refreshError?.message?.includes("session")) {
          useAuthStore.getState().clear();
          // Don't throw - let the calling code handle the redirect
          throw refreshError;
        }
        // For other errors, throw the original error
        throw e;
      }
    }
    throw e;
  }
}
