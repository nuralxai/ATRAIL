"use client";

import AppShell from "../../components/AppShell";

// Shared persistent layout — AppShell (sidebar + Protected + AiAssistant) mounts ONCE.
// When inner pages render <AppShell title="X">, the nested-detection logic in AppShell
// just updates the header without remounting anything.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell title="">{children}</AppShell>;
}
