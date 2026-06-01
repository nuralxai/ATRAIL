"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { setup2fa, verify2fa, disable2fa } from "@/lib/api-extensions";
import { useAuthStore } from "@/lib/auth-store";
import { authedFetch } from "@/lib/authed-fetch";
import { messaging, getToken } from "@/lib/firebase";
import { Shield, Bell, CheckCircle, AlertTriangle, Link as LinkIcon, Rocket } from "lucide-react";
import { API_BASE } from "@/lib/config";

type ConnectedAccount = {
  id: string;
  provider: "GOOGLE" | "MICROSOFT";
  email: string;
  createdAt: string;
};

export default function SettingsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const user  = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [qrCode,  setQrCode]  = useState<string | null>(null);
  const [secret,  setSecret]  = useState<string | null>(null);
  const [code,    setCode]    = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [msg,     setMsg]     = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [pushStatus, setPushStatus] = useState("");
  const [busy,    setBusy]    = useState(false);

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const twoFAEnabled = user?.twoFactorEnabled === true;

  const searchParams = useSearchParams();

  useEffect(() => {
    // Handle OAuth callback result from URL params
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      showMsg(`${connected.charAt(0).toUpperCase() + connected.slice(1)} account connected successfully! 🎉`, 'success');
      loadAccounts();
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    } else if (error) {
      showMsg(`OAuth error: ${error.replace(/_/g, ' ')}`, 'error');
      window.history.replaceState({}, '', '/settings');
    }
  }, [searchParams]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await authedFetch<{ ok: boolean; accounts: ConnectedAccount[] }>("/integrations");
      if (res.ok) {
        setAccounts(res.accounts || []);
      }
    } catch (e) {
      console.error("Failed to load integrations", e);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleConnectProvider = async (provider: "google" | "microsoft") => {
    try {
      setBusy(true);
      const res = await authedFetch<{ ok: boolean; url: string }>(`/integrations/${provider}/auth`);
      if (res.ok && res.url) {
        window.location.href = res.url;
      }
    } catch (e: any) {
      showMsg(e.message || `Failed to start ${provider} connection`, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this account? Calendar and email sync will stop.")) return;
    try {
      setBusy(true);
      await authedFetch(`/integrations/${id}`, { method: "DELETE" });
      setAccounts(accounts.filter(a => a.id !== id));
      showMsg("Account disconnected", "success");
    } catch (e: any) {
      showMsg(e.message || "Failed to disconnect", "error");
    } finally {
      setBusy(false);
    }
  };

  const showMsg = (text: string, type: "success" | "error" = "success") =>
    setMsg({ text, type });

  const handleSetup2FA = async () => {
    if (!token) return;
    setBusy(true); setMsg(null);
    try {
      const res = await setup2fa(token);
      if (res.ok) { setQrCode(res.qrCode); setSecret(res.secret); }
      else showMsg((res as any).message || "Setup failed.", "error");
    } catch (e: any) { showMsg(e.message, "error"); }
    finally { setBusy(false); }
  };

  const handleVerify2FA = async () => {
    if (!token || !user) return;
    if (!/^\d{6}$/.test(code.trim())) { showMsg("Enter a valid 6-digit code", "error"); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await verify2fa(token, code.trim());
      if (res.ok) {
        showMsg("2FA verified and enabled!", "success");
        // Mark enabled in store
        setAuth(token, { ...user, twoFactorEnabled: true });
        setQrCode(null); setSecret(null); setCode("");
      } else { showMsg(res.message || "Invalid code", "error"); }
    } catch (e: any) { showMsg(e.message, "error"); }
    finally { setBusy(false); }
  };

  const handleDisable2FA = async () => {
    if (!token || !user) return;
    if (!/^\d{6}$/.test(disableCode.trim())) {
      showMsg("Enter your current 6-digit 2FA code to confirm disable", "error");
      return;
    }
    if (!confirm("Are you sure you want to disable 2FA? This reduces your account security.")) return;
    setBusy(true); setMsg(null);
    try {
      // Send the TOTP code to the backend for re-auth
      const res = await fetch(`http://localhost:4000/api/v1/auth/2fa/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: disableCode.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        showMsg("2FA disabled.", "success");
        setAuth(token, { ...user, twoFactorEnabled: false });
        setDisableCode("");
      } else { showMsg(data.message || "Could not disable 2FA", "error"); }
    } catch (e: any) { showMsg(e.message, "error"); }
    finally { setBusy(false); }
  };

  const handleEnablePush = async () => {
    if (!token || !messaging) {
      setPushStatus("Firebase messaging is not supported in this browser/environment.");
      return;
    }
    try {
      setBusy(true);
      setPushStatus("Requesting permission...");
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const fcmToken = await getToken(messaging);
        if (fcmToken) {
           const res = await fetch(`${API_BASE}/users/me/fcm`, {
             method: "PUT",
             headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
             body: JSON.stringify({ token: fcmToken })
           });
           if (res.ok) {
              setPushStatus("Push notifications enabled via Firebase!");
           } else {
              setPushStatus("Failed to setup notifications on backend.");
           }
        } else {
           setPushStatus("Failed to get FCM token.");
        }
      } else {
        setPushStatus("Permission denied for notifications.");
      }
    } catch (e: any) {
      console.error(e);
      setPushStatus("Push registration failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", borderRadius: "12px",
    border: "1.5px solid #cbd5e1", padding: "11px 16px",
    fontSize: "0.9rem", outline: "none", color: "#0f172a",
    background: "white", boxSizing: "border-box",
  };
  const btnPrimary: React.CSSProperties = {
    padding: "11px 22px", borderRadius: "12px", border: "none",
    background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
    color: "white", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
    opacity: busy ? 0.7 : 1, fontSize: "0.85rem",
    boxShadow: "0 4px 12px rgba(14,165,233,0.3)",
  };
  const btnDanger: React.CSSProperties = {
    ...btnPrimary,
    background: "linear-gradient(135deg, #ef4444, #b91c1c)",
    boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
  };
  const sectionStyle: React.CSSProperties = {
    background: "white", border: "1px solid #e2eaf4",
    borderRadius: "20px", padding: "28px",
    boxShadow: "0 2px 16px rgba(14,165,233,0.06)",
  };

  return (
    <AppShell title="Account Settings" subtitle="Security and Preferences">
      <div style={{ maxWidth: "640px", margin: "24px auto", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* ── 2FA Section ── */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <span style={{ fontSize: "1.5rem" }}><Shield size={24} className="text-blue-500" /></span>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Two-Factor Authentication
            </h2>
            <span style={{
              marginLeft: "auto", fontSize: "0.72rem", fontWeight: 700, padding: "3px 10px",
              borderRadius: "20px", letterSpacing: "0.05em",
              background: twoFAEnabled ? "#dcfce7" : "#fef9c3",
              color: twoFAEnabled ? "#15803d" : "#92400e",
            }}>
              {twoFAEnabled ? "ENABLED" : "NOT SET UP"}
            </span>
          </div>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>
            Protects your account with a time-based one-time password from Google Authenticator or Authy.
          </p>

          {msg && (
            <div style={{
              marginBottom: "16px", padding: "10px 14px", borderRadius: "10px", fontSize: "0.85rem",
              background: msg.type === "success" ? "#f0fdf4" : "#fef2f2",
              color:      msg.type === "success" ? "#166534" : "#991b1b",
              border: `1px solid ${msg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            }}>
              <span className="flex items-center gap-1">
                {msg.type === "success" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />} {msg.text}
              </span>
            </div>
          )}

          {!twoFAEnabled && !qrCode && (
            <button style={btnPrimary} onClick={handleSetup2FA} disabled={busy}>
              <span className="flex items-center justify-center gap-2">
                {busy ? "Setting up…" : <><Rocket size={16} /> Set Up 2FA</>}
              </span>
            </button>
          )}

          {qrCode && (
            <div style={{ background: "#f8faff", borderRadius: "14px", padding: "20px", border: "1px solid #e2eaf4" }}>
              <p style={{ fontSize: "0.85rem", color: "#0f172a", marginBottom: "12px", fontWeight: 600 }}>
                1. Scan with Google Authenticator / Authy:
              </p>
              <div style={{ background: "white", display: "inline-block", padding: "10px", borderRadius: "12px", border: "1px solid #e2eaf4", marginBottom: "14px" }}>
                <img src={qrCode} alt="2FA QR Code" style={{ width: "160px", height: "160px", display: "block" }} />
              </div>
              <div style={{ background: "#f1f5f9", borderRadius: "10px", padding: "8px 12px", marginBottom: "16px", fontFamily: "monospace", fontSize: "0.78rem", color: "#334155", wordBreak: "break-all" }}>
                <span style={{ color: "#94a3b8" }}>Manual key: </span>{secret}
              </div>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0f172a", marginBottom: "8px" }}>
                2. Enter the 6-digit code to verify:
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  style={{ ...inputStyle, letterSpacing: "0.25em", textAlign: "center", fontWeight: 700 }}
                  onKeyDown={e => e.key === "Enter" && handleVerify2FA()}
                />
                <button style={btnPrimary} onClick={handleVerify2FA} disabled={busy}>
                  {busy ? "…" : <span className="flex items-center gap-1">Verify <CheckCircle size={14} /></span>}
                </button>
              </div>
            </div>
          )}

          {twoFAEnabled && (
            <div style={{ marginTop: "16px", padding: "16px", background: "#fff5f5", borderRadius: "12px", border: "1px solid #fecaca" }}>
              <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.83rem", color: "#7f1d1d", marginBottom: "10px", fontWeight: 600 }}>
                <AlertTriangle size={14} /> Danger Zone — Enter your current 2FA code to disable:
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  style={{ ...inputStyle, letterSpacing: "0.25em", textAlign: "center", fontWeight: 700, border: "1.5px solid #fca5a5" }}
                />
                <button style={btnDanger} onClick={handleDisable2FA} disabled={busy}>
                  {busy ? "…" : "Disable"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Push Notifications ── */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <span style={{ fontSize: "1.4rem" }}><Bell size={22} className="text-yellow-500" /></span>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Push Notifications</h2>
          </div>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>
            Receive browser notifications for new messages, emergency events, and tasks.
          </p>
          <button style={btnPrimary} onClick={handleEnablePush}>
            Enable Notification Delivery
          </button>
          {pushStatus && (
            <p style={{
              marginTop: "12px", fontSize: "0.83rem", padding: "10px 14px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "6px",
              background: pushStatus.toLowerCase().includes("enabled") ? "#f0fdf4" : "#fef9c3",
              color:      pushStatus.toLowerCase().includes("enabled") ? "#166534" : "#92400e",
              border: `1px solid ${pushStatus.toLowerCase().includes("enabled") ? "#bbf7d0" : "#fde68a"}`,
            }}>
              {pushStatus.toLowerCase().includes("enabled") ? <CheckCircle size={14} /> : <AlertTriangle size={14} />} {pushStatus}
            </p>
          )}
        </section>

        {/* ── Integrations ── */}
        <section style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <span style={{ fontSize: "1.4rem" }}><LinkIcon size={22} className="text-slate-600" /></span>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Connected Accounts</h2>
          </div>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "20px" }}>
            Connect your Google Workspace or Microsoft 365 accounts to sync your calendars and emails.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {loadingAccounts ? (
              <p className="text-sm text-text-muted">Loading accounts...</p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-text-muted italic">No accounts connected yet.</p>
            ) : (
              <div className="space-y-3">
                {accounts.map(acc => (
                  <div key={acc.id} className="flex items-center justify-between p-3 border border-zinc-200 rounded-xl bg-zinc-50">
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-1 bg-zinc-200 rounded text-xs font-bold text-zinc-700">
                        {acc.provider}
                      </div>
                      <span className="text-sm font-medium text-zinc-900">{acc.email}</span>
                    </div>
                    <button 
                      onClick={() => handleDisconnect(acc.id)}
                      disabled={busy}
                      className="text-xs text-red-600 hover:underline px-2 py-1"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <button 
                style={{...btnPrimary, background: "white", color: "#333", border: "1px solid #ccc", boxShadow: "none"}} 
                onClick={() => handleConnectProvider("google")} 
                disabled={busy}
              >
                Connect Google
              </button>
              <button 
                style={{...btnPrimary, background: "white", color: "#333", border: "1px solid #ccc", boxShadow: "none"}} 
                onClick={() => handleConnectProvider("microsoft")} 
                disabled={busy}
              >
                Connect Microsoft
              </button>
            </div>

            <div style={{ marginTop: "20px", borderTop: "1px solid #e2eaf4", paddingTop: "20px" }}>
               <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "8px", color: "#0f172a" }}>Notification Mirroring</h3>
               <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "12px" }}>
                 Forward critical notifications and alerts directly to your connected Google or Microsoft accounts via Email.
               </p>
               <button 
                  style={{...btnPrimary, background: (user as any)?.externalReminders ? "#166534" : "linear-gradient(135deg, #0ea5e9, #2563eb)", opacity: (busy || accounts.length === 0) ? 0.6 : 1 }}
                  onClick={async () => {
                     if (!token || !user) return;
                     setBusy(true);
                     const nextState = !(user as any).externalReminders;
                     try {
                        const res = await fetch(`${API_BASE}/users/me/external-reminders`, {
                          method: 'PUT',
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ enabled: nextState })
                       });
                       if (res.ok) {
                          setAuth(token, { ...user, externalReminders: nextState });
                       } else {
                          alert("Failed to update preferences.");
                       }
                     } catch(e) { console.error(e); }
                     setBusy(false);
                  }}
                  disabled={busy || accounts.length === 0}
               >
                  {accounts.length === 0 
                     ? "Connect an account to enable" 
                     : (user as any)?.externalReminders 
                        ? <span className="flex items-center justify-center gap-2"><CheckCircle size={16} /> Mirroring Enabled (Click to Disable)</span> 
                        : "Enable Notification Mirroring"
                  }
               </button>
            </div>

          </div>
        </section>

      </div>
    </AppShell>
  );
}
