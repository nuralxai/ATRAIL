"use client";

import { useState, useEffect, useRef } from "react";
import { login } from "../lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase, BarChart3, Users, Shield, Zap, Globe,
  MessageSquare, CheckSquare, CalendarDays, FileText,
  ArrowRight, Star, Play, ChevronDown,
} from "lucide-react";

/* ── Splash ── */
function Splash({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-[9999] overflow-hidden cursor-pointer"
      style={{ background: "#020b18" }}
      onClick={onClick}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ animation: "scale-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        <img
          src="/icon.png"
          alt="ATRAIL"
          className="w-24 h-24 object-contain"
        />
      </div>
      <div
        className="mt-5 text-2xl font-bold tracking-[0.3em] uppercase"
        style={{ color: "#e2e8f0", animation: "fade-in 0.6s ease 0.2s both" }}
      >
        ATRAIL
      </div>
      <div className="flex gap-1.5 mt-5" style={{ animation: "fade-in 0.6s ease 0.4s both" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]/60"
            style={{ animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <p className="mt-6 text-gray-600 text-xs" style={{ animation: "fade-in 0.6s ease 0.8s both" }}>
        Tap anywhere to continue
      </p>
    </div>
  );
}

/* ── Floating particles ── */
function Particles({ count = 50 }: { count?: number }) {
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 3 + 1,
      dur: Math.random() * 20 + 12,
      delay: Math.random() * 20,
      color: ["rgba(0,212,255,0.6)", "rgba(124,58,237,0.5)", "rgba(245,158,11,0.4)", "rgba(16,185,129,0.4)"][Math.floor(Math.random() * 4)],
    }))
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: "-4px",
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            animation: `particle-float ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Animated counter ── */
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        let start = 0;
        const step = end / 60;
        const tick = () => {
          start = Math.min(start + step, end);
          setVal(Math.floor(start));
          if (start < end) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end]);

  return <span ref={ref}>{val}{suffix}</span>;
}

/* ── 3D tilt card ── */
function TiltCard({
  children, className = "", style: extStyle,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
    const y = ((e.clientY - rect.top)  / rect.height - 0.5) * -16;
    el.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg) translateY(-4px)`;
    el.style.boxShadow = `${-x * 0.5}px ${y * 0.5}px 40px rgba(0,212,255,0.12), 0 20px 60px rgba(0,0,0,0.5)`;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)";
    el.style.boxShadow = "";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
      style={{
        transition: "transform 0.15s ease, box-shadow 0.3s ease",
        transformStyle: "preserve-3d",
        willChange: "transform",
        ...extStyle,
      }}
    >
      {children}
    </div>
  );
}

