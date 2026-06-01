"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { authedFetch } from "@/lib/authed-fetch";
import { useAuthStore } from "@/lib/auth-store";
import {
  CheckCircle, XCircle, Loader2, ExternalLink, Trash2,
  RefreshCw, Plus, ChevronDown, ChevronUp, AlertTriangle,
  Globe, Zap, Link2, Send,
} from "lucide-react";

/* ─── Google SVG ────────────────────────── */
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

/* ─── Microsoft SVG ─────────────────────── */
const MicrosoftIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
    <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
    <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
    <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
  </svg>
);

/* ─── Jira SVG ──────────────────────────── */
const JiraIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005z" fill="#2684FF"/>
    <path d="M5.915 5.796H17.48a5.218 5.218 0 0 1-5.232 5.215h-2.13v2.057A5.215 5.215 0 0 1 4.91 18.283V6.8a1.005 1.005 0 0 1 1.005-1.004z" fill="url(#jira-grad)"/>
    <path d="M0 .079h11.565a5.218 5.218 0 0 1-5.232 5.215H4.2V7.35A5.215 5.215 0 0 1-1.007 12.566V1.083A1.005 1.005 0 0 1 0 .079z" fill="url(#jira-grad2)"/>
    <defs>
      <linearGradient id="jira-grad" x1="17.48" y1="11.32" x2="9.3" y2="18.28" gradientUnits="userSpaceOnUse">
        <stop offset="18%" stopColor="#0052CC"/>
        <stop offset="100%" stopColor="#2684FF"/>
      </linearGradient>
      <linearGradient id="jira-grad2" x1="11.57" y1="5.62" x2="3.38" y2="12.57" gradientUnits="userSpaceOnUse">
        <stop offset="18%" stopColor="#0052CC"/>
        <stop offset="100%" stopColor="#2684FF"/>
      </linearGradient>
    </defs>
  </svg>
);

/* ─── Linear SVG ────────────────────────── */
const LinearIcon = () => (
  <svg viewBox="0 0 100 100" width="20" height="20">
    <defs>
      <linearGradient id="linear-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#5E6AD2"/>
        <stop offset="100%" stopColor="#8B5CF6"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#linear-grad)"/>
    <path d="M17.5 62.5L37.5 82.5a37.5 37.5 0 0 1-20-20zM17.5 47.5L52.5 82.5a37.5 37.5 0 0 1-8.5-2L19.5 56a37.5 37.5 0 0 1-2-8.5zM20.5 33L67 79.5A37.5 37.5 0 0 1 20.5 33zM27 21L79 73A37.5 37.5 0 0 1 27 21zM33.5 17.5L82.5 66.5A37.5 37.5 0 0 1 66.5 82.5L17.5 33.5A37.5 37.5 0 0 1 33.5 17.5zM47.5 17.5L82.5 52.5a37.5 37.5 0 0 1-2 8.5L19.5 19.5a37.5 37.5 0 0 1 28-2zM62.5 17.5a37.5 37.5 0 0 1 20 20L82.5 37.5z" fill="white" opacity="0.9"/>
  </svg>
);

/* ─── Types ────────────────────────────── */
type ConnectedAccount = {
  id: string;
  provider: "GOOGLE" | "MICROSOFT" | "JIRA" | "LINEAR";
  email: string;
  createdAt: string;
};

type JiraIssue = {
  id: string; key: string; summary: string;
  status: string; priority: string; project: string; duedate?: string;
};

type LinearIssue = {
  id: string; key: string; title: string;
  status: string; color: string; priority: string;
  team?: string; project?: string; dueDate?: string;
};

/* ─── Shared Pill ─────────────────────── */
function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={connected
        ? { background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }
        : { background: "rgba(100,116,139,0.1)", color: "#64748b", border: "1px solid rgba(100,116,139,0.15)" }}
    >
      {connected ? <CheckCircle size={10} /> : <XCircle size={10} />}
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

