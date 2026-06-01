'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';
import {
  Building2, Users, RefreshCw, AlertTriangle, XCircle,
  CheckCircle, Clock, Shield, Edit3, X, Save, Search,
  TrendingUp, BarChart3, Zap,
} from 'lucide-react';

interface Org {
  id: string;
  name: string;
  orgType: string;
  billingStatus: string;
  billingDueDate?: string;
  billingAmount?: number;
  billingNote?: string;
  billingUpdatedAt?: string;
  planName?: string;
  trialEndsAt?: string;
  createdAt: string;
  _count: { users: number; customers: number; renewals: number };
}

const BILLING_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  ACTIVE:    { label: 'Active',    bg: 'bg-green-900/40',  text: 'text-green-400',  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  TRIALING:  { label: 'Trial',     bg: 'bg-blue-900/40',   text: 'text-blue-400',   icon: <Clock className="w-3.5 h-3.5" /> },
  PAST_DUE:  { label: 'Past Due',  bg: 'bg-yellow-900/40', text: 'text-yellow-400', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  SUSPENDED: { label: 'Suspended', bg: 'bg-red-900/40',    text: 'text-red-400',    icon: <XCircle className="w-3.5 h-3.5" /> },
  CANCELLED: { label: 'Cancelled', bg: 'bg-gray-800',      text: 'text-gray-400',   icon: <XCircle className="w-3.5 h-3.5" /> },
};

const ORG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  INTERNAL: { label: 'Internal', color: 'text-purple-400' },
  RESELLER: { label: 'Reseller', color: 'text-blue-400'   },
  CLIENT:   { label: 'Client',   color: 'text-teal-400'   },
};

interface EditForm {
  billingStatus: string;
  billingDueDate: string;
  billingAmount: string;
  billingNote: string;
  planName: string;
  orgType: string;
  trialEndsAt: string;
}

const EMPTY_FORM: EditForm = {
  billingStatus: '',
  billingDueDate: '',
  billingAmount: '',
  billingNote: '',
  planName: '',
  orgType: '',
  trialEndsAt: '',
};

