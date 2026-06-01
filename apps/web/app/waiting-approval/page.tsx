"use client";

import { Card } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Link from "next/link";

export default function WaitingApprovalPage() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 bg-gradient-to-b from-[#0A0A0A] to-[#050505]">
      <Card className="max-w-md w-full p-10 border-primary/20 glass-panel backdrop-blur-xl text-center">
        <div className="mb-8 flex justify-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center animate-pulse">
            <span className="text-4xl">⏳</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-primary tracking-tight mb-4 text-glow">Registration Pending</h1>
        
        <p className="text-text-main leading-relaxed mb-8">
          Your KYC details have been successfully submitted to <span className="text-primary font-semibold">ATRAIL WORKFLOW</span>. 
          <br /><br />
          Access to the portal is currently restricted. A <span className="text-primary">Super Admin</span> will review your application and assign your role shortly.
        </p>

        <div className="p-4 rounded-2xl glass-panel border border-primary/20 mb-8">
            <p className="text-xs text-text-muted uppercase tracking-widest font-bold mb-1">Status</p>
            <p className="text-primary font-mono text-lg font-bold">AWAITING APPROVAL</p>
        </div>

        <Link href="/">
          <Button variant="secondary" className="w-full py-3">
            Return to Login
          </Button>
        </Link>
        
        <p className="mt-8 text-xs text-zinc-600">
          If you believe this is a mistake, please contact support.
        </p>
      </Card>
    </div>
  );
}
