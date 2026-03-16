'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

interface BlockedUser {
  user_id: string; reason: string | null; blocked_by: string;
  expires_at: string | null; created_at: string;
}

interface ModOverview {
  blockedUsers: number;
  appeals: { total_appeals: string; open_appeals: string; total_bugs: string; open_bugs: string };
  serverBans: number;
}

export default function ModerationPage() {
  const [overview, setOverview] = useState<ModOverview | null>(null);
  const [blocklist, setBlocklist] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [blockUserId, setBlockUserId] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockError, setBlockError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, blocklistRes] = await Promise.all([
        api.get('/owner/moderation/overview'),
        api.get('/owner/moderation/blocklist?limit=50'),
      ]);
      setOverview(overviewRes.data);
      setBlocklist(blocklistRes.data.users);
    } catch (err) {
      console.error('Failed to fetch moderation data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBlock = async () => {
    if (!blockUserId.match(/^\d{17,20}$/)) { setBlockError('Invalid Discord ID'); return; }
    setBlockError('');
    try {
      await api.post('/owner/moderation/blocklist', { userId: blockUserId, reason: blockReason || undefined });
      setBlockUserId(''); setBlockReason(''); setShowAddBlock(false);
      await fetchData();
    } catch (err: any) { setBlockError(err.response?.data?.error || 'Failed'); }
  };

  const handleUnblock = async (userId: string) => {
    if (!confirm(`Unblock user ${userId}?`)) return;
    try { await api.delete(`/owner/moderation/blocklist/${userId}`); await fetchData(); }
    catch (err) { console.error('Failed to unblock', err); }
  };

  if (loading || !overview) {
    return (<div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" /></div>);
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">🛡️ Moderation & Safety</h1>
          <p className="text-[var(--nexus-dim)]">Manage blocked users and review moderation activity.</p>
        </div>
        <button onClick={() => setShowAddBlock(!showAddBlock)} className="px-4 py-2 bg-[var(--nexus-red)]/80 text-white rounded-lg text-sm font-medium hover:bg-[var(--nexus-red)] transition-colors">
          Block User
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="nexus-card p-4"><p className="text-xs text-[var(--nexus-dim)]">Blocked Users</p><p className="text-2xl font-bold text-[var(--nexus-red)]">{overview.blockedUsers}</p></div>
        <div className="nexus-card p-4"><p className="text-xs text-[var(--nexus-dim)]">Open Appeals</p><p className="text-2xl font-bold text-[var(--nexus-yellow)]">{overview.appeals.open_appeals}</p></div>
        <div className="nexus-card p-4"><p className="text-xs text-[var(--nexus-dim)]">Open Bugs</p><p className="text-2xl font-bold text-[var(--nexus-blue)]">{overview.appeals.open_bugs}</p></div>
        <div className="nexus-card p-4"><p className="text-xs text-[var(--nexus-dim)]">Server Bans</p><p className="text-2xl font-bold text-[var(--nexus-purple)]">{overview.serverBans}</p></div>
      </div>

      {showAddBlock && (
        <div className="nexus-card p-6 mb-6">
          <h3 className="text-sm font-medium mb-3">Block User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input type="text" value={blockUserId} onChange={(e) => setBlockUserId(e.target.value)} placeholder="Discord User ID" className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]" />
            <input type="text" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Reason (optional)" className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]" />
          </div>
          {blockError && <p className="text-xs text-[var(--nexus-red)] mb-2">{blockError}</p>}
          <button onClick={handleBlock} className="px-4 py-2 bg-[var(--nexus-red)] text-white rounded-lg text-sm font-medium">Block</button>
        </div>
      )}

      <div className="nexus-card overflow-hidden">
        <div className="p-4 border-b border-[var(--nexus-border)]"><h3 className="text-sm font-medium">Blocked Users ({blocklist.length})</h3></div>
        {blocklist.length > 0 ? (
          <div className="divide-y divide-[var(--nexus-border)]/50">
            {blocklist.map((u) => (
              <div key={u.user_id} className="p-4 flex items-center gap-4 hover:bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{u.user_id}</p>
                  <p className="text-xs text-[var(--nexus-dim)]">{u.reason || 'No reason'} • Blocked {new Date(u.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleUnblock(u.user_id)} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--nexus-green)]/10 text-[var(--nexus-green)] hover:bg-[var(--nexus-green)]/20 transition-colors">Unblock</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-[var(--nexus-dim)]">No blocked users</div>
        )}
      </div>
    </div>
  );
}
