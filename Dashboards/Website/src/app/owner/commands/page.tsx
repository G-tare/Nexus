'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

/* ── Types ── */

interface CommandStat {
  command_name: string;
  subcommand_name: string | null;
  module_name: string;
  total_uses: string;
  success_count: string;
  error_count: string;
  avg_ms: string;
  unique_users: string;
  unique_guilds: string;
}

interface ModuleStat {
  module_name: string;
  total_uses: string;
  success_count: string;
  error_count: string;
  unique_commands: string;
  unique_users: string;
  unique_guilds: string;
  avg_ms: string;
}

interface TimelinePoint {
  period: string;
  total_uses: string;
  success_count: string;
  error_count: string;
  unique_users: string;
  active_guilds: string;
}

interface HeatmapPoint {
  day_of_week: number;
  hour: number;
  count: string;
}

interface UserStats {
  dau: string;
  wau: string;
  mau: string;
  daily_active_guilds: string;
  weekly_active_guilds: string;
  monthly_active_guilds: string;
  commands_24h: string;
  commands_7d: string;
  commands_30d: string;
}

interface PerformanceStat {
  command_name: string;
  subcommand_name: string | null;
  module_name: string;
  total_uses: string;
  avg_ms: string;
  p50_ms: string;
  p95_ms: string;
  p99_ms: string;
  min_ms: string;
  max_ms: string;
}

interface ErrorStat {
  command_name: string;
  subcommand_name: string | null;
  module_name: string;
  total_uses: string;
  error_count: string;
  error_rate: string;
}

/* ── Constants ── */

