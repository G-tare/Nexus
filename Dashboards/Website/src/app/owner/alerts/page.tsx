'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface AlertRule {
  id: number; name: string; metric_type: string; operator: string;
  threshold: number; webhook_url: string | null; discord_channel_id: string | null;
  enabled: boolean; created_at: string;
}

interface AlertHistoryItem {
  id: number; rule_id: number; triggered_at: string; value: number;
  message: string; resolved: boolean; rule_name: string; metric_type: string;
}

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMetric, setNewMetric] = useState('error_rate');
  const [newOp, setNewOp] = useState('>');
  const [newThreshold, setNewThreshold] = useState('');
  const [newWebhook, setNewWebhook] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, historyRes] = await Promise.all([
        api.get('/owner/alerts'),
        api.get('/owner/alerts/history?limit=20'),
      ]);
      setRules(rulesRes.data.rules);
      setHistory(historyRes.data.history);
    } catch (err) { console.error('Failed', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newName || !newThreshold) return;
    try {
      await api.post('/owner/alerts', {
        name: newName, metricType: newMetric, operator: newOp,
        threshold: parseFloat(newThreshold), webhookUrl: newWebhook || undefined,
      });
      setShowAdd(false); setNewName(''); setNewThreshold(''); setNewWebhook('');
      await fetchData();
    } catch (err) { console.error('Failed', err); }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try { await api.patch(`/owner/alerts/${id}`, { enabled: !enabled }); await fetchData(); }
    catch (err) { console.error('Failed', err); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this alert rule?')) return;
    try { await api.delete(`/owner/alerts/${id}`); await fetchData(); }
    catch (err) { console.error('Failed', err); }
  };

  if (loading) {
    return (<div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" /></div>);
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">🔔 Alerts & Notifications</h1>
          <p className="text-[var(--nexus-dim)]">Configure alert rules to get notified when metrics exceed thresholds.</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-[var(--nexus-cyan)] text-black rounded-lg text-sm font-medium hover:brightness-110 transition-all">+ New Alert Rule</button>
      </div>

      {showAdd && (
        <div className="nexus-card p-6 mb-6">
          <h3 className="text-sm font-medium mb-3">Create Alert Rule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Alert name" className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]" />
            <select value={newMetric} onChange={(e) => setNewMetric(e.target.value)} className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none">
              <option value="error_rate">Error Rate (%)</option>
              <option value="latency_p95">Latency P95 (ms)</option>
              <option value="commands_per_hour">Commands/Hour</option>
              <option value="memory_mb">Memory (MB)</option>
            </select>
            <select value={newOp} onChange={(e) => setNewOp(e.target.value)} className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none">
              <option value=">">Greater than</option>
              <option value="<">Less than</option>
              <option value=">=">Greater or equal</option>
              <option value="<=">Less or equal</option>
            </select>
            <input type="number" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} placeholder="Threshold" className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]" />
            <input type="text" value={newWebhook} onChange={(e) => setNewWebhook(e.target.value)} placeholder="Webhook URL (optional)" className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]" />
          </div>
          <button onClick={handleCreate} className="px-4 py-2 bg-[var(--nexus-cyan)] text-black rounded-lg text-sm font-medium">Create Rule</button>
        </div>
      )}

      <div className="nexus-card overflow-hidden mb-6">
        <div className="p-4 border-b border-[var(--nexus-border)]"><h3 className="text-sm font-medium">Alert Rules ({rules.length})</h3></div>
        {rules.length > 0 ? (
          <div className="divide-y divide-[var(--nexus-border)]/50">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4 flex items-center gap-4 hover:bg-white/[0.02]">
                <button onClick={() => handleToggle(rule.id, rule.enabled)} className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${rule.enabled ? 'bg-[var(--nexus-green)]' : 'bg-[var(--nexus-border)]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{rule.name}</p>
                  <p className="text-xs text-[var(--nexus-dim)]">{rule.metric_type} {rule.operator} {rule.threshold}</p>
                </div>
                <button onClick={() => handleDelete(rule.id)} className="text-[var(--nexus-dim)] hover:text-[var(--nexus-red)] transition-colors text-xs">Delete</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--nexus-dim)]">No alert rules configured</div>
        )}
      </div>

      <div className="nexus-card overflow-hidden">
        <div className="p-4 border-b border-[var(--nexus-border)]"><h3 className="text-sm font-medium">Alert History</h3></div>
        {history.length > 0 ? (
          <div className="divide-y divide-[var(--nexus-border)]/50">
            {history.map((item) => (
              <div key={item.id} className="p-3 flex items-center gap-3">
                <span className={`text-sm ${item.resolved ? 'text-[var(--nexus-green)]' : 'text-[var(--nexus-red)]'}`}>{item.resolved ? '✓' : '!'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{item.rule_name || `Rule #${item.rule_id}`}</p>
                  <p className="text-xs text-[var(--nexus-dim)]">{item.message}</p>
                </div>
                <span className="text-xs text-[var(--nexus-dim)]">{new Date(item.triggered_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-[var(--nexus-dim)]">No alerts triggered yet</div>
        )}
      </div>
    </div>
  );
}
