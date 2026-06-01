'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authedFetch } from '@/lib/authed-fetch';
import {
  ArrowLeft, CheckCircle, Circle, ArrowRight, DollarSign,
  FileText, Phone, RefreshCw, Send, AlertCircle, Zap,
  TrendingUp, User, Building, Calendar
} from 'lucide-react';

interface Renewal {
  id: string;
  renewalDate: string;
  expiryDate: string;
  cycleStartDate: string;
  renewalCost: number;
  margin: number;
  marginPercent: number;
  upsellPotential: number;
  status: string;
  churnRisk: string;
  renewalLikelihood: number;
  paymentStatus: string;
  nextAction?: string;
  lastOutreach?: string;
  quoteSent: boolean;
  quoteSentDate?: string;
  discountRequested?: number;
  discountApproved?: number;
  paidAmount?: number;
  paymentDate?: string;
  notes?: string;
  invoiceRef?: string;
  doRef?: string;
  renewalType?: string;
  reminderCadence?: string;
  customer?: { id: string; name: string; email?: string; healthScore: number; churnRisk: string };
  vendor?: { id: string; name: string };
  accountManager?: { id: string; fullName: string; email: string };
}

const STAGES = [
  { key: 'CAPTURE',    label: 'Capture',    icon: Zap          },
  { key: 'ENRICH',     label: 'Enrich',     icon: RefreshCw    },
  { key: 'SCORE',      label: 'Score',      icon: TrendingUp   },
  { key: 'SCHEDULE',   label: 'Schedule',   icon: Calendar     },
  { key: 'ENGAGE',     label: 'Engage',     icon: Send         },
  { key: 'QUOTE',      label: 'Quote',      icon: FileText     },
  { key: 'NEGOTIATE',  label: 'Negotiate',  icon: Phone        },
  { key: 'CLOSE',      label: 'Close',      icon: CheckCircle  },
  { key: 'PROVISION',  label: 'Provision',  icon: Zap          },
  { key: 'RECONCILE',  label: 'Reconcile',  icon: DollarSign   },
  { key: 'REFLECT',    label: 'Reflect',    icon: Circle       },
];

const STATUS_TO_STAGE: Record<string, number> = {
  DRAFT: 3,
  QUOTED: 5,
  NEGOTIATING: 6,
  CLOSED: 7,
  CANCELLED: 0,
};

const RISK_STYLE: Record<string, { bg: string; text: string }> = {
  LOW:      { bg: 'bg-green-900/40',  text: 'text-green-400'  },
  MEDIUM:   { bg: 'bg-yellow-900/40', text: 'text-yellow-400' },
  HIGH:     { bg: 'bg-orange-900/40', text: 'text-orange-400' },
  CRITICAL: { bg: 'bg-red-900/40',    text: 'text-red-400'    },
};

