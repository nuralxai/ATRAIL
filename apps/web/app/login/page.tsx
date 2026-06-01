"use client";

import "./login.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { login, verifyLogin2fa } from "../../lib/auth";
import { useAuthStore } from "../../lib/auth-store";
import { AlertTriangle } from "lucide-react";
import { API_BASE, API_HOST } from "../../lib/config";

const ROLE_REDIRECT: Record<string, string> = {
  SUPER_ADMIN: "/dashboard/super",
  ADMIN: "/dashboard/admin",
  ELITE: "/dashboard/elite",
  TENANT: "/dashboard/tenant",
  USER: "/dashboard/user",
};

function useParticles(count = 55) {
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      speed: Math.random() * 0.3 + 0.1,
      opacity: Math.random() * 0.6 + 0.1,
      color: ["#38BDF8", "#FACC15", "#EF4444", "#A78BFA", "#34D399"][
        Math.floor(Math.random() * 5)
      ],
      delay: Math.random() * 4,
    }))
  );
  return particles;
}

export default function LoginPage() {
  const router = useRouter();
  const particles = useParticles();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [loginToken, setLoginToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [cardRotation, setCardRotation] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setCardRotation({
      x: ((e.clientY - cy) / rect.height) * -12,
      y: ((e.clientX - cx) / rect.width) * 12,
    });
  }, []);

  const handleMouseLeave = useCallback(() => setCardRotation({ x: 0, y: 0 }), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const ssoToken = url.searchParams.get("token");
    const ssoOtp = url.searchParams.get("otp");

    if (ssoOtp) {
      setLoading(true);
      fetch(`${API_BASE}/auth/sso/exchange-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: ssoOtp }),
      })
      .then(r => {
        if (!r.ok) throw new Error("OTP exchange failed");
        return r.json();
      })
      .then(data => {
        if (data.ok && data.user && data.accessToken) {
          useAuthStore.getState().setAuth(data.accessToken, data.user);
          router.replace(ROLE_REDIRECT[data.user.role] ?? "/dashboard/user");
        } else {
          throw new Error("Invalid response");
        }
      })
      .catch(e => setError("SSO authentication failed. Please try again."))
      .finally(() => setLoading(false));
    } else if (ssoToken) {
       setLoading(true);
       fetch(`${API_BASE}/auth/me`, {
         headers: { Authorization: `Bearer ${ssoToken}` }
       })
       .then(r => r.json())
       .then(data => {
         if (data.ok && data.user) {
           useAuthStore.getState().setAuth(ssoToken, data.user);
           router.replace(ROLE_REDIRECT[data.user.role] ?? "/dashboard/user");
         }
       })
       .catch(e => setError("SSO failed. Please try again."))
       .finally(() => setLoading(false));
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.twoFactorRequired) {
        setTwoFactorRequired(true);
        setLoginToken(res.loginToken || "");
        setLoading(false);
        return;
      }

      const user = res.user!;
      // After login, fetch profile completeness
      const profileRes = await fetch(`${API_BASE}/users/profile/me`, {
        headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
      });
      const profileData = await profileRes.json();
      const needsProfile =
        profileData.ok &&
        !profileData.isComplete &&
        user.role !== 'ADMIN' &&
        user.role !== 'SUPER_ADMIN';
      if (needsProfile) {
        router.replace('/profile');
      } else {
        router.replace(ROLE_REDIRECT[user.role] ?? '/dashboard/user');
      }
    } catch (err: any) {
      setError(err?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (twoFactorCode.length !== 6) {
      setError("Please enter a 6-digit verification code.");
      return;
    }
    setLoading(true);
    try {
      const user = await verifyLogin2fa(loginToken, twoFactorCode);
      const profileRes = await fetch(`${API_BASE}/users/profile/me`, {
        headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
      });
      const profileData = await profileRes.json();
      const needsProfile =
        profileData.ok &&
        !profileData.isComplete &&
        user.role !== 'ADMIN' &&
        user.role !== 'SUPER_ADMIN';
      if (needsProfile) {
        router.replace('/profile');
      } else {
        router.replace(ROLE_REDIRECT[user.role] ?? '/dashboard/user');
      }
    } catch (err: any) {
      setError(err?.message || "Invalid or expired 2FA code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="login-root">
      {/* Backgrounds */}
      <div className="mesh-bg" />
      <div className="grid-bg" />

      {/* Glowing orbs */}
      <div className="glow-orb orb-blue" />
      <div className="glow-orb orb-gold" />
      <div className="glow-orb orb-red" />

      {/* Cursor light */}
      <div
        className="cursor-light"
        style={{ left: `${mousePos.x}%`, top: `${mousePos.y}%` }}
      />

      {/* 3D Geometric SVG decorations */}
      <svg className="geo-shape" style={{ width: 200, height: 200, top: "8%", right: "8%" }} viewBox="0 0 100 100">
        <polygon points="50,5 95,25 95,75 50,95 5,75 5,25"   fill="none" stroke="#38BDF8" strokeWidth="0.5" />
        <polygon points="50,15 85,32 85,68 50,85 15,68 15,32" fill="none" stroke="#38BDF8" strokeWidth="0.3" />
        <polygon points="50,25 75,38 75,62 50,75 25,62 25,38" fill="none" stroke="#FACC15" strokeWidth="0.5" />
      </svg>

      <svg className="geo-shape geo-shape-2" style={{ width: 160, height: 160, bottom: "10%", left: "6%" }} viewBox="0 0 100 100">
        <rect x="10" y="10" width="80" height="80" fill="none" stroke="#A78BFA" strokeWidth="0.6" transform="rotate(15 50 50)" />
        <rect x="20" y="20" width="60" height="60" fill="none" stroke="#FACC15" strokeWidth="0.4" transform="rotate(30 50 50)" />
        <rect x="35" y="35" width="30" height="30" fill="none" stroke="#38BDF8" strokeWidth="0.8" transform="rotate(45 50 50)" />
      </svg>

      <svg className="geo-shape geo-shape-3" style={{ width: 120, height: 120, top: "60%", left: "3%" }} viewBox="0 0 100 100">
        <polygon points="50,10 90,90 10,90" fill="none" stroke="#EF4444" strokeWidth="0.6" />
        <polygon points="50,25 78,78 22,78" fill="none" stroke="#EF4444" strokeWidth="0.4" />
      </svg>

      <svg className="geo-shape" style={{ width: 100, height: 100, top: "15%", left: "12%" }} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#34D399" strokeWidth="0.5" strokeDasharray="5 8" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="#34D399" strokeWidth="0.3" />
      </svg>

      {/* Floating particles — rendered only on client to avoid hydration mismatch */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            ["--dur" as any]: `${p.speed * 20 + 4}s`,
            ["--delay" as any]: `-${p.delay}s`,
            ["--blur" as any]: `${p.size > 3 ? "1px" : "0px"}`,
            ["--op" as any]: p.opacity,
          }}
        />
      ))}

      {/* ── Main card ── */}
      <div
        className="login-card-wrapper"
        ref={cardRef}
        style={{
          transform: `perspective(1200px) rotateX(${cardRotation.x}deg) rotateY(${cardRotation.y}deg)`,
        }}
      >
        <div className="login-card">
          <div className="card-shimmer" />
          <div className="card-reflection" />

          {/* Logo */}
          <div className="logo-ring">
            <img src="/logo.png" alt="ATRAIL" className="logo-img" />
          </div>

          {/* Brand */}
          <h1 className="brand-title">ATRAIL</h1>
          <p className="brand-subtitle">ENTERPRISE WORKFLOW PLATFORM</p>
          <p className="brand-tagline">Authenticate to access your workspace</p>

          <div className="lc-divider" />

          {twoFactorRequired ? (
            <form onSubmit={handleTwoFactorSubmit} noValidate>
              <div className="field-group">
                <label className="field-label">✦ TWO-FACTOR CIPHER</label>
                <div className="field-wrapper">
                  <input
                    id="login-2fa-code"
                    className="field-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                    required
                    disabled={loading}
                    style={{ letterSpacing: "0.2em", textAlign: "center" }}
                  />
                  <span className="field-icon">⬡</span>
                </div>
              </div>

              {/* Error */}
              {error && <div className="error-box flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

              {/* Submit */}
              <button
                type="submit"
                id="login-totp-submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="lc-spinner" />
                    VERIFYING CODE...
                  </>
                ) : (
                  "◈ INITIATE VERIFICATION"
                )}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => {
                    setTwoFactorRequired(false);
                    setTwoFactorCode("");
                    setError(null);
                  }}
                >
                  ← Return to Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div className="field-group">
                <label className="field-label">✦ IDENTITY MATRIX</label>
                <div className="field-wrapper">
                  <input
                    id="login-email"
                    className="field-input"
                    type="email"
                    placeholder="your.email@atrail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    required
                    disabled={loading}
                  />
                  <span className="field-icon">⬡</span>
                </div>
              </div>

              {/* Password */}
              <div className="field-group">
                <label className="field-label">✦ ACCESS CIPHER</label>
                <div className="field-wrapper">
                  <input
                    id="login-password"
                    className="field-input"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    required
                    disabled={loading}
                    style={{ paddingRight: "70px" }}
                  />
                  <span className="field-icon">⬡</span>
                  <button
                    type="button"
                    className="toggle-pass"
                    onClick={() => setShowPass((v) => !v)}
                    disabled={loading}
                  >
                    {showPass ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              {/* Forgot */}
              <div className="forgot-row">
                <a href="/forgot-password" className="forgot-link">
                  Forgot access key?
                </a>
              </div>

              {/* Error */}
              {error && <div className="error-box flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

              {/* Submit */}
              <button
                type="submit"
                id="login-submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="lc-spinner" />
                    AUTHENTICATING...
                  </>
                ) : (
                  "◈ INITIATE SECURE ACCESS"
                )}
              </button>

              {/* SSO Options */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <a href={`${API_HOST}/api/v1/auth/sso/google`} style={{ flex: 1, padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px' }}>
                  GOOGLE SSO
                </a>
                <a href={`${API_HOST}/api/v1/auth/sso/microsoft`} style={{ flex: 1, padding: '10px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px' }}>
                  MICROSOFT SSO
                </a>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="card-footer">
            <p className="footer-text">
              New to ATRAIL?{" "}
              <a href="/signup" className="footer-link">
                Request Access →
              </a>
            </p>
            <div className="status-bar" style={{ marginBottom: "1rem" }}>
              <span className="status-dot dot-blue" />
              <span className="status-dot dot-gold" />
              <span className="status-dot dot-green" />
              <span className="status-text">ALL SYSTEMS NOMINAL</span>
            </div>
            
            <div className="text-center w-full" style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "12px", fontFamily: "monospace", letterSpacing: "1px" }}>
              MADE BY COCOON AI &amp; POWERED BY BEAITE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
