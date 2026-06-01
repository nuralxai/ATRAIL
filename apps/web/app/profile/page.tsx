"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/auth-store";
import { API_BASE } from "../../lib/config";
import {
  User, Phone, Mail, MessageCircle, Building, GraduationCap,
  CheckCircle, ExternalLink, ArrowRight, Loader2, AlertCircle, Send
} from "lucide-react";

interface TelegramStatus {
  linked: boolean;
  telegramUsername?: string;
  linkedAt?: string;
  botName: string;
  linkUrl: string;
}

const ROLE_REDIRECT: Record<string, string> = {
  GOD: "/developer",
  DEVELOPER: "/developer",
  SUPER_ADMIN: "/dashboard/super",
  ADMIN: "/dashboard/admin",
  ELITE: "/dashboard/elite",
  TENANT: "/dashboard/tenant",
  USER: "/dashboard/user",
  INTERN: "/dashboard/user",
};

const STEP_LABELS = ["Personal", "Work", "Telegram", "Done"];

export default function ProfileSetupPage() {
  const router = useRouter();
  const { accessToken, user, setAuth } = useAuthStore();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [managers, setManagers] = useState<{ id: string; fullName: string; role: string }[]>([]);
  const [availableSkills, setAvailableSkills] = useState<{ id: string; name: string }[]>([]);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [telegramPolling, setTelegramPolling] = useState(false);

  // Form state
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    gender: "PREFER_NOT_TO_SAY",
    dob: "",
    companyName: "",
    department: "",
    reportsToId: "",
    skills: [] as string[],
    newSkill: "",
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // ── Load existing data ──────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken || !user) { router.replace("/login"); return; }

    const load = async () => {
      const headers = { Authorization: `Bearer ${accessToken}` };
      try {
        const [profileRes, managersRes, tgRes] = await Promise.all([
          fetch(`${API_BASE}/users/profile/me`, { headers }),
          fetch(`${API_BASE}/users/managers`, { headers }),
          fetch(`${API_BASE}/users/me/telegram-status`, { headers }),
        ]);

        const profile = await profileRes.json();
        if (profile.ok) {
          if (profile.isComplete && profile.data?.telegramLinked) {
            router.replace(ROLE_REDIRECT[user.role] ?? "/dashboard");
            return;
          }
          const u = profile.user ?? profile.data;
          if (u) {
            setForm(f => ({
              ...f,
              fullName: u.fullName ?? "",
              phone: u.phone ?? "",
              gender: u.gender ?? u.profile?.gender ?? "PREFER_NOT_TO_SAY",
              dob: u.dob ? new Date(u.dob).toISOString().split("T")[0] : "",
              companyName: u.companyName ?? "",
              department: u.profile?.department ?? "",
              reportsToId: u.reportsToId ?? "",
              skills: Array.isArray(u.userSkills) ? u.userSkills.map((s: any) => s.skill.name) : [],
            }));
          }
        }

        const mgr = await managersRes.json();
        if (mgr.ok) setManagers(mgr.managers ?? mgr.data ?? []);

        const tg = await tgRes.json();
        if (tg.ok) setTelegramStatus(tg.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [accessToken, user, router]);

  // ── Poll Telegram status after user clicks the link ─────────────────────
  useEffect(() => {
    if (!telegramPolling) return;
    const interval = setInterval(async () => {
      if (!accessToken) return;
      const r = await fetch(`${API_BASE}/users/me/telegram-status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await r.json();
      if (data.ok && data.data.linked) {
        setTelegramStatus(data.data);
        setTelegramPolling(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [telegramPolling, accessToken]);

  // ── Save profile ─────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/users/profile/me`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          gender: form.gender,
          dob: form.dob,
          companyName: form.companyName,
          department: form.department,
          reportsToId: form.reportsToId || undefined,
          skills: form.skills,
        }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.message ?? "Save failed"); return false; }
      return true;
    } catch {
      setError("Save failed. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    if (step === 0) {
      if (!form.fullName.trim()) { setError("Full name is required"); return; }
      if (!form.phone.trim()) { setError("Phone number is required"); return; }
    }
    if (step === 1) {
      if (!form.companyName.trim()) { setError("Company name is required"); return; }
      const ok = await save();
      if (!ok) return;
    }
    if (step === 2) {
      // Telegram step — they can skip
    }
    setError("");
    setStep(s => s + 1);
  };

  const finish = () => {
    router.replace(ROLE_REDIRECT[user?.role ?? ""] ?? "/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020b18] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020b18] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-900/40 border border-blue-700/40 flex items-center justify-center mx-auto mb-4">
            <User className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Complete Your Profile</h1>
          <p className="text-gray-400 text-sm mt-1">Set up your account to get the most out of Atrail</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                i === step ? "bg-blue-600 text-white" :
                i < step ? "bg-green-900/40 text-green-400 border border-green-700/40" :
                "bg-white/5 text-gray-500"
              }`}>
                {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 text-center leading-none">{i + 1}</span>}
                {label}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-6 h-0.5 ${i < step ? "bg-green-600" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[rgba(6,22,40,0.85)] backdrop-blur-lg border border-[rgba(0,212,255,0.12)] rounded-2xl p-7 shadow-2xl">

          {error && (
            <div className="flex items-center gap-2 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* ── STEP 0: Personal Details ── */}
          {step === 0 && (
            <div className="space-y-4">
              <SectionTitle icon={<User className="w-4 h-4" />} title="Personal Details" />

              <Field label="Full Name *">
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => set("fullName", e.target.value)}
                  placeholder="e.g. Abishek Murugan"
                  className={IN}
                />
              </Field>

              <Field label="Phone Number *" hint="Used for WhatsApp renewal reminders">
                <div className="flex gap-2">
                  <span className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 text-sm flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> +91
                  </span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set("phone", e.target.value.replace(/\D/g, ""))}
                    placeholder="98765 43210"
                    maxLength={10}
                    className={`${IN} flex-1`}
                  />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of Birth">
                  <input type="date" value={form.dob} onChange={e => set("dob", e.target.value)} className={IN} />
                </Field>
                <Field label="Gender">
                  <select value={form.gender} onChange={e => set("gender", e.target.value)} className={SEL}>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 1: Work Details ── */}
          {step === 1 && (
            <div className="space-y-4">
              <SectionTitle icon={<Building className="w-4 h-4" />} title="Work Details" />

              <Field label="Company / Organization *">
                <input
                  type="text"
                  value={form.companyName}
                  onChange={e => set("companyName", e.target.value)}
                  placeholder="e.g. Acme Technologies"
                  className={IN}
                />
              </Field>

              <Field label="Department / Team">
                <input
                  type="text"
                  value={form.department}
                  onChange={e => set("department", e.target.value)}
                  placeholder="e.g. Sales, IT, Finance"
                  className={IN}
                />
              </Field>

              {managers.length > 0 && (
                <Field label="Reports To">
                  <select value={form.reportsToId} onChange={e => set("reportsToId", e.target.value)} className={SEL}>
                    <option value="">— Select manager —</option>
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>{m.fullName} ({m.role})</option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Skills" hint="Press Enter to add each skill">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.newSkill}
                    onChange={e => set("newSkill", e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && form.newSkill.trim()) {
                        e.preventDefault();
                        if (!form.skills.includes(form.newSkill.trim())) {
                          set("skills", [...form.skills, form.newSkill.trim()]);
                        }
                        set("newSkill", "");
                      }
                    }}
                    placeholder="e.g. Renewal Management"
                    className={`${IN} flex-1`}
                  />
                </div>
                {form.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.skills.map(s => (
                      <span key={s} className="flex items-center gap-1 px-2.5 py-1 bg-blue-900/30 border border-blue-800/40 text-blue-300 rounded-full text-xs">
                        {s}
                        <button onClick={() => set("skills", form.skills.filter(x => x !== s))} className="text-blue-400 hover:text-red-400 leading-none">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>
            </div>
          )}

          {/* ── STEP 2: Telegram Linking ── */}
          {step === 2 && (
            <div className="space-y-5">
              <SectionTitle icon={<Send className="w-4 h-4" />} title="Link Telegram Bot" />

              {telegramStatus?.linked ? (
                <div className="p-4 rounded-xl bg-green-900/20 border border-green-700/40 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-green-300 font-semibold">Telegram linked!</p>
                    <p className="text-green-400/70 text-sm">
                      {telegramStatus.telegramUsername ? `@${telegramStatus.telegramUsername}` : "Connected"}
                      {telegramStatus.linkedAt && ` · ${new Date(telegramStatus.linkedAt).toLocaleDateString("en-IN")}`}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Connect your Telegram account to receive real-time renewal alerts, task notifications, and use the Atrail bot for on-the-go updates.
                  </p>

                  <div className="bg-[rgba(0,212,255,0.04)] border border-[rgba(0,212,255,0.1)] rounded-xl p-4 space-y-3">
                    <p className="text-white text-sm font-semibold">How to link:</p>
                    <ol className="space-y-2 text-sm text-gray-300">
                      <li className="flex gap-2"><span className="text-blue-400 font-bold flex-shrink-0">1.</span> Open Telegram and search for <code className="bg-white/10 px-1.5 py-0.5 rounded text-blue-300">@{telegramStatus?.botName ?? "AtrailBot"}</code></li>
                      <li className="flex gap-2"><span className="text-blue-400 font-bold flex-shrink-0">2.</span> Send <code className="bg-white/10 px-1.5 py-0.5 rounded text-blue-300">/start</code> to the bot</li>
                      <li className="flex gap-2"><span className="text-blue-400 font-bold flex-shrink-0">3.</span> Enter your login email <code className="bg-white/10 px-1.5 py-0.5 rounded text-blue-300">{user?.email}</code> when prompted</li>
                      <li className="flex gap-2"><span className="text-blue-400 font-bold flex-shrink-0">4.</span> Enter your TOTP code to verify</li>
                    </ol>
                  </div>

                  <a
                    href={telegramStatus?.linkUrl ?? `https://t.me/AtrailBot`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setTelegramPolling(true)}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-[#229ED9] hover:bg-[#1a8cbf] text-white font-semibold rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Open Telegram Bot
                    <ExternalLink className="w-4 h-4 opacity-70" />
                  </a>

                  {telegramPolling && (
                    <p className="text-center text-gray-400 text-xs flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Waiting for Telegram confirmation...
                    </p>
                  )}

                  <button
                    onClick={() => { setStep(3); }}
                    className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                  >
                    Skip for now
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── STEP 3: Done ── */}
          {step === 3 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700/40 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white">You're all set!</h2>
              <p className="text-gray-400 text-sm">
                Your profile is complete. You can update these details anytime from Settings.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2 text-left">
                <InfoBadge icon={<User className="w-3.5 h-3.5" />} label="Name" value={form.fullName} />
                <InfoBadge icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={form.phone ? `+91 ${form.phone}` : "—"} />
                <InfoBadge icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={user?.email ?? "—"} />
                <InfoBadge
                  icon={<MessageCircle className="w-3.5 h-3.5" />}
                  label="Telegram"
                  value={telegramStatus?.linked ? (telegramStatus.telegramUsername ? `@${telegramStatus.telegramUsername}` : "Linked") : "Not linked"}
                  valueColor={telegramStatus?.linked ? "text-green-400" : "text-gray-500"}
                />
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-7">
            {step > 0 && step < 3 && (
              <button
                onClick={() => { setError(""); setStep(s => s - 1); }}
                className="flex-1 py-2.5 border border-white/10 text-gray-400 hover:bg-white/5 rounded-xl text-sm transition-colors"
              >
                Back
              </button>
            )}
            {step < 2 && (
              <button
                onClick={nextStep}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 2 && telegramStatus?.linked && (
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={finish}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-5">
          Atrail · Renewal OS · All data is encrypted and stored securely
        </p>
      </div>
    </div>
  );
}

const IN = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500";
const SEL = "w-full px-3 py-2 bg-[rgba(6,22,40,0.9)] border border-white/10 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1.5">
        {label}
        {hint && <span className="ml-1 normal-case text-gray-600 font-normal">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-white/8 mb-1">
      <span className="text-blue-400">{icon}</span>
      <h3 className="text-white font-semibold text-base">{title}</h3>
    </div>
  );
}

function InfoBadge({ icon, label, value, valueColor = "text-gray-200" }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">{icon} {label}</div>
      <div className={`text-sm font-medium truncate ${valueColor}`}>{value}</div>
    </div>
  );
}