export default function DeveloperPanel() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [orgs, setOrgs]         = useState<Org[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [form, setForm]         = useState<EditForm>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [quickActing, setQuickActing] = useState<string | null>(null);
  const [error, setError]       = useState('');

  // Gate: only GOD/DEVELOPER can access
  useEffect(() => {
    if (user && user.role !== 'GOD' && user.role !== 'DEVELOPER') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const load = () => {
    setLoading(true);
    authedFetch<{ ok: boolean; data: Org[] }>('/developer/orgs')
      .then(r => { if (r.ok) setOrgs(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = orgs.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.name.toLowerCase().includes(q);
    const matchType   = !typeFilter   || o.orgType === typeFilter;
    const matchStatus = !statusFilter || o.billingStatus === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const openEdit = (org: Org) => {
    setEditingOrg(org);
    setForm({
      billingStatus: org.billingStatus,
      billingDueDate: org.billingDueDate ? org.billingDueDate.slice(0, 10) : '',
      billingAmount: org.billingAmount?.toString() ?? '',
      billingNote: org.billingNote ?? '',
      planName: org.planName ?? '',
      orgType: org.orgType,
      trialEndsAt: org.trialEndsAt ? org.trialEndsAt.slice(0, 10) : '',
    });
    setError('');
  };

  const saveEdit = async () => {
    if (!editingOrg) return;
    setSaving(true);
    setError('');
    try {
      const r = await authedFetch<{ ok: boolean; data: Org }>(`/developer/orgs/${editingOrg.id}/billing`, {
        method: 'PATCH',
        body: JSON.stringify({
          billingStatus:  form.billingStatus  || undefined,
          billingDueDate: form.billingDueDate || null,
          billingAmount:  form.billingAmount  ? parseFloat(form.billingAmount) : null,
          billingNote:    form.billingNote    || null,
          planName:       form.planName       || undefined,
          orgType:        form.orgType        || undefined,
          trialEndsAt:    form.trialEndsAt    || null,
        }),
      });
      if (r.ok) {
        setOrgs(prev => prev.map(o => o.id === editingOrg.id ? { ...o, ...r.data } : o));
        setEditingOrg(null);
      } else {
        setError('Save failed');
      }
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const quickAction = async (orgId: string, action: 'suspend' | 'activate', reason?: string) => {
    setQuickActing(orgId);
    try {
      const r = await authedFetch<{ ok: boolean; data: Org }>(`/developer/orgs/${orgId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason, note: reason }),
      });
      if (r.ok) {
        setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, ...r.data } : o));
      }
    } finally {
      setQuickActing(null);
    }
  };

  // Summary stats
  const stats = {
    total:     orgs.length,
    active:    orgs.filter(o => o.billingStatus === 'ACTIVE').length,
    pastDue:   orgs.filter(o => o.billingStatus === 'PAST_DUE').length,
    suspended: orgs.filter(o => o.billingStatus === 'SUSPENDED').length,
    trialing:  orgs.filter(o => o.billingStatus === 'TRIALING').length,
  };

  if (user?.role !== 'GOD' && user?.role !== 'DEVELOPER') return null;

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-700/40 flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Developer Panel</h1>
            <p className="text-gray-400 text-sm">Manage all organizations, billing status, and access</p>
          </div>
          <div className="ml-auto">
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${user?.role === 'GOD' ? 'bg-yellow-900/40 border-yellow-700 text-yellow-300' : 'bg-purple-900/40 border-purple-700 text-purple-300'}`}>
              {user?.role}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Orgs',  value: stats.total,     color: 'text-white'       },
            { label: 'Active',      value: stats.active,    color: 'text-green-400'   },
            { label: 'Trialing',    value: stats.trialing,  color: 'text-blue-400'    },
            { label: 'Past Due',    value: stats.pastDue,   color: 'text-yellow-400'  },
            { label: 'Suspended',   value: stats.suspended, color: 'text-red-400'     },
          ].map(s => (
            <div key={s.label} className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[rgba(6,22,40,0.7)] border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 bg-[rgba(6,22,40,0.7)] border border-white/10 rounded-lg text-gray-300 text-sm focus:outline-none focus:border-blue-500">
            <option value="">All Types</option>
            <option value="INTERNAL">Internal</option>
            <option value="RESELLER">Reseller</option>
            <option value="CLIENT">Client</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-[rgba(6,22,40,0.7)] border border-white/10 rounded-lg text-gray-300 text-sm focus:outline-none focus:border-blue-500">
            <option value="">All Status</option>
            {Object.entries(BILLING_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button onClick={load} className="p-2 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Org Table */}
        <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[rgba(6,22,40,0.4)] border-b border-[rgba(0,212,255,0.08)]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Organization</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Plan</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Billing</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Usage</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Due Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-500">No organizations found</td></tr>
                ) : filtered.map(org => {
                  const sc = BILLING_STATUS_CONFIG[org.billingStatus] ?? BILLING_STATUS_CONFIG.ACTIVE;
                  const tc = ORG_TYPE_CONFIG[org.orgType] ?? ORG_TYPE_CONFIG.INTERNAL;
                  const isActing = quickActing === org.id;
                  return (
                    <tr key={org.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium text-white">{org.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{org.id.slice(-8).toUpperCase()}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-sm font-medium ${tc.color}`}>{tc.label}</span>
                      </td>
                      <td className="px-5 py-4 text-gray-300 text-sm">{org.planName ?? '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${sc.bg} ${sc.text}`}>
                          {sc.icon} {sc.label}
                        </span>
                        {org.billingNote && (
                          <p className="text-gray-500 text-xs mt-1 truncate max-w-[160px]" title={org.billingNote}>{org.billingNote}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs text-gray-400 space-y-0.5">
                          <div>{org._count.users} users</div>
                          <div>{org._count.customers} customers</div>
                          <div>{org._count.renewals} renewals</div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {org.billingDueDate ? (
                          <span className={`text-sm ${new Date(org.billingDueDate) < new Date() ? 'text-red-400' : 'text-gray-300'}`}>
                            {new Date(org.billingDueDate).toLocaleDateString('en-IN')}
                          </span>
                        ) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => openEdit(org)}
                            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                            title="Edit billing"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {org.billingStatus !== 'SUSPENDED' && org.billingStatus !== 'CANCELLED' ? (
                            <button
                              onClick={() => quickAction(org.id, 'suspend', 'Suspended by administrator')}
                              disabled={isActing}
                              className="px-2.5 py-1 bg-red-900/40 hover:bg-red-800/60 text-red-400 text-xs rounded-lg border border-red-800/40 disabled:opacity-50 transition-colors"
                            >
                              {isActing ? '...' : 'Suspend'}
                            </button>
                          ) : (
                            <button
                              onClick={() => quickAction(org.id, 'activate', 'Reactivated by administrator')}
                              disabled={isActing}
                              className="px-2.5 py-1 bg-green-900/40 hover:bg-green-800/60 text-green-400 text-xs rounded-lg border border-green-800/40 disabled:opacity-50 transition-colors"
                            >
                              {isActing ? '...' : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Billing Modal */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(6,22,40,0.98)] border border-[rgba(0,212,255,0.15)] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white text-lg font-bold">Edit Billing — {editingOrg.name}</h2>
                <p className="text-gray-400 text-xs mt-0.5">Changes take effect immediately</p>
              </div>
              <button onClick={() => setEditingOrg(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2 mb-4">{error}</p>}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1.5">Billing Status</label>
                  <select
                    value={form.billingStatus}
                    onChange={e => setForm(f => ({ ...f, billingStatus: e.target.value }))}
                    className="w-full px-3 py-2 bg-[rgba(6,22,40,0.9)] border border-white/10 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {Object.entries(BILLING_STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1.5">Org Type</label>
                  <select
                    value={form.orgType}
                    onChange={e => setForm(f => ({ ...f, orgType: e.target.value }))}
                    className="w-full px-3 py-2 bg-[rgba(6,22,40,0.9)] border border-white/10 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="INTERNAL">Internal</option>
                    <option value="RESELLER">Reseller</option>
                    <option value="CLIENT">Client</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1.5">Plan</label>
                  <select
                    value={form.planName}
                    onChange={e => setForm(f => ({ ...f, planName: e.target.value }))}
                    className="w-full px-3 py-2 bg-[rgba(6,22,40,0.9)] border border-white/10 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="Starter">Starter</option>
                    <option value="Growth">Growth</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1.5">Amount (₹)</label>
                  <input
                    type="number"
                    value={form.billingAmount}
                    onChange={e => setForm(f => ({ ...f, billingAmount: e.target.value }))}
                    placeholder="e.g. 9999"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1.5">Payment Due Date</label>
                  <input
                    type="date"
                    value={form.billingDueDate}
                    onChange={e => setForm(f => ({ ...f, billingDueDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1.5">Trial Ends</label>
                  <input
                    type="date"
                    value={form.trialEndsAt}
                    onChange={e => setForm(f => ({ ...f, trialEndsAt: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1.5">Internal Note (shown in suspension message)</label>
                <textarea
                  value={form.billingNote}
                  onChange={e => setForm(f => ({ ...f, billingNote: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Invoice #1234 sent on 01 Jun 2026. Follow up after 7 days."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Quick Status Buttons */}
              <div>
                <label className="block text-gray-400 text-xs uppercase tracking-wide mb-2">Quick Set Status</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(BILLING_STATUS_CONFIG).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setForm(f => ({ ...f, billingStatus: k }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        form.billingStatus === k
                          ? `${v.bg} ${v.text} border-current`
                          : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingOrg(null)} className="flex-1 py-2.5 border border-white/10 text-gray-400 hover:bg-white/5 rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