/* ─── Integration Card wrapper ─────────── */
function IntCard({ icon, name, description, children, accent = "#00d4ff" }: {
  icon: React.ReactNode; name: string; description: string;
  children: React.ReactNode; accent?: string;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(6,22,40,0.75)",
        border: "1px solid rgba(0,212,255,0.09)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Top accent */}
      <div className="h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}
          >
            {icon}
          </div>
          <div>
            <div className="text-sm font-bold text-[#e2e8f0]">{name}</div>
            <div className="text-[11px] text-[#64748b] font-medium">{description}</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Issue List ────────────────────────── */
function IssueList<T extends { id: string; key?: string; status: string }>({
  items, renderRow, loading, emptyText,
}: { items: T[]; renderRow: (i: T) => React.ReactNode; loading: boolean; emptyText: string }) {
  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-[#64748b] py-4">
      <Loader2 size={13} className="animate-spin" /> Loading…
    </div>
  );
  if (!items.length) return (
    <p className="text-xs text-[#374151] py-4 text-center">{emptyText}</p>
  );
  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
      {items.map(renderRow)}
    </div>
  );
}

/* ─── Main Page ─────────────────────────── */
export default function IntegrationsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  /* Jira state */
  const [jiraForm, setJiraForm] = useState({ baseUrl: "", email: "", apiKey: "" });
  const [jiraBusy, setJiraBusy]   = useState(false);
  const [jiraErr, setJiraErr]     = useState<string | null>(null);
  const [jiraIssues, setJiraIssues] = useState<JiraIssue[]>([]);
  const [jiraLoading, setJiraLoading] = useState(false);
  const [showJiraForm, setShowJiraForm] = useState(false);
  const [newJira, setNewJira]     = useState({ projectKey: "", summary: "", description: "" });
  const [showNewJira, setShowNewJira] = useState(false);
  const [jiraProjects, setJiraProjects] = useState<any[]>([]);

  /* Linear state */
  const [linearKey, setLinearKey]   = useState("");
  const [linearBusy, setLinearBusy] = useState(false);
  const [linearErr, setLinearErr]   = useState<string | null>(null);
  const [linearIssues, setLinearIssues] = useState<LinearIssue[]>([]);
  const [linearLoading, setLinearLoading] = useState(false);
  const [showLinearForm, setShowLinearForm] = useState(false);
  const [linearTeams, setLinearTeams] = useState<any[]>([]);
  const [newLinear, setNewLinear]   = useState({ teamId: "", title: "", description: "" });
  const [showNewLinear, setShowNewLinear] = useState(false);

  const [telegramLink, setTelegramLink] = useState<{ id: string; telegramUsername: string | null; isActive: boolean } | null>(null);

  /* OAuth busy */
  const [oauthBusy, setOauthBusy]   = useState<string | null>(null);
  const [disconnBusy, setDisconnBusy] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await authedFetch<{ ok: boolean; accounts: ConnectedAccount[]; telegramLink?: any }>("/integrations");
      if (res.ok) {
        setAccounts(res.accounts ?? []);
        setTelegramLink(res.telegramLink ?? null);
      }
    } finally { setLoadingAccounts(false); }
  }, []);

  useEffect(() => {
    loadAccounts();
    // OAuth callback redirect params
    const p = new URLSearchParams(window.location.search);
    const connected = p.get("connected");
    const error = p.get("error");
    if (connected || error) {
      window.history.replaceState({}, "", "/integrations");
      if (connected) loadAccounts();
    }
  }, [loadAccounts]);

  /* Load Jira issues when connected */
  useEffect(() => {
    const acc = accounts.find((a) => a.provider === "JIRA");
    if (!acc) return;
    setJiraLoading(true);
    Promise.all([
      authedFetch<{ ok: boolean; issues: JiraIssue[] }>("/integrations/jira/issues").catch(() => null),
      authedFetch<{ ok: boolean; projects: any[] }>("/integrations/jira/projects").catch(() => null),
    ]).then(([iRes, pRes]) => {
      if (iRes?.ok) setJiraIssues(iRes.issues ?? []);
      if (pRes?.ok) setJiraProjects(pRes.projects ?? []);
    }).finally(() => setJiraLoading(false));
  }, [accounts]);

  /* Load Linear issues when connected */
  useEffect(() => {
    const acc = accounts.find((a) => a.provider === "LINEAR");
    if (!acc) return;
    setLinearLoading(true);
    Promise.all([
      authedFetch<{ ok: boolean; issues: LinearIssue[] }>("/integrations/linear/issues").catch(() => null),
      authedFetch<{ ok: boolean; teams: any[] }>("/integrations/linear/teams").catch(() => null),
    ]).then(([iRes, tRes]) => {
      if (iRes?.ok) setLinearIssues(iRes.issues ?? []);
      if (tRes?.ok) setLinearTeams(tRes.teams ?? []);
    }).finally(() => setLinearLoading(false));
  }, [accounts]);

  const isConnected = (p: ConnectedAccount["provider"]) => accounts.some((a) => a.provider === p);
  const getAccount  = (p: ConnectedAccount["provider"]) => accounts.find((a) => a.provider === p);

  /* ── OAuth connect ── */
  const connectOAuth = async (provider: "google" | "microsoft") => {
    setOauthBusy(provider);
    try {
      const res = await authedFetch<{ ok: boolean; url: string }>(`/integrations/${provider}/auth`);
      if (res.ok && res.url) window.location.href = res.url;
    } catch (e: any) { alert(e.message); }
    finally { setOauthBusy(null); }
  };

  /* ── Disconnect ── */
  const disconnect = async (id: string) => {
    if (!confirm("Disconnect this account?")) return;
    setDisconnBusy(id);
    try {
      await authedFetch(`/integrations/${id}`, { method: "DELETE" });
      await loadAccounts();
      if (id !== "telegram") {
        setJiraIssues([]); setLinearIssues([]);
      }
    } catch (e: any) { alert(e.message); }
    finally { setDisconnBusy(null); }
  };

  /* ── Jira connect ── */
  const connectJira = async () => {
    setJiraBusy(true); setJiraErr(null);
    try {
      const res = await authedFetch<{ ok: boolean; message?: string }>("/integrations/jira/connect", {
        method: "POST", body: JSON.stringify(jiraForm),
      });
      if ((res as any).ok) {
        setShowJiraForm(false);
        setJiraForm({ baseUrl: "", email: "", apiKey: "" });
        await loadAccounts();
      } else {
        setJiraErr((res as any).message ?? "Connection failed");
      }
    } catch (e: any) { setJiraErr(e.message); }
    finally { setJiraBusy(false); }
  };

  /* ── Linear connect ── */
  const connectLinear = async () => {
    setLinearBusy(true); setLinearErr(null);
    try {
      const res = await authedFetch<{ ok: boolean; message?: string }>("/integrations/linear/connect", {
        method: "POST", body: JSON.stringify({ apiKey: linearKey }),
      });
      if ((res as any).ok) {
        setShowLinearForm(false); setLinearKey("");
        await loadAccounts();
      } else {
        setLinearErr((res as any).message ?? "Connection failed");
      }
    } catch (e: any) { setLinearErr(e.message); }
    finally { setLinearBusy(false); }
  };

  /* ── Create Jira issue ── */
  const createJiraIssue = async () => {
    if (!newJira.projectKey || !newJira.summary) return;
    try {
      await authedFetch("/integrations/jira/issues", {
        method: "POST", body: JSON.stringify(newJira),
      });
      setShowNewJira(false); setNewJira({ projectKey: "", summary: "", description: "" });
      setJiraLoading(true);
      const r = await authedFetch<{ ok: boolean; issues: JiraIssue[] }>("/integrations/jira/issues").catch(() => null);
      if (r?.ok) setJiraIssues(r.issues ?? []);
      setJiraLoading(false);
    } catch (e: any) { alert(e.message); }
  };

  /* ── Create Linear issue ── */
  const createLinearIssue = async () => {
    if (!newLinear.teamId || !newLinear.title) return;
    try {
      await authedFetch("/integrations/linear/issues", {
        method: "POST", body: JSON.stringify(newLinear),
      });
      setShowNewLinear(false); setNewLinear({ teamId: "", title: "", description: "" });
      setLinearLoading(true);
      const r = await authedFetch<{ ok: boolean; issues: LinearIssue[] }>("/integrations/linear/issues").catch(() => null);
      if (r?.ok) setLinearIssues(r.issues ?? []);
      setLinearLoading(false);
    } catch (e: any) { alert(e.message); }
  };

  const PRIORITY_COLOR: Record<string, string> = {
    Highest: "#ef4444", High: "#f97316", Medium: "#f59e0b",
    Low: "#64748b", Lowest: "#475569", Urgent: "#ef4444",
    "No priority": "#374151",
  };

  return (
    <AppShell
      title="Integrations"
      subtitle="Connect your tools — Google, Microsoft, Jira and Linear"
      right={
        <button
          onClick={loadAccounts}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5"
          style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", color: "#00d4ff" }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* ══════════ GOOGLE ══════════ */}
        <IntCard icon={<GoogleIcon />} name="Google" description="Calendar, Gmail & Drive" accent="#4285F4">
          <div className="flex items-center justify-between mb-4">
            <StatusPill connected={isConnected("GOOGLE")} />
            {isConnected("GOOGLE") ? (
              <button
                onClick={() => disconnect(getAccount("GOOGLE")!.id)}
                disabled={disconnBusy === getAccount("GOOGLE")?.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-all"
                style={{ border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {disconnBusy === getAccount("GOOGLE")?.id
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Trash2 size={11} />
                } Disconnect
              </button>
            ) : (
              <button
                onClick={() => connectOAuth("google")}
                disabled={oauthBusy === "google"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#4285F4,#357ae8)", color: "#fff", boxShadow: "0 4px 16px rgba(66,133,244,0.3)" }}
              >
                {oauthBusy === "google" ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                Connect Google
              </button>
            )}
          </div>
          {isConnected("GOOGLE") && (
            <div className="text-xs text-[#64748b] font-medium px-1">
              <span className="text-[#94a3b8]">{getAccount("GOOGLE")?.email}</span>
              <span className="mx-2 text-[#374151]">·</span>
              Calendar, Gmail & Drive synced
            </div>
          )}
          {!isConnected("GOOGLE") && (
            <p className="text-xs text-[#374151] leading-relaxed">
              Sign in with Google to sync your Calendar events, Gmail and access Drive files directly from the platform.
            </p>
          )}
        </IntCard>

        {/* ══════════ MICROSOFT ══════════ */}
        <IntCard icon={<MicrosoftIcon />} name="Microsoft 365" description="Outlook Calendar & Email" accent="#00A4EF">
          <div className="flex items-center justify-between mb-4">
            <StatusPill connected={isConnected("MICROSOFT")} />
            {isConnected("MICROSOFT") ? (
              <button
                onClick={() => disconnect(getAccount("MICROSOFT")!.id)}
                disabled={disconnBusy === getAccount("MICROSOFT")?.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-all"
                style={{ border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {disconnBusy === getAccount("MICROSOFT")?.id
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Trash2 size={11} />
                } Disconnect
              </button>
            ) : (
              <button
                onClick={() => connectOAuth("microsoft")}
                disabled={oauthBusy === "microsoft"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#00A4EF,#0078D4)", color: "#fff", boxShadow: "0 4px 16px rgba(0,164,239,0.3)" }}
              >
                {oauthBusy === "microsoft" ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                Connect Microsoft
              </button>
            )}
          </div>
          {isConnected("MICROSOFT") && (
            <div className="text-xs text-[#64748b] font-medium px-1">
              <span className="text-[#94a3b8]">{getAccount("MICROSOFT")?.email}</span>
              <span className="mx-2 text-[#374151]">·</span>
              Outlook Calendar & Email synced
            </div>
          )}
          {!isConnected("MICROSOFT") && (
            <p className="text-xs text-[#374151] leading-relaxed">
              Connect your Microsoft 365 account to sync Outlook Calendar events and emails into the unified scheduler.
            </p>
          )}
        </IntCard>

        {/* ══════════ JIRA ══════════ */}
        <IntCard icon={<JiraIcon />} name="Jira" description="Issues & Project tracking" accent="#2684FF">
          <div className="flex items-center justify-between mb-4">
            <StatusPill connected={isConnected("JIRA")} />
            {isConnected("JIRA") ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setJiraLoading(true); authedFetch<{ ok: boolean; issues: JiraIssue[] }>("/integrations/jira/issues").then((r) => { if (r?.ok) setJiraIssues(r.issues ?? []); }).finally(() => setJiraLoading(false)); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#64748b] hover:text-[#94a3b8] transition-all"
                  style={{ border: "1px solid rgba(0,212,255,0.1)" }}
                >
                  <RefreshCw size={11} className={jiraLoading ? "animate-spin" : ""} /> Refresh
                </button>
                <button
                  onClick={() => disconnect(getAccount("JIRA")!.id)}
                  disabled={disconnBusy === getAccount("JIRA")?.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-all"
                  style={{ border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <Trash2 size={11} /> Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowJiraForm((v) => !v)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg,#2684FF,#0052CC)", color: "#fff", boxShadow: "0 4px 16px rgba(38,132,255,0.3)" }}
              >
                {showJiraForm ? <ChevronUp size={12} /> : <Link2 size={12} />}
                {showJiraForm ? "Cancel" : "Connect Jira"}
              </button>
            )}
          </div>

          {/* Connect form */}
          {!isConnected("JIRA") && showJiraForm && (
            <div className="space-y-2.5 mb-4 p-3 rounded-xl" style={{ background: "rgba(13,37,64,0.5)", border: "1px solid rgba(38,132,255,0.15)", animation: "slide-down 0.2s ease both" }}>
              <p className="text-[11px] text-[#64748b] font-medium mb-1">
                Get your API key at <span className="text-[#2684FF]">id.atlassian.com/manage-profile/security/api-tokens</span>
              </p>
              {[
                { key: "baseUrl", label: "Jira Base URL", placeholder: "https://yourcompany.atlassian.net" },
                { key: "email",   label: "Account Email",  placeholder: "you@company.com" },
                { key: "apiKey",  label: "API Token",       placeholder: "ATATT3xFfGF0..." },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest block mb-1">{label}</label>
                  <input
                    type={key === "apiKey" ? "password" : "text"}
                    value={(jiraForm as any)[key]}
                    onChange={(e) => setJiraForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-lg px-3 py-2 text-xs text-[#e2e8f0] outline-none"
                    style={{ background: "rgba(6,22,40,0.8)", border: "1px solid rgba(38,132,255,0.2)" }}
                  />
                </div>
              ))}
              {jiraErr && (
                <div className="flex items-center gap-2 text-xs text-red-400 px-2 py-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertTriangle size={11} /> {jiraErr}
                </div>
              )}
              <button
                onClick={connectJira}
                disabled={jiraBusy || !jiraForm.baseUrl || !jiraForm.email || !jiraForm.apiKey}
                className="w-full py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg,#2684FF,#0052CC)", color: "#fff" }}
              >
                {jiraBusy ? <><Loader2 size={11} className="inline animate-spin mr-1" />Verifying…</> : "Connect Jira"}
              </button>
            </div>
          )}

          {/* Issues panel */}
          {isConnected("JIRA") && (
            <>
              <div className="text-xs text-[#64748b] font-medium mb-3 px-1">
                <span className="text-[#94a3b8]">{getAccount("JIRA")?.email}</span>
                <span className="mx-2 text-[#374151]">·</span>
                {jiraIssues.length} open issues assigned to you
              </div>

              {/* New issue button */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">My Issues</span>
                <button
                  onClick={() => setShowNewJira((v) => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                  style={{ background: showNewJira ? "rgba(38,132,255,0.15)" : "rgba(13,37,64,0.6)", border: "1px solid rgba(38,132,255,0.2)", color: "#2684FF" }}
                >
                  <Plus size={10} /> New Issue
                </button>
              </div>

              {showNewJira && (
                <div className="space-y-2 mb-3 p-3 rounded-xl" style={{ background: "rgba(13,37,64,0.5)", border: "1px solid rgba(38,132,255,0.15)", animation: "slide-down 0.2s ease both" }}>
                  <select
                    value={newJira.projectKey}
                    onChange={(e) => setNewJira((f) => ({ ...f, projectKey: e.target.value }))}
                    className="w-full rounded-lg px-2 py-2 text-xs outline-none"
                    style={{ background: "rgba(6,22,40,0.8)", border: "1px solid rgba(38,132,255,0.2)", color: "#94a3b8" }}
                  >
                    <option value="">Select project…</option>
                    {jiraProjects.map((p) => <option key={p.key} value={p.key}>{p.name} ({p.key})</option>)}
                  </select>
                  <input
                    value={newJira.summary}
                    onChange={(e) => setNewJira((f) => ({ ...f, summary: e.target.value }))}
                    placeholder="Issue summary…"
                    className="w-full rounded-lg px-3 py-2 text-xs text-[#e2e8f0] outline-none"
                    style={{ background: "rgba(6,22,40,0.8)", border: "1px solid rgba(38,132,255,0.2)" }}
                  />
                  <textarea
                    value={newJira.description}
                    onChange={(e) => setNewJira((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Description (optional)…"
                    rows={2}
                    className="w-full rounded-lg px-3 py-2 text-xs text-[#94a3b8] outline-none resize-none"
                    style={{ background: "rgba(6,22,40,0.8)", border: "1px solid rgba(38,132,255,0.2)" }}
                  />
                  <button
                    onClick={createJiraIssue}
                    disabled={!newJira.projectKey || !newJira.summary}
                    className="w-full py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#2684FF,#0052CC)", color: "#fff" }}
                  >
                    Create Issue
                  </button>
                </div>
              )}

              <IssueList
                items={jiraIssues}
                loading={jiraLoading}
                emptyText="No open issues assigned to you"
                renderRow={(issue) => (
                  <div key={issue.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors"
                    style={{ background: "rgba(13,37,64,0.4)", border: "1px solid rgba(38,132,255,0.08)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(38,132,255,0.07)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(13,37,64,0.4)"}
                  >
                    <span className="text-[10px] font-bold text-[#2684FF] flex-shrink-0 mt-0.5 w-16 truncate">{issue.key}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#e2e8f0] truncate">{issue.summary}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                          style={{ background: "rgba(0,212,255,0.1)", color: "#00d4ff" }}>{issue.status}</span>
                        {issue.priority && (
                          <span className="text-[10px] font-bold" style={{ color: PRIORITY_COLOR[issue.priority] ?? "#64748b" }}>
                            {issue.priority}
                          </span>
                        )}
                        {issue.project && <span className="text-[10px] text-[#374151]">{issue.project}</span>}
                      </div>
                    </div>
                  </div>
                )}
              />
            </>
          )}
        </IntCard>

        {/* ══════════ LINEAR ══════════ */}
        <IntCard icon={<LinearIcon />} name="Linear" description="Issues & sprint planning" accent="#5E6AD2">
          <div className="flex items-center justify-between mb-4">
            <StatusPill connected={isConnected("LINEAR")} />
            {isConnected("LINEAR") ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setLinearLoading(true); authedFetch<{ ok: boolean; issues: LinearIssue[] }>("/integrations/linear/issues").then((r) => { if (r?.ok) setLinearIssues(r.issues ?? []); }).finally(() => setLinearLoading(false)); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#64748b] hover:text-[#94a3b8] transition-all"
                  style={{ border: "1px solid rgba(0,212,255,0.1)" }}
                >
                  <RefreshCw size={11} className={linearLoading ? "animate-spin" : ""} /> Refresh
                </button>
                <button
                  onClick={() => disconnect(getAccount("LINEAR")!.id)}
                  disabled={disconnBusy === getAccount("LINEAR")?.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-all"
                  style={{ border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <Trash2 size={11} /> Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLinearForm((v) => !v)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg,#5E6AD2,#4B5096)", color: "#fff", boxShadow: "0 4px 16px rgba(94,106,210,0.3)" }}
              >
                {showLinearForm ? <ChevronUp size={12} /> : <Link2 size={12} />}
                {showLinearForm ? "Cancel" : "Connect Linear"}
              </button>
            )}
          </div>

          {/* Connect form */}
          {!isConnected("LINEAR") && showLinearForm && (
            <div className="space-y-2.5 mb-4 p-3 rounded-xl" style={{ background: "rgba(13,37,64,0.5)", border: "1px solid rgba(94,106,210,0.15)", animation: "slide-down 0.2s ease both" }}>
              <p className="text-[11px] text-[#64748b] font-medium mb-1">
                Get your API key at <span className="text-[#5E6AD2]">linear.app → Settings → API → Personal API keys</span>
              </p>
              <div>
                <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest block mb-1">Personal API Key</label>
                <input
                  type="password"
                  value={linearKey}
                  onChange={(e) => setLinearKey(e.target.value)}
                  placeholder="lin_api_..."
                  className="w-full rounded-lg px-3 py-2 text-xs text-[#e2e8f0] outline-none"
                  style={{ background: "rgba(6,22,40,0.8)", border: "1px solid rgba(94,106,210,0.2)" }}
                />
              </div>
              {linearErr && (
                <div className="flex items-center gap-2 text-xs text-red-400 px-2 py-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertTriangle size={11} /> {linearErr}
                </div>
              )}
              <button
                onClick={connectLinear}
                disabled={linearBusy || !linearKey}
                className="w-full py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg,#5E6AD2,#4B5096)", color: "#fff" }}
              >
                {linearBusy ? <><Loader2 size={11} className="inline animate-spin mr-1" />Verifying…</> : "Connect Linear"}
              </button>
            </div>
          )}

          {/* Issues panel */}
          {isConnected("LINEAR") && (
            <>
              <div className="text-xs text-[#64748b] font-medium mb-3 px-1">
                <span className="text-[#94a3b8]">{getAccount("LINEAR")?.email}</span>
                <span className="mx-2 text-[#374151]">·</span>
                {linearIssues.length} open issues assigned to you
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">My Issues</span>
                <button
                  onClick={() => setShowNewLinear((v) => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                  style={{ background: showNewLinear ? "rgba(94,106,210,0.15)" : "rgba(13,37,64,0.6)", border: "1px solid rgba(94,106,210,0.2)", color: "#7c7fe0" }}
                >
                  <Plus size={10} /> New Issue
                </button>
              </div>

              {showNewLinear && (
                <div className="space-y-2 mb-3 p-3 rounded-xl" style={{ background: "rgba(13,37,64,0.5)", border: "1px solid rgba(94,106,210,0.15)", animation: "slide-down 0.2s ease both" }}>
                  <select
                    value={newLinear.teamId}
                    onChange={(e) => setNewLinear((f) => ({ ...f, teamId: e.target.value }))}
                    className="w-full rounded-lg px-2 py-2 text-xs outline-none"
                    style={{ background: "rgba(6,22,40,0.8)", border: "1px solid rgba(94,106,210,0.2)", color: "#94a3b8" }}
                  >
                    <option value="">Select team…</option>
                    {linearTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input
                    value={newLinear.title}
                    onChange={(e) => setNewLinear((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Issue title…"
                    className="w-full rounded-lg px-3 py-2 text-xs text-[#e2e8f0] outline-none"
                    style={{ background: "rgba(6,22,40,0.8)", border: "1px solid rgba(94,106,210,0.2)" }}
                  />
                  <textarea
                    value={newLinear.description}
                    onChange={(e) => setNewLinear((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Description (optional)…"
                    rows={2}
                    className="w-full rounded-lg px-3 py-2 text-xs text-[#94a3b8] outline-none resize-none"
                    style={{ background: "rgba(6,22,40,0.8)", border: "1px solid rgba(94,106,210,0.2)" }}
                  />
                  <button
                    onClick={createLinearIssue}
                    disabled={!newLinear.teamId || !newLinear.title}
                    className="w-full py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#5E6AD2,#4B5096)", color: "#fff" }}
                  >
                    Create Issue
                  </button>
                </div>
              )}

              <IssueList
                items={linearIssues}
                loading={linearLoading}
                emptyText="No open issues assigned to you"
                renderRow={(issue) => (
                  <div key={issue.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition-colors"
                    style={{ background: "rgba(13,37,64,0.4)", border: "1px solid rgba(94,106,210,0.08)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(94,106,210,0.07)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(13,37,64,0.4)"}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: issue.color ?? "#5E6AD2" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#5E6AD2] flex-shrink-0">{issue.key}</span>
                        <div className="text-xs font-semibold text-[#e2e8f0] truncate">{issue.title}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                          style={{ background: "rgba(94,106,210,0.12)", color: "#7c7fe0" }}>{issue.status}</span>
                        {issue.priority && (
                          <span className="text-[10px] font-bold" style={{ color: PRIORITY_COLOR[issue.priority] ?? "#64748b" }}>
                            {issue.priority}
                          </span>
                        )}
                        {issue.team && <span className="text-[10px] text-[#374151]">{issue.team}</span>}
                      </div>
                    </div>
                  </div>
                )}
              />
            </>
          )}
        </IntCard>

        {/* ══════════ TELEGRAM BOT ══════════ */}
        <IntCard icon={<Send size={20} />} name="Telegram Bot (@AtrailBot)" description="Notifications & Security Actions via Telegram" accent="#0088cc">
          <div className="flex items-center justify-between mb-4">
            <StatusPill connected={!!telegramLink?.isActive} />
            {telegramLink?.isActive ? (
              <button
                onClick={() => disconnect("telegram")}
                disabled={disconnBusy === "telegram"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-all"
                style={{ border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {disconnBusy === "telegram"
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Trash2 size={11} />
                } Disconnect
              </button>
            ) : (
              <a
                href="https://t.me/AtrailBot"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg,#0088cc,#006699)", color: "#fff", boxShadow: "0 4px 16px rgba(0,136,204,0.3)" }}
              >
                <ExternalLink size={12} />
                Open Bot
              </a>
            )}
          </div>
          {telegramLink?.isActive && (
            <div className="text-xs text-[#64748b] font-medium px-1 space-y-2">
              <div>
                <span className="text-[#94a3b8]">@{telegramLink.telegramUsername || "Linked Account"}</span>
                <span className="mx-2 text-[#374151]">·</span>
                Active and listening
              </div>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-300/80 leading-relaxed">
                💡 <strong>Password Change:</strong> If you want to change your password, open the Telegram bot and type <code className="text-white bg-white/10 px-1 rounded">password change</code>. The bot will guide you through verification and invalidate web sessions.
              </div>
            </div>
          )}
          {!telegramLink?.isActive && (
            <p className="text-xs text-[#374151] leading-relaxed">
              Open <a href="https://t.me/AtrailBot" target="_blank" rel="noopener noreferrer" className="text-[#0088cc] hover:underline">@AtrailBot</a> in Telegram, send <code className="text-[#e2e8f0] bg-white/5 px-1 rounded">/start</code>, and follow the instructions to link your account.
            </p>
          )}
        </IntCard>
      </div>

      {/* Info footer */}
      <div
        className="mt-6 flex items-start gap-3 px-5 py-4 rounded-2xl"
        style={{ background: "rgba(13,37,64,0.4)", border: "1px solid rgba(0,212,255,0.07)" }}
      >
        <AlertTriangle size={14} className="text-[#f59e0b] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#64748b] leading-relaxed font-medium">
          <strong className="text-[#94a3b8]">Google & Microsoft</strong> require OAuth credentials set in the backend environment (<code className="text-[#00d4ff] text-[10px]">GOOGLE_CLIENT_ID</code>, <code className="text-[#00d4ff] text-[10px]">MICROSOFT_CLIENT_ID</code>, etc.).{" "}
          <strong className="text-[#94a3b8]">Jira</strong> needs your Atlassian API token.{" "}
          <strong className="text-[#94a3b8]">Linear</strong> needs a Personal API key from Linear settings.{" "}
          All credentials are stored securely on the server and never exposed to the browser.
        </p>
      </div>
    </AppShell>
  );
}
