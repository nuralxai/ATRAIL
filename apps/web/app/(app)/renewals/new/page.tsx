'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authedFetch } from '@/lib/authed-fetch';
import { useAuthStore } from '@/lib/auth-store';
import { ArrowLeft, Save } from 'lucide-react';

interface Customer { id: string; name: string; }
interface Vendor   { id: string; name: string; }
interface User     { id: string; fullName: string; }

export default function NewRenewalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors]     = useState<Vendor[]>([]);
  const [users, setUsers]         = useState<User[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const [form, setForm] = useState({
    customerId:     searchParams.get('customerId') || '',
    amId:           user?.id || '',
    vendorId:       '',
    renewalDate:    '',
    expiryDate:     '',
    cycleStartDate: '',
    renewalCost:    '',
    margin:         '',
    marginPercent:  '',
    renewalType:    'LICENSE',
    reminderCadence: 'BALANCED',
    notes:          '',
    doRef:          '',
    invoiceRef:     '',
  });

  useEffect(() => {
    Promise.all([
      authedFetch<{ ok: boolean; data: Customer[] }>('/customers'),
      authedFetch<{ ok: boolean; vendors: Vendor[] }>('/assets/vendors'),
      authedFetch<{ ok: boolean; users: User[] }>('/users'),
    ]).then(([c, v, u]) => {
      if (c.ok) setCustomers(c.data);
      if (v.ok) setVendors(v.vendors);
      if (u.ok) setUsers(u.users);
    });
  }, []);

  // Auto-calc margin when cost changes
  useEffect(() => {
    if (form.renewalCost && form.marginPercent) {
      const cost = parseFloat(form.renewalCost);
      const pct  = parseFloat(form.marginPercent);
      if (!isNaN(cost) && !isNaN(pct)) {
        setForm(f => ({ ...f, margin: (cost * pct / 100).toFixed(2) }));
      }
    }
  }, [form.renewalCost, form.marginPercent]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.customerId || !form.vendorId || !form.renewalDate || !form.renewalCost) {
      setError('Customer, Vendor, Renewal Date and Cost are required.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        customerId:     form.customerId,
        amId:           form.amId || user?.id,
        vendorId:       form.vendorId,
        renewalDate:    new Date(form.renewalDate).toISOString(),
        expiryDate:     form.expiryDate ? new Date(form.expiryDate).toISOString() : new Date(form.renewalDate).toISOString(),
        cycleStartDate: form.cycleStartDate ? new Date(form.cycleStartDate).toISOString() : new Date().toISOString(),
        renewalCost:    parseFloat(form.renewalCost),
        margin:         form.margin ? parseFloat(form.margin) : 0,
        marginPercent:  form.marginPercent ? parseFloat(form.marginPercent) : 0,
        renewalType:    form.renewalType,
        reminderCadence: form.reminderCadence,
        notes:          form.notes || undefined,
        doRef:          form.doRef || undefined,
        invoiceRef:     form.invoiceRef || undefined,
      };
      const r = await authedFetch<{ ok: boolean; data: { id: string } }>('/renewals', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        router.push(`/renewals/${r.data.id}`);
      } else {
        setError('Failed to create renewal');
      }
    } catch {
      setError('Failed to create renewal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/renewals" className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">New Renewal</h1>
            <p className="text-gray-400 text-sm">Create a renewal tracking record</p>
          </div>
        </div>

        <form onSubmit={submit} className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-6 space-y-5">

          {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Customer *">
                <select value={form.customerId} onChange={e => set('customerId', e.target.value)} required className={SELECT}>
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Vendor *">
              <select value={form.vendorId} onChange={e => set('vendorId', e.target.value)} required className={SELECT}>
                <option value="">Select vendor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>

            <Field label="Account Manager">
              <select value={form.amId} onChange={e => set('amId', e.target.value)} className={SELECT}>
                <option value={user?.id || ''}>{user ? `Me (${user.fullName || user.email})` : 'Me'}</option>
                {users.filter(u => u.id !== user?.id).map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </Field>

            <Field label="Renewal Date *">
              <input type="date" value={form.renewalDate} onChange={e => set('renewalDate', e.target.value)} required className={INPUT} />
            </Field>

            <Field label="Expiry Date">
              <input type="date" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} className={INPUT} />
            </Field>

            <Field label="Cycle Start Date">
              <input type="date" value={form.cycleStartDate} onChange={e => set('cycleStartDate', e.target.value)} className={INPUT} />
            </Field>

            <Field label="Renewal Type">
              <select value={form.renewalType} onChange={e => set('renewalType', e.target.value)} className={SELECT}>
                <option value="LICENSE">License</option>
                <option value="AMC">AMC</option>
                <option value="SERVICE">Service</option>
                <option value="SUBSCRIPTION">Subscription</option>
                <option value="WARRANTY">Warranty</option>
              </select>
            </Field>

            <Field label="Renewal Cost (₹) *">
              <input type="number" step="0.01" value={form.renewalCost} onChange={e => set('renewalCost', e.target.value)} required placeholder="0.00" className={INPUT} />
            </Field>

            <Field label="Margin %">
              <input type="number" step="0.1" value={form.marginPercent} onChange={e => set('marginPercent', e.target.value)} placeholder="15" className={INPUT} />
            </Field>

            <Field label="Margin Amount (₹)">
              <input type="number" step="0.01" value={form.margin} onChange={e => set('margin', e.target.value)} placeholder="Auto-calculated" className={INPUT} />
            </Field>

            <Field label="Reminder Cadence">
              <select value={form.reminderCadence} onChange={e => set('reminderCadence', e.target.value)} className={SELECT}>
                <option value="GENTLE">Gentle (90/60/30 days)</option>
                <option value="BALANCED">Balanced (60/30/14/7 days)</option>
                <option value="AGGRESSIVE">Aggressive (90/60/30/14/7/3/1 days)</option>
              </select>
            </Field>

            <Field label="DO Reference">
              <input type="text" value={form.doRef} onChange={e => set('doRef', e.target.value)} placeholder="Delivery Order ref" className={INPUT} />
            </Field>

            <Field label="Invoice Reference">
              <input type="text" value={form.invoiceRef} onChange={e => set('invoiceRef', e.target.value)} placeholder="Invoice ref" className={INPUT} />
            </Field>

            <div className="col-span-2">
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any additional notes..." className={`${INPUT} resize-none`} />
              </Field>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/renewals" className="flex-1 py-2.5 text-center border border-white/10 text-gray-400 hover:bg-white/5 rounded-lg text-sm transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Creating...' : 'Create Renewal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INPUT = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500';
const SELECT = 'w-full px-3 py-2 bg-[rgba(6,22,40,0.9)] border border-white/10 rounded-lg text-gray-200 text-sm focus:outline-none focus:border-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-gray-400 text-xs uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}
