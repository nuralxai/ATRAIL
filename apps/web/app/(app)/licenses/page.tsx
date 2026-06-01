"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";
import { confirm } from "@/components/ui/confirm";
import { 
  Key, 
  UserPlus, 
  UserMinus, 
  Eye, 
  EyeOff, 
  Calendar, 
  Layers, 
  AlertCircle, 
  DollarSign 
} from "lucide-react";

type Assignment = {
  id: string;
  assignedAt: string;
  revokedAt: string | null;
  remarks: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
};

type License = {
  id: string;
  name: string;
  version: string | null;
  type: "SUBSCRIPTION" | "PERPETUAL";
  licenseKey: string | null;
  numberOfSeats: number;
  assignedSeats: number;
  startDate: string | null;
  endDate: string | null;
  renewalType: string | null;
  invoiceNumber: string | null;
  paymentAmount: number | null;
  currency: string | null;
  paymentFrequency: string | null;
  notes: string | null;
  category: { id: string; name: string };
  subCategory: { id: string; name: string } | null;
  vendor: { id: string; name: string } | null;
  assignments: Assignment[];
};

type DirectoryUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

type Category = {
  id: string;
  name: string;
  subCategories: { id: string; name: string }[];
};

type Vendor = { id: string; name: string };

export default function LicensesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [licenses, setLicenses] = useState<License[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Modals
  const [detailsLicense, setDetailsLicense] = useState<License | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  // Key Visibility Map
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  // Assignment Form State
  const [assigningLicense, setAssigningLicense] = useState<License | null>(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [assignRemarks, setAssignRemarks] = useState("");

  // Create Form State
  const [newName, setNewName] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [newType, setNewType] = useState("SUBSCRIPTION");
  const [newKey, setNewKey] = useState("");
  const [newSeats, setNewSeats] = useState("1");
  const [newCategory, setNewCategory] = useState("");
  const [newSubCat, setNewSubCat] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newRenewal, setNewRenewal] = useState("AUTO");
  const [newInvoice, setNewInvoice] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newFreq, setNewFreq] = useState("ANNUAL");
  const [newNotes, setNewNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await authedFetch<{ ok: true; licenses: License[] }>("/licenses");
      setLicenses(res.licenses || []);

      if (isAdmin) {
        const [usersRes, catRes, vendorRes] = await Promise.all([
          authedFetch<{ ok: true; users: DirectoryUser[] }>("/users/directory"),
          authedFetch<{ ok: true; categories: Category[] }>("/licenses/categories"),
          authedFetch<{ ok: true; vendors: Vendor[] }>("/assets/vendors"),
        ]);
        setUsers(usersRes.users || []);
        setCategories(catRes.categories || []);
        setVendors(vendorRes.vendors || []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load software licenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!newName || !newCategory) {
      return toast.error("Software name and category are required");
    }
    setBusy(true);
    try {
      await authedFetch("/licenses", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          version: newVersion || null,
          type: newType,
          licenseKey: newKey || null,
          numberOfSeats: newSeats ? parseInt(newSeats) : 1,
          categoryId: newCategory,
          subCategoryId: newSubCat || null,
          vendorId: newVendor || null,
          startDate: newStartDate || null,
          endDate: newEndDate || null,
          renewalType: newRenewal,
          invoiceNumber: newInvoice || null,
          paymentAmount: newAmount ? parseFloat(newAmount) : null,
          paymentFrequency: newFreq || null,
          notes: newNotes || null
        })
      });
      toast.success("License registered successfully");
      setIsCreateOpen(false);
      // Reset form
      setNewName("");
      setNewVersion("");
      setNewType("SUBSCRIPTION");
      setNewKey("");
      setNewSeats("1");
      setNewCategory("");
      setNewSubCat("");
      setNewVendor("");
      setNewStartDate("");
      setNewEndDate("");
      setNewRenewal("AUTO");
      setNewInvoice("");
      setNewAmount("");
      setNewFreq("ANNUAL");
      setNewNotes("");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to create license");
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async () => {
    if (!assigningLicense || !selectedUser) return;
    setBusy(true);
    try {
      await authedFetch(`/licenses/${assigningLicense.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId: selectedUser, remarks: assignRemarks })
      });
      toast.success("Seat assigned successfully");
      setIsAssignOpen(false);
      setAssigningLicense(null);
      setSelectedUser("");
      setAssignRemarks("");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Assignment failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (license: License, assign: Assignment) => {
    const ok = await confirm({
      title: "Revoke License Seat?",
      message: `Are you sure you want to revoke the seat assigned to ${assign.user.fullName}?`,
      confirmText: "Revoke Seat"
    });
    if (!ok) return;

    setBusy(true);
    try {
      await authedFetch(`/licenses/${license.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ assignmentId: assign.id })
      });
      toast.success("Seat allocation revoked successfully");
      // Update details view if open
      if (detailsLicense && detailsLicense.id === license.id) {
        setDetailsLicense(prev => {
          if (!prev) return null;
          return {
            ...prev,
            assignedSeats: Math.max(0, prev.assignedSeats - 1),
            assignments: prev.assignments.filter(a => a.id !== assign.id)
          };
        });
      }
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to revoke seat");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (license: License) => {
    const ok = await confirm({
      title: "Delete License?",
      message: `Are you sure you want to delete the ${license.name} software suite? All seats assignments will be deleted.`,
      confirmText: "Delete Suite"
    });
    if (!ok) return;

    setBusy(true);
    try {
      await authedFetch(`/licenses/${license.id}`, { method: "DELETE" });
      toast.success("License suite deleted");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete license");
    } finally {
      setBusy(false);
    }
  };

  // Expiration highlight
  const getExpirationBadge = (endDateStr: string | null) => {
    if (!endDateStr) return <Badge tone="neutral">No Expiration</Badge>;
    const daysLeft = Math.ceil((new Date(endDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return <Badge tone="red">Expired</Badge>;
    if (daysLeft <= 30) return <Badge tone="amber">{daysLeft} Days Left</Badge>;
    return <Badge tone="green">{new Date(endDateStr).toLocaleDateString()}</Badge>;
  };

  // Metrics calculations
  const totalSeats = licenses.reduce((acc, l) => acc + l.numberOfSeats, 0);
  const assignedSeats = licenses.reduce((acc, l) => acc + l.assignedSeats, 0);
  const freeSeats = totalSeats - assignedSeats;

  // Toggle visual key
  const toggleKey = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const activeSubCategories = categories.find(c => c.id === newCategory)?.subCategories || [];

  return (
    <AppShell
      title="Software Licenses"
      subtitle="Manage premium software allocations, license keys, and subscription billing"
      right={
        isAdmin ? (
          <Button onClick={() => setIsCreateOpen(true)}>+ Add License</Button>
        ) : undefined
      }
    >
      {/* ── Metric Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="hover:scale-[1.01] transition-transform duration-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Key size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{licenses.length}</div>
              <div className="text-xs text-text-muted">Software Products</div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:scale-[1.01] transition-transform duration-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
              <Layers size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-500">{totalSeats}</div>
              <div className="text-xs text-text-muted">Total Seat Pool</div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:scale-[1.01] transition-transform duration-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20 text-green-500">
              <UserPlus size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">{assignedSeats}</div>
              <div className="text-xs text-text-muted">Seats Allocated</div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:scale-[1.01] transition-transform duration-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-500/10 border border-zinc-500/20 text-zinc-400">
              <UserMinus size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{freeSeats}</div>
              <div className="text-xs text-text-muted">Available Seats</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Expiration Alert Banner ── */}
      {licenses.some(l => l.endDate && Math.ceil((new Date(l.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 30) && (
        <Card className="mb-6 border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="text-amber-500 mt-0.5"><AlertCircle size={18} /></div>
            <div>
              <div className="text-sm font-bold text-white">License Expirations Warning</div>
              <p className="text-xs text-text-muted mt-0.5">
                Some software subscriptions are expiring in less than 30 days. Review billing frequencies and renewal triggers below.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Software Suites Table ── */}
      <Card>
        <CardHeader title="All Registered Licenses" subtitle="Assigned seats automatically increment seat counters" />
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-text-muted">Loading software suites...</div>
          ) : licenses.length === 0 ? (
            <div className="p-12 text-center text-text-muted">
              <Key className="mx-auto mb-2 text-primary/40" size={32} />
              No software licenses registered. Click "+ Add License" to track subscription metrics.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-primary/20 bg-zinc-900/30 text-xs font-semibold text-primary uppercase tracking-wider">
                    <th className="px-5 py-3.5">Software Suite</th>
                    <th className="px-5 py-3.5">Assigned Seats</th>
                    <th className="px-5 py-3.5">License Key preview</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Expiration / Renewal</th>
                    {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {licenses.map((lic) => {
                    const isKeyVisible = !!visibleKeys[lic.id];
                    const percent = Math.round((lic.assignedSeats / lic.numberOfSeats) * 100);

                    return (
                      <tr 
                        key={lic.id} 
                        className="hover:bg-zinc-800/20 transition-colors group cursor-pointer"
                        onClick={() => setDetailsLicense(lic)}
                      >
                        <td className="px-5 py-4">
                          <div>
                            <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                              {lic.name}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                              {lic.category.name} {lic.version && `• v${lic.version}`}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-bold text-white whitespace-nowrap">
                              {lic.assignedSeats} / {lic.numberOfSeats}
                            </div>
                            <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden hidden sm:block">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  percent >= 90 ? "bg-red-500" : percent >= 75 ? "bg-amber-500" : "bg-primary"
                                }`}
                                style={{ width: `${Math.min(100, percent)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                          {lic.licenseKey ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-text-muted tracking-tight select-all">
                                {isKeyVisible ? lic.licenseKey : "••••••••••••••••••••"}
                              </span>
                              <button 
                                onClick={() => toggleKey(lic.id)}
                                className="text-text-muted hover:text-primary transition"
                              >
                                {isKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted italic">No key registered</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={lic.type === "PERPETUAL" ? "neutral" : "blue"}>{lic.type}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <div>{getExpirationBadge(lic.endDate)}</div>
                            {lic.renewalType && (
                              <span className="text-[10px] text-text-muted font-bold tracking-wide uppercase">
                                {lic.renewalType} Renewal
                              </span>
                            )}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              {lic.assignedSeats < lic.numberOfSeats && (
                                <Button 
                                  variant="secondary" 
                                  className="px-2 py-1 text-xs"
                                  onClick={() => {
                                    setAssigningLicense(lic);
                                    setIsAssignOpen(true);
                                  }}
                                  disabled={busy}
                                >
                                  Assign
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
                                onClick={() => handleDelete(lic)}
                                disabled={busy}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Modals ── */}

      {/* DETAILED VIEW MODAL */}
      <Modal
        open={!!detailsLicense}
        onClose={() => setDetailsLicense(null)}
        title={detailsLicense?.name || "License Details"}
        subtitle={detailsLicense?.category?.name || "Software Suite"}
      >
        {detailsLicense && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl border border-primary/10 bg-zinc-900/40">
                <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1">Specifications</div>
                <p className="text-sm text-white font-medium">Type: {detailsLicense.type}</p>
                <p className="text-sm text-white font-medium mt-1">Version: {detailsLicense.version || "N/A"}</p>
                <p className="text-sm text-white font-medium mt-1">Renewal: {detailsLicense.renewalType || "AUTO"}</p>
              </div>

              <div className="p-3 rounded-xl border border-primary/10 bg-zinc-900/40">
                <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1">Billing Details</div>
                <p className="text-sm text-white font-medium">Cost: {detailsLicense.paymentAmount ? `$${detailsLicense.paymentAmount.toLocaleString()}` : "N/A"}</p>
                <p className="text-sm text-white font-medium mt-1">Invoice: {detailsLicense.invoiceNumber || "N/A"}</p>
                <p className="text-sm text-white font-medium mt-1">Freq: {detailsLicense.paymentFrequency || "ANNUAL"}</p>
              </div>
            </div>

            {/* License Key Reveal Panel */}
            {detailsLicense.licenseKey && (
              <div className="p-3 rounded-xl border border-primary/10 bg-zinc-900/50 flex justify-between items-center">
                <div>
                  <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1">License Activation Key</div>
                  <span className="font-mono text-sm text-primary select-all">
                    {visibleKeys[detailsLicense.id] ? detailsLicense.licenseKey : "••••••••••••••••••••••••••••••"}
                  </span>
                </div>
                <Button variant="ghost" onClick={() => toggleKey(detailsLicense.id)}>
                  {visibleKeys[detailsLicense.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            )}

            {/* Dates Panel */}
            <div className="p-4 rounded-xl border border-primary/10 bg-zinc-900/40 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Start Date</span>
                <p className="text-sm text-white font-medium mt-0.5">
                  {detailsLicense.startDate ? new Date(detailsLicense.startDate).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Expiration Date</span>
                <div className="mt-0.5">{getExpirationBadge(detailsLicense.endDate)}</div>
              </div>
            </div>

            {/* Notes Panel */}
            {detailsLicense.notes && (
              <div className="p-4 rounded-xl border border-primary/10 bg-zinc-900/40">
                <span className="text-xs font-bold text-primary">Licensing Notes</span>
                <p className="text-xs text-text-main mt-1 whitespace-pre-wrap leading-relaxed">
                  "{detailsLicense.notes}"
                </p>
              </div>
            )}

            {/* Active Assignments */}
            <div className="p-4 rounded-xl border border-primary/10 bg-zinc-900/40">
              <div className="text-xs font-bold text-primary mb-2">
                Active Seat Assignments ({detailsLicense.assignments.length})
              </div>
              {detailsLicense.assignments.length === 0 ? (
                <div className="text-xs text-text-muted italic">No seats currently allocated. All seats are free in the pool.</div>
              ) : (
                <div className="divide-y divide-zinc-800/80">
                  {detailsLicense.assignments.map((assign) => (
                    <div key={assign.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-white">{assign.user.fullName}</div>
                        <div className="text-xs text-text-muted">{assign.user.email}</div>
                        {assign.remarks && <p className="text-[10px] text-text-main italic mt-0.5">"{assign.remarks}"</p>}
                      </div>
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-1"
                          onClick={() => handleRevoke(detailsLicense, assign)}
                          disabled={busy}
                        >
                          <UserMinus size={12} /> Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ALLOCATE / ASSIGN SEAT MODAL */}
      <Modal
        open={isAssignOpen}
        onClose={() => {
          setIsAssignOpen(false);
          setAssigningLicense(null);
          setSelectedUser("");
          setAssignRemarks("");
        }}
        title={`Allocate License Seat: ${assigningLicense?.name}`}
        subtitle={`${assigningLicense?.assignedSeats} / ${assigningLicense?.numberOfSeats} seats currently in use`}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={busy || !selectedUser}>
              Allocate Seat
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Select Operative</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary bg-zinc-950"
            >
              <option value="">-- Choose employee --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Assignment Description</label>
            <Textarea
              value={assignRemarks}
              onChange={(e) => setAssignRemarks(e.target.value)}
              placeholder="E.g., Engineering pack license for UI development. Active on employee's primary workstation."
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* CREATE NEW LICENSE DIALOG MODAL */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Software License Suite"
        subtitle="Manage keys and circular progress trackers."
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={busy || !newName || !newCategory}>
              Register License
            </Button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Software Suite Name"
                placeholder="JetBrains All Products Pack"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                label="Category *"
                placeholder="Developer Tools"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Input
                label="Version"
                placeholder="2026.1"
                value={newVersion}
                onChange={(e) => setNewVersion(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Billing Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary bg-zinc-950"
              >
                <option value="SUBSCRIPTION">Subscription</option>
                <option value="PERPETUAL">Perpetual</option>
              </select>
            </div>
            <div>
              <Input
                label="Number of Seats"
                type="number"
                min="1"
                value={newSeats}
                onChange={(e) => setNewSeats(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Sub-category"
                placeholder="IDE Licenses"
                value={newSubCat}
                onChange={(e) => setNewSubCat(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Procurement Vendor"
                placeholder="JetBrains s.r.o."
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Input
              label="Activation / License Key"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Input
                label="Procurement Cost ($)"
                type="number"
                placeholder="1200.00"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Renewal Cycle</label>
              <select
                value={newRenewal}
                onChange={(e) => setNewRenewal(e.target.value)}
                className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary bg-zinc-950"
              >
                <option value="AUTO">Auto-renew</option>
                <option value="MANUAL">Manual trigger</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Payment Cycle</label>
              <select
                value={newFreq}
                onChange={(e) => setNewFreq(e.target.value)}
                className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary bg-zinc-950"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
                <option value="ONE_TIME">One Time</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Activation Date"
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Subscription Expiration Date"
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Input
              label="Invoice Reference ID"
              placeholder="INV-XXXXX"
              value={newInvoice}
              onChange={(e) => setNewInvoice(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Licensing Remarks</label>
            <Textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Describe software application notes, download locations, or distribution channels."
              rows={3}
            />
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