/* ── Feature Card ── */
function FeatureCard({
  icon, title, desc, items, color, delay = 0,
}: {
  icon: React.ReactNode; title: string; desc: string;
  items: string[]; color: string; delay?: number;
}) {
  const gradMap: Record<string, string> = {
    cyan:   "from-[rgba(0,212,255,0.15)] to-transparent",
    purple: "from-[rgba(124,58,237,0.15)] to-transparent",
    emerald:"from-[rgba(16,185,129,0.15)] to-transparent",
    gold:   "from-[rgba(245,158,11,0.15)] to-transparent",
  };
  const iconBg: Record<string, string> = {
    cyan:   "rgba(0,212,255,0.12)",
    purple: "rgba(124,58,237,0.12)",
    emerald:"rgba(16,185,129,0.12)",
    gold:   "rgba(245,158,11,0.12)",
  };
  const iconCol: Record<string, string> = {
    cyan:   "#00d4ff",
    purple: "#a78bfa",
    emerald:"#34d399",
    gold:   "#f59e0b",
  };
  const dotCol: Record<string, string> = {
    cyan:   "#00d4ff",
    purple: "#a78bfa",
    emerald:"#34d399",
    gold:   "#f59e0b",
  };

  return (
    <TiltCard
      className="rounded-2xl overflow-hidden"
      style={{
        animation: `slide-up 0.6s ease ${delay}s both`,
        background: "linear-gradient(135deg, rgba(13,37,64,0.8), rgba(6,22,40,0.95))",
        border: "1px solid rgba(0,212,255,0.1)",
      }}
    >
      <div className={`p-6 bg-gradient-to-br ${gradMap[color]}`}>
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: iconBg[color], color: iconCol[color] }}
        >
          {icon}
        </div>
        <h3 className="text-lg font-bold text-[#e2e8f0] mb-2">{title}</h3>
        <p className="text-sm text-[#64748b] leading-relaxed mb-5 font-medium">{desc}</p>
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-[#94a3b8]">
              <span
                className="w-1 h-1 rounded-full flex-shrink-0"
                style={{ background: dotCol[color], boxShadow: `0 0 6px ${dotCol[color]}` }}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </TiltCard>
  );
}

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [navScrolled, setNavScrolled] = useState(false);

  const dismissSplash = () => setShowSplash(false);

  useEffect(() => {
    // Auto-dismiss after 1.5s; user can also tap/click to skip immediately
    const timer = setTimeout(dismissSplash, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.twoFactorRequired) {
        router.push("/login");
        return;
      }
      const user = res.user!;
      if (user.role === "SUPER_ADMIN") router.push("/dashboard/super");
      else if (user.role === "ADMIN") router.push("/dashboard/admin");
      else if (user.role === "ELITE") router.push("/dashboard/elite");
      else router.push("/dashboard/user");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (showSplash) return <Splash onClick={dismissSplash} />;

  return (
    <main
      className="min-h-screen text-[#e2e8f0] selection:bg-primary/20 overflow-x-hidden"
      style={{ background: "#020b18" }}
    >
      {/* ── Animated background glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 65%)",
            animation: "breathe 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 65%)",
            animation: "breathe 10s ease-in-out 3s infinite",
          }}
        />
        <div
          className="absolute top-[40%] left-[50%] w-[40vw] h-[40vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 65%)",
            animation: "breathe 6s ease-in-out 1.5s infinite",
          }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Navbar ── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 transition-all duration-500"
        style={{
          background: navScrolled ? "rgba(2,11,24,0.92)" : "transparent",
          borderBottom: navScrolled ? "1px solid rgba(0,212,255,0.08)" : "1px solid transparent",
          backdropFilter: navScrolled ? "blur(24px)" : "none",
          boxShadow: navScrolled ? "0 4px 24px rgba(0,0,0,0.3)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center p-1"
              style={{
                width: "50px",
                height: "50px",
                background: "rgba(0,212,255,0.1)",
                border: "1px solid rgba(0,212,255,0.2)",
              }}
            >
              <img src="/icon.png" alt="ATRAIL" className="w-full h-full object-contain" />
            </div>
            <span
              className="text-base font-bold tracking-[0.12em] uppercase"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #7dd3fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ATRAIL
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {["#solutions", "#features", "#stats"].map((href) => (
              <a
                key={href}
                href={href}
                className="text-xs font-semibold uppercase tracking-widest text-[#64748b] hover:text-[#e2e8f0] transition-colors duration-200"
              >
                {href.replace("#", "")}
              </a>
            ))}
            <button
              onClick={() => router.push("/login")}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5"
              style={{
                border: "1px solid rgba(0,212,255,0.3)",
                background: "rgba(0,212,255,0.06)",
                boxShadow: "0 0 20px rgba(0,212,255,0.1)",
              }}
            >
              Access Portal
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 overflow-hidden">
        <Particles count={60} />

        <div className="relative z-10 max-w-5xl mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] mb-8"
            style={{
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.2)",
              color: "#00d4ff",
              animation: "fade-in 0.8s ease 0.2s both",
              boxShadow: "0 0 30px rgba(0,212,255,0.08)",
            }}
          >
            <Star size={10} fill="currentColor" />
            Next-Gen Enterprise Workflow Platform
            <Star size={10} fill="currentColor" />
          </div>

          {/* Headline */}
          <h1
            className="text-5xl lg:text-8xl font-black tracking-tight mb-6 leading-[1.05]"
            style={{ animation: "slide-up 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}
          >
            <span
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 40%, #94a3b8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Workflow
            </span>
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #00d4ff 0%, #7c3aed 50%, #f59e0b 100%)",
                backgroundSize: "300% 300%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "aurora 5s ease infinite",
              }}
            >
              Reimagined.
            </span>
          </h1>

          {/* Sub */}
          <p
            className="text-lg lg:text-xl text-[#64748b] max-w-2xl mx-auto leading-relaxed mb-10 font-medium"
            style={{ animation: "fade-in 0.8s ease 0.4s both" }}
          >
            Built with modern technology for blazing fast performance.
            Complete data isolation with enterprise-grade security and real-time collaboration.
          </p>

          {/* CTA buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            style={{ animation: "slide-up 0.7s ease 0.5s both" }}
          >
            <button
              onClick={() => router.push("/login")}
              className="group relative px-8 py-4 rounded-xl font-bold text-sm tracking-wide text-bg overflow-hidden transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #0284c7)",
                boxShadow: "0 8px 32px rgba(0,212,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started Now <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button
              onClick={() => document.getElementById("solutions")?.scrollIntoView({ behavior: "smooth" })}
              className="group flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm tracking-wide text-[#94a3b8] transition-all duration-300 hover:text-white hover:-translate-y-0.5"
              style={{
                border: "1px solid rgba(0,212,255,0.12)",
                background: "rgba(0,212,255,0.03)",
              }}
            >
              <Play size={14} className="text-primary" />
              Explore Solutions
            </button>
          </div>

          {/* Scroll indicator */}
          <div
            className="flex flex-col items-center gap-2 opacity-40"
            style={{ animation: "float-slow 3s ease-in-out infinite" }}
          >
            <span className="text-[10px] tracking-widest uppercase text-[#64748b]">Scroll</span>
            <ChevronDown size={16} className="text-[#64748b]" />
          </div>
        </div>
      </section>

      {/* ── Solutions Grid ── */}
      <section id="solutions" className="py-28 px-6 lg:px-10 max-w-7xl mx-auto relative">
        <div className="text-center mb-16" style={{ animation: "fade-in 0.6s ease both" }}>
          <div
            className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.25em] mb-4"
            style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#a78bfa" }}
          >
            Solutions
          </div>
          <h2
            className="text-3xl lg:text-5xl font-black tracking-tight mb-4"
            style={{
              background: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Everything Your Enterprise Needs
          </h2>
          <p className="text-[#64748b] text-base max-w-xl mx-auto font-medium">
            A unified platform covering every aspect of your organization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Briefcase size={22} />}
            title="Project & Task Management"
            desc="Manage projects, assign tasks, and track submissions with full audit trails."
            items={["Project boards & timelines", "Task assignment & deadlines", "Submission & review workflow"]}
            color="cyan" delay={0.1}
          />
          <FeatureCard
            icon={<Users size={22} />}
            title="HR & People Management"
            desc="Complete employee lifecycle management with payroll, leaves, and org charts."
            items={["Employee profiles & onboarding", "Leave & attendance tracking", "Performance reviews & skills"]}
            color="purple" delay={0.2}
          />
          <FeatureCard
            icon={<BarChart3 size={22} />}
            title="Analytics & Reporting"
            desc="Real-time dashboards with deep insights across all business functions."
            items={["Live performance metrics", "Custom report generation", "Export to PDF & Excel"]}
            color="emerald" delay={0.3}
          />
          <FeatureCard
            icon={<MessageSquare size={22} />}
            title="Real-Time Communication"
            desc="Direct messaging and project-based conversations with emergency alerts."
            items={["Direct & project channels", "File sharing & reactions", "Emergency broadcast system"]}
            color="cyan" delay={0.4}
          />
          <FeatureCard
            icon={<Shield size={22} />}
            title="Enterprise Security"
            desc="Role-based access with 2FA, SSO, and complete audit logging."
            items={["6-tier role hierarchy", "OAuth SSO (Google + Microsoft)", "Two-factor authentication"]}
            color="gold" delay={0.5}
          />
          <FeatureCard
            icon={<Globe size={22} />}
            title="Cloud Integrations"
            desc="Seamless integration with Google Workspace, Microsoft 365, and more."
            items={["Google Drive file picker", "Microsoft Calendar sync", "Push notification delivery"]}
            color="purple" delay={0.6}
          />
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section
        id="stats"
        className="py-20 px-6 lg:px-10 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(13,37,64,0.5), rgba(6,22,40,0.7))",
          borderTop: "1px solid rgba(0,212,255,0.08)",
          borderBottom: "1px solid rgba(0,212,255,0.08)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { val: 99, suffix: ".9%", label: "Uptime SLA" },
              { val: 50,  suffix: "ms",  label: "Avg Response Time" },
              { val: 6,   suffix: " Roles", label: "Access Tiers" },
              { val: 20,  suffix: "+ Modules", label: "Enterprise Features" },
            ].map(({ val, suffix, label }) => (
              <div key={label} className="space-y-2">
                <div
                  className="text-4xl lg:text-5xl font-black tabular-nums"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff, #7dd3fc)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  <Counter end={val} suffix={suffix} />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#64748b]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature highlights ── */}
      <section id="features" className="py-28 px-6 lg:px-10 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2
            className="text-3xl lg:text-5xl font-black tracking-tight mb-4"
            style={{
              background: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Built for Speed. Designed to Scale.
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: <Shield size={24} />, label: "Secured", desc: "Role-Based Access Control", color: "#00d4ff" },
            { icon: <Zap size={24} />,    label: "Fast",    desc: "Lightning-Fast Performance", color: "#f59e0b" },
            { icon: <Globe size={24} />,  label: "Isolated", desc: "Multi-Tenant Architecture", color: "#a78bfa" },
            { icon: <BarChart3 size={24} />, label: "Scalable", desc: "Startup to Enterprise", color: "#34d399" },
          ].map(({ icon, label, desc, color }, i) => (
            <TiltCard
              key={label}
              className="rounded-2xl p-6 text-center"
              style={{
                background: "linear-gradient(135deg, rgba(13,37,64,0.7), rgba(6,22,40,0.9))",
                border: "1px solid rgba(0,212,255,0.1)",
                animation: `scale-in 0.5s ease ${i * 0.1}s both`,
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `${color}15`, color }}
              >
                {icon}
              </div>
              <div
                className="text-2xl font-black mb-1.5 italic"
                style={{ color }}
              >
                {label}
              </div>
              <p className="text-xs text-[#64748b] font-semibold uppercase tracking-widest">{desc}</p>
            </TiltCard>
          ))}
        </div>
      </section>

      {/* ── Login CTA ── */}
      <section
        id="login-section"
        className="py-28 px-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(2,11,24,0) 0%, rgba(6,22,40,0.3) 50%, rgba(2,11,24,0) 100%)",
        }}
      >
        <div className="max-w-md mx-auto relative">
          {/* Glow behind card */}
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-64 pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />

          {/* Login card */}
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(13,37,64,0.95) 0%, rgba(6,22,40,0.98) 100%)",
              border: "1px solid rgba(0,212,255,0.18)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.06), 0 0 80px rgba(0,212,255,0.06)",
              backdropFilter: "blur(32px)",
              animation: "scale-in 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            {/* Top aurora bar */}
            <div
              className="h-px"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.7), rgba(124,58,237,0.5), rgba(0,212,255,0.7), transparent)",
                animation: "aurora 4s ease infinite",
                backgroundSize: "300% 100%",
              }}
            />

            <div className="p-10">
              {/* Icon */}
              <div className="text-center mb-8">
                <div
                  className="relative w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center p-2"
                  style={{
                    background: "rgba(0,212,255,0.1)",
                    border: "1px solid rgba(0,212,255,0.25)",
                    boxShadow: "0 0 40px rgba(0,212,255,0.15)",
                    animation: "float 4s ease-in-out infinite",
                  }}
                >
                  <img src="/icon.png" alt="ATRAIL" className="w-full h-full object-contain" />
                  {/* Orbit rings */}
                  <div
                    className="absolute inset-[-10px] rounded-full border border-dashed border-primary/20"
                    style={{ animation: "spin-slow 12s linear infinite" }}
                  />
                  <div
                    className="absolute inset-[-18px] rounded-full border border-dashed"
                    style={{ borderColor: "rgba(124,58,237,0.15)", animation: "spin-slow-reverse 20s linear infinite" }}
                  />
                </div>
                <h2 className="text-2xl font-bold text-[#e2e8f0] tracking-tight">Secure Access</h2>
                <p className="text-[#64748b] text-sm mt-1 font-medium">Authenticate to enter your workspace</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.18em] mb-2 pl-1">
                    Identity (Email)
                  </label>
                  <input
                    className="w-full rounded-xl text-[#e2e8f0] placeholder:text-[#374151] font-medium
                      bg-[rgba(6,22,40,0.7)] backdrop-blur-sm text-sm px-4 py-3.5
                      border border-[rgba(0,212,255,0.12)] outline-none transition-all duration-300
                      focus:border-[rgba(0,212,255,0.5)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.08),0_0_20px_rgba(0,212,255,0.06)]
                      focus:bg-[rgba(0,212,255,0.03)]"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="your.email@atrail.com"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2 pl-1">
                    <label className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.18em]">
                      Access Key
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-[10px] font-bold uppercase tracking-widest transition-colors duration-200"
                      style={{ color: "rgba(0,212,255,0.7)" }}
                    >
                      Recover
                    </Link>
                  </div>
                  <input
                    className="w-full rounded-xl text-[#e2e8f0] placeholder:text-[#374151] font-medium
                      bg-[rgba(6,22,40,0.7)] backdrop-blur-sm text-sm px-4 py-3.5
                      border border-[rgba(0,212,255,0.12)] outline-none transition-all duration-300
                      focus:border-[rgba(0,212,255,0.5)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.08)]
                      focus:bg-[rgba(0,212,255,0.03)]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {err && (
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-red-300 font-medium"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    <span className="w-4 h-4 rounded-full bg-red-500/20 flex-shrink-0 flex items-center justify-center text-red-400 text-xs">!</span>
                    {err}
                  </div>
                )}

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-4 rounded-xl font-bold text-sm tracking-[0.1em] text-bg transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff, #0284c7)",
                    boxShadow: "0 8px 32px rgba(0,212,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span
                        className="w-4 h-4 border-2 border-bg/30 border-t-bg rounded-full"
                        style={{ animation: "spin 0.8s linear infinite" }}
                      />
                      Authenticating...
                    </span>
                  ) : (
                    "Initialize Session →"
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[rgba(0,212,255,0.08)] text-center">
                <p className="text-xs text-[#374151] font-medium">
                  New to ATRAIL?{" "}
                  <Link
                    href="/signup"
                    className="font-bold transition-colors duration-200 hover:text-[#e2e8f0]"
                    style={{ color: "#f59e0b" }}
                  >
                    Request Access →
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="py-12 px-6 text-center"
        style={{
          borderTop: "1px solid rgba(0,212,255,0.06)",
          background: "rgba(2,11,24,0.5)",
        }}
      >
        <img src="/logo.png" alt="ATRAIL" className="h-7 w-auto object-contain mx-auto mb-4 opacity-30" />
        <p className="text-[10px] text-[#374151] uppercase tracking-widest font-bold">
          © 2026 ATRAIL ENTERPRISE · ALL RIGHTS RESERVED
        </p>
        <p className="text-[10px] text-[#1f2937] mt-1 font-medium">
          Made by Cocoon AI · Powered by beAIte
        </p>
      </footer>
    </main>
  );
}
