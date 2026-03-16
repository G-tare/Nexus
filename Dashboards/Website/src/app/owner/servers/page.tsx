'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

/* ── Types ── */

interface Server {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  member_count: number;
  premium_tier: string;
  premium_expires_at: string | null;
  locale: string;
  timezone: string;
  joined_at: string;
  left_at: string | null;
  is_active: boolean;
}

interface ServerDetailData {
  server: Server;
  moduleStats: { enabledCount: number };
  usageStats: { commands30d: number; uniqueUsers30d: number };
  subscription: {
    id: number;
    tier: string;
    status: string;
    expiry_date: string;
  } | null;
}

interface ServerInsights {
  totals: { total_guilds: string; total_members: string; avg_members: string };
  tiers: { premium_tier: string; count: string }[];
  sizeDistribution: { size_bucket: string; count: string }[];
}

interface TopServer {
  guild_id: string;
  guild_name: string | null;
  member_count: number | null;
  premium_tier: string | null;
  command_count: string;
  unique_users: string;
}

interface Announcement {
  id: number;
  title: string;
  message: string;
  type: string;
  author_id: string;
  created_at: string;
}

/* ── Constants ── */

const TIER_COLORS: Record<string, string> = {
  free: 'var(--nexus-dim)',
  pro: 'var(--nexus-purple)',
  plus: 'var(--nexus-cyan)',
  premium: 'var(--nexus-yellow)',
};

const ANNOUNCEMENT_TYPE_COLORS: Record<string, string> = {
  info: 'var(--nexus-cyan)',
  warning: 'var(--nexus-yellow)',
  update: 'var(--nexus-purple)',
  maintenance: 'var(--nexus-red)',
};

const ANNOUNCEMENT_TYPE_ICONS: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  update: '🚀',
  maintenance: '🔧',
};

/* ── Skeleton ── */

function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="nexus-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[var(--nexus-border)]" />
          <div className="flex-1">
            <div className="h-4 w-48 bg-[var(--nexus-border)] rounded mb-1" />
            <div className="h-3 w-32 bg-[var(--nexus-border)] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Page ── */

