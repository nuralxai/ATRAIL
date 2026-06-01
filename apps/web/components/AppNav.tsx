"use client";

import Link from "next/link";
import { useAuthStore } from "../lib/auth-store";

function dashboardPath(role?: string) {
  if (role === "SUPER_ADMIN") return "/dashboard/super";
  if (role === "ADMIN") return "/dashboard/admin";
  if (role === "ELITE") return "/dashboard/elite";
  if (role === "TENANT") return "/dashboard/tenant";
  if (role === "USER") return "/dashboard/user";
  return "/login";
}

export default function AppNav() {
  const { user } = useAuthStore();

  if (!user) return null;

  const NAV = [
    { href: dashboardPath(user.role), label: "Dashboard" },
    // Renewal OS
    { href: "/renewals", label: "Renewals" },
    { href: "/dashboard/customers", label: "Customers" },
    { href: "/commissions", label: "Commissions" },
    { href: "/finance", label: "Finance" },
    { href: "/licenses", label: "Licenses" },
    // Existing
    { href: "/attendance", label: "Attendance", roles: ["SUPER_ADMIN", "ADMIN", "ELITE", "USER"] },
    { href: "/chat", label: "Chat" },
    { href: "/projects", label: "Projects" },
    { href: "/tasks", label: "Tasks", roles: ["SUPER_ADMIN", "ADMIN", "ELITE", "USER"] },
    { href: "/calendar", label: "Calendar" },
    { href: "/directory", label: "Directory", roles: ["SUPER_ADMIN", "ADMIN"] },
    { href: "/notices", label: "Notices" },
    { href: "/emergency", label: "Emergency" },
  ];

  const items = NAV.filter((n) =>
    !n.roles ? true : !!user.role && n.roles.includes(user.role)
  );

  return (
    <div className="border-b border-primary/20 bg-brand-black shadow-md">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center"
            style={{ width: "50px", height: "50px" }}
          >
            <img src="/icon.png" alt="AMGI Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight text-primary">
              ATRAIL
            </div>
            <div className="text-xs text-primary-light leading-tight">
              {user.fullName} • <span className="text-text-muted">{user.role}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="text-sm text-text-main hover:text-primary hover:underline transition-colors"
            >
              {it.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
