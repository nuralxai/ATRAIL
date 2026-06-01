"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuthStore } from "@/lib/auth-store";
import { getSkills, getUserSkills, createSkill, updateUserSkill, getOrgEmployees } from "@/lib/api-extensions";
import Button from "@/components/ui/Button";

export default function SkillMatrixPage() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  
  const [skills, setSkills] = useState<any[]>([]);
  const [userSkills, setUserSkills] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  const [newSkill, setNewSkill] = useState("");
  const isManager = ["ADMIN", "SUPER_ADMIN"].includes(user?.role || "");

  const loadData = async () => {
    if (!token) return;
    const [skRes, usRes] = await Promise.all([
      getSkills(token),
      getUserSkills(token)
    ]);
    if (skRes.ok) setSkills(skRes.skills);
    if (usRes.ok) setUserSkills(usRes.userSkills);
    
    if (isManager) {
      const empRes = await getOrgEmployees(token);
      if (empRes.ok) setEmployees(empRes.employees);
    }
  };

  useEffect(() => { loadData(); }, [token]);

  const handleCreateSkill = async () => {
    if (!token || !newSkill) return;
    const res = await createSkill(token, { name: newSkill });
    if (res.ok) {
      setNewSkill("");
      loadData();
    } else {
      alert(res.message);
    }
  };

  const handleUpdateLevel = async (userId: string, skillId: string, level: number) => {
    if (!token) return;
    await updateUserSkill(token, { userId, skillId, proficiencyLevel: level });
    loadData();
  };

  // Build the matrix data
  // Combine all users we know about (from employees or userSkills)
  const fullUserMap: Record<string, { user: any; skills: Record<string, number> }> = {};
  
  if (isManager) {
    employees.forEach(e => {
      fullUserMap[e.id] = { user: e, skills: {} };
    });
  } else if (user) {
    // Non-managers only see themselves or the data returned by user-skills
    fullUserMap[user.id] = { user, skills: {} };
  }

  userSkills.forEach((us) => {
    if (!fullUserMap[us.userId]) {
      fullUserMap[us.userId] = { user: us.user, skills: {} };
    }
    fullUserMap[us.userId].skills[us.skillId] = us.proficiencyLevel;
  });

  return (
    <AppShell title="Skill Matrix" subtitle="Map employee proficiencies across the organization">
      <div className="mt-6 flex flex-col space-y-6">
        {isManager && (
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6 flex gap-4 items-end">
            <div className="flex-1 max-w-sm">
              <label className="block text-sm text-text-muted mb-1">Add New Skill to Matrix</label>
              <input 
                type="text" 
                value={newSkill} 
                onChange={(e) => setNewSkill(e.target.value)} 
                className="w-full bg-zinc-800 border border-primary/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                placeholder="e.g. ReactJS, SQL, Project Management..."
              />
            </div>
            <Button onClick={handleCreateSkill}>Create Skill</Button>
          </div>
        )}

        <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6 overflow-hidden overflow-x-auto">
          {skills.length === 0 ? (
            <div className="text-text-muted text-center py-4">No skills registered across the organization yet.</div>
          ) : (
            <table className="w-full text-left text-sm text-text-main">
              <thead className="bg-zinc-800 text-text-muted">
                <tr>
                  <th className="p-4 font-semibold border-b border-primary/20 rounded-tl-xl whitespace-nowrap min-w-[200px]">Employee</th>
                  {skills.map((s) => (
                    <th key={s.id} className="p-4 font-semibold border-b border-primary/20 text-center w-32 whitespace-nowrap">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(fullUserMap).map(({ user: u, skills: map }) => (
                  <tr key={u.id} className="border-b border-primary/20 hover:bg-zinc-800/30">
                    <td className="p-4 flex flex-col">
                      <span className="font-semibold text-white">{u.fullName || u.email}</span>
                      <span className="text-xs text-text-muted">{u.profile?.department || "General"}</span>
                    </td>
                    {skills.map((s) => {
                      const level = map[s.id] || 0;
                      const canEdit = isManager || user?.id === u.id;
                      return (
                        <td key={s.id} className="p-4 text-center align-middle">
                          <div className="flex gap-1 justify-center">
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <button
                                key={lvl}
                                disabled={!canEdit}
                                onClick={() => handleUpdateLevel(u.id, s.id, lvl)}
                                className={`w-3 h-4 rounded-sm transition-all duration-200 ${
                                  level >= lvl 
                                    ? "bg-primary shadow-[0_0_5px_rgba(255,215,0,0.5)]" 
                                    : "bg-zinc-700 hover:bg-zinc-500"
                                } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
                                title={`Level ${lvl}`}
                              />
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
