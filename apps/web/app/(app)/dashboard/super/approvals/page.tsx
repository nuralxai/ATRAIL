"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { authedFetch } from "@/lib/authed-fetch";
import Skeleton from "@/components/ui/Skeleton";
import { CheckCircle } from "lucide-react";

type PendingUser = {
  id: string;
  fullName: string;
  email: string;
  companyName: string;
  phone: string;
  createdAt: string;
};

export default function ApprovalsPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await authedFetch<{ ok: true; users: PendingUser[] }>("/users/pending");
      setUsers(res.users ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (userId: string, role: string) => {
    setProcessing(userId);
    try {
      await authedFetch(`/users/${userId}/approve`, {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      setUsers(users.filter((u) => u.id !== userId));
    } catch (e: any) {
      alert(e.message || "Approval failed");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <AppShell title="User Approvals" subtitle="Review and approve pending KYC registrations.">
      <div className="space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : users.length === 0 ? (
          <Card className="text-center py-20 glass-panel/20 border-primary/20/40">
             <div className="mb-4 opacity-20 flex justify-center text-green-500"><CheckCircle size={64} /></div>
             <h2 className="text-xl font-bold text-text-muted">No pending approvals</h2>
             <p className="text-zinc-600 mt-1">All user registrations have been processed.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((user) => (
              <Card key={user.id} className="border-primary/20 hover:border-primary/30 transition-all duration-300">
                <CardHeader title={user.fullName} subtitle={user.email} />
                <CardContent>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted uppercase font-bold tracking-tighter">Company</span>
                      <span className="text-zinc-200">{user.companyName}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted uppercase font-bold tracking-tighter">Phone</span>
                      <span className="text-zinc-200">{user.phone}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted uppercase font-bold tracking-tighter">Registered</span>
                      <span className="text-zinc-200">{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      disabled={processing !== null}
                      onClick={() => handleApprove(user.id, "USER")}
                      className="text-xs h-9 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                    >
                      {processing === user.id ? "..." : "As User"}
                    </Button>
                    <Button 
                      disabled={processing !== null}
                      onClick={() => handleApprove(user.id, "ADMIN")}
                      className="text-xs h-9 border-primary/50 text-primary hover:bg-primary hover:text-black"
                    >
                       {processing === user.id ? "..." : "As Admin"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
