"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Sparkles } from "lucide-react";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

  const handleGetQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password?email=${email}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to find account");
      setQuestion(data.question);
      setStep(2);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, answer, totpToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");
      setResetToken(data.resetToken);
      setStep(3);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed");
      setSuccess(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-10 text-center border-green-500/20 bg-green-500/5">
          <div className="mb-4 flex justify-center text-green-500"><Sparkles size={48} /></div>
          <h1 className="text-2xl font-bold text-white mb-2">Password Reset Successful</h1>
          <p className="text-text-muted mb-8">You can now use your new password to access the portal.</p>
          <Link href="/">
            <Button className="w-full">Return to Login</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 bg-gradient-dark-shine">
      <Card className="max-w-md w-full p-8 border-primary/20 glass-panel backdrop-blur-xl">
        <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary">Reset Security</h1>
            <p className="text-sm text-text-muted mt-1">Multi-factor identity restoration</p>
        </div>

        {err && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm italic">
            {err}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleGetQuestion} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1">Registered Email</label>
              <input
                required
                type="email"
                className="w-full glass-panel border border-primary/20 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@atrial.org.in"
              />
            </div>
            <Button disabled={loading} className="w-full py-3 mt-4">
              {loading ? "Searching..." : "Find Account"}
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1">Security Challenge</label>
              <p className="text-white font-medium">{question}</p>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1">Your Answer</label>
                    <input
                        required
                        className="w-full glass-panel border border-primary/20 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1 flex justify-between">
                        <span>2FA Code</span>
                        <span className="text-[10px] opacity-40 font-normal normal-case italic">If enabled</span>
                    </label>
                    <input
                        className="w-full glass-panel border border-primary/20 rounded-xl px-4 py-3 text-white font-mono tracking-[0.5em] text-center focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        placeholder="000000"
                        value={totpToken}
                        onChange={(e) => setTotpToken(e.target.value)}
                    />
                </div>
            </div>
            
            <Button disabled={loading} className="w-full py-3">
              {loading ? "Verifying..." : "Confirm Identity"}
            </Button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-xs text-text-muted hover:text-text-main transition-colors">
              Wrong email? Go back
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-1">New Secure Password</label>
              <input
                required
                type="password"
                className="w-full glass-panel border border-primary/20 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
              <p className="text-[10px] text-text-muted mt-2 px-1">Use 8+ characters with a mix of letters, numbers, and symbols.</p>
            </div>
            <Button disabled={loading} className="w-full py-3 mt-4">
              {loading ? "Updating..." : "Set New Password"}
            </Button>
          </form>
        )}

        <div className="mt-8 text-center space-y-4">
            <Link href="/" className="text-text-muted hover:text-primary text-xs transition-colors">
                Return to Login
            </Link>
            
            <div className="text-[10px] text-zinc-600 font-mono tracking-widest uppercase">
              Made by Cocoon AI &amp; Powered by beAIte
            </div>
        </div>
      </Card>
    </div>
  );
}
