"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "../lib/auth-store";
import { getMe, refreshAccessToken } from "../lib/auth";
import { API_BASE } from "../lib/config";

export default function Protected({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const { accessToken, user, setAuth, clear } = useAuthStore();
  const [ready, setReady]       = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const refreshing = useRef(false);

  // Step 1 — wait for Zustand to rehydrate from localStorage (one tick)
  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;

    let mounted = true;

    // ── Fast path: token + user already in store → show content instantly ──
    // Kick off a silent background refresh so the user object stays fresh,
    // but do NOT block the render on it.
    if (accessToken && user) {
      setReady(true);

      if (!refreshing.current) {
        refreshing.current = true;
        getMe(accessToken)
          .then((me) => { if (mounted && me?.user) setAuth(accessToken, me.user); })
          .catch(async () => {
            // Access token expired — try silent refresh
            try {
              const newToken = await refreshAccessToken();
              if (!newToken) { if (mounted) clear(); return; }
              const me = await getMe(newToken);
              if (mounted) setAuth(newToken, me.user);
            } catch {
              if (mounted) clear();
            }
          })
          .finally(() => { refreshing.current = false; });
      }
      return () => { mounted = false; };
    }

    // ── Slow path: no token/user in store → full boot (first load / after logout) ──
    const boot = async () => {
      try {
        const token = await refreshAccessToken().catch(() => null);
        if (!token) { if (mounted) clear(); return; }
        const me = await getMe(token);
        if (mounted) setAuth(token, me.user);
      } catch {
        if (mounted) clear();
      } finally {
        if (mounted) setReady(true);
      }
    };

    boot();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Redirect to login when not authenticated, or to profile if incomplete
  useEffect(() => {
    if (!ready) return;
    if (!user) {
      if (pathname !== "/login" && pathname !== "/") {
        router.replace("/login");
      }
      return;
    }

    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return;
    if (pathname === "/profile") return;

    let active = true;
    const checkProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/profile/me`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();
        if (active && data.ok && !data.isComplete) {
          router.replace("/profile");
        }
      } catch (err) {
        console.error("Profile check error:", err);
      }
    };

    checkProfile();
    return () => {
      active = false;
    };
  }, [ready, user, pathname, router, accessToken]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#020b18" }}>
        <div
          className="flex flex-col items-center gap-4 p-8 rounded-2xl"
          style={{
            background: "rgba(6,22,40,0.8)",
            border: "1px solid rgba(0,212,255,0.12)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div
            className="w-10 h-10 rounded-full border-2 border-transparent border-t-[#00d4ff]"
            style={{ animation: "spin 0.7s linear infinite" }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p className="text-sm text-[#64748b] font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
