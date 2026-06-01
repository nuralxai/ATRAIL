'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authedFetch } from '@/lib/authed-fetch';
import {
  ArrowLeft, Mail, Phone, MapPin, Activity, TrendingUp,
  AlertCircle, CheckCircle, Plus, Users, RefreshCw, DollarSign
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  title?: string;
  isPrimary?: boolean;
}

interface Renewal {
  id: string;
  renewalDate: string;
  renewalCost: number;
  status: string;
  churnRisk: string;
  renewalLikelihood: number;
  paymentStatus: string;
  nextAction?: string;
  vendor?: { name: string };
  accountManager?: { fullName: string };
}

interface Customer360 {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  gstNumber?: string;
  panNumber?: string;
  healthScore: number;
  churnRisk: string;
  contacts: Contact[];
  renewals: Renewal[];
  metrics: {
    totalRenewals: number;
    activeRenewals: number;
    totalValue: number;
    churnRiskRenewals: number;
    healthScore: number;
    churnRisk: string;
  };
}

const RISK_STYLE: Record<string, { bg: string; text: string }> = {
  LOW:      { bg: 'bg-green-900/40',  text: 'text-green-400'  },
  MEDIUM:   { bg: 'bg-yellow-900/40', text: 'text-yellow-400' },
  HIGH:     { bg: 'bg-orange-900/40', text: 'text-orange-400' },
  CRITICAL: { bg: 'bg-red-900/40',    text: 'text-red-400'    },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  DRAFT:       { bg: 'bg-gray-800',       text: 'text-gray-300'   },
  QUOTED:      { bg: 'bg-blue-900/40',    text: 'text-blue-400'   },
  NEGOTIATING: { bg: 'bg-yellow-900/40',  text: 'text-yellow-400' },
  CLOSED:      { bg: 'bg-green-900/40',   text: 'text-green-400'  },
  CANCELLED:   { bg: 'bg-red-900/40',     text: 'text-red-400'    },
};

