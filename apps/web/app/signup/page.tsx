"use client";

import Link from "next/link";
import { Card } from "../../components/ui/Card";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 bg-gradient-to-b from-[#0A0A0A] to-[#050505]">
      <Card className="max-w-md w-full p-8 border-primary/20 glass-panel backdrop-blur-xl text-center">
        <h1 className="text-3xl font-bold text-primary tracking-tight mb-4">Registration Disabled</h1>
        <p className="text-text-muted mb-8 leading-relaxed">
          Public registration has been disabled. Only Administrators can create new operative accounts and explicitly assign roles.
        </p>
        <p className="text-text-muted text-sm mb-6">
          If you need access to the ATRAIL portal, please contact your project administrator or HR.
        </p>
        
        <Link 
          href="/" 
          className="inline-block px-8 py-3 bg-primary text-black font-bold uppercase tracking-wider text-sm rounded-xl hover:scale-105 transition-transform"
        >
          Return to Login
        </Link>
      </Card>
    </div>
  );
}

