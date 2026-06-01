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
  Laptop, 
  Wrench, 
  Trash2, 
  CheckCircle, 
  UserCheck, 
  FileText, 
  ShieldAlert, 
  History,
  Calendar,
  DollarSign
} from "lucide-react";

type Asset = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  assetTag: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  amcStart: string | null;
  amcEnd: string | null;
  invoiceNumber: string | null;
  purchaseCost: number | null;
  currentValue: number | null;
  status: "ACTIVE" | "INACTIVE" | "REPAIR" | "DISPOSED";
  ipAddress: string | null;
  macAddress: string | null;
  osInstalled: string | null;
  assetCondition: string | null;
  remarks: string | null;
  category: { id: string; name: string };
  subCategory: { id: string; name: string } | null;
  vendor: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  custodian: { id: string; fullName: string; email: string } | null;
  allocations: {
    id: string;
    allocatedAt: string;
    returnedAt: string | null;
    remarks: string | null;
    user: { id: string; fullName: string; email: string };
  }[];
  maintenance: {
    id: string;
    maintenanceDate: string;
    description: string;
    cost: number | null;
    performedBy: string | null;
    nextDueDate: string | null;
  }[];
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

type Branch = { id: string; name: string };
type Department = { id: string; name: string };
type Vendor = { id: string; name: string };

