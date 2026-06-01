'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authed-fetch';
import { DollarSign, TrendingUp, Award, RefreshCw, ArrowDownCircle } from 'lucide-react';

interface CommissionEvent {
  id: string;
  amount: number;
  percentage: number;
  status: string;
  createdAt: string;
  renewal?: { id: string; renewalCost: number; customerId: string };
}

interface Wallet {
  id: string;
  balance: number;
  totalEarned: number;
  totalPaid: number;
  lastPayout?: string;
  payoutSchedule: string;
  commissionEvents: CommissionEvent[];
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  userEmail: string;
  balance: number;
  totalEarned: number;
  totalPaid: number;
  rank: number;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  ACCRUED: { bg: 'bg-blue-900/30',   text: 'text-blue-400'   },
  PAID:    { bg: 'bg-green-900/30',  text: 'text-green-400'  },
  PENDING: { bg: 'bg-yellow-900/30', text: 'text-yellow-400' },
};

export default function CommissionsPage() {
  const [wallet, setWallet]           = useState<Wallet | null>(null);
  const [history, setHistory]         = useState<CommissionEvent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [paying, setPaying]           = useState(false);
  const [payoutMsg, setPayoutMsg]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [w, h, lb] = await Promise.all([
        authedFetch<{ ok: boolean; data: Wallet }>('/commissions/wallet'),
        authedFetch<{ ok: boolean; data: CommissionEvent[] }>('/commissions/history'),
        authedFetch<{ ok: boolean; data: LeaderboardEntry[] }>('/commissions/leaderboard'),
      ]);
      if (w.ok) setWallet(w.data);
      if (h.ok) setHistory(h.data);
      if (lb.ok) setLeaderboard(lb.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const requestPayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) return;
    setPaying(true);
    setPayoutMsg('');
    try {
      const r = await authedFetch<{ ok: boolean; data: { paidAmount: number } }>('/commissions/payout', {
        method: 'POST',
        body: JSON.stringify({ amount: parseFloat(payoutAmount) }),
      });
      if (r.ok) {
        setPayoutMsg(`Payout of ₹${r.data.paidAmount.toLocaleString('en-IN')} requested successfully.`);
        setPayoutAmount('');
        load();
      }
    } catch {
      setPayoutMsg('Payout failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Commissions</h1>
          <p className="text-gray-400 text-sm mt-1">Your earnings wallet and team leaderboard</p>
        </div>

        {/* Wallet Cards */}
        {wallet && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Available Balance
              </p>
              <p className="text-3xl font-bold text-green-400">₹{wallet.balance.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Total Earned
              </p>
              <p className="text-3xl font-bold text-blue-400">₹{wallet.totalEarned.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                <ArrowDownCircle className="w-3.5 h-3.5" /> Total Paid Out
              </p>
              <p className="text-3xl font-bold text-gray-300">₹{wallet.totalPaid.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Payout Schedule</p>
              <p className="text-xl font-bold text-gray-200">{wallet.payoutSchedule}</p>
              {wallet.lastPayout && (
                <p className="text-gray-500 text-xs mt-1">Last: {new Date(wallet.lastPayout).toLocaleDateString('en-IN')}</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Commission History */}
          <div className="lg:col-span-2">
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">Commission History</h2>
              {history.length === 0 ? (
                <div className="text-center py-10">
                  <DollarSign className="h-10 w-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400">No commission events yet</p>
                  <p className="text-gray-500 text-sm mt-1">Close renewals to start earning</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(event => {
                    const statusStyle = STATUS_STYLE[event.status] || STATUS_STYLE.PENDING;
                    return (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div>
                          <p className="text-white font-medium text-sm">
                            ₹{event.amount.toLocaleString('en-IN')}
                            <span className="text-gray-500 text-xs ml-1">({event.percentage.toFixed(1)}%)</span>
                          </p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {new Date(event.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {event.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Payout Request */}
            {wallet && wallet.balance > 0 && (
              <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-green-400" /> Request Payout
                </h2>
                <p className="text-gray-400 text-xs mb-3">Available: ₹{wallet.balance.toLocaleString('en-IN')}</p>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={e => setPayoutAmount(e.target.value)}
                  placeholder="Amount to withdraw"
                  max={wallet.balance}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-3"
                />
                {payoutMsg && (
                  <p className={`text-xs mb-2 ${payoutMsg.includes('success') ? 'text-green-400' : 'text-red-400'}`}>{payoutMsg}</p>
                )}
                <button
                  onClick={requestPayout}
                  disabled={paying || !payoutAmount}
                  className="w-full py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {paying ? 'Processing...' : 'Request Payout'}
                </button>
              </div>
            )}

            {/* Leaderboard */}
            <div className="bg-[rgba(6,22,40,0.7)] backdrop-blur-lg border border-[rgba(0,212,255,0.1)] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-400" /> Team Leaderboard
              </h2>
              {leaderboard.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, idx) => (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${idx === 0 ? 'bg-yellow-900/20 border-yellow-800/40' : idx === 1 ? 'bg-gray-700/20 border-gray-600/40' : idx === 2 ? 'bg-orange-900/20 border-orange-800/40' : 'bg-white/5 border-white/5'}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-gray-400 text-black' : idx === 2 ? 'bg-orange-600 text-white' : 'bg-white/10 text-gray-300'}`}>
                        {entry.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{entry.userName}</p>
                        <p className="text-gray-500 text-xs truncate">{entry.userEmail}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 font-bold text-sm">₹{(entry.totalEarned / 1000).toFixed(0)}K</p>
                        <p className="text-gray-500 text-xs">earned</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
