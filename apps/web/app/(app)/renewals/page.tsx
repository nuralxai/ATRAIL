'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/authed-fetch';
import { useAuthStore } from '@/lib/auth-store';
import {
  Plus, Search, Filter, RefreshCw, AlertCircle, Clock,
  TrendingUp, CheckCircle, DollarSign, Calendar
} from 'lucide-react';

interface Renewal {
  id: string;
  renewalDate: string;
  expiryDate: string;
  renewalCost: number;
  margin: number;
  marginPercent: number;
  status: string;
  churnRisk: string;
  renewalLikelihood: number;
  paymentStatus: string;
  nextAction?: string;
  quoteSent: boolean;
  renewalType?: string;
  customer?: { id: string; name: string; healthScore: number };
  vendor?: { id: string; name: string };
  accountManager?: { id: string; fullName: string };
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT:       { bg: 'bg-gray-800',       text: 'text-gray-300',   label: 'Draft'       },
  QUOTED:      { bg: 'bg-blue-900/40',    text: 'text-blue-400',   label: 'Quoted'      },
  NEGOTIATING: { bg: 'bg-yellow-900/40',  text: 'text-yellow-400', label: 'Negotiating' },
  CLOSED:      { bg: 'bg-green-900/40',   text: 'text-green-400',  label: 'Closed'      },
  CANCELLED:   { bg: 'bg-red-900/40',     text: 'text-red-400',    label: 'Cancelled'   },
};

const RISK_STYLE: Record<string, { bg: string; text: string }> = {
  LOW:      { bg: 'bg-green-900/30',  text: 'text-green-400'  },
  MEDIUM:   { bg: 'bg-yellow-900/30', text: 'text-yellow-400' },
  HIGH:     { bg: 'bg-orange-900/30', text: 'text-orange-400' },
  CRITICAL: { bg: 'bg-red-900/30',    text: 'text-red-400'    },
};

export default function RenewalsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (riskFilter) params.set('churnRisk', riskFilter);
      const r = await authedFetch<{ ok: boolean; data: Renewal[] }>(`/renewals?${params}`);
      if (r.ok) setRenewals(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, riskFilter]);

  const filtered = renewals.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.customer?.name.toLowerCase().includes(q) ||
      r.vendor?.name.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  });

  const totalValue = filtered.reduce((s, r) => s + r.renewalCost, 0);
  const criticalCount = filtered.filter(r => r.churnRisk === 'CRITICAL' || r.churnRisk === 'HIGH').length;
  const closedCount = filtered.filter(r => r.status === 'CLOSED').length;

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Renewals</h1>
            <p className="text-gray-400 text-sm mt-1">Track and manage all renewal workflows</p>
          </div>
          <Link
            href="/renewals/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> New Renewal
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total</p>
            <p className="text-2xl font-bold text-white">{filtered.length}</p>
          </div>
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Pipeline</p>
            <p className="text-2xl font-bold text-blue-400">₹{(totalValue / 100000).toFixed(1)}L</p>
          </div>
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">At Risk</p>
            <p className="text-2xl font-bold text-orange-400">{criticalCount}</p>
          </div>
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Closed</p>
            <p className="text-2xl font-bold text-green-400">{closedCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by customer, vendor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[rgba(6,22,40,0.7)] border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[rgba(6,22,40,0.7)] border border-white/10 rounded-lg text-gray-300 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">All Status</option>
            {Object.entries(STATUS_STYLE).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={riskFilter}
            onChange={e => setRiskFilter(e.target.value)}
            className="px-3 py-2 bg-[rgba(6,22,40,0.7)] border border-white/10 rounded-lg text-gray-300 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">All Risk</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <button
            onClick={load}
            className="p-2 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="h-10 w-10 text-gray-600 mb-3" />
              <p className="text-gray-400 font-medium">No renewals found</p>
              <Link href="/renewals/new" className="mt-3 text-blue-400 text-sm hover:underline">
                Create your first renewal
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[rgba(6,22,40,0.4)] border-b border-[rgba(0,212,255,0.08)]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Vendor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Renewal Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Value</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Risk</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Likelihood</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(renewal => {
                  const daysLeft = Math.ceil((new Date(renewal.renewalDate).getTime() - Date.now()) / 86400000);
                  const statusStyle = STATUS_STYLE[renewal.status] || STATUS_STYLE.DRAFT;
                  const rStyle = RISK_STYLE[renewal.churnRisk] || RISK_STYLE.LOW;
                  return (
                    <tr key={renewal.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-white">{renewal.customer?.name || '—'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Health: {renewal.customer?.healthScore ?? '—'}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-300 text-sm">{renewal.vendor?.name || '—'}</td>
                      <td className="px-5 py-4">
                        <div className="text-gray-300 text-sm">{new Date(renewal.renewalDate).toLocaleDateString('en-IN')}</div>
                        <div className={`text-xs mt-0.5 ${daysLeft < 0 ? 'text-red-400' : daysLeft < 14 ? 'text-orange-400' : 'text-gray-500'}`}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-white font-semibold">₹{renewal.renewalCost.toLocaleString('en-IN')}</div>
                        {renewal.marginPercent > 0 && (
                          <div className="text-xs text-gray-500 mt-0.5">{renewal.marginPercent.toFixed(0)}% margin</div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${rStyle.bg} ${rStyle.text}`}>
                          {renewal.churnRisk}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${renewal.renewalLikelihood}%` }}
                            />
                          </div>
                          <span className="text-gray-400 text-xs w-7 text-right">{renewal.renewalLikelihood}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/renewals/${renewal.id}`}
                          className="text-blue-400 hover:text-blue-300 text-sm font-medium hover:underline"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
