'use client';

import { useAuthStore } from '@/stores/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { getGuildIconUrl, formatNumber } from '@/lib/utils';
import type { OwnerStats, OwnerGuild } from '@/lib/types';

const PREMIUM_TIERS: { value: string; label: string; color: string; icon: string }[] = [
  { value: 'free', label: 'Free', color: 'var(--nexus-dim)', icon: '—' },
  { value: 'pro', label: 'Pro', color: 'var(--nexus-purple)', icon: '⭐' },
  { value: 'plus', label: 'Plus', color: 'var(--nexus-cyan)', icon: '⚡' },
  { value: 'premium', label: 'Premium', color: 'var(--nexus-yellow)', icon: '👑' },
];

function getTierInfo(tier: string | null) {
  if (!tier || tier === 'none') return PREMIUM_TIERS[0];
  return PREMIUM_TIERS.find((t) => t.value === tier) || PREMIUM_TIERS[0];
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="nexus-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-[var(--nexus-dim)]">{label}</span>
      </div>
      <p className="text-3xl font-bold">{typeof value === 'number' ? formatNumber(value) : value}</p>
    </div>
  );
}

function PremiumBar({ tier, count, total }: { tier: string; count: number; total: number }) {
  const info = getTierInfo(tier);
  const pct = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-6 text-center">{info.icon}</span>
      <span className="text-sm w-24 truncate" style={{ color: info.color }}>{info.label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--nexus-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: info.color }}
        />
      </div>
      <span className="text-sm text-[var(--nexus-dim)] w-16 text-right">
        {count} ({pct.toFixed(1)}%)
      </span>
    </div>
  );
}

