'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface DbInfo {
  database: { sizeBytes: number; sizeMB: string; activeConnections: number };
  tables: { name: string; sizeMB: string; rowCount: number }[];
}

interface SystemInfo {
  nodeVersion: string; platform: string; arch: string; pid: number;
  uptime: number; memory: { heapUsedMB: string; heapTotalMB: string; rssMB: string };
  env: string;
}

export default function InfrastructurePage() {
  const [db, setDb] = useState<DbInfo | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dbRes, sysRes] = await Promise.all([
        api.get('/owner/infrastructure/db'),
        api.get('/owner/infrastructure/system'),
      ]);
      setDb(dbRes.data);
      setSystem(sysRes.data);
    } catch (err) { console.error('Failed', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !db || !system) {
    return (<div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" /></div>);
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🖥️ Infrastructure</h1>
        <p className="text-[var(--nexus-dim)]">Monitor database, system resources, and infrastructure status.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="nexus-card p-4"><p className="text-xs text-[var(--nexus-dim)]">DB Size</p><p className="text-2xl font-bold text-[var(--nexus-cyan)]">{db.database.sizeMB} MB</p></div>
        <div className="nexus-card p-4"><p className="text-xs text-[var(--nexus-dim)]">Active Connections</p><p className="text-2xl font-bold text-[var(--nexus-green)]">{db.database.activeConnections}</p></div>
        <div className="nexus-card p-4"><p className="text-xs text-[var(--nexus-dim)]">Heap Used</p><p className="text-2xl font-bold text-[var(--nexus-blue)]">{system.memory.heapUsedMB} MB</p></div>
        <div className="nexus-card p-4"><p className="text-xs text-[var(--nexus-dim)]">RSS</p><p className="text-2xl font-bold text-[var(--nexus-purple)]">{system.memory.rssMB} MB</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="nexus-card p-6">
          <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">System Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--nexus-dim)]">Node.js</span><span>{system.nodeVersion}</span></div>
            <div className="flex justify-between"><span className="text-[var(--nexus-dim)]">Platform</span><span>{system.platform} ({system.arch})</span></div>
            <div className="flex justify-between"><span className="text-[var(--nexus-dim)]">Environment</span><span className="capitalize">{system.env}</span></div>
            <div className="flex justify-between"><span className="text-[var(--nexus-dim)]">PID</span><span>{system.pid}</span></div>
            <div className="flex justify-between"><span className="text-[var(--nexus-dim)]">Process Uptime</span><span>{Math.floor(system.uptime / 3600)}h {Math.floor((system.uptime % 3600) / 60)}m</span></div>
          </div>
        </div>

        <div className="nexus-card p-6">
          <h3 className="text-sm font-medium text-[var(--nexus-dim)] mb-4">Memory</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="text-[var(--nexus-dim)]">Heap</span><span>{system.memory.heapUsedMB} / {system.memory.heapTotalMB} MB</span></div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full rounded-full bg-[var(--nexus-cyan)]" style={{ width: `${(parseFloat(system.memory.heapUsedMB) / parseFloat(system.memory.heapTotalMB)) * 100}%` }} /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="nexus-card overflow-hidden">
        <div className="p-4 border-b border-[var(--nexus-border)]"><h3 className="text-sm font-medium">Database Tables (by size)</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--nexus-border)]">
              <th className="text-left px-4 py-3 text-[var(--nexus-dim)] font-medium">Table</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Size</th>
              <th className="text-right px-4 py-3 text-[var(--nexus-dim)] font-medium">Rows</th>
            </tr></thead>
            <tbody>
              {db.tables.map((t) => (
                <tr key={t.name} className="border-b border-[var(--nexus-border)]/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-right">{t.sizeMB} MB</td>
                  <td className="px-4 py-3 text-right text-[var(--nexus-dim)]">{t.rowCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
