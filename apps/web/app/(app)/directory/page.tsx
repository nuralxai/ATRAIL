"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";

type DirectoryUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone: string | null;
  companyName: string | null;
  status: string;
  reportsTo: { id: string; fullName: string; role: string } | null;
};

type DirectoryData = {
  users: DirectoryUser[];
  grouped: Record<string, DirectoryUser[]>;
};

export default function DirectoryPage() {
  const [data, setData] = useState<DirectoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState<{ open: boolean; targetUser: DirectoryUser | null }>({
    open: false,
    targetUser: null,
  });
  const [selectedManager, setSelectedManager] = useState("");

  const [roleModal, setRoleModal] = useState<{ open: boolean; targetUser: DirectoryUser | null }>({
    open: false,
    targetUser: null,
  });
  const [selectedRole, setSelectedRole] = useState("");

  const me = useAuthStore((s) => s.user);

  const load = async () => {
    try {
      const res = await authedFetch<{ ok: true; users: DirectoryUser[]; grouped: Record<string, DirectoryUser[]> }>(
        "/users/directory"
      );
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAssign = async () => {
    if (!assignModal.targetUser || !selectedManager) return;
    try {
      await authedFetch(`/users/${assignModal.targetUser.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ reportsToId: selectedManager }),
      });
      setAssignModal({ open: false, targetUser: null });
      setSelectedManager("");
      load(); // Reload directory
    } catch (e: any) {
      alert(e.message || "Failed to assign manager. Please check permissions.");
    }
  };

  const handleChangeRole = async () => {
    if (!roleModal.targetUser || !selectedRole) return;
    try {
      await authedFetch(`/users/${roleModal.targetUser.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: selectedRole }),
      });
      setRoleModal({ open: false, targetUser: null });
      setSelectedRole("");
      load(); // Reload directory
    } catch (e: any) {
      alert(e.message || "Failed to change role. Please check permissions.");
    }
  };

  const [createUserModal, setCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ fullName: "", email: "", password: "", role: "USER" });

  const handleCreateUser = async () => {
    try {
      await authedFetch("/users", {
        method: "POST",
        body: JSON.stringify(newUser),
      });
      setCreateUserModal(false);
      setNewUser({ fullName: "", email: "", password: "", role: "USER" });
      load();
    } catch (e: any) {
      alert(e.message || "Failed to create user.");
    }
  };

  // Get valid managers based on the target user's role
  const getValidManagers = (targetRole: string) => {
    if (!data) return [];
    if (targetRole === "ELITE") {
      // Elites report to Admins or Super Admins
      return [...(data.grouped["ADMIN"] || []), ...(data.grouped["SUPER_ADMIN"] || [])];
    }
    if (targetRole === "USER") {
      // Interns/Users report to Elites
      return data.grouped["ELITE"] || [];
    }
    return [];
  };

  return (
    <AppShell 
      title="Organization Directory" 
      subtitle="Manage teams and reporting structures"
      right={
        (me?.role === "ADMIN" || me?.role === "SUPER_ADMIN") && (
          <Button onClick={() => setCreateUserModal(true)}>+ Create User</Button>
        )
      }
    >
      <div className="space-y-6">
        {loading ? (
          <div className="text-text-muted">Loading directory...</div>
        ) : !data ? (
          <div className="text-red-400">Failed to load directory.</div>
        ) : (
          ["SUPER_ADMIN", "ADMIN", "ELITE", "TENANT", "USER"].map((roleKey) => {
            const roleUsers = data.grouped[roleKey] || [];
            if (roleUsers.length === 0) return null;

            return (
              <Card key={roleKey} className="border-primary/20">
                <CardHeader title={roleKey.replace("_", " ")} subtitle={`${roleUsers.length} members`} />
                <CardContent>
                  <div className="divide-y divide-zinc-800">
                    {roleUsers.map((u) => (
                      <div key={u.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <p className="text-white font-medium flex items-center gap-2">
                            {u.fullName}
                            {u.status === "PENDING" && <Badge tone="amber">Pending</Badge>}
                          </p>
                          <p className="text-sm text-text-muted">{u.email} {u.phone && `• ${u.phone}`}</p>
                          {u.reportsTo && (
                            <p className="text-xs text-primary mt-1">
                              Reports To: {u.reportsTo.fullName} ({u.reportsTo.role})
                            </p>
                          )}
                        </div>
                        
                        {(u.role === "ELITE" || u.role === "USER" || u.role === "INTERN") && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setRoleModal({ open: true, targetUser: u });
                                setSelectedRole(u.role);
                              }}
                              className="text-xs"
                            >
                              Change Role
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setAssignModal({ open: true, targetUser: u })}
                              className="text-xs"
                            >
                              Assign Manager
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        open={assignModal.open}
        onClose={() => setAssignModal({ open: false, targetUser: null })}
        title={`Assign Manager to ${assignModal.targetUser?.fullName}`}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setAssignModal({ open: false, targetUser: null })}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!selectedManager}>
              Confirm Assignment
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Select the new reporting manager for this user. The chat boundaries and project access will be securely updated.
          </p>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Select Manager
            </label>
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="w-full glass-panel border border-primary/20 rounded-lg px-3 py-2 text-white outline-none focus:border-primary"
            >
              <option value="" disabled>-- Choose a manager --</option>
              {assignModal.targetUser &&
                getValidManagers(assignModal.targetUser.role).map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.fullName} ({manager.role})
                  </option>
                ))}
            </select>
            {assignModal.targetUser && getValidManagers(assignModal.targetUser.role).length === 0 && (
              <p className="text-xs text-red-400 mt-2">No valid managers exist for this role level.</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={roleModal.open}
        onClose={() => setRoleModal({ open: false, targetUser: null })}
        title={`Change Role for ${roleModal.targetUser?.fullName}`}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setRoleModal({ open: false, targetUser: null })}>
              Cancel
            </Button>
            <Button onClick={handleChangeRole} disabled={!selectedRole || selectedRole === roleModal.targetUser?.role}>
              Confirm Change
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Select the new role for this user. This affects their system permissions and module access.
          </p>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">
              Select Role
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full glass-panel border border-primary/20 rounded-lg px-3 py-2 text-white outline-none focus:border-primary"
            >
              <option value="" disabled>-- Choose a role --</option>
              <option value="INTERN">Intern</option>
              <option value="USER">User</option>
              <option value="TENANT">Tenant (Client)</option>
              <option value="ELITE">Elite / Team Lead</option>
              {me?.role === "SUPER_ADMIN" && <option value="ADMIN">Admin</option>}
              {me?.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin</option>}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={createUserModal}
        onClose={() => setCreateUserModal(false)}
        title="Create New User"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setCreateUserModal(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={!newUser.fullName || !newUser.email || !newUser.password}>Create</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Add a new operative. Only Admins can perform this action.</p>
          
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Full Name</label>
            <input 
              className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
              value={newUser.fullName} onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Email</label>
            <input 
              type="email"
              className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
              value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              placeholder="john@atrail.org.in"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Temporary Password</label>
            <input 
              className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
              value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              placeholder="ChangeMe@123"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Role</label>
            <select
              className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
              value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})}
            >
              <option value="INTERN">Intern</option>
              <option value="USER">User</option>
              <option value="TENANT">Tenant</option>
              <option value="ELITE">Elite / Team Lead</option>
              {me?.role === "SUPER_ADMIN" && <option value="ADMIN">Admin</option>}
              {me?.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin</option>}
            </select>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
