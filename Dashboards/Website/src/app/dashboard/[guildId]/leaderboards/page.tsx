'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { formatNumber, getAvatarUrl } from '@/lib/utils';

const BOARD_TYPES = [
  { key: 'xp', label: 'XP', icon: '⭐', field: 'totalXp' },
  { key: 'level', label: 'Level', icon: '📊', field: 'level' },
  { key: 'messages', label: 'Messages', icon: '💬', field: 'totalMessages' },
  { key: 'coins', label: 'Coins', icon: '💰', field: 'coins' },
  { key: 'voice', label: 'Voice', icon: '🎙️', field: 'totalVoiceMinutes' },
  { key: 'invites', label: 'Invites', icon: '🔗', field: 'inviteCount' },
  { key: 'reputation', label: 'Reputation', icon: '🌟', field: 'reputation' },
];

interface LeaderboardRow {
  userId: string;
  username: string | null;
  globalName: string | null;
  avatarUrl: string | null;
  level: number;
  totalXp: number;
  coins: number;
  totalMessages: number;
  totalVoiceMinutes: number;
  inviteCount: number;
  reputation: number;
}

function getValueForType(row: LeaderboardRow, type: string): number {
  const info = BOARD_TYPES.find((b) => b.key === type);
  if (!info) return 0;
  const val = (row as unknown as Record<string, unknown>)[info.field];
  return typeof val === 'number' ? val : Number(val) || 0;
}

function formatVoice(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatVal(type: string, val: number): string {
  return type === 'voice' ? formatVoice(val) : formatNumber(val);
}

const RANK_STYLES: Record<number, { bg: string; border: string; text: string; medal: string }> = {
  1: { bg: 'bg-[var(--nexus-yellow)]/[0.06]', border: 'border-l-[var(--nexus-yellow)]', text: 'text-[var(--nexus-yellow)]', medal: '🥇' },
  2: { bg: 'bg-gray-400/[0.04]', border: 'border-l-gray-400', text: 'text-gray-300', medal: '🥈' },
  3: { bg: 'bg-orange-400/[0.04]', border: 'border-l-orange-400', text: 'text-orange-400', medal: '🥉' },
};

export default function LeaderboardsPage() {
  const { guildId } = useParams() as { guildId: string };
  const [type, setType] = useState('xp');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const LIMIT = 25;

  useEffect(() => {
    setLoading(true);
    api.get(`/users/${guildId}/leaderboard/${type}?page=${page}&limit=${LIMIT}`)
      .then(({ data }) => {
        const fetched: LeaderboardRow[] = data.leaderboard || [];
        setRows(fetched);
        setHasMore(fetched.length >= LIMIT);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [guildId, type, page]);

  const boardInfo = BOARD_TYPES.find((b) => b.key === type);

  // Top 3 for the highlight banner (only on page 1)
  const topThree = page === 1 ? rows.slice(0, 3) : [];
  const remaining = page === 1 ? rows.slice(3) : rows;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Leaderboards</h1>
      <p className="text-[var(--nexus-dim)] mb-6">See who&apos;s on top across different categories.</p>

      {/* Type selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {BOARD_TYPES.map((b) => (
          <button
            key={b.key}
            onClick={() => { setType(b.key); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              type === b.key
                ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] border border-[var(--nexus-cyan)]/30'
                : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] border border-transparent'
            }`}
          >
            <span>{b.icon}</span> {b.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="nexus-card flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="nexus-card text-center py-20 text-[var(--nexus-dim)]">
          No data yet for this leaderboard.
        </div>
      ) : (
        <>
          {/* Top 3 — horizontal banner with large avatars */}
          {topThree.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {topThree.map((row, i) => {
                const rank = i + 1;
                const style = RANK_STYLES[rank];
                const val = getValueForType(row, type);
                const displayName = row.username || row.userId;
                const avatarSrc = row.avatarUrl || getAvatarUrl(row.userId, null, 128);
                const topVal = getValueForType(topThree[0], type);
                const barPct = topVal > 0 ? (val / topVal) * 100 : 0;

                return (
                  <div
                    key={row.userId}
                    className={`nexus-card p-5 border-l-4 ${style.border} ${style.bg} relative overflow-hidden`}
                  >
                    {/* Background bar showing relative value */}
                    <div
                      className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent opacity-30"
                      style={{ width: `${barPct}%`, background: `linear-gradient(to right, transparent, var(--nexus-cyan))` }}
                    />

                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={avatarSrc}
                          alt=""
                          className="w-14 h-14 rounded-full"
                        />
                        <span className="absolute -top-1 -left-1 text-lg">{style.medal}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{displayName}</p>
                        <p className={`text-xl font-bold ${style.text}`}>
                          {formatVal(type, val)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Remaining entries — clean table */}
          <div className="nexus-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--nexus-border)]">
                  <th className="text-left py-3 px-5 text-xs text-[var(--nexus-dim)] font-medium w-16">Rank</th>
                  <th className="text-left py-3 px-5 text-xs text-[var(--nexus-dim)] font-medium">User</th>
                  <th className="text-right py-3 px-5 text-xs text-[var(--nexus-dim)] font-medium w-32">{boardInfo?.label}</th>
                  <th className="text-right py-3 px-5 text-xs text-[var(--nexus-dim)] font-medium w-40">Progress</th>
                </tr>
              </thead>
              <tbody>
                {remaining.map((row, i) => {
                  const rank = page === 1 ? i + 4 : (page - 1) * LIMIT + i + 1;
                  const val = getValueForType(row, type);
                  const displayName = row.username || row.userId;
                  const avatarSrc = row.avatarUrl || getAvatarUrl(row.userId, null, 64);
                  // Progress bar relative to #1 on page 1, or first on current page
                  const maxVal = page === 1 && topThree.length > 0
                    ? getValueForType(topThree[0], type)
                    : remaining.length > 0 ? getValueForType(remaining[0], type) : 1;
                  const barPct = maxVal > 0 ? Math.max(2, (val / maxVal) * 100) : 0;

                  return (
                    <tr
                      key={row.userId}
                      className="border-b border-[var(--nexus-border)]/50 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-5">
                        <span className="text-sm font-bold text-[var(--nexus-dim)]">{rank}</span>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <img src={avatarSrc} alt="" className="w-9 h-9 rounded-full" />
                          <span className="text-sm font-medium">{displayName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <span className="text-sm font-semibold text-[var(--nexus-cyan)]">
                          {formatVal(type, val)}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <div className="w-full h-2 bg-[var(--nexus-border)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--nexus-blue)] to-[var(--nexus-cyan)] transition-all duration-300"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {(page > 1 || hasMore) && (
              <div className="flex items-center justify-center gap-3 p-4 border-t border-[var(--nexus-border)]">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-[var(--nexus-dim)]">Page {page}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!hasMore}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
