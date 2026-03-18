'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { timeAgo } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  ban: 'var(--nexus-red)',
  kick: 'var(--nexus-yellow)',
  mute: '#f97316',
  warn: 'var(--nexus-yellow)',
  unban: 'var(--nexus-green)',
  unmute: 'var(--nexus-green)',
  tempban: 'var(--nexus-red)',
};

const ACTION_FILTERS = ['all', 'ban', 'kick', 'mute', 'warn', 'unban', 'unmute', 'tempban'];

interface ModCase {
  id: number;
  caseNumber: number;
  action: string;
  userId: string;
  moderatorId: string;
  reason: string | null;
  duration: string | null;
  isActive: boolean;
  createdAt: string;
  username: string | null;
  moderatorUsername: string | null;
}

export default function ModLogsPage() {
  const { guildId } = useParams() as { guildId: string };
  const [cases, setCases] = useState<ModCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [editingCase, setEditingCase] = useState<number | null>(null);
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCases = useCallback(() => {
    setLoading(true);
    const actionParam = filter !== 'all' ? `&action=${filter}` : '';
    api.get(`/guilds/${guildId}/modlogs?page=${page}&limit=25${actionParam}`)
      .then(({ data }) => {
        setCases(data.cases || []);
        setTotal(data.total || 0);
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, [guildId, page, filter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const startEdit = (c: ModCase) => {
    setEditingCase(c.caseNumber);
    setEditReason(c.reason || '');
  };

  const cancelEdit = () => {
    setEditingCase(null);
    setEditReason('');
  };

  const saveEdit = async (caseNumber: number) => {
    if (!editReason.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/guilds/${guildId}/modlogs/${caseNumber}`, { reason: editReason.trim() });
      // Update local state
      setCases(prev => prev.map(c =>
        c.caseNumber === caseNumber ? { ...c, reason: editReason.trim() } : c
      ));
      setEditingCase(null);
      setEditReason('');
    } catch {
      // Silently fail — user will see the old value
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Moderation Logs</h1>
      <p className="text-[var(--nexus-dim)] mb-6">View all moderation actions taken in this server.</p>

      {/* Action filter */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {ACTION_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] border border-[var(--nexus-cyan)]/30'
                : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] border border-transparent'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Cases list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cases.length > 0 ? (
          cases.map((c) => (
            <div key={c.id} className="nexus-card p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase"
                    style={{
                      color: ACTION_COLORS[c.action] || 'var(--nexus-dim)',
                      background: `${ACTION_COLORS[c.action] || 'var(--nexus-dim)'}15`,
                    }}
                  >
                    {c.action}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {c.username || c.userId}
                    </span>
                    <span className="text-xs text-[var(--nexus-dim)]">&bull;</span>
                    <span className="text-xs text-[var(--nexus-dim)]">
                      by {c.moderatorUsername || c.moderatorId}
                    </span>
                  </div>
                  {editingCase === c.caseNumber ? (
                    <div className="mt-2 flex gap-2 items-start">
                      <textarea
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--nexus-text)] resize-none focus:outline-none focus:border-[var(--nexus-cyan)]/50"
                        rows={2}
                        maxLength={1000}
                        placeholder="Edit reason..."
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => saveEdit(c.caseNumber)}
                          disabled={saving || !editReason.trim()}
                          className="px-3 py-1.5 text-xs rounded-lg bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] hover:bg-[var(--nexus-cyan)]/20 disabled:opacity-30 transition-colors"
                        >
                          {saving ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1.5 text-xs rounded-lg text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {c.reason && (
                        <p className="text-sm text-[var(--nexus-dim)] mt-1">{c.reason}</p>
                      )}
                      {c.duration && (
                        <span className="text-xs text-[var(--nexus-dim)] mt-1 inline-block">
                          Duration: {c.duration}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs text-[var(--nexus-dim)]">#{c.caseNumber}</span>
                  <p className="text-xs text-[var(--nexus-dim)]">{timeAgo(c.createdAt)}</p>
                  {editingCase !== c.caseNumber && (
                    <button
                      onClick={() => startEdit(c)}
                      className="text-xs text-[var(--nexus-dim)] hover:text-[var(--nexus-cyan)] transition-colors mt-1"
                      title="Edit reason"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-16 text-[var(--nexus-dim)]">
            No moderation cases found.
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-[var(--nexus-dim)]">
            Page {page} of {Math.ceil(total / 25)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(total / 25)}
            className="px-4 py-2 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
