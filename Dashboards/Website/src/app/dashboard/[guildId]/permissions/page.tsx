'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useGuildStore } from '@/stores/guild';
import { useAuthStore } from '@/stores/auth';
import { getAvatarUrl } from '@/lib/utils';

const API_URL = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') : 'http://localhost:3001/api';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    window.location.href = '/';
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

interface BotManager {
  id: number;
  guildId: string;
  targetType: 'role' | 'user';
  targetId: string;
  addedBy: string;
  createdAt: string;
  displayName?: string;
}

export default function BotManagersPage() {
  const { guildId } = useParams() as { guildId: string };
  const { roles } = useGuildStore();
  const { user, guilds } = useAuthStore();

  const [managers, setManagers] = useState<BotManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [addType, setAddType] = useState<'role' | 'user'>('role');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [userIdInput, setUserIdInput] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<{ id: string; username: string; globalName: string | null }[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const guild = guilds.find((g) => g.id === guildId);
  const isOwner = guild?.owner === true;

  // Resolve display names for user-type managers
  const resolveUserDisplayNames = useCallback(async (mgrs: BotManager[]): Promise<BotManager[]> => {
    const userManagers = mgrs.filter((m) => m.targetType === 'user');
    if (userManagers.length === 0) return mgrs;

    const resolved = await Promise.all(
      userManagers.map(async (mgr) => {
        try {
          const data = await fetchWithAuth(`/guilds/${guildId}/members/search?q=${mgr.targetId}`);
          const members = data.members || [];
          const match = members.find((m: { id: string; username: string; globalName: string | null }) => m.id === mgr.targetId);
          return { ...mgr, displayName: match ? (match.globalName || match.username) : undefined };
        } catch {
          return mgr;
        }
      })
    );

    const resolvedMap = new Map(resolved.map((r) => [r.id, r]));
    return mgrs.map((m) => resolvedMap.get(m.id) || m);
  }, [guildId]);

  const fetchManagers = useCallback(async () => {
    try {
      const data = await fetchWithAuth(`/managers/${guildId}`);
      const rawManagers: BotManager[] = data.managers || [];
      const withNames = await resolveUserDisplayNames(rawManagers);
      setManagers(withNames);
    } catch {
      setManagers([]);
    }
    setLoading(false);
  }, [guildId, resolveUserDisplayNames]);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  // Member search for user picker
  useEffect(() => {
    if (addType !== 'user' || memberSearch.length < 1) {
      setMemberResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingMembers(true);
      try {
        const data = await fetchWithAuth(`/guilds/${guildId}/members/search?q=${encodeURIComponent(memberSearch)}`);
        setMemberResults(data.members || []);
      } catch {
        setMemberResults([]);
      }
      setSearchingMembers(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [memberSearch, addType, guildId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const addManager = async () => {
    const targetId = addType === 'role' ? selectedRoleId : userIdInput.trim();
    if (!targetId) return;

    // Check if already exists
    if (managers.some((m) => m.targetType === addType && m.targetId === targetId)) {
      showToast('This manager already exists.');
      return;
    }

    setSaving(true);
    try {
      await fetchWithAuth(`/managers/${guildId}`, {
        method: 'POST',
        body: JSON.stringify({ targetType: addType, targetId }),
      });
      await fetchManagers();
      setSelectedRoleId('');
      setUserIdInput('');
      setMemberSearch('');
      showToast('Manager added successfully.');
    } catch {
      showToast('Failed to add manager.');
    }
    setSaving(false);
  };

  const removeManager = async (manager: BotManager) => {
    setRemoving(manager.id);
    try {
      await fetchWithAuth(`/managers/${guildId}`, {
        method: 'DELETE',
        body: JSON.stringify({ targetType: manager.targetType, targetId: manager.targetId }),
      });
      setManagers((prev) => prev.filter((m) => m.id !== manager.id));
      showToast('Manager removed.');
    } catch {
      showToast('Failed to remove manager.');
    }
    setRemoving(null);
  };

  const getRoleName = (roleId: string): string => {
    return roles.find((r) => r.id === roleId)?.name || roleId;
  };

  const getRoleColor = (roleId: string): string => {
    const role = roles.find((r) => r.id === roleId);
    if (!role || role.color === 0) return 'var(--nexus-text)';
    return `#${role.color.toString(16).padStart(6, '0')}`;
  };

  const selectableRoles = roles.filter((r) => !r.managed && r.name !== '@everyone');

  const managerRoles = managers.filter((m) => m.targetType === 'role');
  const managerUsers = managers.filter((m) => m.targetType === 'user');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Bot Managers</h1>
      <p className="text-[var(--nexus-dim)] mb-6">
        Control who can access and configure the bot dashboard for this server.
        Server owners always have full access.
      </p>

      {/* Info card */}
      <div className="nexus-card p-4 mb-6 border-l-4 border-l-[var(--nexus-cyan)]">
        <div className="flex items-start gap-3">
          <span className="text-lg mt-0.5">ℹ️</span>
          <div>
            <p className="text-sm font-medium mb-1">How Bot Managers Work</p>
            <p className="text-xs text-[var(--nexus-dim)] leading-relaxed">
              Bot managers can access the dashboard, toggle modules, and change bot configurations
              for this server. You can add entire roles (all members with that role get access) or
              specific users by searching for them. The server owner always has full access regardless
              of this list.
            </p>
          </div>
        </div>
      </div>

      {/* Add manager form */}
      <div className="nexus-card p-5 mb-6">
        <h2 className="font-semibold text-sm mb-4">Add Bot Manager</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Type selector */}
          <div className="flex gap-1 bg-[var(--nexus-dark)] rounded-lg p-1">
            <button
              onClick={() => setAddType('role')}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                addType === 'role'
                  ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)]'
                  : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)]'
              }`}
            >
              Role
            </button>
            <button
              onClick={() => setAddType('user')}
              className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                addType === 'user'
                  ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)]'
                  : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)]'
              }`}
            >
              User
            </button>
          </div>

          {/* Input */}
          <div className="flex-1">
            {addType === 'role' ? (
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full px-3 py-2.5 bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--nexus-cyan)]/50 cursor-pointer"
              >
                <option value="">Select a role...</option>
                {selectableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for a member..."
                  value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); setUserIdInput(''); }}
                  className="w-full px-3 py-2.5 bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--nexus-cyan)]/50"
                />
                {memberSearch.length > 0 && memberResults.length > 0 && !userIdInput && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--nexus-card)] border border-[var(--nexus-border)] rounded-lg max-h-48 overflow-y-auto shadow-lg">
                    {memberResults.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setUserIdInput(m.id);
                          setMemberSearch(m.globalName || m.username);
                          setMemberResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-2 text-sm"
                      >
                        <span className="text-[var(--nexus-text)]">{m.globalName || m.username}</span>
                        {m.globalName && <span className="text-[var(--nexus-dim)] text-xs">@{m.username}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {searchingMembers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add button */}
          <button
            onClick={addManager}
            disabled={saving || (addType === 'role' ? !selectedRoleId : !userIdInput.trim())}
            className="px-6 py-2.5 bg-[var(--nexus-cyan)] text-black font-medium rounded-lg text-sm hover:bg-[var(--nexus-cyan)]/80 disabled:opacity-30 transition-colors whitespace-nowrap"
          >
            {saving ? 'Adding...' : 'Add Manager'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="nexus-card flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Server Owner */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 pl-1">
              <span className="text-sm">👑</span>
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--nexus-dim)]">Server Owner</span>
            </div>
            <div className="nexus-card p-4">
              <div className="flex items-center gap-3">
                {user && (
                  <img
                    src={getAvatarUrl(guild?.owner ? user.id : '', null, 64)}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {isOwner ? user?.username || 'You' : 'Server Owner'}
                  </p>
                  <p className="text-xs text-[var(--nexus-dim)]">Full access — cannot be removed</p>
                </div>
                <span className="text-xs bg-[var(--nexus-yellow)]/10 text-[var(--nexus-yellow)] px-2 py-1 rounded font-medium">
                  Owner
                </span>
              </div>
            </div>
          </div>

          {/* Manager Roles */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 pl-1">
              <span className="text-sm">🎭</span>
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--nexus-dim)]">
                Manager Roles ({managerRoles.length})
              </span>
            </div>
            {managerRoles.length > 0 ? (
              <div className="nexus-card divide-y divide-[var(--nexus-border)]">
                {managerRoles.map((mgr) => (
                  <div key={mgr.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getRoleColor(mgr.targetId) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: getRoleColor(mgr.targetId) }}>
                        {getRoleName(mgr.targetId)}
                      </p>
                      <p className="text-xs text-[var(--nexus-dim)]">
                        All members with this role can manage the bot
                      </p>
                    </div>
                    <span className="text-xs text-[var(--nexus-dim)] mr-2 hidden sm:block">
                      Added {new Date(mgr.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => removeManager(mgr)}
                      disabled={removing === mgr.id}
                      className="text-xs text-[var(--nexus-dim)] hover:text-[var(--nexus-red)] transition-colors px-2 py-1"
                    >
                      {removing === mgr.id ? '...' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="nexus-card p-8 text-center text-[var(--nexus-dim)] text-sm">
                No manager roles added yet. Add a role above to grant all its members dashboard access.
              </div>
            )}
          </div>

          {/* Manager Users */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2 pl-1">
              <span className="text-sm">👤</span>
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--nexus-dim)]">
                Manager Users ({managerUsers.length})
              </span>
            </div>
            {managerUsers.length > 0 ? (
              <div className="nexus-card divide-y divide-[var(--nexus-border)]">
                {managerUsers.map((mgr) => (
                  <div key={mgr.id} className="flex items-center gap-3 px-4 py-3">
                    <img
                      src={getAvatarUrl(mgr.targetId, null, 64)}
                      alt=""
                      className="w-9 h-9 rounded-full flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {mgr.displayName || mgr.targetId}
                      </p>
                      <p className="text-xs text-[var(--nexus-dim)]">
                        Individual user access
                      </p>
                    </div>
                    <span className="text-xs text-[var(--nexus-dim)] mr-2 hidden sm:block">
                      Added {new Date(mgr.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => removeManager(mgr)}
                      disabled={removing === mgr.id}
                      className="text-xs text-[var(--nexus-dim)] hover:text-[var(--nexus-red)] transition-colors px-2 py-1"
                    >
                      {removing === mgr.id ? '...' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="nexus-card p-8 text-center text-[var(--nexus-dim)] text-sm">
                No individual user managers added yet. Search for a member above to grant them dashboard access.
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="text-sm text-[var(--nexus-dim)] text-center mt-4">
            {managerRoles.length + managerUsers.length} bot manager{managerRoles.length + managerUsers.length !== 1 ? 's' : ''} configured
            {managerRoles.length > 0 && ` (${managerRoles.length} role${managerRoles.length !== 1 ? 's' : ''}`}
            {managerUsers.length > 0 && `${managerRoles.length > 0 ? ', ' : ' ('}${managerUsers.length} user${managerUsers.length !== 1 ? 's' : ''}`}
            {(managerRoles.length > 0 || managerUsers.length > 0) && ')'}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--nexus-card)] border border-[var(--nexus-border)] px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