const DATE_RANGES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const TABS = ['overview', 'commands', 'modules', 'performance', 'errors'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, { label: string; icon: string }> = {
  overview: { label: 'Overview', icon: '📊' },
  commands: { label: 'Top Commands', icon: '⚡' },
  modules: { label: 'Modules', icon: '🧩' },
  performance: { label: 'Performance', icon: '⏱️' },
  errors: { label: 'Errors', icon: '⚠️' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ── Formatting helpers ── */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
  return Math.round(ms) + 'ms';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/* ── Main Page ── */

export default function CommandUsagePage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dateRange, setDateRange] = useState(30);
  const [loading, setLoading] = useState(true);

  // Data states
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [topCommands, setTopCommands] = useState<CommandStat[]>([]);
  const [modulesData, setModulesData] = useState<ModuleStat[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [performance, setPerformance] = useState<PerformanceStat[]>([]);
  const [errors, setErrors] = useState<ErrorStat[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(dateRange);
    const params = `from=${from}&to=${to}`;

    try {
      const [usersRes, topRes, modulesRes, timelineRes, heatmapRes, perfRes, errRes] = await Promise.all([
        api.get('/owner/commands/users'),
        api.get(`/owner/commands/top?${params}&limit=25`),
        api.get(`/owner/commands/modules?${params}`),
        api.get(`/owner/commands/timeline?${params}&granularity=${dateRange <= 1 ? 'hour' : 'day'}`),
        api.get(`/owner/commands/peak-hours?${params}`),
        api.get(`/owner/commands/performance?${params}&limit=25`),
        api.get(`/owner/commands/errors?${params}`),
      ]);

      setUserStats(usersRes.data);
      setTopCommands(topRes.data.commands);
      setModulesData(modulesRes.data.modules);
      setTimeline(timelineRes.data.timeline);
      setHeatmap(heatmapRes.data.heatmap);
      setPerformance(perfRes.data.commands);
      setErrors(errRes.data.commands);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">📈 Command Usage</h1>
          <p className="text-[var(--nexus-dim)]">
            Track and analyze command usage statistics across all servers.
          </p>
        </div>

        {/* Date range picker */}
        <div className="flex gap-1 bg-[var(--nexus-card)] rounded-lg p-1 border border-[var(--nexus-border)]">
          {DATE_RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDateRange(r.days)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                dateRange === r.days
                  ? 'bg-[var(--nexus-cyan)]/20 text-[var(--nexus-cyan)]'
                  : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] border border-[var(--nexus-cyan)]/30'
                : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
            }`}
          >
            <span>{TAB_LABELS[tab].icon}</span>
            {TAB_LABELS[tab].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <OverviewTab
              userStats={userStats}
              topCommands={topCommands}
              modulesData={modulesData}
              timeline={timeline}
              heatmap={heatmap}
            />
          )}
          {activeTab === 'commands' && <CommandsTab commands={topCommands} />}
          {activeTab === 'modules' && <ModulesTab modules={modulesData} />}
          {activeTab === 'performance' && <PerformanceTab commands={performance} />}
          {activeTab === 'errors' && <ErrorsTab commands={errors} />}
        </>
      )}
    </div>
  );
}

/* ── Overview Tab ── */

function OverviewTab({
  userStats,
  topCommands,
  modulesData,
  timeline,
  heatmap,
}: {
  userStats: UserStats | null;
  topCommands: CommandStat[];
  modulesData: ModuleStat[];
  timeline: TimelinePoint[];
  heatmap: HeatmapPoint[];
}) {
  if (!userStats) return null;

  const totalModuleUses = modulesData.reduce((s, m) => s + parseInt(m.total_uses, 10), 0);

  return (
    <div className="space-y-6">
      {/* Key metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Commands (24h)" value={formatNumber(parseInt(userStats.commands_24h, 10))} color="var(--nexus-cyan)" />
        <StatCard label="Commands (7d)" value={formatNumber(parseInt(userStats.commands_7d, 10))} color="var(--nexus-blue)" />
        <StatCard label="Active Users (DAU)" value={formatNumber(parseInt(userStats.dau, 10))} color="var(--nexus-green)" />
        <StatCard label="Active Guilds (DAG)" value={formatNumber(parseInt(userStats.daily_active_guilds, 10))} color="var(--nexus-purple)" />
      </div>

      {/* User metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="DAU" value={formatNumber(parseInt(userStats.dau, 10))} sub="Daily Active Users" color="var(--nexus-green)" />
        <StatCard label="WAU" value={formatNumber(parseInt(userStats.wau, 10))} sub="Weekly Active Users" color="var(--nexus-blue)" />
        <StatCard label="MAU" value={formatNumber(parseInt(userStats.mau, 10))} sub="Monthly Active Users" color="var(--nexus-purple)" />
      </div>

      {/* Timeline chart */}
      <div className="nexus-card p-6">
        <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Usage Timeline</h3>
        {timeline.length > 0 ? (
          <TimelineChart data={timeline} />
        ) : (
          <p className="text-center text-[var(--nexus-dim)] py-8">No data for this period</p>
        )}
      </div>

      {/* Two-column: top commands + module breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 commands */}
        <div className="nexus-card p-6">
          <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Top 10 Commands</h3>
          <div className="space-y-2">
            {topCommands.slice(0, 10).map((cmd, i) => {
              const uses = parseInt(cmd.total_uses, 10);
              const maxUses = parseInt(topCommands[0]?.total_uses || '1', 10);
              const pct = Math.max(5, (uses / maxUses) * 100);
              return (
                <div key={`${cmd.command_name}-${cmd.subcommand_name}`} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--nexus-dim)] w-5 text-right">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">
                        /{cmd.command_name}
                        {cmd.subcommand_name && <span className="text-[var(--nexus-dim)]"> {cmd.subcommand_name}</span>}
                      </span>
                      <span className="text-sm font-bold text-[var(--nexus-cyan)] ml-2">{formatNumber(uses)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--nexus-cyan)]"
                        style={{ width: `${pct}%`, opacity: 0.3 + (0.7 * pct) / 100 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {topCommands.length === 0 && (
              <p className="text-center text-[var(--nexus-dim)] py-4">No commands recorded yet</p>
            )}
          </div>
        </div>

        {/* Module breakdown */}
        <div className="nexus-card p-6">
          <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Module Breakdown</h3>
          <div className="space-y-2">
            {modulesData.slice(0, 10).map((mod) => {
              const uses = parseInt(mod.total_uses, 10);
              const pct = totalModuleUses > 0 ? (uses / totalModuleUses) * 100 : 0;
              return (
                <div key={mod.module_name} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize truncate">{mod.module_name}</span>
                      <div className="flex items-center gap-3 ml-2">
                        <span className="text-xs text-[var(--nexus-dim)]">{pct.toFixed(1)}%</span>
                        <span className="text-sm font-bold text-[var(--nexus-blue)]">{formatNumber(uses)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--nexus-blue)]"
                        style={{ width: `${Math.max(3, pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {modulesData.length === 0 && (
              <p className="text-center text-[var(--nexus-dim)] py-4">No module data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Peak hours heatmap */}
      <div className="nexus-card p-6">
        <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Peak Usage Hours</h3>
        {heatmap.length > 0 ? (
          <HeatmapGrid data={heatmap} />
        ) : (
          <p className="text-center text-[var(--nexus-dim)] py-8">No data for this period</p>
        )}
      </div>
    </div>
  );
}

/* ── Commands Tab ── */

function CommandsTab({ commands }: { commands: CommandStat[] }) {
  return (
    <div className="nexus-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--nexus-border)]">
              <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">#</th>
              <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Command</th>
              <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Module</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Uses</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Success</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Errors</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Avg Time</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Users</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Guilds</th>
            </tr>
          </thead>
          <tbody>
            {commands.map((cmd, i) => (
              <tr key={`${cmd.command_name}-${cmd.subcommand_name}`} className="border-b border-[var(--nexus-border)]/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-[var(--nexus-dim)]">{i + 1}</td>
                <td className="px-4 py-3 font-medium">
                  /{cmd.command_name}
                  {cmd.subcommand_name && <span className="text-[var(--nexus-dim)]"> {cmd.subcommand_name}</span>}
                </td>
                <td className="px-4 py-3 text-[var(--nexus-dim)] capitalize">{cmd.module_name}</td>
                <td className="px-4 py-3 text-right font-bold text-[var(--nexus-cyan)]">{formatNumber(parseInt(cmd.total_uses, 10))}</td>
                <td className="px-4 py-3 text-right text-[var(--nexus-green)]">{formatNumber(parseInt(cmd.success_count, 10))}</td>
                <td className="px-4 py-3 text-right text-[var(--nexus-red)]">
                  {parseInt(cmd.error_count, 10) > 0 ? formatNumber(parseInt(cmd.error_count, 10)) : '—'}
                </td>
                <td className="px-4 py-3 text-right">{formatMs(parseInt(cmd.avg_ms, 10))}</td>
                <td className="px-4 py-3 text-right">{formatNumber(parseInt(cmd.unique_users, 10))}</td>
                <td className="px-4 py-3 text-right">{formatNumber(parseInt(cmd.unique_guilds, 10))}</td>
              </tr>
            ))}
            {commands.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[var(--nexus-dim)]">
                  No command data recorded yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Modules Tab ── */

function ModulesTab({ modules }: { modules: ModuleStat[] }) {
  const totalUses = modules.reduce((s, m) => s + parseInt(m.total_uses, 10), 0);

  return (
    <div className="space-y-6">
      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const uses = parseInt(mod.total_uses, 10);
          const errCount = parseInt(mod.error_count, 10);
          const errRate = uses > 0 ? ((errCount / uses) * 100).toFixed(1) : '0';
          const pct = totalUses > 0 ? ((uses / totalUses) * 100).toFixed(1) : '0';

          return (
            <div key={mod.module_name} className="nexus-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium capitalize">{mod.module_name}</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)]">
                  {pct}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[var(--nexus-dim)]">Uses</p>
                  <p className="text-lg font-bold text-[var(--nexus-cyan)]">{formatNumber(uses)}</p>
                </div>
                <div>
                  <p className="text-[var(--nexus-dim)]">Avg Time</p>
                  <p className="text-lg font-bold">{formatMs(parseInt(mod.avg_ms, 10))}</p>
                </div>
                <div>
                  <p className="text-[var(--nexus-dim)]">Users</p>
                  <p className="font-semibold">{formatNumber(parseInt(mod.unique_users, 10))}</p>
                </div>
                <div>
                  <p className="text-[var(--nexus-dim)]">Error Rate</p>
                  <p className={`font-semibold ${parseFloat(errRate) > 5 ? 'text-[var(--nexus-red)]' : 'text-[var(--nexus-green)]'}`}>
                    {errRate}%
                  </p>
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--nexus-dim)]">
                {mod.unique_commands} commands • {formatNumber(parseInt(mod.unique_guilds, 10))} guilds
              </div>
            </div>
          );
        })}
      </div>
      {modules.length === 0 && (
        <div className="nexus-card p-12 text-center">
          <p className="text-[var(--nexus-dim)]">No module data recorded yet</p>
        </div>
      )}
    </div>
  );
}

/* ── Performance Tab ── */

function PerformanceTab({ commands }: { commands: PerformanceStat[] }) {
  return (
    <div className="nexus-card overflow-hidden">
      <div className="p-4 border-b border-[var(--nexus-border)]">
        <p className="text-xs text-[var(--nexus-dim)]">
          Showing commands with 5+ executions, sorted by average execution time (slowest first).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--nexus-border)]">
              <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Command</th>
              <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Module</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Uses</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Avg</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">P50</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">P95</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">P99</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Min</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Max</th>
            </tr>
          </thead>
          <tbody>
            {commands.map((cmd) => {
              const avgMs = parseInt(cmd.avg_ms, 10);
              const color = avgMs > 2000 ? 'var(--nexus-red)' : avgMs > 500 ? 'var(--nexus-yellow)' : 'var(--nexus-green)';
              return (
                <tr key={`${cmd.command_name}-${cmd.subcommand_name}`} className="border-b border-[var(--nexus-border)]/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    /{cmd.command_name}
                    {cmd.subcommand_name && <span className="text-[var(--nexus-dim)]"> {cmd.subcommand_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--nexus-dim)] capitalize">{cmd.module_name}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(parseInt(cmd.total_uses, 10))}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color }}>{formatMs(avgMs)}</td>
                  <td className="px-4 py-3 text-right">{formatMs(parseInt(cmd.p50_ms, 10))}</td>
                  <td className="px-4 py-3 text-right">{formatMs(parseInt(cmd.p95_ms, 10))}</td>
                  <td className="px-4 py-3 text-right">{formatMs(parseInt(cmd.p99_ms, 10))}</td>
                  <td className="px-4 py-3 text-right text-[var(--nexus-green)]">{formatMs(parseInt(cmd.min_ms, 10))}</td>
                  <td className="px-4 py-3 text-right text-[var(--nexus-red)]">{formatMs(parseInt(cmd.max_ms, 10))}</td>
                </tr>
              );
            })}
            {commands.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-[var(--nexus-dim)]">
                  Not enough data yet (commands need 5+ executions to appear here)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Errors Tab ── */

function ErrorsTab({ commands }: { commands: ErrorStat[] }) {
  return (
    <div className="nexus-card overflow-hidden">
      <div className="p-4 border-b border-[var(--nexus-border)]">
        <p className="text-xs text-[var(--nexus-dim)]">
          Commands that have encountered errors, sorted by error count.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--nexus-border)]">
              <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Command</th>
              <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Module</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Total Uses</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Errors</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Error Rate</th>
            </tr>
          </thead>
          <tbody>
            {commands.map((cmd) => {
              const rate = parseFloat(cmd.error_rate);
              const color = rate > 20 ? 'var(--nexus-red)' : rate > 5 ? 'var(--nexus-yellow)' : 'var(--nexus-dim)';
              return (
                <tr key={`${cmd.command_name}-${cmd.subcommand_name}`} className="border-b border-[var(--nexus-border)]/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    /{cmd.command_name}
                    {cmd.subcommand_name && <span className="text-[var(--nexus-dim)]"> {cmd.subcommand_name}</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--nexus-dim)] capitalize">{cmd.module_name}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(parseInt(cmd.total_uses, 10))}</td>
                  <td className="px-4 py-3 text-right font-bold text-[var(--nexus-red)]">{formatNumber(parseInt(cmd.error_count, 10))}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color }}>
                    {rate.toFixed(1)}%
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden inline-block ml-2 align-middle">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, rate)}%`, backgroundColor: color }} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {commands.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[var(--nexus-green)]">
                  No errors recorded — all commands running cleanly!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Shared Components ── */

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="nexus-card p-4">
      <p className="text-xs text-[var(--nexus-dim)] mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--nexus-dim)] mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Timeline Chart (CSS-based bar chart) ── */

function TimelineChart({ data }: { data: TimelinePoint[] }) {
  const maxUses = Math.max(...data.map((d) => parseInt(d.total_uses, 10)), 1);

  // Show last ~30 bars max for readability
  const displayData = data.length > 30 ? data.slice(-30) : data;

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: 160 }}>
        {displayData.map((point, i) => {
          const total = parseInt(point.total_uses, 10);
          const errors = parseInt(point.error_count, 10);
          const successHeight = ((total - errors) / maxUses) * 100;
          const errorHeight = (errors / maxUses) * 100;

          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end min-w-[4px] group relative"
              style={{ height: '100%' }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg p-2 text-xs whitespace-nowrap shadow-lg">
                  <p className="font-medium">{formatDate(point.period)}</p>
                  <p className="text-[var(--nexus-cyan)]">{formatNumber(total)} commands</p>
                  <p className="text-[var(--nexus-dim)]">{point.unique_users} users</p>
                  {errors > 0 && <p className="text-[var(--nexus-red)]">{errors} errors</p>}
                </div>
              </div>
              {/* Bars */}
              {errorHeight > 0 && (
                <div
                  className="w-full rounded-t-sm bg-[var(--nexus-red)]/60"
                  style={{ height: `${errorHeight}%` }}
                />
              )}
              <div
                className="w-full bg-[var(--nexus-cyan)] rounded-t-sm"
                style={{ height: `${successHeight}%`, opacity: 0.4 + (0.6 * total) / maxUses }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-[10px] text-[var(--nexus-dim)]">
        <span>{displayData.length > 0 ? formatDate(displayData[0].period) : ''}</span>
        <span>{displayData.length > 0 ? formatDate(displayData[displayData.length - 1].period) : ''}</span>
      </div>
    </div>
  );
}

/* ── Heatmap Grid ── */

function HeatmapGrid({ data }: { data: HeatmapPoint[] }) {
  const maxCount = Math.max(...data.map((d) => parseInt(d.count, 10)), 1);

  // Build 7x24 grid
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const point of data) {
    grid[point.day_of_week][point.hour] = parseInt(point.count, 10);
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex mb-1 pl-10">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-[var(--nexus-dim)]">
              {h % 3 === 0 ? `${h}` : ''}
            </div>
          ))}
        </div>
        {/* Grid rows */}
        {grid.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-1 mb-[2px]">
            <span className="w-8 text-right text-[10px] text-[var(--nexus-dim)] mr-1">{DAY_NAMES[dayIdx]}</span>
            <div className="flex-1 flex gap-[2px]">
              {row.map((count, hourIdx) => {
                const intensity = maxCount > 0 ? count / maxCount : 0;
                return (
                  <div
                    key={hourIdx}
                    className="flex-1 aspect-square rounded-sm group relative"
                    style={{
                      backgroundColor: count === 0
                        ? 'rgba(255,255,255,0.03)'
                        : `rgba(0, 212, 255, ${0.1 + intensity * 0.8})`,
                    }}
                    title={`${DAY_NAMES[dayIdx]} ${hourIdx}:00 — ${count} commands`}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-[var(--nexus-dim)]">
          <span>Less</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
            <div
              key={o}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `rgba(0, 212, 255, ${o})` }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
