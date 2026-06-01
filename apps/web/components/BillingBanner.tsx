'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';
import { AlertTriangle, XCircle, Clock, X } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';

interface BillingStatusData {
  billingStatus: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
  billingDueDate?: string;
  billingNote?: string;
  trialEndsAt?: string;
  planName?: string;
  daysUntilDue?: number;
}

const BYPASS_ROLES = new Set(['GOD', 'DEVELOPER']);

export default function BillingBanner() {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<BillingStatusData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user || BYPASS_ROLES.has(user.role)) return;
    authedFetch<{ ok: boolean; data: BillingStatusData }>('/billing/my-status')
      .then(r => { if (r.ok) setStatus(r.data); })
      .catch(() => {});
  }, [user]);

  // Don't show for GOD/DEVELOPER or ACTIVE accounts or when dismissed
  if (!status || BYPASS_ROLES.has(user?.role ?? '')) return null;
  if (status.billingStatus === 'ACTIVE') return null;
  if (dismissed && status.billingStatus === 'PAST_DUE') return null;

  const configs = {
    TRIALING: {
      bg: 'bg-blue-950 border-blue-800',
      icon: <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />,
      text: `text-blue-200`,
      message: () => {
        const days = status.trialEndsAt
          ? Math.ceil((new Date(status.trialEndsAt).getTime() - Date.now()) / 86400000)
          : null;
        return days !== null && days >= 0
          ? `Your free trial ends in ${days} day${days !== 1 ? 's' : ''}. Contact your account manager to continue.`
          : 'Your free trial has ended. Contact your account manager to activate your account.';
      },
      dismissable: true,
      blocking: false,
    },
    PAST_DUE: {
      bg: 'bg-yellow-950 border-yellow-700',
      icon: <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />,
      text: 'text-yellow-200',
      message: () => {
        const base = 'Payment overdue — your account is in read-only mode.';
        return status.billingNote ? `${base} Note: ${status.billingNote}` : base;
      },
      dismissable: true,
      blocking: false,
    },
    SUSPENDED: {
      bg: 'bg-red-950 border-red-800',
      icon: <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
      text: 'text-red-200',
      message: () => {
        const base = 'Your account has been suspended due to non-payment.';
        return status.billingNote ? `${base} Reason: ${status.billingNote}` : base;
      },
      dismissable: false,
      blocking: true,
    },
    CANCELLED: {
      bg: 'bg-gray-900 border-gray-700',
      icon: <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />,
      text: 'text-gray-300',
      message: () => 'Your account has been cancelled. Contact support to reactivate.',
      dismissable: false,
      blocking: true,
    },
  } as const;

  const cfg = configs[status.billingStatus as keyof typeof configs];
  if (!cfg) return null;

  return (
    <>
      {/* Top banner */}
      <div className={`relative z-50 w-full border-b px-4 py-2.5 flex items-center gap-3 ${cfg.bg}`}>
        {cfg.icon}
        <p className={`flex-1 text-sm font-medium ${cfg.text}`}>
          {cfg.message()}
          <span className="ml-2 text-xs opacity-70">
            Contact: <a href="mailto:support@atrail.in" className="underline hover:opacity-100">support@atrail.in</a>
          </span>
        </p>
        {cfg.dismissable && (
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Full-screen overlay for SUSPENDED/CANCELLED */}
      {cfg.blocking && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`max-w-md w-full rounded-2xl border p-8 text-center shadow-2xl ${cfg.bg}`}>
            <div className="flex justify-center mb-4">
              {cfg.icon}
            </div>
            <h2 className={`text-xl font-bold mb-2 ${cfg.text}`}>
              {status.billingStatus === 'SUSPENDED' ? 'Account Suspended' : 'Account Cancelled'}
            </h2>
            <p className={`text-sm mb-6 opacity-80 ${cfg.text}`}>{cfg.message()}</p>
            <div className={`text-xs space-y-1 opacity-60 ${cfg.text}`}>
              <p>To reactivate your account, please contact:</p>
              <p className="font-semibold">support@atrail.in</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