export default function Customer360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer360 | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', department: '', title: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authedFetch<{ ok: boolean; data: Customer360 }>(`/customers/${id}/360`)
      .then(r => { if (r.ok) setCustomer(r.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await authedFetch<{ ok: boolean; data: Contact }>(`/customers/${id}/contacts`, {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      if (r.ok && customer) {
        setCustomer({ ...customer, contacts: [...customer.contacts, r.data] });
        setContactForm({ name: '', email: '', phone: '', department: '', title: '' });
        setShowContactForm(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-white text-lg">Customer not found</p>
          <Link href="/dashboard/customers" className="text-blue-400 hover:underline mt-2 block">Back to Customers</Link>
        </div>
      </div>
    );
  }

  const healthColor = customer.healthScore >= 75 ? 'text-green-400' : customer.healthScore >= 50 ? 'text-yellow-400' : 'text-red-400';
  const riskStyle = RISK_STYLE[customer.churnRisk] || RISK_STYLE.LOW;
  const upcomingRenewals = customer.renewals
    .filter(r => r.status !== 'CLOSED' && r.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime());

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">{customer.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">Customer 360° View</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${riskStyle.bg} ${riskStyle.text}`}>
              {customer.churnRisk} Risk
            </span>
            <Link
              href={`/renewals/new?customerId=${customer.id}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Renewal
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Health Score</p>
            <p className={`text-3xl font-bold ${healthColor}`}>{customer.healthScore}</p>
          </div>
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total Renewals</p>
            <p className="text-3xl font-bold text-white">{customer.metrics.totalRenewals}</p>
          </div>
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Lifetime Value</p>
            <p className="text-3xl font-bold text-blue-400">
              ₹{(customer.metrics.totalValue / 100000).toFixed(1)}L
            </p>
          </div>
          <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">At-Risk Renewals</p>
            <p className="text-3xl font-bold text-orange-400">{customer.metrics.churnRiskRenewals}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Info + Contacts */}
          <div className="space-y-6">
            {/* Company Info */}
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" /> Company Info
              </h2>
              <div className="space-y-3">
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Mail className="w-4 h-4 text-gray-500" /> {customer.email}
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Phone className="w-4 h-4 text-gray-500" /> {customer.phone}
                  </div>
                )}
                {(customer.city || customer.country) && (
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    {[customer.address, customer.city, customer.country].filter(Boolean).join(', ')}
                  </div>
                )}
                {customer.gstNumber && (
                  <div className="text-sm text-gray-400">GST: <span className="text-gray-200">{customer.gstNumber}</span></div>
                )}
                {customer.panNumber && (
                  <div className="text-sm text-gray-400">PAN: <span className="text-gray-200">{customer.panNumber}</span></div>
                )}
              </div>
            </div>

            {/* Contacts */}
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" /> Contacts ({customer.contacts.length})
                </h2>
                <button
                  onClick={() => setShowContactForm(!showContactForm)}
                  className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {showContactForm && (
                <form onSubmit={addContact} className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                  {(['name', 'email', 'phone', 'department', 'title'] as const).map(field => (
                    <input
                      key={field}
                      type="text"
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={contactForm[field]}
                      onChange={e => setContactForm({ ...contactForm, [field]: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      required={field === 'name'}
                    />
                  ))}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Add'}
                    </button>
                    <button type="button" onClick={() => setShowContactForm(false)} className="px-3 py-1.5 border border-white/10 text-gray-400 text-sm rounded hover:bg-white/5">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {customer.contacts.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-2">No contacts yet</p>
                ) : (
                  customer.contacts.map(c => (
                    <div key={c.id} className="p-3 rounded-lg bg-white/5 border border-white/5">
                      <div className="font-medium text-white text-sm">{c.name}</div>
                      {c.title && <div className="text-gray-400 text-xs">{c.title}</div>}
                      {c.department && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-900/30 text-blue-300 text-xs rounded">
                          {c.department}
                        </span>
                      )}
                      {c.email && <div className="text-gray-400 text-xs mt-1">{c.email}</div>}
                      {c.phone && <div className="text-gray-400 text-xs">{c.phone}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right column: Renewals */}
          <div className="lg:col-span-2">
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-400" /> Renewals
              </h2>

              {upcomingRenewals.length === 0 && customer.renewals.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400">No renewals tracked yet</p>
                  <Link href={`/renewals/new?customerId=${customer.id}`} className="text-blue-400 text-sm hover:underline mt-1 inline-block">
                    Create first renewal
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {customer.renewals.map(renewal => {
                    const daysLeft = Math.ceil((new Date(renewal.renewalDate).getTime() - Date.now()) / 86400000);
                    const statusStyle = STATUS_STYLE[renewal.status] || STATUS_STYLE.DRAFT;
                    const rStyle = RISK_STYLE[renewal.churnRisk] || RISK_STYLE.LOW;
                    return (
                      <Link
                        key={renewal.id}
                        href={`/renewals/${renewal.id}`}
                        className="block p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                {renewal.status}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rStyle.bg} ${rStyle.text}`}>
                                {renewal.churnRisk}
                              </span>
                              {renewal.paymentStatus === 'PAID' && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 font-medium">
                                  Paid
                                </span>
                              )}
                            </div>
                            {renewal.vendor && <p className="text-gray-400 text-sm mt-1">{renewal.vendor.name}</p>}
                            {renewal.nextAction && (
                              <p className="text-gray-500 text-xs mt-1 italic">Next: {renewal.nextAction}</p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-white font-bold text-lg">
                              ₹{renewal.renewalCost.toLocaleString('en-IN')}
                            </p>
                            <p className={`text-xs mt-1 ${daysLeft < 0 ? 'text-red-400' : daysLeft < 14 ? 'text-orange-400' : 'text-gray-400'}`}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                            </p>
                            <p className="text-gray-500 text-xs">{new Date(renewal.renewalDate).toLocaleDateString('en-IN')}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${renewal.renewalLikelihood}%` }}
                            />
                          </div>
                          <span className="text-gray-500 text-xs">{renewal.renewalLikelihood}% likelihood</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