export default function ServerManagementPage() {
  const [activeTab, setActiveTab] = useState<'servers' | 'insights' | 'announcements'>('servers');
  const [servers, setServers] = useState<Server[]>([]);
  const [insights, setInsights] = useState<ServerInsights | null>(null);
  const [topServers, setTopServers] = useState<TopServer[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<Record<string, ServerDetailData>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Announcement form state
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', type: 'info' });
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  /* ── Fetchers ── */

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        sort: sortBy,
        order: sortOrder,
      });
      if (searchQuery) params.set('q', searchQuery);
      if (tierFilter) params.set('tier', tierFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await api.get(`/owner/servers/search?${params}`);
      setServers(res.data.servers || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || 0);
    } catch {
      setError('Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, tierFilter, statusFilter, sortBy, sortOrder, currentPage]);

  const fetchInsights = useCallback(async () => {
    try {
      const [insightsRes, topRes] = await Promise.all([
        api.get('/owner/servers/insights'),
        api.get('/owner/servers/top?limit=20&days=30'),
      ]);
      setInsights(insightsRes.data);
      setTopServers(topRes.data.servers || []);
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await api.get('/owner/servers/announcements?page=1&limit=50');
      setAnnouncements(res.data.announcements || []);
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchServerDetail = useCallback(async (guildId: string) => {
    setDetailLoading((prev) => ({ ...prev, [guildId]: true }));
    try {
      const res = await api.get(`/owner/servers/${guildId}/detail`);
      setServerDetails((prev) => ({ ...prev, [guildId]: res.data }));
    } catch {
      /* non-critical */
    } finally {
      setDetailLoading((prev) => ({ ...prev, [guildId]: false }));
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'servers') fetchServers();
    else if (activeTab === 'insights') fetchInsights();
    else if (activeTab === 'announcements') fetchAnnouncements();
  }, [activeTab, fetchServers, fetchInsights, fetchAnnouncements]);

  /* ── Handlers ── */

  const handleExpandServer = (guildId: string) => {
    if (expandedServerId === guildId) {
      setExpandedServerId(null);
    } else {
      setExpandedServerId(guildId);
      if (!serverDetails[guildId]) {
        fetchServerDetail(guildId);
      }
    }
  };

  const handleResetConfig = async (guildId: string) => {
    if (!confirm('Are you sure you want to reset this server\'s module configs? This cannot be undone.')) return;
    try {
      await api.post(`/owner/servers/${guildId}/reset-config`, {});
      fetchServerDetail(guildId);
      setError(null);
    } catch {
      setError('Failed to reset config');
    }
  };

  const handleMarkInactive = async (guildId: string) => {
    if (!confirm('Mark this server as inactive (soft-leave)?')) return;
    try {
      await api.post(`/owner/servers/${guildId}/leave`, {});
      setServers((s) => s.map((srv) => (srv.id === guildId ? { ...srv, is_active: false } : srv)));
      setError(null);
    } catch {
      setError('Failed to mark inactive');
    }
  };

  const handleChangeTier = async (guildId: string, newTier: string) => {
    try {
      await api.patch(`/owner/servers/${guildId}/config`, { premium_tier: newTier });
      setServers((s) => s.map((srv) => (srv.id === guildId ? { ...srv, premium_tier: newTier } : srv)));
      setError(null);
    } catch {
      setError('Failed to change tier');
    }
  };

  const handlePostAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
      setError('Title and message are required');
      return;
    }
    setPostingAnnouncement(true);
    try {
      const res = await api.post('/owner/servers/announcements', announcementForm);
      setAnnouncements([res.data.announcement, ...announcements]);
      setAnnouncementForm({ title: '', message: '', type: 'info' });
      setError(null);
    } catch {
      setError('Failed to post announcement');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/owner/servers/announcements/${id}`);
      setAnnouncements((a) => a.filter((ann) => ann.id !== id));
      setError(null);
    } catch {
      setError('Failed to delete announcement');
    }
  };

  /* ── Render ── */

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Server Management</h1>
        <p className="text-[var(--nexus-dim)]">Search, manage, and monitor all bot servers.</p>
      </div>

      {error && (
        <div className="nexus-card p-4 border-l-4 border-[var(--nexus-red)] bg-red-500/5 flex justify-between items-center">
          <span className="text-[var(--nexus-red)] text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-[var(--nexus-dim)] hover:text-[var(--nexus-text)]">
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--nexus-border)]">
        {(['servers', 'insights', 'announcements'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-[var(--nexus-cyan)] text-[var(--nexus-cyan)]'
                : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)]'
            }`}
          >
            {tab === 'servers' ? `Servers${totalCount > 0 ? ` (${totalCount})` : ''}` : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ═══════ SERVERS TAB ═══════ */}
      {activeTab === 'servers' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nexus-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-[var(--nexus-dark)] border border-[var(--nexus-border)] focus:border-[var(--nexus-cyan)] outline-none transition-colors"
              />
            </div>
            <select
              value={tierFilter}
              onChange={(e) => { setTierFilter(e.target.value); setCurrentPage(1); }}
              className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)] transition-colors"
            >
              <option value="">All Tiers</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="plus">Plus</option>
              <option value="premium">Premium</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)] transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)] transition-colors"
            >
              <option value="name">Sort: Name</option>
              <option value="members">Sort: Members</option>
              <option value="joined">Sort: Joined</option>
              <option value="usage">Sort: Usage (30d)</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg text-sm hover:bg-white/5 transition-colors"
            >
              {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
          </div>

          {/* Server list */}
          {loading ? (
            <SkeletonLoader />
          ) : servers.length === 0 ? (
            <div className="nexus-card p-8 text-center">
              <span className="text-4xl mb-3 block">🌐</span>
              <p className="text-[var(--nexus-dim)]">No servers found matching your filters.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {servers.map((server) => (
                  <div key={server.id}>
                    {/* Server row */}
                    <button
                      onClick={() => handleExpandServer(server.id)}
                      className="w-full nexus-card p-4 flex items-center gap-4 hover:border-[var(--nexus-cyan)]/30 transition-colors text-left"
                    >
                      {/* Icon */}
                      {server.icon ? (
                        <img
                          src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=64`}
                          alt=""
                          className="w-10 h-10 rounded-lg"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${TIER_COLORS[server.premium_tier] || 'var(--nexus-cyan)'} 20%, transparent)`,
                            color: TIER_COLORS[server.premium_tier] || 'var(--nexus-cyan)',
                          }}
                        >
                          {server.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{server.name}</p>
                        <p className="text-xs text-[var(--nexus-dim)]">{server.id}</p>
                      </div>

                      {/* Members */}
                      <div className="text-right hidden sm:block">
                        <p className="text-sm">{(server.member_count || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-[var(--nexus-dim)]">members</p>
                      </div>

                      {/* Joined */}
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-[var(--nexus-dim)]">
                          {new Date(server.joined_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Tier badge */}
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${TIER_COLORS[server.premium_tier] || 'var(--nexus-dim)'} 15%, transparent)`,
                          color: TIER_COLORS[server.premium_tier] || 'var(--nexus-dim)',
                          border: `1px solid color-mix(in srgb, ${TIER_COLORS[server.premium_tier] || 'var(--nexus-dim)'} 30%, transparent)`,
                        }}
                      >
                        {server.premium_tier}
                      </span>

                      {/* Status */}
                      <span
                        className="px-2 py-1 rounded-full text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${server.is_active ? 'var(--nexus-green)' : 'var(--nexus-red)'} 15%, transparent)`,
                          color: server.is_active ? 'var(--nexus-green)' : 'var(--nexus-red)',
                        }}
                      >
                        {server.is_active ? 'Active' : 'Inactive'}
                      </span>

                      {/* Expand arrow */}
                      <svg
                        className={`w-4 h-4 text-[var(--nexus-dim)] transition-transform ${expandedServerId === server.id ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Expanded detail panel */}
                    {expandedServerId === server.id && (
                      <div className="nexus-card p-5 rounded-t-none border-t-0 bg-white/[0.02] space-y-5">
                        {detailLoading[server.id] ? (
                          <SkeletonLoader />
                        ) : serverDetails[server.id] ? (
                          <>
                            {/* Stats row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="nexus-card p-3 bg-white/[0.02]">
                                <p className="text-[10px] text-[var(--nexus-dim)] uppercase tracking-wide">Modules Enabled</p>
                                <p className="text-xl font-bold text-[var(--nexus-cyan)] mt-1">
                                  {serverDetails[server.id].moduleStats.enabledCount}
                                </p>
                              </div>
                              <div className="nexus-card p-3 bg-white/[0.02]">
                                <p className="text-[10px] text-[var(--nexus-dim)] uppercase tracking-wide">Commands (30d)</p>
                                <p className="text-xl font-bold text-[var(--nexus-purple)] mt-1">
                                  {serverDetails[server.id].usageStats.commands30d.toLocaleString()}
                                </p>
                              </div>
                              <div className="nexus-card p-3 bg-white/[0.02]">
                                <p className="text-[10px] text-[var(--nexus-dim)] uppercase tracking-wide">Unique Users (30d)</p>
                                <p className="text-xl font-bold text-[var(--nexus-blue)] mt-1">
                                  {serverDetails[server.id].usageStats.uniqueUsers30d.toLocaleString()}
                                </p>
                              </div>
                              <div className="nexus-card p-3 bg-white/[0.02]">
                                <p className="text-[10px] text-[var(--nexus-dim)] uppercase tracking-wide">Locale / TZ</p>
                                <p className="text-sm font-medium mt-1">
                                  {server.locale} / {server.timezone}
                                </p>
                              </div>
                            </div>

                            {/* Subscription info */}
                            {serverDetails[server.id].subscription && (
                              <div className="nexus-card p-3 bg-white/[0.02] flex items-center gap-3">
                                <span className="text-base">💳</span>
                                <div className="flex-1">
                                  <p className="text-xs text-[var(--nexus-dim)]">Active Subscription</p>
                                  <p className="text-sm font-medium capitalize">
                                    {serverDetails[server.id].subscription!.tier} — {serverDetails[server.id].subscription!.status}
                                  </p>
                                </div>
                                {serverDetails[server.id].subscription!.expiry_date && (
                                  <p className="text-xs text-[var(--nexus-dim)]">
                                    Expires {new Date(serverDetails[server.id].subscription!.expiry_date).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap gap-3 items-end">
                              <div className="flex-1 min-w-[150px]">
                                <label className="text-[10px] text-[var(--nexus-dim)] uppercase tracking-wide block mb-1.5">Change Tier</label>
                                <select
                                  value={server.premium_tier}
                                  onChange={(e) => handleChangeTier(server.id, e.target.value)}
                                  className="w-full px-3 py-2 bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg text-sm focus:border-[var(--nexus-cyan)] outline-none transition-colors"
                                >
                                  <option value="free">Free</option>
                                  <option value="pro">Pro</option>
                                  <option value="plus">Plus</option>
                                  <option value="premium">Premium</option>
                                </select>
                              </div>
                              {server.is_active && (
                                <button
                                  onClick={() => handleMarkInactive(server.id)}
                                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--nexus-yellow)]/10 text-[var(--nexus-yellow)] border border-[var(--nexus-yellow)]/30 hover:bg-[var(--nexus-yellow)]/20 transition-colors"
                                >
                                  Mark Inactive
                                </button>
                              )}
                              <button
                                onClick={() => handleResetConfig(server.id)}
                                className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--nexus-red)]/10 text-[var(--nexus-red)] border border-[var(--nexus-red)]/30 hover:bg-[var(--nexus-red)]/20 transition-colors"
                              >
                                Reset Config
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--nexus-border)] text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:border-[var(--nexus-dim)] transition-colors disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[var(--nexus-dim)]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[var(--nexus-border)] text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:border-[var(--nexus-dim)] transition-colors disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════ INSIGHTS TAB ═══════ */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {insights ? (
            <>
              {/* Top-line stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="nexus-card p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--nexus-cyan)]">
                    {parseInt(insights.totals.total_guilds, 10).toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--nexus-dim)] mt-1">Total Servers</p>
                </div>
                <div className="nexus-card p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--nexus-blue)]">
                    {parseInt(insights.totals.total_members || '0', 10).toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--nexus-dim)] mt-1">Total Members</p>
                </div>
                <div className="nexus-card p-4 text-center">
                  <p className="text-2xl font-bold text-[var(--nexus-green)]">
                    {Math.round(parseFloat(insights.totals.avg_members || '0')).toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--nexus-dim)] mt-1">Avg Members/Server</p>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tier breakdown */}
                <div className="nexus-card p-6">
                  <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Tier Breakdown</h3>
                  <div className="space-y-3">
                    {insights.tiers.map((t) => {
                      const count = parseInt(t.count, 10);
                      const total = parseInt(insights.totals.total_guilds, 10);
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={t.premium_tier}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="capitalize font-medium" style={{ color: TIER_COLORS[t.premium_tier] || 'var(--nexus-text)' }}>
                              {t.premium_tier}
                            </span>
                            <span className="text-[var(--nexus-dim)]">
                              {count.toLocaleString()} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.max(2, pct)}%`,
                                backgroundColor: TIER_COLORS[t.premium_tier] || 'var(--nexus-cyan)',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Size distribution */}
                <div className="nexus-card p-6">
                  <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Server Size Distribution</h3>
                  <div className="space-y-3">
                    {insights.sizeDistribution.map((bucket) => {
                      const count = parseInt(bucket.count, 10);
                      const total = parseInt(insights.totals.total_guilds, 10);
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={bucket.size_bucket}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-medium">{bucket.size_bucket}</span>
                            <span className="text-[var(--nexus-dim)]">
                              {count.toLocaleString()} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--nexus-cyan)] transition-all"
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Top servers table */}
              <div className="nexus-card overflow-hidden">
                <div className="p-4 border-b border-[var(--nexus-border)]">
                  <h3 className="text-sm font-medium">Top Servers by Usage (30d)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--nexus-border)]">
                        <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">#</th>
                        <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Server</th>
                        <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Tier</th>
                        <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Members</th>
                        <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Commands</th>
                        <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topServers.map((s, i) => (
                        <tr key={s.guild_id} className="border-b border-[var(--nexus-border)]/50 hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-[var(--nexus-dim)]">{i + 1}</td>
                          <td className="px-4 py-3 font-medium">{s.guild_name || s.guild_id}</td>
                          <td className="px-4 py-3 capitalize" style={{ color: TIER_COLORS[s.premium_tier || 'free'] }}>
                            {s.premium_tier || 'free'}
                          </td>
                          <td className="px-4 py-3 text-right">{(s.member_count || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-[var(--nexus-cyan)]">
                            {parseInt(s.command_count, 10).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">{parseInt(s.unique_users, 10).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <SkeletonLoader />
          )}
        </div>
      )}

      {/* ═══════ ANNOUNCEMENTS TAB ═══════ */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          {/* Create form */}
          <div className="nexus-card p-6 space-y-4">
            <h3 className="text-sm font-medium text-[var(--nexus-dim)]">Create Announcement</h3>
            <input
              type="text"
              placeholder="Announcement title..."
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg text-sm placeholder-[var(--nexus-dim)] focus:border-[var(--nexus-cyan)] outline-none transition-colors"
            />
            <textarea
              placeholder="Announcement message..."
              value={announcementForm.message}
              onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg text-sm placeholder-[var(--nexus-dim)] focus:border-[var(--nexus-cyan)] outline-none transition-colors resize-none"
            />
            <div className="flex gap-3 items-center">
              <select
                value={announcementForm.type}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.value })}
                className="flex-1 px-3 py-2 bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg text-sm focus:border-[var(--nexus-cyan)] outline-none transition-colors"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="update">Update</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <button
                onClick={handlePostAnnouncement}
                disabled={postingAnnouncement}
                className="px-6 py-2 text-sm font-medium rounded-lg bg-[var(--nexus-cyan)] text-[var(--nexus-dark)] hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {postingAnnouncement ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>

          {/* Announcements list */}
          {announcements.length === 0 ? (
            <div className="nexus-card p-8 text-center">
              <span className="text-4xl mb-3 block">📢</span>
              <p className="text-[var(--nexus-dim)]">No announcements yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="nexus-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{ANNOUNCEMENT_TYPE_ICONS[ann.type] || '📢'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full"
                          style={{
                            color: ANNOUNCEMENT_TYPE_COLORS[ann.type] || 'var(--nexus-text)',
                            backgroundColor: `color-mix(in srgb, ${ANNOUNCEMENT_TYPE_COLORS[ann.type] || 'var(--nexus-text)'} 15%, transparent)`,
                          }}
                        >
                          {ann.type}
                        </span>
                        <span className="text-xs text-[var(--nexus-dim)]">
                          {new Date(ann.created_at).toLocaleDateString()} {new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm">{ann.title}</h4>
                      <p className="text-sm text-[var(--nexus-dim)] mt-1 whitespace-pre-wrap">{ann.message}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="text-[var(--nexus-dim)] hover:text-[var(--nexus-red)] transition-colors p-1"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
