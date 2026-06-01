"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { getLeaves, applyLeave, reviewLeave, getOrgEmployees } from "@/lib/api-extensions";
import { useAuthStore } from "@/lib/auth-store";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function HRPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // form state
  const [type, setType] = useState("SICK");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");

  const isManager = ["ADMIN", "SUPER_ADMIN"].includes(user?.role || "");

  // Document Generator state
  const [docModal, setDocModal] = useState<{ open: boolean; emp: any; type: "PAYSLIP" | "LETTER" }>({ open: false, emp: null, type: "PAYSLIP" });
  const [docData, setDocData] = useState({
    month: "", basic: "50000", allowances: "10000", deductions: "2000",
    subject: "Warning Letter / Offer Letter", body: "We are writing to inform you that..."
  });

  const handleGenerateDocument = () => {
    if (!docModal.emp) return;
    const doc = new jsPDF();
    const { emp, type } = docModal;

    doc.setFontSize(22);
    doc.text("ATRAIL INC.", 14, 20);
    doc.setFontSize(10);
    doc.text("Organization Document", 14, 28);
    
    doc.line(14, 32, 196, 32);

    if (type === "PAYSLIP") {
      doc.setFontSize(16);
      doc.text(`PAYSLIP - ${docData.month || "Current Month"}`, 14, 45);
      
      doc.setFontSize(12);
      doc.text(`Employee Name: ${emp.fullName}`, 14, 55);
      doc.text(`Role: ${emp.role}`, 14, 62);
      doc.text(`Department: ${emp.profile?.department || "N/A"}`, 14, 69);

      const basic = parseFloat(docData.basic) || 0;
      const allow = parseFloat(docData.allowances) || 0;
      const ded = parseFloat(docData.deductions) || 0;
      const net = basic + allow - ded;

      autoTable(doc, {
        startY: 80,
        head: [["Description", "Amount (INR)"]],
        body: [
          ["Basic Salary", basic.toFixed(2)],
          ["Allowances", allow.toFixed(2)],
          ["Deductions", `- ${ded.toFixed(2)}`],
        ],
        foot: [["NET PAYABLE", net.toFixed(2)]],
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] },
      });
      
      doc.save(`Payslip_${emp.fullName.replace(/\s+/g, "_")}.pdf`);
    } else {
      doc.setFontSize(16);
      doc.text(docData.subject, 14, 45);
      
      doc.setFontSize(12);
      doc.text(`To: ${emp.fullName} (${emp.role})`, 14, 55);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 62);
      
      const splitBody = doc.splitTextToSize(docData.body, 180);
      doc.text(splitBody, 14, 75);

      doc.text("Authorized Signatory", 14, 250);
      doc.text("ATRAIL HR Department", 14, 257);

      doc.save(`${docData.subject.replace(/[^a-z0-9]/gi, "_")}_${emp.fullName.replace(/\s+/g, "_")}.pdf`);
    }

    setDocModal({ open: false, emp: null, type: "PAYSLIP" });
  };

  const loadLeaves = async () => {
    if (!token) return;
    try {
      const res = await getLeaves(token);
      if (res.ok) setLeaves(res.leaves);
    } catch (e) {
      console.error(e);
    }
  };

  const loadEmployees = async () => {
    if (!token || !isManager) return;
    try {
      const res = await getOrgEmployees(token);
      if (res.ok) setEmployees(res.employees);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLeaves();
    loadEmployees();
  }, [user, token]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await applyLeave(token, { type, fromDate: from, toDate: to, reason });
      if (res.ok) {
        alert("Leave applied!");
        setFrom(""); setTo(""); setReason("");
        loadLeaves();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReview = async (id: string, status: string) => {
    if (!token) return;
    try {
      await reviewLeave(token, id, { status });
      loadLeaves();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <AppShell title="HR & Leaves" subtitle="Manage Organization Personnel">
      <div className="flex flex-col md:flex-row gap-6 mt-6">
        
        {/* Left: Leave Application & List */}
        <div className="flex-1 space-y-6">
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Apply for Leave</h2>
            <form onSubmit={handleApply} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-muted mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-zinc-800 border border-primary/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  >
                    <option value="SICK">Sick</option>
                    <option value="CASUAL">Casual</option>
                    <option value="ANNUAL">Annual</option>
                    <option value="UNPAID">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">From Date</label>
                  <input
                    type="date"
                    required
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full bg-zinc-800 border border-primary/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">To Date</label>
                  <input
                    type="date"
                    required
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full bg-zinc-800 border border-primary/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Reason</label>
                <textarea
                  required
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-zinc-800 border border-primary/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>
              <Button type="submit">Submit Request</Button>
            </form>
          </div>

          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              {isManager ? "Leave Requests (Org)" : "My Leave History"}
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {leaves.length === 0 && <p className="text-text-muted text-sm">No leave records found.</p>}
              {leaves.map((l) => (
                <div key={l.id} className="p-4 bg-zinc-800/40 border border-primary/20 rounded-xl flex items-center justify-between">
                  <div>
                    {isManager && <div className="text-sm font-semibold text-white">{l.user.fullName}</div>}
                    <div className="text-xs text-text-muted">
                      {l.type} • {new Date(l.fromDate).toLocaleDateString()} to {new Date(l.toDate).toLocaleDateString()}
                    </div>
                    {l.reason && <div className="text-xs text-text-muted mt-1 italic">"{l.reason}"</div>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${l.status === 'APPROVED' ? 'bg-green-500/10 text-green-400' : l.status === 'REJECTED' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                      {l.status}
                    </span>
                    {isManager && l.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button onClick={() => handleReview(l.id, "APPROVED")} className="text-xs text-green-400 hover:text-green-300">Approve</button>
                        <button onClick={() => handleReview(l.id, "REJECTED")} className="text-xs text-red-400 hover:text-red-300">Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Org Chart / Employees */}
        {isManager && (
          <div className="w-full md:w-80 space-y-6">
            <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Personnel Directory</h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {employees.map((emp) => (
                  <div key={emp.id} className="p-3 bg-zinc-800/40 border border-primary/20/50 rounded-xl">
                    <div className="font-semibold text-primary text-sm flex justify-between items-center">
                      <span>{emp.fullName}</span>
                      <Button variant="secondary" className="px-2 py-1 text-[10px]" onClick={() => setDocModal({ open: true, emp, type: "PAYSLIP" })}>
                        Issue Doc
                      </Button>
                    </div>
                    <div className="text-xs text-text-muted flex justify-between mt-1">
                      <span>{emp.role}</span>
                      <span>{emp.profile?.department || "Unassigned"}</span>
                    </div>
                    {emp.reportsTo && (
                      <div className="text-[10px] text-text-muted mt-2 pt-2 border-t border-primary/20/50">
                        Reports to: {emp.reportsTo.fullName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={docModal.open}
        onClose={() => setDocModal({ ...docModal, open: false })}
        title={`Issue Document to ${docModal.emp?.fullName}`}
        widthClass="max-w-lg"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setDocModal({ ...docModal, open: false })}>Cancel</Button>
            <Button onClick={handleGenerateDocument} className="bg-primary text-black border border-primary hover:bg-primary/90 font-semibold shadow-[0_0_15px_rgba(255,215,0,0.2)]">
              Generate & Download PDF
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2 p-1 glass-panel border border-primary/20 rounded-lg">
            <button
              onClick={() => setDocModal({ ...docModal, type: "PAYSLIP" })}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${docModal.type === "PAYSLIP" ? "bg-zinc-800 text-white" : "text-text-muted hover:text-text-main"}`}
            >
              Payslip
            </button>
            <button
              onClick={() => setDocModal({ ...docModal, type: "LETTER" })}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${docModal.type === "LETTER" ? "bg-zinc-800 text-white" : "text-text-muted hover:text-text-main"}`}
            >
              Issue Letter
            </button>
          </div>

          {docModal.type === "PAYSLIP" ? (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Month & Year</label>
                <input 
                  type="month"
                  className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                  value={docData.month} onChange={(e) => setDocData({...docData, month: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Basic Salary</label>
                <input 
                  type="number"
                  className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                  value={docData.basic} onChange={(e) => setDocData({...docData, basic: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Allowances</label>
                <input 
                  type="number"
                  className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                  value={docData.allowances} onChange={(e) => setDocData({...docData, allowances: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Deductions</label>
                <input 
                  type="number"
                  className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                  value={docData.deductions} onChange={(e) => setDocData({...docData, deductions: e.target.value})}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Document Subject / Title</label>
                <input 
                  className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                  value={docData.subject} onChange={(e) => setDocData({...docData, subject: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Letter Body</label>
                <textarea 
                  rows={6}
                  className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary"
                  value={docData.body} onChange={(e) => setDocData({...docData, body: e.target.value})}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

    </AppShell>
  );
}
