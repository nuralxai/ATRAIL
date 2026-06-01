"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { authedFetch } from "@/lib/authed-fetch";
import { toast } from "@/components/ui/toast";

type Organization = {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    users: number;
    projects: number;
  };
};

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const res = await authedFetch<{ ok: true; organizations: Organization[] }>("/organizations");
      setOrgs(res.organizations ?? []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const handleCreate = async () => {
    if (newName.trim().length < 2) return toast.error("Name too short");
    setBusy(true);
    try {
      await authedFetch("/organizations", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      toast.success("Organization created successfully");
      setCreateOpen(false);
      setNewName("");
      loadOrgs();
    } catch (e: any) {
      toast.error(e.message || "Creation failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${name}'?`)) return;
    try {
      await authedFetch(`/organizations/${id}`, { method: "DELETE" });
      toast.success("Organization Deleted");
      setOrgs(orgs.filter((o) => o.id !== id));
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AppShell
      title="Tenant Management"
      subtitle="Manage Multi-Tenant Organizations"
      right={
        <Button onClick={() => setCreateOpen(true)} disabled={loading}>
          + New Organization
        </Button>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <Input
              placeholder="Search organizations..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="text-center py-20 glass-panel border-primary/20">
            <h2 className="text-xl font-bold text-white">No Organizations Found</h2>
            <p className="text-text-muted mt-2">Create your first tenant to get started.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((org) => (
              <Card key={org.id} className="border-primary/20 hover:border-primary/30 transition-all">
                <CardHeader title={org.name} subtitle={`ID: ${org.id}`} />
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted font-bold uppercase tracking-wider">Users</span>
                      <span className="text-primary font-bold">{org._count.users}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted font-bold uppercase tracking-wider">Projects</span>
                      <span className="text-primary font-bold">{org._count.projects}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted font-bold uppercase tracking-wider">Created</span>
                      <span className="text-text-main">{new Date(org.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="pt-4 border-t border-primary/20">
                      <Button
                        variant="ghost"
                        className="w-full text-red-500 hover:bg-red-500/10 hover:text-red-400 border border-red-500/20"
                        onClick={() => handleDelete(org.id, org.name)}
                      >
                        Delete Tenant
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        title="Create New Tenant"
        subtitle="Add a new organization to the platform"
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy}>Create Organization</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-main mb-2">Organization Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Acme Corp"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