export default function AssetsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Modals
  const [detailsAsset, setDetailsAsset] = useState<Asset | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  // Allocation State
  const [allocatingAsset, setAllocatingAsset] = useState<Asset | null>(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [allocRemarks, setAllocRemarks] = useState("");

  // Maintenance State
  const [maintenanceAsset, setMaintenanceAsset] = useState<Asset | null>(null);
  const [maintDesc, setMaintDesc] = useState("");
  const [maintCost, setMaintCost] = useState("");
  const [maintPerformer, setMaintPerformer] = useState("");
  const [maintDate, setMaintDate] = useState(new Date().toISOString().split("T")[0]);
  const [maintNextDate, setMaintNextDate] = useState("");
  const [maintStatus, setMaintStatus] = useState("REPAIR");

  // Create Form State
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSubCat, setNewSubCat] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newPurchDate, setNewPurchDate] = useState("");
  const [newWarrantyStart, setNewWarrantyStart] = useState("");
  const [newWarrantyEnd, setNewWarrantyEnd] = useState("");
  const [newCondition, setNewCondition] = useState("EXCELLENT");
  const [newRemarks, setNewRemarks] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      // Build query string
      let qs = "?";
      if (search) qs += `search=${encodeURIComponent(search)}&`;
      if (statusFilter) qs += `status=${statusFilter}&`;
      if (branchFilter) qs += `branchId=${branchFilter}&`;
      if (categoryFilter) qs += `categoryId=${categoryFilter}&`;

      const res = await authedFetch<{ ok: true; assets: Asset[] }>(`/assets${qs}`);
      setAssets(res.assets || []);

      if (isAdmin) {
        // Fetch metadata
        const [usersRes, catRes, branchRes, deptRes, vendorRes] = await Promise.all([
          authedFetch<{ ok: true; users: DirectoryUser[] }>("/users/directory"),
          authedFetch<{ ok: true; categories: Category[] }>("/assets/categories"),
          authedFetch<{ ok: true; branches: Branch[] }>("/assets/branches"),
          authedFetch<{ ok: true; departments: Department[] }>("/assets/departments"),
          authedFetch<{ ok: true; vendors: Vendor[] }>("/assets/vendors"),
        ]);
        setUsers(usersRes.users || []);
        setCategories(catRes.categories || []);
        setBranches(branchRes.branches || []);
        setDepartments(deptRes.departments || []);
        setVendors(vendorRes.vendors || []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, branchFilter, categoryFilter]);

  const handleCreate = async () => {
    if (!newName || !newCategory) {
      return toast.error("Asset Name and Category are required");
    }
    setBusy(true);
    try {
      await authedFetch("/assets", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          brand: newBrand || null,
          model: newModel || null,
          assetTag: newTag || null,
          serialNumber: newSerial || null,
          categoryId: newCategory,
          subCategoryId: newSubCat || null,
          vendorId: newVendor || null,
          branchId: newBranch || null,
          departmentId: newDept || null,
          purchaseCost: newCost ? parseFloat(newCost) : null,
          purchaseDate: newPurchDate || null,
          warrantyStart: newWarrantyStart || null,
          warrantyEnd: newWarrantyEnd || null,
          assetCondition: newCondition,
          remarks: newRemarks || null,
          status: "ACTIVE"
        })
      });
      toast.success("Asset created successfully");
      setIsCreateOpen(false);
      // Reset form
      setNewName("");
      setNewBrand("");
      setNewModel("");
      setNewTag("");
      setNewSerial("");
      setNewCategory("");
      setNewSubCat("");
      setNewVendor("");
      setNewBranch("");
      setNewDept("");
      setNewCost("");
      setNewPurchDate("");
      setNewWarrantyStart("");
      setNewWarrantyEnd("");
      setNewCondition("EXCELLENT");
      setNewRemarks("");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to create asset");
    } finally {
      setBusy(false);
    }
  };

  const handleAllocate = async () => {
    if (!allocatingAsset || !selectedUser) return;
    setBusy(true);
    try {
      await authedFetch(`/assets/${allocatingAsset.id}/allocate`, {
        method: "POST",
        body: JSON.stringify({ userId: selectedUser, remarks: allocRemarks })
      });
      toast.success(`Asset allocated successfully`);
      setIsAllocateOpen(false);
      setAllocatingAsset(null);
      setSelectedUser("");
      setAllocRemarks("");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Allocation failed");
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async (asset: Asset) => {
    const ok = await confirm({
      title: "Return Asset?",
      message: `Confirm that ${asset.name} (${asset.assetTag || "No tag"}) is being returned to inventory.`,
      confirmText: "Return Asset"
    });
    if (!ok) return;

    setBusy(true);
    try {
      await authedFetch(`/assets/${asset.id}/return`, { method: "POST" });
      toast.success("Asset returned to inventory");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to return asset");
    } finally {
      setBusy(false);
    }
  };

  const handleMaintenance = async () => {
    if (!maintenanceAsset || !maintDesc) return;
    setBusy(true);
    try {
      await authedFetch(`/assets/${maintenanceAsset.id}/maintenance`, {
        method: "POST",
        body: JSON.stringify({
          maintenanceDate: maintDate,
          description: maintDesc,
          cost: maintCost || null,
          performedBy: maintPerformer || null,
          nextDueDate: maintNextDate || null,
          updateAssetStatus: maintStatus
        })
      });
      toast.success("Maintenance log registered successfully");
      setIsMaintenanceOpen(false);
      setMaintenanceAsset(null);
      setMaintDesc("");
      setMaintCost("");
      setMaintPerformer("");
      setMaintNextDate("");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to log maintenance");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    const ok = await confirm({
      title: "Delete Asset?",
      message: `Are you sure you want to delete ${asset.name}? This action is permanent and cannot be undone.`,
      confirmText: "Delete Permanently"
    });
    if (!ok) return;

    setBusy(true);
    try {
      await authedFetch(`/assets/${asset.id}`, { method: "DELETE" });
      toast.success("Asset deleted successfully");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete asset");
    } finally {
      setBusy(false);
    }
  };

  // Status badges Tone selector
  const getStatusTone = (st: string) => {
    if (st === "ACTIVE") return "green";
    if (st === "REPAIR") return "amber";
    if (st === "DISPOSED") return "red";
    return "neutral";
  };

  // Metrics calculating
  const metrics = {
    total: assets.length,
    active: assets.filter(a => a.status === "ACTIVE").length,
    repair: assets.filter(a => a.status === "REPAIR").length,
    disposed: assets.filter(a => a.status === "DISPOSED").length
  };

  const activeSubCategories = categories.find(c => c.id === newCategory)?.subCategories || [];

  return (
    <AppShell
      title="Hardware Assets"
      subtitle="Track physical equipment, custodian logs, and service history"
      right={
        isAdmin ? (
          <Button onClick={() => setIsCreateOpen(true)}>+ Add Asset</Button>
        ) : undefined
      }
    >
      {/* ── Metric Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="hover:scale-[1.01] transition-transform duration-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Laptop size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{metrics.total}</div>
              <div className="text-xs text-text-muted">Total Hardware</div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:scale-[1.01] transition-transform duration-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20 text-green-500">
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">{metrics.active}</div>
              <div className="text-xs text-text-muted">In Use / Active</div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:scale-[1.01] transition-transform duration-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Wrench size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-500">{metrics.repair}</div>
              <div className="text-xs text-text-muted">In Maintenance</div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:scale-[1.01] transition-transform duration-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
              <Trash2 size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{metrics.disposed}</div>
              <div className="text-xs text-text-muted">Disposed</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters Card ── */}
      <Card className="mb-6">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by asset tag, serial, brand, model..."
            />
          </div>
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-zinc-950 transition"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="REPAIR">In Repair</option>
              <option value="DISPOSED">Disposed</option>
            </select>
          </div>
          {isAdmin && (
            <>
              <div className="w-full md:w-48">
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-zinc-950 transition"
                >
                  <option value="">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-48">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-zinc-950 transition"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Assets Data Grid ── */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-text-muted">Loading equipment directory...</div>
          ) : assets.length === 0 ? (
            <div className="p-12 text-center text-text-muted">
              <Laptop className="mx-auto mb-2 text-primary/40" size={32} />
              No assets tracked matching search criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-primary/20 bg-zinc-900/30 text-xs font-semibold text-primary uppercase tracking-wider">
                    <th className="px-5 py-3.5">Asset Detail</th>
                    <th className="px-5 py-3.5">Category / Tag</th>
                    <th className="px-5 py-3.5">Custodian</th>
                    <th className="px-5 py-3.5">Branch</th>
                    <th className="px-5 py-3.5">Status</th>
                    {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {assets.map((asset) => (
                    <tr 
                      key={asset.id} 
                      className="hover:bg-zinc-800/20 transition-colors group cursor-pointer"
                      onClick={() => setDetailsAsset(asset)}
                    >
                      <td className="px-5 py-4">
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                            {asset.name}
                          </div>
                          <div className="text-xs text-text-muted mt-0.5">
                            {asset.brand && `${asset.brand} `}{asset.model && `• ${asset.model}`}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-text-main font-semibold">
                          {asset.category.name}
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">
                          {asset.assetTag || "No asset tag"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {asset.custodian ? (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary font-bold flex items-center justify-center">
                              {asset.custodian.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="text-sm text-white font-medium">{asset.custodian.fullName}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted italic">In Inventory</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-text-main">
                        {asset.branch?.name || "N/A"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={getStatusTone(asset.status)}>{asset.status}</Badge>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end items-center gap-2">
                            {asset.status !== "DISPOSED" && (
                              <>
                                {asset.custodian ? (
                                  <Button 
                                    variant="secondary" 
                                    className="px-2 py-1 text-xs"
                                    onClick={() => handleReturn(asset)}
                                    disabled={busy}
                                  >
                                    Return
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="secondary" 
                                    className="px-2 py-1 text-xs"
                                    onClick={() => {
                                      setAllocatingAsset(asset);
                                      setIsAllocateOpen(true);
                                    }}
                                    disabled={busy}
                                  >
                                    Assign
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  className="px-2 py-1 text-xs border border-primary/20 text-amber-500"
                                  onClick={() => {
                                    setMaintenanceAsset(asset);
                                    setIsMaintenanceOpen(true);
                                  }}
                                  disabled={busy}
                                >
                                  Maint.
                                </Button>
                              </>
                            )}
                            <Button 
                              variant="ghost" 
                              className="px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
                              onClick={() => handleDelete(asset)}
                              disabled={busy}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Modals ── */}

      {/* DETAILED VIEW MODAL */}
      <Modal
        open={!!detailsAsset}
        onClose={() => setDetailsAsset(null)}
        title={detailsAsset?.name || "Asset Details"}
        subtitle={detailsAsset?.assetTag || "No Asset Tag"}
      >
        {detailsAsset && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl border border-primary/10 bg-zinc-900/40">
                <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1">Specifications</div>
                <p className="text-sm text-white font-medium">Brand: {detailsAsset.brand || "N/A"}</p>
                <p className="text-sm text-white font-medium mt-1">Model: {detailsAsset.model || "N/A"}</p>
                <p className="text-sm text-white font-medium mt-1">Serial: {detailsAsset.serialNumber || "N/A"}</p>
              </div>

              <div className="p-3 rounded-xl border border-primary/10 bg-zinc-900/40">
                <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1">Status & Condition</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">Status:</span>
                  <Badge tone={getStatusTone(detailsAsset.status)}>{detailsAsset.status}</Badge>
                </div>
                <p className="text-sm text-white font-medium mt-1.5">Condition: {detailsAsset.assetCondition || "EXCELLENT"}</p>
                <p className="text-sm text-white font-medium mt-1">IP: {detailsAsset.ipAddress || "N/A"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl border border-primary/10 bg-zinc-900/40">
                <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center gap-1 mb-1">
                  <DollarSign size={10} /> Financial Details
                </div>
                <p className="text-sm text-white font-medium">Cost: {detailsAsset.purchaseCost ? `$${detailsAsset.purchaseCost.toLocaleString()}` : "N/A"}</p>
                <p className="text-sm text-white font-medium mt-1">Value: {detailsAsset.currentValue ? `$${detailsAsset.currentValue.toLocaleString()}` : "N/A"}</p>
                <p className="text-sm text-white font-medium mt-1">Invoice: {detailsAsset.invoiceNumber || "N/A"}</p>
              </div>

              <div className="p-3 rounded-xl border border-primary/10 bg-zinc-900/40">
                <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center gap-1 mb-1">
                  <Calendar size={10} /> Warranty & AMC
                </div>
                <p className="text-xs text-text-main">
                  Purchased: {detailsAsset.purchaseDate ? new Date(detailsAsset.purchaseDate).toLocaleDateString() : "N/A"}
                </p>
                <p className="text-xs text-text-main mt-1">
                  Warranty End: {detailsAsset.warrantyEnd ? new Date(detailsAsset.warrantyEnd).toLocaleDateString() : "N/A"}
                </p>
                <p className="text-xs text-text-main mt-1">
                  AMC End: {detailsAsset.amcEnd ? new Date(detailsAsset.amcEnd).toLocaleDateString() : "N/A"}
                </p>
              </div>
            </div>

            {/* Custodian details */}
            <div className="p-4 rounded-xl border border-primary/10 bg-zinc-900/40">
              <div className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                <UserCheck size={14} /> Current Custodian
              </div>
              {detailsAsset.custodian ? (
                <div>
                  <div className="font-semibold text-white text-sm">{detailsAsset.custodian.fullName}</div>
                  <div className="text-xs text-text-muted mt-0.5">{detailsAsset.custodian.email}</div>
                  {detailsAsset.remarks && (
                    <div className="mt-2 text-xs text-text-main bg-zinc-900/50 p-2 rounded-lg border border-primary/10 italic">
                      Remarks: "{detailsAsset.remarks}"
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-text-muted italic">This equipment is currently stored in inventory.</span>
              )}
            </div>

            {/* Maintenance History */}
            <div className="p-4 rounded-xl border border-primary/10 bg-zinc-900/40">
              <div className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                <History size={14} /> Maintenance Service Log ({detailsAsset.maintenance.length})
              </div>
              {detailsAsset.maintenance.length === 0 ? (
                <div className="text-xs text-text-muted italic">No maintenance history registered.</div>
              ) : (
                <div className="space-y-3">
                  {detailsAsset.maintenance.map((m) => (
                    <div key={m.id} className="border-l-2 border-primary pl-3 py-0.5 text-xs">
                      <div className="font-bold text-white flex justify-between">
                        <span>{m.description}</span>
                        {m.cost && <span className="text-green-400 font-semibold">${m.cost}</span>}
                      </div>
                      <div className="text-[10px] text-text-muted mt-1">
                        Service Date: {new Date(m.maintenanceDate).toLocaleDateString()}
                        {m.performedBy && ` • By ${m.performedBy}`}
                        {m.nextDueDate && ` • Next Due: ${new Date(m.nextDueDate).toLocaleDateString()}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Allocation Log */}
            <div className="p-4 rounded-xl border border-primary/10 bg-zinc-900/40">
              <div className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
                <FileText size={14} /> Custody Handover Log ({detailsAsset.allocations.length})
              </div>
              {detailsAsset.allocations.length === 0 ? (
                <div className="text-xs text-text-muted italic">No allocation logs.</div>
              ) : (
                <div className="space-y-3">
                  {detailsAsset.allocations.map((a) => (
                    <div key={a.id} className="border-l-2 border-zinc-700 pl-3 py-0.5 text-xs">
                      <div className="font-bold text-white">Handover to {a.user.fullName}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        Assigned: {new Date(a.allocatedAt).toLocaleDateString()}
                        {a.returnedAt && ` • Returned: ${new Date(a.returnedAt).toLocaleDateString()}`}
                      </div>
                      {a.remarks && <p className="text-[11px] text-text-main italic mt-1 bg-zinc-950/20 p-1 rounded">"{a.remarks}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ALLOCATION / HANDOVER ASSIGN MODAL */}
      <Modal
        open={isAllocateOpen}
        onClose={() => {
          setIsAllocateOpen(false);
          setAllocatingAsset(null);
          setSelectedUser("");
          setAllocRemarks("");
        }}
        title={`Handover Equipment: ${allocatingAsset?.name}`}
        subtitle={allocatingAsset?.assetTag || "No Tag"}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsAllocateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAllocate} disabled={busy || !selectedUser}>
              Handover
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Choose Employee</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary bg-zinc-950"
            >
              <option value="">-- Select custodian --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Handover Remarks</label>
            <Textarea
              value={allocRemarks}
              onChange={(e) => setAllocRemarks(e.target.value)}
              placeholder="E.g., MacBook assigned as primary workstation. Provided power supply, case."
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* REGISTER MAINTENANCE MODAL */}
      <Modal
        open={isMaintenanceOpen}
        onClose={() => {
          setIsMaintenanceOpen(false);
          setMaintenanceAsset(null);
        }}
        title={`Service Logs & Maintenance: ${maintenanceAsset?.name}`}
        subtitle={maintenanceAsset?.assetTag || "Service log details"}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsMaintenanceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMaintenance} disabled={busy || !maintDesc}>
              Log Service
            </Button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Service Date"
                type="date"
                value={maintDate}
                onChange={(e) => setMaintDate(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Repair Cost ($)"
                type="number"
                placeholder="150.00"
                value={maintCost}
                onChange={(e) => setMaintCost(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Input
              label="Service Performed By (Technician/Vendor)"
              placeholder="E.g., Apple Store Support"
              value={maintPerformer}
              onChange={(e) => setMaintPerformer(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Service Details & Troubleshooting Description</label>
            <Textarea
              value={maintDesc}
              onChange={(e) => setMaintDesc(e.target.value)}
              placeholder="E.g., Repasted CPU thermal pads. Replaced swollen battery. Verified diagnostics."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Next Maintenance Date (Optional)"
                type="date"
                value={maintNextDate}
                onChange={(e) => setMaintNextDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Asset Status Post-Repair</label>
              <select
                value={maintStatus}
                onChange={(e) => setMaintStatus(e.target.value)}
                className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary bg-zinc-950"
              >
                <option value="ACTIVE">Active (In inventory/custody)</option>
                <option value="REPAIR">In Repair (Still diagnostic)</option>
                <option value="INACTIVE">Inactive / Storage</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* CREATE NEW ASSET FORM MODAL */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New Hardware Asset Profile"
        subtitle="Ensure tag numbers and serial numbers are strictly logged."
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={busy || !newName || !newCategory}>
              Register Asset
            </Button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Asset Name"
                placeholder="MacBook Pro 16"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                label="Category *"
                placeholder="Laptops"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Brand"
                placeholder="Apple"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Model Specifications"
                placeholder="M3 Max, 64GB"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Asset Tag Reference"
                placeholder="AST-MBP-001"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Serial Number (S/N)"
                placeholder="C02F123..."
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Sub-category"
                placeholder="Ultrabook"
                value={newSubCat}
                onChange={(e) => setNewSubCat(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Vendor Procurement"
                placeholder="Apple Inc."
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Branch Location</label>
              <select
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary bg-zinc-950"
              >
                <option value="">-- Select Branch --</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Assigned Department</label>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary bg-zinc-950"
              >
                <option value="">-- Select Department --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Input
                label="Procurement Cost ($)"
                type="number"
                placeholder="2499.00"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Purchase Date"
                type="date"
                value={newPurchDate}
                onChange={(e) => setNewPurchDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Condition</label>
              <select
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                className="w-full h-10 glass-panel border border-primary/20 rounded-xl px-3 text-white text-sm outline-none focus:border-primary bg-zinc-950"
              >
                <option value="EXCELLENT">Excellent</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="POOR">Poor</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Warranty Start"
                type="date"
                value={newWarrantyStart}
                onChange={(e) => setNewWarrantyStart(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Warranty Expiration"
                type="date"
                value={newWarrantyEnd}
                onChange={(e) => setNewWarrantyEnd(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1.5">Handover Remarks</label>
            <Textarea
              value={newRemarks}
              onChange={(e) => setNewRemarks(e.target.value)}
              placeholder="E.g., Standard executive engineer workspace computer setup."
              rows={3}
            />
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
