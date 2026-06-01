"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "../lib/auth-store";
import { setup2fa, verify2fa } from "../lib/api-extensions";
import {
  Shield, CheckCircle, AlertTriangle, Lock, Smartphone, Zap, Rocket, X,
} from "lucide-react";

export default function TwoFactorSetupBanner() {
  const user    = useAuthStore((s) => s.user);
  const token   = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [show, setShow]       = useState(false);
  const [step, setStep]       = useState<"intro" | "qr" | "verify" | "done">("intro");
  const [qrCode, setQrCode]   = useState<string | null>(null);
  const [secret, setSecret]   = useState<string | null>(null);
  const [code, setCode]       = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);

  useEffect(() => {
    if (!user) { setShow(false); return; }
    if (hasSkipped) { setShow(false); return; }
    setShow(user.twoFactorEnabled === false);
  }, [user, hasSkipped]);

  const handleSkip = () => { setHasSkipped(true); setShow(false); };

  const handleSetup = async () => {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      const res = await setup2fa(token);
      if (res.ok) { setQrCode(res.qrCode); setSecret(res.secret); setStep("qr"); }
      else setError((res as any).message || "Setup failed.");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleVerify = async () => {
    if (!token || !user) return;
    if (code.length !== 6) { setError("Enter a 6-digit code"); return; }
    setBusy(true); setError(null);
    try {
      const res = await verify2fa(token, code);
      if (res.ok) {
        setAuth(token, { ...user, twoFactorEnabled: true });
        setStep("done");
        setTimeout(() => setShow(false), 2000);
      } else {
        setError(res.message || "Invalid code");
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{
        background: "rgba(2,11,24,0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        animation: "fade-in 0.3s ease both",
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(13,37,64,0.97) 0%, rgba(6,22,40,0.99) 100%)",
          border: "1px solid rgba(0,212,255,0.18)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,255,0.06), 0 0 80px rgba(0,212,255,0.06)",
          backdropFilter: "blur(32px)",
          animation: "scale-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Top aurora bar */}
        <div
          className="h-px"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.7), rgba(124,58,237,0.5), transparent)",
            animation: "aurora 4s ease infinite",
            backgroundSize: "300% 100%",
          }}
        />

        {/* Skip button */}
        {step !== "done" && (
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-[#64748b] hover:text-[#94a3b8] hover:bg-white/5 transition-all"
            aria-label="Skip 2FA setup"
          >
            <X size={15} />
          </button>
        )}

        <div className="p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
              style={{
                background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.1))",
                border: "1px solid rgba(0,212,255,0.25)",
                boxShadow: "0 0 40px rgba(0,212,255,0.15)",
              }}
            >
              {step === "done"
                ? <CheckCircle size={30} className="text-emerald-400" />
                : <Shield size={30} className="text-primary" />}
              <div
                className="absolute inset-[-8px] rounded-2xl border border-primary/20"
                style={{ animation: "spin-slow 12s linear infinite" }}
              />
            </div>
          </div>

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="text-center" style={{ animation: "slide-up 0.4s ease both" }}>
              <h2 className="text-xl font-bold text-[#e2e8f0] mb-2">2FA Activated!</h2>
              <p className="text-sm text-[#64748b] font-medium">
                Your account is now secured with two-factor authentication.
              </p>
            </div>
          )}

          {/* ── QR / VERIFY ── */}
          {step === "qr" && (
            <div style={{ animation: "slide-up 0.4s ease both" }}>
              <h2 className="text-xl font-bold text-[#e2e8f0] mb-1 text-center">Scan QR Code</h2>
              <p className="text-sm text-[#64748b] font-medium mb-6 text-center">
                Open <strong className="text-[#94a3b8]">Google Authenticator</strong> or{" "}
                <strong className="text-[#94a3b8]">Authy</strong> and scan:
              </p>

              {/* QR Code */}
              <div
                className="mx-auto mb-5 p-3 rounded-xl flex items-center justify-center"
                style={{
                  background: "#fff",
                  width: "fit-content",
                  border: "1px solid rgba(0,212,255,0.2)",
                  boxShadow: "0 0 30px rgba(0,212,255,0.1)",
                }}
              >
                {qrCode && (
                  <img src={qrCode} alt="2FA QR Code" style={{ width: 176, height: 176, display: "block" }} />
                )}
              </div>

              {/* Secret */}
              <div
                className="mb-5 px-4 py-3 rounded-xl text-xs font-mono break-all"
                style={{
                  background: "rgba(13,37,64,0.6)",
                  border: "1px solid rgba(0,212,255,0.1)",
                  color: "#64748b",
                }}
              >
                <span className="text-[#374151] mr-2">Manual key:</span>
                <span className="text-[#94a3b8]">{secret}</span>
              </div>

              <p className="text-sm font-semibold text-[#94a3b8] mb-3">Enter the 6-digit code:</p>

              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="flex-1 rounded-xl text-center text-xl font-bold tracking-[0.4em] text-[#e2e8f0] outline-none transition-all"
                  style={{
                    background: "rgba(6,22,40,0.7)",
                    border: "1px solid rgba(0,212,255,0.2)",
                    padding: "14px",
                    letterSpacing: "0.4em",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(0,212,255,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(0,212,255,0.2)"; e.target.style.boxShadow = "none"; }}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                />
                <button
                  onClick={handleVerify}
                  disabled={busy || code.length !== 6}
                  className="px-5 rounded-xl font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff, #0284c7)",
                    color: "#020b18",
                    boxShadow: "0 4px 16px rgba(0,212,255,0.3)",
                  }}
                >
                  {busy ? "…" : <span className="flex items-center gap-1.5"><CheckCircle size={14} /> Verify</span>}
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-300 mb-3"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertTriangle size={14} className="text-red-400 flex-shrink-0" /> {error}
                </div>
              )}

              <button
                onClick={handleSkip}
                className="w-full text-center text-xs text-[#374151] hover:text-[#64748b] transition-colors py-2 font-medium"
              >
                Skip for now →
              </button>
            </div>
          )}

          {/* ── INTRO ── */}
          {step === "intro" && (
            <div style={{ animation: "slide-up 0.4s ease both" }}>
              <h2 className="text-xl font-bold text-[#e2e8f0] mb-2 text-center">
                Secure Your Account
              </h2>
              <p className="text-sm text-[#64748b] font-medium mb-6 text-center leading-relaxed">
                Two-factor authentication keeps your workspace safe — takes only 30 seconds to set up.
              </p>

              <div className="space-y-3 mb-6">
                {[
                  { icon: <Lock size={16} />, text: "Protects your account even if your password is compromised", color: "#00d4ff" },
                  { icon: <Smartphone size={16} />, text: "Works with Google Authenticator, Authy, or any TOTP app", color: "#a78bfa" },
                  { icon: <Zap size={16} />, text: "Quick 30-second setup — just scan a QR code", color: "#34d399" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(13,37,64,0.5)", border: "1px solid rgba(0,212,255,0.07)" }}
                  >
                    <span className="flex-shrink-0 mt-0.5" style={{ color: item.color }}>{item.icon}</span>
                    <span className="text-sm text-[#94a3b8] font-medium leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSetup}
                disabled={busy}
                className="w-full py-4 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none mb-3"
                style={{
                  background: "linear-gradient(135deg, #00d4ff, #0284c7)",
                  color: "#020b18",
                  boxShadow: "0 8px 32px rgba(0,212,255,0.35)",
                }}
              >
                {busy ? (
                  <><div className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full" style={{ animation: "spin 0.8s linear infinite" }} /> Setting up…</>
                ) : (
                  <><Rocket size={16} /> Set Up 2FA Now</>
                )}
              </button>

              <button
                onClick={handleSkip}
                disabled={busy}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#64748b] transition-all duration-200 hover:text-[#94a3b8]"
                style={{ border: "1px solid rgba(0,212,255,0.08)" }}
              >
                Skip for now
              </button>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-300 mt-3"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertTriangle size={14} className="text-red-400 flex-shrink-0" /> {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
