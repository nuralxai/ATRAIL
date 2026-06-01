"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authedFetch } from "@/lib/authed-fetch";
import AppShell from "@/components/AppShell";
import { toast } from "@/components/ui/toast";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Processing authentication...");

  useEffect(() => {
    const code = searchParams.get("code");
    const provider = searchParams.get("state"); // read from OAuth state param

    if (!code) {
      setStatus("No authentication code found. Redirecting...");
      setTimeout(() => router.push("/settings"), 2000);
      return;
    }

    const processAuth = async () => {
      try {
        const endpoint = provider === "microsoft" 
          ? "/integrations/microsoft/callback" 
          : "/integrations/google/callback";

        await authedFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({ code }),
        });
        
        toast.success(`Successfully connected ${provider === "microsoft" ? "Microsoft" : "Google"} account!`);
        router.push("/settings");
      } catch (e: any) {
        setStatus(`Error connecting account: ${e.message}`);
        setTimeout(() => router.push("/settings"), 3000);
      }
    };

    processAuth();
  }, [router, searchParams]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-text-muted">{status}</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <AppShell title="Connecting Account..." subtitle="Please wait">
      <Suspense fallback={<div className="p-8 text-center text-text-muted">Loading...</div>}>
        <CallbackContent />
      </Suspense>
    </AppShell>
  );
}