export default function RenewalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [renewal, setRenewal] = useState<Renewal | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [discount, setDiscount] = useState('');

  const load = () =>
    authedFetch<{ ok: boolean; data: Renewal }>(`/renewals/${id}`)
      .then(r => { if (r.ok) { setRenewal(r.data); setNotes(r.data.notes || ''); } })
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, [id]);

  const action = async (stage: string, body: Record<string, unknown> = {}) => {
    setActing(stage);
    try {
      const r = await authedFetch<{ ok: boolean; data: Renewal }>(`/renewals/${id}/${stage.toLowerCase()}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (r.ok) setRenewal(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setActing(null);
    }
  };

  const autoProcess = async () => {
    setActing('auto');
    try {
      const r = await authedFetch<{ ok: boolean; data: Renewal }>(`/renewals/${id}/auto-process`, { method: 'POST' });
      if (r.ok) setRenewal(r.data);
    } finally {
      setActing(null);
    }
  };

  const saveNotes = async () => {
    setActing('notes');
    try {
      const r = await authedFetch<{ ok: boolean; data: Renewal }>(`/renewals/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ notes }),
      });
      if (r.ok) setRenewal(r.data);
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!renewal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-white">Renewal not found</p>
          <Link href="/renewals" className="text-blue-400 hover:underline mt-2 block">Back to Renewals</Link>
        </div>
      </div>
    );
  }

  const currentStageIdx = STATUS_TO_STAGE[renewal.status] ?? 2;
  const daysLeft = Math.ceil((new Date(renewal.renewalDate).getTime() - Date.now()) / 86400000);
  const rStyle = RISK_STYLE[renewal.churnRisk] || RISK_STYLE.LOW;
  const isClosed = renewal.status === 'CLOSED';

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">
              {renewal.customer?.name || 'Unknown Customer'}
              {renewal.vendor && <span className="text-gray-400 font-normal text-lg"> — {renewal.vendor.name}</span>}
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">Renewal #{renewal.id.slice(-8).toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${rStyle.bg} ${rStyle.text}`}>
              {renewal.churnRisk}
            </span>
            {!isClosed && (
              <button
                onClick={autoProcess}
                disabled={!!acting}
                className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {acting === 'auto' ? 'Processing...' : 'Auto-Process'}
              </button>
            )}
          </div>
        </div>

        {/* Workflow Progress */}
        <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-4">Renewal Workflow</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STAGES.map((stage, idx) => {
              const done = idx < currentStageIdx;
              const active = idx === currentStageIdx;
              const Icon = stage.icon;
              return (
                <div key={stage.key} className="flex items-center">
                  <div className={`flex flex-col items-center gap-1 min-w-[70px] ${done ? 'opacity-100' : active ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      done ? 'bg-green-600 border-green-500' :
                      active ? 'bg-blue-600 border-blue-500 ring-2 ring-blue-500/30' :
                      'bg-white/5 border-white/10'
                    }`}>
                      {done ? <CheckCircle className="w-4 h-4 text-white" /> : <Icon className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${active ? 'text-blue-400' : done ? 'text-green-400' : 'text-gray-500'}`}>
                      {stage.label}
                    </span>
                  </div>
                  {idx < STAGES.length - 1 && (
                    <div className={`h-0.5 w-5 mx-1 flex-shrink-0 ${idx < currentStageIdx ? 'bg-green-600' : 'bg-white/10'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Details */}
          <div className="space-y-5">
            {/* Key Metrics */}
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">Key Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Renewal Cost</span>
                  <span className="text-white font-bold">₹{renewal.renewalCost.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Margin</span>
                  <span className="text-green-400 font-semibold">
                    ₹{renewal.margin.toLocaleString('en-IN')} ({renewal.marginPercent.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Upsell Potential</span>
                  <span className="text-blue-400 font-semibold">₹{renewal.upsellPotential.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Renewal Date</span>
                  <span className={`text-sm font-medium ${daysLeft < 0 ? 'text-red-400' : daysLeft < 14 ? 'text-orange-400' : 'text-gray-300'}`}>
                    {new Date(renewal.renewalDate).toLocaleDateString('en-IN')}
                    <span className="ml-1 text-xs">({daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`})</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Payment</span>
                  <span className={`text-sm font-medium ${renewal.paymentStatus === 'PAID' ? 'text-green-400' : renewal.paymentStatus === 'OVERDUE' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {renewal.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Likelihood bar */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400 text-xs">Renewal Likelihood</span>
                  <span className="text-white text-xs font-semibold">{renewal.renewalLikelihood}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${renewal.renewalLikelihood >= 70 ? 'bg-green-500' : renewal.renewalLikelihood >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${renewal.renewalLikelihood}%` }}
                  />
                </div>
              </div>
            </div>

            {/* People */}
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">People</h3>
              {renewal.customer && (
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                    <Building className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <Link href={`/dashboard/customers/${renewal.customer.id}`} className="text-white font-medium text-sm hover:text-blue-400">
                      {renewal.customer.name}
                    </Link>
                    <p className="text-gray-500 text-xs">Customer · Health {renewal.customer.healthScore}</p>
                  </div>
                </div>
              )}
              {renewal.accountManager && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-900/40 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{renewal.accountManager.fullName}</p>
                    <p className="text-gray-500 text-xs">Account Manager</p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">Notes</h3>
              {renewal.nextAction && (
                <div className="mb-3 p-2 rounded bg-blue-900/20 border border-blue-800/40">
                  <p className="text-blue-300 text-xs font-medium">Next Action</p>
                  <p className="text-gray-200 text-sm mt-0.5">{renewal.nextAction}</p>
                </div>
              )}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Add notes..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              />
              <button
                onClick={saveNotes}
                disabled={acting === 'notes'}
                className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
              >
                {acting === 'notes' ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>

          {/* Right: Workflow Actions */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Workflow Actions</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Enrich */}
                <ActionCard
                  title="Enrich Data"
                  description="Auto-fill missing fields and calculate margin"
                  icon={RefreshCw}
                  color="purple"
                  onClick={() => action('enrich')}
                  loading={acting === 'enrich'}
                  disabled={isClosed}
                />

                {/* Score */}
                <ActionCard
                  title="Re-Score"
                  description="Recompute renewal likelihood and churn risk"
                  icon={TrendingUp}
                  color="blue"
                  onClick={() => action('score')}
                  loading={acting === 'score'}
                  disabled={isClosed}
                />

                {/* Schedule */}
                <ActionCard
                  title="Schedule"
                  description="Determine optimal outreach timing"
                  icon={Calendar}
                  color="indigo"
                  onClick={() => action('schedule')}
                  loading={acting === 'schedule'}
                  disabled={isClosed}
                />

                {/* Engage */}
                <ActionCard
                  title="Mark Engaged"
                  description="Record customer outreach via email/WhatsApp"
                  icon={Send}
                  color="cyan"
                  onClick={() => action('engage', { channel: 'email' })}
                  loading={acting === 'engage'}
                  disabled={isClosed}
                />

                {/* Quote */}
                <ActionCard
                  title={renewal.quoteSent ? 'Re-Send Quote' : 'Send Quote'}
                  description={renewal.quoteSent ? `Sent ${renewal.quoteSentDate ? new Date(renewal.quoteSentDate).toLocaleDateString('en-IN') : ''}` : 'Generate and send quote to customer'}
                  icon={FileText}
                  color="yellow"
                  onClick={() => action('quote', { discount: discount ? parseFloat(discount) : undefined })}
                  loading={acting === 'quote'}
                  disabled={isClosed}
                  badge={renewal.quoteSent ? 'Sent' : undefined}
                />

                {/* Negotiate */}
                <ActionCard
                  title="Log Negotiation"
                  description="Record discount request or customer pushback"
                  icon={Phone}
                  color="orange"
                  onClick={() => action('negotiate', { discountRequested: discount ? parseFloat(discount) : 0, feedback: notes })}
                  loading={acting === 'negotiate'}
                  disabled={isClosed || renewal.status === 'DRAFT'}
                />

                {/* Close */}
                <ActionCard
                  title="Close Renewal"
                  description="Confirm payment and mark as closed"
                  icon={CheckCircle}
                  color="green"
                  onClick={() => {
                    if (!paymentAmount) {
                      alert('Enter payment amount first');
                      return;
                    }
                    action('close', { paymentAmount: parseFloat(paymentAmount) });
                  }}
                  loading={acting === 'close'}
                  disabled={isClosed}
                />

                {/* Provision */}
                <ActionCard
                  title="Mark Provisioned"
                  description="Confirm licenses/services delivered to customer"
                  icon={Zap}
                  color="teal"
                  onClick={() => action('provision')}
                  loading={acting === 'provision'}
                  disabled={renewal.status !== 'CLOSED' && renewal.paymentStatus !== 'PAID'}
                />
              </div>

              {/* Quick inputs */}
              <div className="mt-4 grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-1 block">Payment Amount (₹)</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder={renewal.renewalCost.toString()}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase tracking-wide mb-1 block">Discount Amount (₹)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Reconcile & Reflect (post-close) */}
            {isClosed && (
              <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4">Post-Close Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <ActionCard
                    title="Reconcile"
                    description="Sync to accounting and post commission"
                    icon={DollarSign}
                    color="green"
                    onClick={() => action('reconcile', { commissionAmount: renewal.margin })}
                    loading={acting === 'reconcile'}
                    disabled={false}
                  />
                  <ActionCard
                    title="Reflect"
                    description="Update customer health and schedule next year"
                    icon={RefreshCw}
                    color="blue"
                    onClick={() => action('reflect')}
                    loading={acting === 'reflect'}
                    disabled={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  title, description, icon: Icon, color, onClick, loading, disabled, badge
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  badge?: string;
}) {
  const colors: Record<string, { bg: string; border: string; icon: string; btn: string }> = {
    purple: { bg: 'bg-purple-900/20', border: 'border-purple-800/40', icon: 'text-purple-400', btn: 'bg-purple-700 hover:bg-purple-600' },
    blue:   { bg: 'bg-blue-900/20',   border: 'border-blue-800/40',   icon: 'text-blue-400',   btn: 'bg-blue-700 hover:bg-blue-600'   },
    indigo: { bg: 'bg-indigo-900/20', border: 'border-indigo-800/40', icon: 'text-indigo-400', btn: 'bg-indigo-700 hover:bg-indigo-600' },
    cyan:   { bg: 'bg-cyan-900/20',   border: 'border-cyan-800/40',   icon: 'text-cyan-400',   btn: 'bg-cyan-700 hover:bg-cyan-600'   },
    yellow: { bg: 'bg-yellow-900/20', border: 'border-yellow-800/40', icon: 'text-yellow-400', btn: 'bg-yellow-700 hover:bg-yellow-600' },
    orange: { bg: 'bg-orange-900/20', border: 'border-orange-800/40', icon: 'text-orange-400', btn: 'bg-orange-700 hover:bg-orange-600' },
    green:  { bg: 'bg-green-900/20',  border: 'border-green-800/40',  icon: 'text-green-400',  btn: 'bg-green-700 hover:bg-green-600'  },
    teal:   { bg: 'bg-teal-900/20',   border: 'border-teal-800/40',   icon: 'text-teal-400',   btn: 'bg-teal-700 hover:bg-teal-600'   },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`p-4 rounded-xl border ${c.bg} ${c.border} flex flex-col gap-3 ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${c.icon}`} />
          <span className="text-white font-medium text-sm">{title}</span>
        </div>
        {badge && <span className="text-xs px-1.5 py-0.5 bg-white/10 text-gray-300 rounded">{badge}</span>}
      </div>
      <p className="text-gray-400 text-xs flex-1">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`w-full py-2 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${c.btn}`}
      >
        {loading ? 'Working...' : title}
      </button>
    </div>
  );
}
