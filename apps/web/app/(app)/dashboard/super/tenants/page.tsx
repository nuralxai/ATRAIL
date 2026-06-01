"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { getOrganizations, updateOrganization } from "@/lib/api-extensions";
import { useAuthStore } from "@/lib/auth-store";
import { Building2, Edit, Save, X, Users, Briefcase, Eye } from "lucide-react";

type Organization = {
  id: string;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  _count?: {
    users: number;
    projects: number;
  };
};

export default function TenantsPage() {
  const token = useAuthStore((state) => state.accessToken);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Edit Form State
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadOrgs();
  }, [token]);

  const loadOrgs = async () => {
    if (!token) return;
    try {
      const res = await getOrganizations(token);
      if (res.ok) setOrganizations(res.organizations);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (org: Organization) => {
    setEditingId(org.id);
    setEditName(org.name);
    setEditLogo(org.logoUrl || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditLogo("");
  };

  const handleSaveEdit = async (orgId: string) => {
    if (!token) return;
    if (!editName.trim()) {
      alert("Company Name cannot be empty.");
      return;
    }
    setBusy(true);
    try {
      const res = await updateOrganization(token, orgId, {
        name: editName.trim(),
        logoUrl: editLogo.trim() || null
      });
      if (res.ok) {
        setOrganizations(orgs => orgs.map(o => o.id === orgId ? { ...o, name: res.organization.name, logoUrl: res.organization.logoUrl } : o));
        setEditingId(null);
      } else {
        alert(res.message || "Failed to update organization");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Tenant Management" subtitle="Profile and manage organizations across the platform.">
      <div className="max-w-5xl mx-auto py-6">
        
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-12 text-text-muted">No tenants found.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => {
              const isEditing = editingId === org.id;

              return (
                <div key={org.id} className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                  
                  {/* Card Header (Logo & Name) */}
                  <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex items-center gap-4">
                    {org.logoUrl && !isEditing ? (
                      <div className="w-12 h-12 rounded-lg bg-white shadow-sm border border-zinc-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        <img src={org.logoUrl} alt={org.name} className="max-w-full max-h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-200 flex items-center justify-center flex-shrink-0 text-text-muted">
                        <Building2 strokeWidth={1.5} className="w-6 h-6 currentColor" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 text-sm font-semibold text-zinc-900 border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Company name"
                        />
                      ) : (
                        <h3 className="text-lg font-bold text-zinc-900 truncate">{org.name}</h3>
                      )}
                      
                      {!isEditing && (
                        <p className="text-xs text-text-muted truncate font-mono">ID: {org.id}</p>
                      )}
                    </div>
                  </div>

                  {/* Card Body (Stats & Edits) */}
                  <div className="p-5 flex-1 flex flex-col gap-4">
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Logo URL</label>
                        <input
                          type="url"
                          value={editLogo}
                          onChange={(e) => setEditLogo(e.target.value)}
                          className="w-full px-3 py-2 text-sm text-zinc-900 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="https://example.com/logo.png"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 mt-auto">
                        <div className="bg-zinc-50 rounded-xl p-3 flex flex-col items-center justify-center border border-zinc-100">
                           <Users className="w-5 h-5 text-text-muted mb-1" />
                           <span className="text-lg font-bold text-zinc-800">{org._count?.users || 0}</span>
                           <span className="text-[10px] font-semibold text-text-muted uppercase">Users</span>
                        </div>
                        <div className="bg-zinc-50 rounded-xl p-3 flex flex-col items-center justify-center border border-zinc-100">
                           <Briefcase className="w-5 h-5 text-text-muted mb-1" />
                           <span className="text-lg font-bold text-zinc-800">{org._count?.projects || 0}</span>
                           <span className="text-[10px] font-semibold text-text-muted uppercase">Projects</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer (Actions) */}
                  <div className="p-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-2 justify-end">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleCancelEdit}
                          disabled={busy}
                          className="px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(org.id)}
                          disabled={busy}
                          className="px-3 py-1.5 text-xs font-semibold text-white glass-panel rounded-lg hover:bg-zinc-800 transition flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" /> {busy ? "Saving..." : "Save Profile"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEditClick(org)}
                        className="px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-lg shadow-sm hover:border-zinc-300 hover:bg-zinc-50 transition flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit Profile
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
