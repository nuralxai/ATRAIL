"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "@/components/ui/toast";
import { Plus, Trash2, Download, FileText, Send, CheckCircle, XCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  items: string;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
};

type LineItem = { description: string; qty: number; rate: number };

const STATUS_STYLE: Record<InvoiceStatus, { color: string; bg: string; label: string }> = {
  DRAFT:     { color: "#64748b", bg: "rgba(100,116,139,0.1)", label: "Draft"     },
  SENT:      { color: "#3B82F6", bg: "rgba(59,130,246,0.1)",  label: "Sent"      },
  PAID:      { color: "#22C55E", bg: "rgba(34,197,94,0.1)",   label: "Paid"      },
  OVERDUE:   { color: "#EF4444", bg: "rgba(239,68,68,0.1)",   label: "Overdue"   },
  CANCELLED: { color: "#6B7280", bg: "rgba(107,114,128,0.1)", label: "Cancelled" },
};

const EMPTY_ITEM: LineItem = { description: "", qty: 1, rate: 0 };

export default function FinancePage() {
  const user = useAuthStore(s => s.user);
  const [invoices, setInvoices]  = useState<Invoice[]>([]);
  const [loading, setLoading]    = useState(true);
  const [creating, setCreating]  = useState(false);
  const [form, setForm]          = useState({
    clientName: "", clientEmail: "", notes: "", dueDate: "",
    items: [{ ...EMPTY_ITEM }] as LineItem[],
  });

  const load = () =>
    authedFetch<{ ok: boolean; invoices: Invoice[] }>("/finance/invoices")
      .then(r => { if (r.ok) setInvoices(r.invoices); setLoading(false); });

  useEffect(() => { load(); }, []);

  const subtotal = form.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const tax      = Math.round(subtotal * 0.18 * 100) / 100;
  const total    = subtotal + tax;

  async function create() {
    if (!form.clientName.trim()) { toast.error("Client name is required"); return; }
    if (form.items.some(i => !i.description.trim())) { toast.error("All items need a description"); return; }
    setCreating(true);
    try {
      await authedFetch("/finance/invoices", {
        method: "POST",
        body: JSON.stringify({ ...form }),
      });
      toast.success("Invoice created");
      setForm({ clientName: "", clientEmail: "", notes: "", dueDate: "", items: [{ ...EMPTY_ITEM }] });
      load();
    } catch { toast.error("Failed to create invoice"); }
    setCreating(false);
  }

  async function updateStatus(id: string, status: InvoiceStatus) {
    await authedFetch(`/finance/invoices/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
  }

  async function remove(id: string) {
    await authedFetch(`/finance/invoices/${id}`, { method: "DELETE" });
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    toast.success("Invoice deleted");
  }

  function downloadPdf(inv: Invoice) {
    const doc = new jsPDF();
    const items: LineItem[] = JSON.parse(inv.items);

    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 150, 200);
    doc.text("INVOICE", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Invoice #: ${inv.invoiceNumber}`, 14, 30);
    doc.text(`Date: ${new Date(inv.createdAt).toLocaleDateString("en-IN")}`, 14, 36);
    if (inv.dueDate) doc.text(`Due: ${new Date(inv.dueDate).toLocaleDateString("en-IN")}`, 14, 42);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Bill To:`, 14, 55);
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text(inv.clientName, 14, 61);
    if (inv.clientEmail) doc.text(inv.clientEmail, 14, 67);

    // Table
    autoTable(doc, {
      startY: 78,
      head: [["Description", "Qty", "Rate (₹)", "Amount (₹)"]],
      body: items.map(i => [i.description, i.qty, i.rate.toFixed(2), (i.qty * i.rate).toFixed(2)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 150, 200] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Subtotal: ₹${inv.subtotal.toFixed(2)}`, 140, finalY);
    doc.text(`GST (18%): ₹${inv.tax.toFixed(2)}`, 140, finalY + 7);
    doc.setFontSize(12);
    doc.setTextColor(0, 150, 200);
    doc.text(`Total: ₹${inv.total.toFixed(2)}`, 140, finalY + 16);

    if (inv.notes) {
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Notes: ${inv.notes}`, 14, finalY + 30);
    }

    doc.save(`${inv.invoiceNumber}.pdf`);
  }

  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }));
  const setItem    = (i: number, field: keyof LineItem, val: string | number) =>
    setForm(f => ({ ...f, items: f.items.map((item, j) => j === i ? { ...item, [field]: val } : item) }));

  return (
    <AppShell title="Invoice Manager" subtitle="Create, manage and export professional invoices">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">

        {/* Create Invoice */}
        <div className="xl:col-span-1 rounded-2xl p-6 space-y-4" style={{ background: "rgba(6,22,40,0.6)", border: "1px solid rgba(0,212,255,0.1)" }}>
          <h2 className="text-base font-bold text-white">New Invoice</h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Client Name *</label>
              <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                placeholder="Acme Corp" className="w-full bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-xl px-3 py-2 text-sm text-white placeholder-text-muted outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Client Email</label>
              <input type="email" value={form.clientEmail} onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
                placeholder="billing@acme.com" className="w-full bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-xl px-3 py-2 text-sm text-white placeholder-text-muted outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50 transition-colors" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Line Items</label>
              <button onClick={addItem} className="text-xs text-primary hover:text-white transition-colors flex items-center gap-1">
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input value={item.description} onChange={e => setItem(i, "description", e.target.value)}
                    placeholder="Service description" className="flex-1 bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-lg px-2 py-1.5 text-xs text-white placeholder-text-muted outline-none focus:border-primary/50" />
                  <input type="number" value={item.qty} onChange={e => setItem(i, "qty", Number(e.target.value))}
                    className="w-12 bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-lg px-2 py-1.5 text-xs text-white text-center outline-none focus:border-primary/50" min={1} />
                  <input type="number" value={item.rate} onChange={e => setItem(i, "rate", Number(e.target.value))}
                    placeholder="Rate" className="w-20 bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-lg px-2 py-1.5 text-xs text-white text-right outline-none focus:border-primary/50" min={0} />
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-xl p-3 space-y-1 text-sm" style={{ background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.08)" }}>
            <div className="flex justify-between text-text-muted"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-text-muted"><span>GST (18%)</span><span>₹{tax.toFixed(2)}</span></div>
            <div className="flex justify-between text-white font-bold text-base border-t border-[rgba(0,212,255,0.1)] pt-1 mt-1"><span>Total</span><span className="text-primary">₹{total.toFixed(2)}</span></div>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Payment terms, bank details..." className="w-full bg-[rgba(0,212,255,0.03)] border border-[rgba(0,212,255,0.1)] rounded-xl px-3 py-2 text-sm text-white placeholder-text-muted outline-none focus:border-primary/50 transition-colors resize-none" />
          </div>

          <button onClick={create} disabled={creating}
            className="w-full py-2.5 rounded-xl font-bold text-sm transition-all bg-primary text-[#020b18] hover:bg-yellow-400 disabled:opacity-50">
            {creating ? "Creating..." : "Create Invoice"}
          </button>
        </div>

        {/* Invoice List */}
        <div className="xl:col-span-2 space-y-3">
          <h2 className="text-base font-bold text-white">All Invoices ({invoices.length})</h2>

          {loading && <div className="text-text-muted text-sm">Loading...</div>}

          {!loading && invoices.length === 0 && (
            <div className="rounded-2xl p-12 text-center" style={{ background: "rgba(6,22,40,0.4)", border: "1px dashed rgba(0,212,255,0.1)" }}>
              <FileText size={32} className="text-text-muted mx-auto mb-3" />
              <div className="text-text-muted text-sm">No invoices yet. Create your first one.</div>
            </div>
          )}

          {invoices.map(inv => {
            const st = STATUS_STYLE[inv.status];
            const items: LineItem[] = JSON.parse(inv.items);
            return (
              <div key={inv.id} className="rounded-2xl p-4" style={{ background: "rgba(6,22,40,0.6)", border: "1px solid rgba(0,212,255,0.08)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{inv.invoiceNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                    </div>
                    <div className="text-sm text-text-muted mt-0.5">{inv.clientName} {inv.clientEmail && `· ${inv.clientEmail}`}</div>
                    <div className="text-xs text-text-muted mt-1">{items.length} item{items.length !== 1 ? "s" : ""} · Created {new Date(inv.createdAt).toLocaleDateString("en-IN")} {inv.dueDate && `· Due ${new Date(inv.dueDate).toLocaleDateString("en-IN")}`}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-primary">₹{inv.total.toFixed(2)}</div>
                    <div className="text-[10px] text-text-muted">incl. GST</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button onClick={() => downloadPdf(inv)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ background: "rgba(0,212,255,0.08)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.15)" }}>
                    <Download size={12} /> PDF
                  </button>
                  {inv.status === "DRAFT" && (
                    <button onClick={() => updateStatus(inv.id, "SENT")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ background: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.2)" }}>
                      <Send size={12} /> Mark Sent
                    </button>
                  )}
                  {inv.status === "SENT" && (
                    <button onClick={() => updateStatus(inv.id, "PAID")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ background: "rgba(34,197,94,0.1)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <CheckCircle size={12} /> Mark Paid
                    </button>
                  )}
                  {!["PAID","CANCELLED"].includes(inv.status) && (
                    <button onClick={() => updateStatus(inv.id, "CANCELLED")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all text-text-muted hover:text-red-400">
                      <XCircle size={12} /> Cancel
                    </button>
                  )}
                  <button onClick={() => remove(inv.id)} className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-400/10 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
