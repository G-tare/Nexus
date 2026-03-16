'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface HealthOverview {
  uptime: number;
  uptimeFormatted: string;
  memory: { heapUsedMB: number; rssMB: number; heapTotal: number; rss: number };
  database: { latencyMs: number; status: string };
  commands: {
    commands_1h: string;
    commands_24h: string;
    errors_1h: string;
    errors_24h: string;
    avg_ms_1h: string;
  };
}

interface LatencySummary {
  avg_ms: string;
  p50: string;
  p95: string;
  p99: string;
  min_ms: string;
  max_ms: string;
  sample_count: string;
}

interface LatencyPoint {
  period: string;
  avg_ms: string;
  p95: string;
  count: string;
}

export default function HealthPage() {
  const [overview, setOverview] = useState<HealthOverview | null>(null);
  const [latency, setLatency] = useState<{ summary: LatencySummary; timeline: LatencyPoint[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, latencyRes] = await Promise.all([
        api.get('/owner/health/overview'),
        api.get('/owner/health/latency?hours=24'),
      ]);
      setOverview(overviewRes.data);
      setLatency(latencyRes.data);
    } catch (err) {
      console.error('Failed to fetch health data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading || !overview) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const errorRate1h = parseInt(overview.commands.commands_1h, 10) > 0
    ? ((parseInt(overview.commands.errors_1h, 10) / parseInt(overview.commands.commands_1h, 10)) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">💓 Health & Performance</h1>
        <p className="text-[var(--nexus-dim)]">Real-time monitoring of bot health, latency, and resource usage. Auto-refreshes every 30s.</p>
      </div>

      {/* Status banner */}
      <div className={`nexus-card p-4 mb-6 border-l-4 ${
        overview.database.status === 'healthy' && parseFloat(errorRate1h) < 5
          ? 'border-l-[var(--nexus-green)]' : 'border-l-[var(--nexus-yellow)]'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{overview.database.status === 'healthy' ? '✅' : '⚠️'}</span>
          <div>
            <p className="font-medium">
              {overview.database.status === 'healthy' && parseFloat(errorRate1h) < 5 ? 'All Systems Operational' : 'Degraded Performance'}
            </p>
            <p className="text-xs text-[var(--nexus-dim)]">Uptime: {overview.uptimeFormatted} • DB: {overview.database.latencyMs}ms</p>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Uptime" value={overview.uptimeFormatted} color="var(--nexus-green)" />
        <StatCard label="Commands (1h)" value={parseInt(overview.commands.commands_1h, 10).toLocaleString()} color="var(--nexus-cyan)" />
        <StatCard label="Avg Latency (1h)" value={overview.commands.avg_ms_1h ? `${overview.commands.avg_ms_1h}ms` : 'N/A'} color="var(--nexus-blue)" />
        <StatCard label="Error Rate (1h)" value={`${errorRate1h}%`} color={parseFloat(errorRate1h) > 5 ? 'var(--nexus-red)' : 'var(--nexus-green)'} />
      </div>

      {/* Memory & DB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="nexus-card p-6">
          <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Memory Usage</h3>
          <div className="space-y-3">
            <MemBar label="Heap Used" value={overview.memory.heapUsedMB} max={512} unit="MB" color="var(--nexus-cyan)" />
            <MemBar label="RSS" value={overview.memory.rssMB} max={1024} unit="MB" color="var(--nexus-blue)" />
          </div>
        </div>
        <div className="nexus-card p-6">
          <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Database</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--nexus-dim)]">Latency</p>
              <p className="text-2xl font-bold" style={{ color: overview.database.latencyMs < 50 ? 'var(--nexus-green)' : 'var(--nexus-yellow)' }}>
                {overview.database.latencyMs}ms
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--nexus-dim)]">Status</p>
              <p className="text-2xl font-bold text-[var(--nexus-green)] capitalize">{overview.database.status}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Latency percentiles */}
      {latency?.summary && (() => {
        const samples = parseInt(latency.summary.sample_count || '0', 10);
        const fmt = (v: string | null | undefined) => samples > 0 && v ? `${v}ms` : 'N/A';
        return (
          <div className="nexus-card p-6 mb-6">
            <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Command Latency (24h)</h3>
            {samples === 0 && (
              <p className="text-xs text-[var(--nexus-dim)] mb-3">No commands have been executed in the last 24 hours. Run some commands and check back.</p>
            )}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              <div>
                <p className="text-xs text-[var(--nexus-dim)]">Avg</p>
                <p className="text-lg font-bold">{fmt(latency.summary.avg_ms)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--nexus-dim)]">P50</p>
                <p className="text-lg font-bold">{fmt(latency.summary.p50)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--nexus-dim)]">P95</p>
                <p className="text-lg font-bold text-[var(--nexus-yellow)]">{fmt(latency.summary.p95)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--nexus-dim)]">P99</p>
                <p className="text-lg font-bold text-[var(--nexus-red)]">{fmt(latency.summary.p99)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--nexus-dim)]">Min</p>
                <p className="text-lg font-bold text-[var(--nexus-green)]">{fmt(latency.summary.min_ms)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--nexus-dim)]">Samples</p>
                <p className="text-lg font-bold">{samples.toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Commands summary */}
      <div className="nexus-card p-6">
        <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Command Volume</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[var(--nexus-dim)]">Last Hour</p>
            <p className="text-xl font-bold text-[var(--nexus-cyan)]">{parseInt(overview.commands.commands_1h, 10).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--nexus-dim)]">Last 24 Hours</p>
            <p className="text-xl font-bold text-[var(--nexus-blue)]">{parseInt(overview.commands.commands_24h, 10).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--nexus-dim)]">Errors (1h)</p>
            <p className="text-xl font-bold text-[var(--nexus-red)]">{parseInt(overview.commands.errors_1h, 10).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--nexus-dim)]">Errors (24h)</p>
            <p className="text-xl font-bold text-[var(--nexus-red)]">{parseInt(overview.commands.errors_24h, 10).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="nexus-card p-4">
      <p className="text-xs text-[var(--nexus-dim)]">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function MemBar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--nexus-dim)]">{label}</span>
        <span className="font-medium">{value} {unit}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
