'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface TierCount { tier: string; count: string; }
interface SubBreakdown { tier: string; active_count: string; total_revenue: string; avg_amount: string; }
interface ExpiringSubscription {
  guild_id: string; tier: string; amount: number; expiry_date: string;
  status: string; guild_name: string | null; member_count: number | null;
}

const TIER_COLORS: Record<string, string> = {
  free: 'var(--nexus-dim)', pro: 'var(--nexus-green)',
  plus: 'var(--nexus-blue)', premium: 'var(--nexus-yellow)',
};

export default function RevenuePage() {
  const [tiers, setTiers] = useState<TierCount[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubBreakdown[]>([]);
  const [expiring, setExpiring] = useState<ExpiringSubscription[]>([]);
  const [totalPremium, setTotalPremium] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, expiringRes] = await Promise.all([
        api.get('/owner/revenue/overview'),
        api.get('/owner/revenue/expiring?days=30'),
      ]);
      setTiers(overviewRes.data.tiers);
      setSubscriptions(overviewRes.data.subscriptions);
      setTotalPremium(overviewRes.data.totalPremiumServers);
      setExpiring(expiringRes.data.expiring);
    } catch (err) {
      console.error('Failed to fetch revenue data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalServers = tiers.reduce((s, t) => s + parseInt(t.count, 10), 0);

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">💰 Revenue & Premium</h1>
        <p className="text-[var(--nexus-dim)]">Track premium subscriptions, tier distribution, and revenue metrics.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Total Servers</p>
          <p className="text-2xl font-bold text-[var(--nexus-cyan)]">{totalServers.toLocaleString()}</p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Premium Servers</p>
          <p className="text-2xl font-bold text-[var(--nexus-yellow)]">{totalPremium}</p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Premium Rate</p>
          <p className="text-2xl font-bold text-[var(--nexus-green)]">
            {totalServers > 0 ? ((totalPremium / totalServers) * 100).toFixed(1) : 0}%
          </p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Expiring (30d)</p>
          <p className="text-2xl font-bold text-[var(--nexus-red)]">{expiring.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="nexus-card p-6">
          <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Tier Distribution</h3>
          <div className="space-y-3">
            {tiers.map((t) => {
              const count = parseInt(t.count, 10);
              const pct = totalServers > 0 ? (count / totalServers) * 100 : 0;
              return (
                <div key={t.tier}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize font-medium" style={{ color: TIER_COLORS[t.tier] || 'var(--nexus-text)' }}>{t.tier}</span>
                    <span>{count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(1, pct)}%`, backgroundColor: TIER_COLORS[t.tier] || 'var(--nexus-cyan)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="nexus-card p-6">
          <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Active Subscriptions</h3>
          {subscriptions.length > 0 ? (
            <div className="space-y-3">
              {subscriptions.map((s) => (
                <div key={s.tier} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <div>
                    <span className="capitalize font-medium" style={{ color: TIER_COLORS[s.tier] || 'var(--nexus-text)' }}>{s.tier}</span>
                    <p className="text-xs text-[var(--nexus-dim)]">{s.active_count} active</p>
                  </div>
                  <p className="font-bold text-[var(--nexus-green)]">${parseFloat(s.total_revenue || '0').toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[var(--nexus-dim)] py-6">No active subscriptions</p>
          )}
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="nexus-card overflow-hidden">
          <div className="p-4 border-b border-[var(--nexus-border)]">
            <h3 className="text-sm font-medium">Expiring Soon ({expiring.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--nexus-border)]">
                  <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Server</th>
                  <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Tier</th>
                  <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((sub, i) => (
                  <tr key={i} className="border-b border-[var(--nexus-border)]/50">
                    <td className="px-4 py-3">{sub.guild_name || sub.guild_id}</td>
                    <td className="px-4 py-3 capitalize" style={{ color: TIER_COLORS[sub.tier] }}>{sub.tier}</td>
                    <td className="px-4 py-3 text-right text-[var(--nexus-dim)]">{new Date(sub.expiry_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