function GuildRow({
  guild,
  isDropdownOpen,
  onToggleDropdown,
  isSelected,
  selectMode,
  onToggleSelect,
  onSetPremium,
}: {
  guild: OwnerGuild;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  isSelected: boolean;
  selectMode: boolean;
  onToggleSelect: () => void;
  onSetPremium: (guildId: string, tier: string) => void;
}) {
  const iconUrl = getGuildIconUrl(guild.id, guild.icon, 64);
  const tierInfo = getTierInfo(guild.premiumTier);
  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <div className="nexus-card p-4 flex items-center gap-4">
      {selectMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-4 h-4 accent-[var(--nexus-cyan)] cursor-pointer"
        />
      )}

      {iconUrl ? (
        <img src={iconUrl} alt={guild.name} className="w-10 h-10 rounded-lg object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-[var(--nexus-border)] flex items-center justify-center text-sm font-bold text-[var(--nexus-dim)]">
          {guild.name.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{guild.name}</p>
        <p className="text-xs text-[var(--nexus-dim)]">{guild.id}</p>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={onToggleDropdown}
          className="px-3 py-1 text-xs font-medium rounded-lg border transition-colors"
          style={{
            borderColor: tierInfo.color,
            color: tierInfo.color,
            backgroundColor: `color-mix(in srgb, ${tierInfo.color} 10%, transparent)`,
          }}
        >
          {tierInfo.icon} {tierInfo.label}
          <svg className="w-3 h-3 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 nexus-card p-1 min-w-[140px] shadow-lg">
            {PREMIUM_TIERS.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  onSetPremium(guild.id, t.value);
                  onToggleDropdown();
                }}
                className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-[var(--nexus-border)] transition-colors flex items-center gap-2"
                style={{ color: t.color }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OwnerOverview() {
  const { user, isAuthenticated } = useAuthStore();

  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [guilds, setGuilds] = useState<OwnerGuild[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const LIMIT = 25;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (openDropdownId) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-dropdown]')) {
          setOpenDropdownId(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await api.get('/owner/stats');
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setError('Failed to load owner stats');
      }
    }
    if (isAuthenticated && user?.isOwner) load();
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await api.get('/owner/guilds', { params: { page: 1, limit: LIMIT } });
        if (!cancelled) {
          const fetched: OwnerGuild[] = data.guilds || [];
          setGuilds(fetched);
          setPage(1);
          setHasMore(fetched.length >= LIMIT);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load guilds');
          setLoading(false);
        }
      }
    }
    if (isAuthenticated && user?.isOwner) load();
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const { data } = await api.get('/owner/guilds', { params: { page: nextPage, limit: LIMIT } });
      const fetched: OwnerGuild[] = data.guilds || [];
      setGuilds((prev) => [...prev, ...fetched]);
      setPage(nextPage);
      setHasMore(fetched.length >= LIMIT);
    } catch { /* silently fail */ }
    setLoadingMore(false);
  }, [page, loadingMore, hasMore]);

  const handleSetPremium = useCallback(async (guildId: string, tier: string) => {
    try {
      await api.patch(`/owner/guilds/${guildId}/premium`, { tier });
      setGuilds((prev) =>
        prev.map((g) => (g.id === guildId ? { ...g, premiumTier: tier === 'none' ? 'free' : tier } : g))
      );
      try {
        const { data } = await api.get('/owner/stats');
        setStats(data);
      } catch { /* non-critical */ }
    } catch {
      setError('Failed to update premium tier');
    }
  }, []);

  const handleBulkPremium = useCallback(async (tier: string) => {
    if (selectedIds.size === 0) return;
    try {
      await api.patch('/owner/guilds/bulk-premium', { guildIds: Array.from(selectedIds), tier });
      setGuilds((prev) =>
        prev.map((g) => (selectedIds.has(g.id) ? { ...g, premiumTier: tier } : g))
      );
      setSelectedIds(new Set());
      setSelectMode(false);
      try {
        const { data } = await api.get('/owner/stats');
        setStats(data);
      } catch { /* non-critical */ }
    } catch {
      setError('Failed to bulk update premium tiers');
    }
  }, [selectedIds]);

  const toggleSelect = useCallback((guildId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(guildId)) next.delete(guildId);
      else next.add(guildId);
      return next;
    });
  }, []);

  const filteredGuilds = search
    ? guilds.filter(
        (g) =>
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          g.id.includes(search)
      )
    : guilds;

  const totalPremium = stats
    ? stats.premiumBreakdown
        .filter((b) => b.tier !== 'none' && b.tier !== 'free')
        .reduce((sum, b) => sum + b.count, 0)
    : 0;

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-[var(--nexus-red)]/10 border border-[var(--nexus-red)]/30 text-[var(--nexus-red)] text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bot Overview</h1>
        <p className="text-[var(--nexus-dim)]">Global statistics and server management for Nexus Bot.</p>
      </div>

      {stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon="🌐" label="Total Servers" value={stats.totalGuilds} />
          <StatCard icon="💎" label="Premium Servers" value={totalPremium} />
          <StatCard icon="📊" label="Premium Rate" value={stats.totalGuilds > 0 ? `${((totalPremium / stats.totalGuilds) * 100).toFixed(1)}%` : '0%'} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="nexus-card p-5 animate-pulse">
              <div className="h-4 w-24 bg-[var(--nexus-border)] rounded mb-3" />
              <div className="h-8 w-16 bg-[var(--nexus-border)] rounded" />
            </div>
          ))}
        </div>
      )}

      {stats && stats.premiumBreakdown.length > 0 && (
        <div className="nexus-card p-6 mb-10">
          <h2 className="text-sm font-medium text-[var(--nexus-dim)] uppercase tracking-wider mb-4">Premium Tier Breakdown</h2>
          <div className="space-y-3">
            {stats.premiumBreakdown.map((b) => (
              <PremiumBar key={b.tier} tier={b.tier} count={b.count} total={stats.totalGuilds} />
            ))}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--nexus-dim)] uppercase tracking-wider flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            All Servers ({stats?.totalGuilds ?? guilds.length})
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedIds(new Set()); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${selectMode ? 'bg-[var(--nexus-cyan)]/20 text-[var(--nexus-cyan)] border-[var(--nexus-cyan)]/30' : 'bg-transparent text-[var(--nexus-dim)] border-[var(--nexus-border)] hover:border-[var(--nexus-dim)]'}`}
            >
              {selectMode ? `${selectedIds.size} Selected` : 'Select'}
            </button>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nexus-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search servers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 text-sm rounded-lg bg-[var(--nexus-dark)] border border-[var(--nexus-border)] focus:border-[var(--nexus-cyan)] outline-none transition-colors w-64"
              />
            </div>
          </div>
        </div>

        {selectMode && selectedIds.size > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--nexus-cyan)]/10 border border-[var(--nexus-cyan)]/30 flex items-center gap-3">
            <span className="text-sm text-[var(--nexus-cyan)]">{selectedIds.size} server{selectedIds.size !== 1 ? 's' : ''} selected</span>
            <span className="text-xs text-[var(--nexus-dim)]">Set tier:</span>
            {PREMIUM_TIERS.map((t) => (
              <button key={t.value} onClick={() => handleBulkPremium(t.value)} className="px-2 py-1 text-xs rounded border transition-colors hover:opacity-80" style={{ borderColor: t.color, color: t.color }}>
                {t.icon} {t.label}
              </button>
            ))}
            <button onClick={() => { setSelectedIds(new Set()); setSelectMode(false); }} className="ml-auto text-xs text-[var(--nexus-dim)] hover:text-white transition-colors">Cancel</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="nexus-card p-4 animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--nexus-border)]" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-[var(--nexus-border)] rounded mb-1" />
                  <div className="h-3 w-48 bg-[var(--nexus-border)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredGuilds.length === 0 ? (
          <div className="nexus-card p-8 text-center">
            <p className="text-[var(--nexus-dim)]">{search ? 'No servers match your search.' : 'No servers found.'}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3" data-dropdown>
              {filteredGuilds.map((guild) => (
                <GuildRow
                  key={guild.id}
                  guild={guild}
                  isDropdownOpen={openDropdownId === guild.id}
                  onToggleDropdown={() => setOpenDropdownId(openDropdownId === guild.id ? null : guild.id)}
                  isSelected={selectedIds.has(guild.id)}
                  selectMode={selectMode}
                  onToggleSelect={() => toggleSelect(guild.id)}
                  onSetPremium={handleSetPremium}
                />
              ))}
            </div>
            {hasMore && !search && (
              <div className="mt-6 text-center">
                <button onClick={loadMore} disabled={loadingMore} className="px-6 py-2 text-sm font-medium rounded-lg bg-[var(--nexus-border)] hover:bg-[var(--nexus-dim)]/30 transition-colors disabled:opacity-50">
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </span>
                  ) : 'Load More'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
