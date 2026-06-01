'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authedFetch } from '@/lib/authed-fetch';
import { useAuthStore } from '@/lib/auth-store';
import { AlertCircle, TrendingUp, Clock, Zap, CheckCircle, DollarSign, RefreshCw } from 'lucide-react';

interface ActionRenewal {
  id: string;
  renewalDate: string;
  renewalCost: number;
  upsellPotential: number;
  churnRisk: string;
  renewalLikelihood: number;
  nextAction?: string;
  customer?: { id: string; name: string };
  vendor?: { name: string };
}

interface ActionQueue {
  critical: ActionRenewal[];
  high: ActionRenewal[];
  upsell: ActionRenewal[];
  review: ActionRenewal[];
  easy: ActionRenewal[];
  total: number;
}

const PRIORITIES = [
  { key: 'critical', label: 'Critical',      color: 'border-red-800/60 bg-red-900/10',       icon: AlertCircle,  iconColor: 'text-red-400',    cta: 'Call Now',    ctaClass: 'bg-red-700 hover:bg-red-600'       },
  { key: 'high',     label: 'High Priority', color: 'border-orange-800/60 bg-orange-900/10', icon: Clock,        iconColor: 'text-orange-400', cta: 'Follow Up',   ctaClass: 'bg-orange-700 hover:bg-orange-600' },
  { key: 'upsell',   label: 'Upsell',        color: 'border-blue-800/60 bg-blue-900/10',     icon: TrendingUp,   iconColor: 'text-blue-400',   cta: 'Send Bundle', ctaClass: 'bg-blue-700 hover:bg-blue-600'     },
  { key: 'review',   label: 'Review',        color: 'border-yellow-800/60 bg-yellow-900/10', icon: Zap,          iconColor: 'text-yellow-400', cta: 'Review',      ctaClass: 'bg-yellow-700 hover:bg-yellow-600' },
  { key: 'easy',     label: 'Easy Win',      color: 'border-green-800/60 bg-green-900/10',   icon: CheckCircle,  iconColor: 'text-green-400',  cta: 'Confirm',     ctaClass: 'bg-green-700 hover:bg-green-600'   },
] as const;

export default function Dashboard() {
  const { user } = useAuthStore();
  const [queue, setQueue]     = useState<ActionQueue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch<{ ok: boolean; data: ActionQueue }>('/renewals/queue')
      .then(r => { if (r.ok) setQueue(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const allItems = queue ? [...queue.critical, ...queue.high, ...queue.upsell, ...queue.review, ...queue.easy] : [];
  const totalValue  = allItems.reduce((s, r) => s + r.renewalCost, 0);
  const upsellValue = queue?.upsell.reduce((s, r) => s + r.upsellPotential, 0) ?? 0;

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">
            Good morning{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">Here's your renewal action queue for today</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Total Open
            </p>
            <p className="text-3xl font-bold text-white">{queue?.total ?? '—'}</p>
          </div>
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Pipeline
            </p>
            <p className="text-3xl font-bold text-blue-400">
              {loading ? '—' : `₹${(totalValue / 100000).toFixed(1)}L`}
            </p>
          </div>
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Critical
            </p>
            <p className="text-3xl font-bold text-red-400">{queue?.critical.length ?? '—'}</p>
          </div>
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Upsell Potential
            </p>
            <p className="text-3xl font-bold text-teal-400">
              {loading ? '—' : `₹${(upsellValue / 100000).toFixed(1)}L`}
            </p>
          </div>
        </div>

        {loading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
            <p className="text-gray-400 mt-4 text-sm">Loading your action queue...</p>
          </div>
        )}

        {!loading && queue?.total === 0 && (
          <div className="text-center py-16 bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-white text-lg font-semibold">All clear!</p>
            <p className="text-gray-400 text-sm mt-1">No pending renewals in your queue</p>
            <Link href="/renewals/new" className="mt-4 inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
              Create a Renewal
            </Link>
          </div>
        )}

        {!loading && queue && queue.total > 0 && (
          <div className="space-y-6">
            {PRIORITIES.map(({ key, label, color, icon: Icon, iconColor, cta, ctaClass }) => {
              const items = queue[key as keyof ActionQueue] as ActionRenewal[];
              if (!items || items.length === 0) return null;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                    <h2 className="text-xl font-bold text-white">{label}</h2>
                    <span className="text-sm text-gray-400">({items.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map(r => {
                      const daysLeft = Math.ceil((new Date(r.renewalDate).getTime() - Date.now()) / 86400000);
                      return (
                        <div key={r.id} className={`border rounded-xl p-4 ${color}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-white">{r.customer?.name || 'Unknown Customer'}</h3>
                              {r.vendor && <p className="text-sm text-gray-400">{r.vendor.name}</p>}
                            </div>
                            <span className="text-lg font-bold text-white">₹{(r.renewalCost / 1000).toFixed(0)}K</span>
                          </div>
                          {r.nextAction && <p className="text-xs text-gray-400 italic mb-2">{r.nextAction}</p>}
                          <div className="flex items-center justify-between mt-3">
                            <span className={`text-xs ${daysLeft < 0 ? 'text-red-400' : daysLeft < 14 ? 'text-orange-400' : 'text-gray-400'}`}>
                              <Clock className="w-3 h-3 inline mr-1" />
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                            </span>
                            <div className="flex gap-2">
                              <Link href={`/renewals/${r.id}`} className={`px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors ${ctaClass}`}>
                                {cta}
                              </Link>
                              <Link href={`/renewals/${r.id}`} className="px-3 py-1.5 border border-white/10 text-gray-300 text-xs rounded-lg hover:bg-white/5 transition-colors">
                                Details
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
