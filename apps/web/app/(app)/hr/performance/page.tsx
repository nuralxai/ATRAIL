"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuthStore } from "@/lib/auth-store";
import { getOkrs, createObjective, createKeyResult, updateKeyResult } from "@/lib/api-extensions";
import Button from "@/components/ui/Button";

export default function PerformancePage() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const [objectives, setObjectives] = useState<any[]>([]);

  // Form states
  const [showObjForm, setShowObjForm] = useState(false);
  const [objTitle, setObjTitle] = useState("");
  const [objDesc, setObjDesc] = useState("");
  const [objQuarter, setObjQuarter] = useState(1);
  const [objYear, setObjYear] = useState(new Date().getFullYear());

  const [krFormObjId, setKrFormObjId] = useState<string | null>(null);
  const [krTitle, setKrTitle] = useState("");
  const [krTarget, setKrTarget] = useState("");
  const [krUnit, setKrUnit] = useState("");

  const loadData = async () => {
    if (!token) return;
    const res = await getOkrs(token);
    if (res.ok) setObjectives(res.objectives);
  };

  useEffect(() => { loadData(); }, [token]);

  const handleCreateObj = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const res = await createObjective(token, { title: objTitle, description: objDesc, quarter: objQuarter, year: objYear });
    if (res.ok) {
      setShowObjForm(false);
      setObjTitle(""); setObjDesc("");
      loadData();
    }
  };

  const handleCreateKR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !krFormObjId) return;
    const res = await createKeyResult(token, krFormObjId, { title: krTitle, targetValue: parseFloat(krTarget), unit: krUnit });
    if (res.ok) {
      setKrFormObjId(null);
      setKrTitle(""); setKrTarget(""); setKrUnit("");
      loadData();
    }
  };

  const handleUpdateKR = async (krId: string, value: number) => {
    if (!token) return;
    await updateKeyResult(token, krId, value);
    loadData();
  };

  return (
    <AppShell title="Performance & OKRs" subtitle="Track Objectives and Key Results">
      <div className="mt-6 flex flex-col space-y-6 max-w-5xl">
        <div className="flex justify-between items-center glass-panel backdrop-blur-xl border border-primary/20 p-4 rounded-xl">
          <div>
            <h2 className="text-xl font-bold text-white">Your OKRs</h2>
            <p className="text-sm text-text-muted">Quarterly goals mapped to key results</p>
          </div>
          <Button onClick={() => setShowObjForm(!showObjForm)}>
            {showObjForm ? "Cancel" : "Add Objective"}
          </Button>
        </div>

        {showObjForm && (
          <form onSubmit={handleCreateObj} className="bg-zinc-800/80 p-6 rounded-xl border border-primary/20 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-semibold text-white">New Objective</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-text-muted mb-1">Title</label>
                <input required value={objTitle} onChange={(e) => setObjTitle(e.target.value)} className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Quarter</label>
                <select value={objQuarter} onChange={(e) => setObjQuarter(parseInt(e.target.value))} className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none">
                  {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Year</label>
                <input type="number" value={objYear} onChange={(e) => setObjYear(parseInt(e.target.value))} className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-text-muted mb-1">Description (Optional)</label>
                <textarea rows={2} value={objDesc} onChange={(e) => setObjDesc(e.target.value)} className="w-full glass-panel border border-primary/20 rounded-lg px-4 py-2 text-white outline-none focus:border-primary" />
              </div>
            </div>
            <Button type="submit" className="w-full">Save Objective</Button>
          </form>
        )}

        {objectives.length === 0 && !showObjForm && (
          <div className="p-8 text-center text-text-muted border border-primary/20 rounded-xl glass-panel/30">
            No Objectives found. Create your first OKR to start tracking performance.
          </div>
        )}

        {objectives.map((obj) => (
          <div key={obj.id} className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-primary/20 flex justify-between items-start">
              <div>
                <div className="flex gap-3 items-center mb-1">
                  <span className="bg-primary text-black text-xs font-bold px-2 py-0.5 rounded">Q{obj.quarter} {obj.year}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${obj.status === 'ACTIVE' || obj.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-700 text-text-muted'}`}>
                    {obj.status}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">{obj.title}</h3>
                {obj.description && <p className="text-sm text-text-muted mt-1">{obj.description}</p>}
              </div>
              <Button variant="secondary" onClick={() => setKrFormObjId(krFormObjId === obj.id ? null : obj.id)} className="text-xs">
                + Add KR
              </Button>
            </div>

            {krFormObjId === obj.id && (
              <form onSubmit={handleCreateKR} className="p-4 bg-zinc-800/50 border-b border-primary/20 flex flex-wrap gap-4 items-end animate-in slide-in-from-top-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-text-muted mb-1">Key Result Title</label>
                  <input required value={krTitle} onChange={(e) => setKrTitle(e.target.value)} className="w-full glass-panel border border-primary/20 rounded-lg px-3 py-1.5 text-sm text-white focus:border-primary outline-none" placeholder="e.g. Increase conversion by 10%" />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-text-muted mb-1">Target</label>
                  <input required type="number" step="any" value={krTarget} onChange={(e) => setKrTarget(e.target.value)} className="w-full glass-panel border border-primary/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none" placeholder="100"/>
                </div>
                <div className="w-24">
                  <label className="block text-xs text-text-muted mb-1">Unit</label>
                  <input value={krUnit} onChange={(e) => setKrUnit(e.target.value)} className="w-full glass-panel border border-primary/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none" placeholder="%, $, qty"/>
                </div>
                <Button type="submit" className="py-1.5 px-4 text-sm h-auto">Add</Button>
              </form>
            )}

            <div className="p-6 space-y-6">
              {obj.keyResults.length === 0 ? (
                <p className="text-text-muted text-sm italic">No Key Results added yet.</p>
              ) : (
                obj.keyResults.map((kr: any) => {
                  const progressPct = Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100)) || 0;
                  return (
                    <div key={kr.id} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-zinc-200">{kr.title}</span>
                        <span className="text-text-muted font-mono text-xs">
                          {kr.currentValue} / {kr.targetValue} {kr.unit} ({progressPct}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Progress Bar */}
                        <div className="flex-1 bg-zinc-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${progressPct >= 100 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-primary shadow-[0_0_10px_rgba(255,215,0,0.3)]'}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        {/* Quick Update */}
                        <input 
                          type="number" 
                          step="any"
                          className="w-20 glass-panel border border-primary/20 rounded p-1 text-xs text-right text-white focus:outline-none focus:border-primary"
                          defaultValue={kr.currentValue}
                          onBlur={(e) => {
                            if (parseFloat(e.target.value) !== kr.currentValue) {
                              handleUpdateKR(kr.id, parseFloat(e.target.value));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
