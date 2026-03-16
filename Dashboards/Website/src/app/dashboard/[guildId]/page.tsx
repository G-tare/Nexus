'use client';

import { useParams } from 'next/navigation';
import { useGuildStore } from '@/stores/guild';
import { formatNumber, formatDuration } from '@/lib/utils';
import { MODULE_REGISTRY } from '@/lib/types';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import type { ActivityPoint, ModCase } from '@/lib/types';

export default function OverviewPage() {
  const { guildId } = useParams() as { guildId: string };
  const { stats, modules, isLoadingGuild } = useGuildStore();
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [period, setPeriod] = useState('7d');
  const [recentActions, setRecentActions] = useState<ModCase[]>([]);

  useEffect(() => {
    api.get(`/guilds/${guildId}/activity?period=${period}`)
      .then(({ data }) => setActivity(data.points || []))
      .catch(() => {});
  }, [guildId, period]);

  useEffect(() => {
    api.get(`/guilds/${guildId}/modlogs?limit=8`)
      .then(({ data }) => setRecentActions(data.cases || []))
      .catch(() => {});
  }, [guildId]);

  const enabledModules = Object.values(modules).filter((m) => m.enabled).length;
  const totalModules = MODULE_REGISTRY.length;

  if (isLoadingGuild) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Server Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Members" value={formatNumber(stats?.totalMembers || 0)} icon="👥" color="cyan" />
        <StatCard label="Messages" value={formatNumber(stats?.totalMessages || 0)} icon="💬" color="blue" />
        <StatCard label="Voice Time" value={formatDuration(stats?.totalVoiceMinutes || 0)} icon="🎙️" color="purple" />
        <StatCard label="Modules" value={`${enabledModules}/${totalModules}`} icon="🧩" color="green" />
      </div>

      {/* Activity chart placeholder */}
      <div className="nexus-card p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Activity</h2>
          <div className="flex gap-1">
            {['24h', '7d', '30d'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  period === p
                    ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)]'
                    : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {activity.length > 0 ? (
          <div className="h-48 flex items-end gap-1">
            {activity.map((point, i) => {
              const maxVal = Math.max(...activity.map((a) => a.messages), 1);
              const height = (point.messages / maxVal) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-[var(--nexus-cyan)]/20 rounded-t-sm hover:bg-[var(--nexus-cyan)]/40 transition-colors relative group"
                    style={{ height: `${Math.max(height, 4)}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[var(--nexus-card)] border border-[var(--nexus-border)] rounded px-2 py-1 text-xs hidden group-hover:block whitespace-nowrap z-10">
                      {point.messages} msgs
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--nexus-dim)]">{point.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-[var(--nexus-dim)]">
            No activity data yet
          </div>
        )}
      </div>

      {/* Quick stats + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="nexus-card p-6">
          <h2 className="font-semibold mb-3">Levels</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--nexus-dim)]">Average Level</span>
              <span className="font-medium">{stats?.averageLevel || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--nexus-dim)]">Highest Level</span>
              <span className="font-medium">{stats?.highestLevel || 0}</span>
            </div>
          </div>
        </div>
        <div className="nexus-card p-6">
          <h2 className="font-semibold mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <a href={`/dashboard/${guildId}/modules`} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 transition-colors">Configure Modules</a>
            <a href={`/dashboard/${guildId}/leaderboards`} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 transition-colors">View Leaderboards</a>
            <a href={`/dashboard/${guildId}/modlogs`} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 transition-colors">Mod Logs</a>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="nexus-card p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent Activity</h2>
          <a href={`/dashboard/${guildId}/modlogs`} className="text-xs text-[var(--nexus-cyan)] hover:underline">View all</a>
        </div>
        {recentActions.length > 0 ? (
          <div className="space-y-0">
            {recentActions.map((action) => (
              <RecentActionRow key={action.id} action={action} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--nexus-dim)] text-center py-6">No recent moderation activity</p>
        )}
      </div>
    </div>
  );
}

const ACTION_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  warn: { color: 'var(--nexus-yellow)', icon: '⚠️', label: 'Warned' },
  mute: { color: 'var(--nexus-purple)', icon: '🔇', label: 'Muted' },
  unmute: { color: 'var(--nexus-green)', icon: '🔊', label: 'Unmuted' },
  kick: { color: 'var(--nexus-red)', icon: '👢', label: 'Kicked' },
  ban: { color: 'var(--nexus-red)', icon: '🔨', label: 'Banned' },
  unban: { color: 'var(--nexus-green)', icon: '✅', label: 'Unbanned' },
  tempban: { color: 'var(--nexus-red)', icon: '⏳', label: 'Temp Banned' },
  softban: { color: 'var(--nexus-red)', icon: '🧹', label: 'Softbanned' },
  note: { color: 'var(--nexus-dim)', icon: '📝', label: 'Note' },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function RecentActionRow({ action }: { action: ModCase }) {
  const style = ACTION_STYLES[action.action] || { color: 'var(--nexus-dim)', icon: '❓', label: action.action };
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--nexus-border)]/50 last:border-0">
      <span className="text-base w-6 text-center flex-shrink-0">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium" style={{ color: style.color }}>{style.label}</span>
          {' '}
          <span className="text-[var(--nexus-dim)]">{action.username || action.userId}</span>
          {action.reason && (
            <span className="text-[var(--nexus-dim)]"> — {action.reason.length > 50 ? action.reason.slice(0, 50) + '…' : action.reason}</span>
          )}
        </p>
        <p className="text-[10px] text-[var(--nexus-dim)]">
          by {action.moderatorUsername || action.moderatorId} · {timeAgo(action.createdAt)}
        </p>
      </div>
      <span className="text-xs text-[var(--nexus-dim)] flex-shrink-0 font-mono">#{action.caseNumber}</span>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    cyan: 'var(--nexus-cyan)',
    blue: 'var(--nexus-blue)',
    purple: 'var(--nexus-purple)',
    green: 'var(--nexus-green)',
  };

  return (
    <div className="nexus-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-[var(--nexus-dim)] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: colorMap[color] || 'var(--nexus-text)' }}>
        {value}
      </p>
    </div>
  );
}
