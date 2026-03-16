'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { MODULE_REGISTRY } from '@/lib/types';

/* ── Types ── */

interface GlobalToggle {
  module_name: string;
  enabled: boolean;
  reason: string | null;
  reason_detail: string | null;
  disabled_by: string | null;
  updated_at: string | null;
}

interface ServerBan {
  id: number;
  guild_id: string;
  module_name: string;
  reason: string | null;
  reason_detail: string | null;
  banned_by: string;
  created_at: string;
}

/* ── Constants ── */

const REASONS = [
  { value: 'update', label: 'Undergoing Updates' },
  { value: 'glitch', label: 'Known Glitch' },
  { value: 'issue', label: 'Technical Issue' },
  { value: 'misuse', label: 'Abuse / Misuse Prevention' },
];

/* ── Page ── */

export default function GlobalModuleToggles() {
  const [toggles, setToggles] = useState<GlobalToggle[]>([]);
  const [serverBans, setServerBans] = useState<ServerBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'toggles' | 'bans'>('toggles');

  // Disable modal state
  const [disableModal, setDisableModal] = useState<string | null>(null);
  const [disableReason, setDisableReason] = useState('glitch');
  const [disableDetail, setDisableDetail] = useState('');

  // Server ban form state
  const [banGuildId, setBanGuildId] = useState('');
  const [banModule, setBanModule] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDetail, setBanDetail] = useState('');
  const [banError, setBanError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [togglesRes, bansRes] = await Promise.all([
        api.get('/owner/toggles'),
        api.get('/owner/server-bans?limit=100'),
      ]);
      setToggles(togglesRes.data.toggles);
      setServerBans(bansRes.data.bans);
    } catch (err) {
      console.error('Failed to fetch module data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build a map of module_name -> toggle state
  const toggleMap: Record<string, GlobalToggle> = {};
  for (const t of toggles) {
    toggleMap[t.module_name] = t;
  }

  const handleToggle = async (moduleName: string, currentlyEnabled: boolean) => {
    if (currentlyEnabled) {
      // Disabling — show modal for reason
      setDisableModal(moduleName);
      setDisableReason('glitch');
      setDisableDetail('');
    } else {
      // Re-enabling
      try {
        await api.patch(`/owner/toggles/${moduleName}`, { enabled: true });
        await fetchData();
      } catch (err) {
        console.error('Failed to enable module', err);
      }
    }
  };

  const confirmDisable = async () => {
    if (!disableModal) return;
    try {
      await api.patch(`/owner/toggles/${disableModal}`, {
        enabled: false,
        reason: disableReason,
        reasonDetail: disableDetail || undefined,
      });
      setDisableModal(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to disable module', err);
    }
  };

  const handleAddBan = async () => {
    if (!banGuildId.trim() || !banModule.trim()) {
      setBanError('Guild ID and module are required');
      return;
    }
    if (!/^\d{17,20}$/.test(banGuildId.trim())) {
      setBanError('Invalid Guild ID format');
      return;
    }

    setBanError('');
    try {
      await api.post(`/owner/server-bans/${banGuildId.trim()}/${banModule}`, {
        reason: banReason || undefined,
        reasonDetail: banDetail || undefined,
      });
      setBanGuildId('');
      setBanModule('');
      setBanReason('');
      setBanDetail('');
      await fetchData();
    } catch (err: any) {
      setBanError(err.response?.data?.error || 'Failed to add ban');
    }
  };

  const handleRemoveBan = async (guildId: string, moduleName: string) => {
    try {
      await api.delete(`/owner/server-bans/${guildId}/${moduleName}`);
      await fetchData();
    } catch (err) {
      console.error('Failed to remove ban', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate stats
  const disabledCount = MODULE_REGISTRY.filter((m) => toggleMap[m.key] && !toggleMap[m.key].enabled).length;

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🧩 Global Modules</h1>
        <p className="text-[var(--nexus-dim)]">
          Manage global module toggles and per-server module restrictions.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Total Modules</p>
          <p className="text-2xl font-bold text-[var(--nexus-cyan)]">{MODULE_REGISTRY.length}</p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Globally Disabled</p>
          <p className="text-2xl font-bold text-[var(--nexus-red)]">{disabledCount}</p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Server Bans</p>
          <p className="text-2xl font-bold text-[var(--nexus-yellow)]">{serverBans.length}</p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Active Modules</p>
          <p className="text-2xl font-bold text-[var(--nexus-green)]">{MODULE_REGISTRY.length - disabledCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('toggles')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'toggles'
              ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] border border-[var(--nexus-cyan)]/30'
              : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
          }`}
        >
          Global Toggles
        </button>
        <button
          onClick={() => setActiveTab('bans')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'bans'
              ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] border border-[var(--nexus-cyan)]/30'
              : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
          }`}
        >
          Server Bans ({serverBans.length})
        </button>
      </div>

      {activeTab === 'toggles' && (
        <div className="space-y-2">
          {MODULE_REGISTRY.map((mod) => {
            const toggle = toggleMap[mod.key];
            const isEnabled = !toggle || toggle.enabled;

            return (
              <div
                key={mod.key}
                className={`nexus-card p-4 flex items-center gap-4 transition-opacity ${
                  !isEnabled ? 'opacity-60' : ''
                }`}
              >
                <span className="text-2xl w-8 text-center">{mod.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{mod.name}</p>
                  <p className="text-xs text-[var(--nexus-dim)]">{mod.key} • {mod.category}</p>
                  {!isEnabled && toggle && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--nexus-red)]/10 text-[var(--nexus-red)]">
                        DISABLED
                      </span>
                      {toggle.reason && (
                        <span className="text-[10px] text-[var(--nexus-dim)]">
                          {REASONS.find((r) => r.value === toggle.reason)?.label || toggle.reason}
                        </span>
                      )}
                      {toggle.reason_detail && (
                        <span className="text-[10px] text-[var(--nexus-dim)]">— {toggle.reason_detail}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => handleToggle(mod.key, isEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    isEnabled ? 'bg-[var(--nexus-green)]' : 'bg-[var(--nexus-border)]'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'bans' && (
        <div className="space-y-6">
          {/* Add ban form */}
          <div className="nexus-card p-6">
            <h3 className="text-sm font-medium mb-4">Add Server Module Ban</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-xs text-[var(--nexus-dim)] block mb-1">Guild ID</label>
                <input
                  type="text"
                  value={banGuildId}
                  onChange={(e) => setBanGuildId(e.target.value)}
                  placeholder="123456789012345678"
                  className="w-full bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--nexus-dim)] block mb-1">Module</label>
                <select
                  value={banModule}
                  onChange={(e) => setBanModule(e.target.value)}
                  className="w-full bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]"
                >
                  <option value="">Select module...</option>
                  {MODULE_REGISTRY.map((m) => (
                    <option key={m.key} value={m.key}>{m.icon} {m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--nexus-dim)] block mb-1">Reason</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="e.g., misuse"
                  className="w-full bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--nexus-dim)] block mb-1">Details</label>
                <input
                  type="text"
                  value={banDetail}
                  onChange={(e) => setBanDetail(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]"
                />
              </div>
            </div>
            {banError && <p className="text-xs text-[var(--nexus-red)] mb-2">{banError}</p>}
            <button
              onClick={handleAddBan}
              className="px-4 py-2 bg-[var(--nexus-red)]/80 text-white rounded-lg text-sm font-medium hover:bg-[var(--nexus-red)] transition-colors"
            >
              Ban Module for Server
            </button>
          </div>

          {/* Bans list */}
          <div className="nexus-card overflow-hidden">
            <div className="p-4 border-b border-[var(--nexus-border)]">
              <h3 className="text-sm font-medium">Active Server Bans ({serverBans.length})</h3>
            </div>
            {serverBans.length > 0 ? (
              <div className="divide-y divide-[var(--nexus-border)]/50">
                {serverBans.map((ban) => {
                  const modInfo = MODULE_REGISTRY.find((m) => m.key === ban.module_name);
                  return (
                    <div key={ban.id} className="p-4 flex items-center gap-4 hover:bg-white/[0.02]">
                      <span className="text-xl">{modInfo?.icon || '❓'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {modInfo?.name || ban.module_name}
                          <span className="text-[var(--nexus-dim)] ml-2">in {ban.guild_id}</span>
                        </p>
                        <p className="text-xs text-[var(--nexus-dim)]">
                          {ban.reason && <span>{ban.reason}</span>}
                          {ban.reason_detail && <span> — {ban.reason_detail}</span>}
                          <span className="ml-2">{new Date(ban.created_at).toLocaleDateString()}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveBan(ban.guild_id, ban.module_name)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-[var(--nexus-green)]/10 text-[var(--nexus-green)] hover:bg-[var(--nexus-green)]/20 transition-colors"
                      >
                        Unban
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-[var(--nexus-dim)]">
                No server module bans active
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disable modal */}
      {disableModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDisableModal(null)}>
          <div className="nexus-card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">
              Disable {MODULE_REGISTRY.find((m) => m.key === disableModal)?.name || disableModal}?
            </h3>
            <p className="text-xs text-[var(--nexus-dim)] mb-4">
              This will disable the module for ALL servers. Users will see a message explaining why.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-[var(--nexus-dim)] block mb-1">Reason</label>
                <select
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  className="w-full bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--nexus-dim)] block mb-1">Additional Details (optional)</label>
                <textarea
                  value={disableDetail}
                  onChange={(e) => setDisableDetail(e.target.value)}
                  placeholder="Brief explanation for users..."
                  rows={2}
                  className="w-full bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDisableModal(null)}
                className="px-4 py-2 bg-white/5 rounded-lg text-sm hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisable}
                className="px-4 py-2 bg-[var(--nexus-red)] text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all"
              >
                Disable Globally
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
