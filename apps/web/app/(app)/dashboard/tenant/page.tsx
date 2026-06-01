"use client";

import AppShell from "@/components/AppShell";
import { useAuthStore } from "@/lib/auth-store";

export default function TenantDashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <AppShell title="Tenant Dashboard" subtitle="Welcome back">
      <div className="space-y-6">
        <div className="p-6 rounded-2xl glass-panel border border-primary/20">
          <h2 className="text-lg font-bold text-white mb-2">Welcome, {user?.fullName}</h2>
          <p className="text-text-muted">
            As a Tenant, you have access to your assigned projects, chats, and documents.
            Use the sidebar to navigate to your available tools.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
