'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

/* ── Types ── */

interface StaffMember {
  id: number;
  discord_id: string;
  username: string;
  avatar_hash: string | null;
  role: 'owner' | 'manager' | 'support';
  permissions: Record<string, boolean>;
  added_by: string;
  added_at: string;
  removed_at: string | null;
}

interface StaffActivity {
  staff_id: string;
  staff_name: string;
  ticket_id: number;
  ticket_subject: string;
  ticket_category: string;
  action_type: string;
  created_at: string;
}

/* ── Constants ── */

const ROLE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  owner: {
    label: 'Owner',
    color: 'var(--nexus-yellow)',
    description: 'Full access — staff management, all settings',
  },
  manager: {
    label: 'Manager',
    color: 'var(--nexus-blue)',
    description: 'Analytics, server management, module toggles, tickets',
  },
  support: {
    label: 'Support',
    color: 'var(--nexus-green)',
    description: 'View and respond to tickets only',
  },
};

/* ── Page ── */

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activity, setActivity] = useState<StaffActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Add form state
  const [newDiscordId, setNewDiscordId] = useState('');
  const [newRole, setNewRole] = useState<string>('support');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, activityRes] = await Promise.all([
        api.get('/owner/staff'),
        api.get('/owner/staff/activity?limit=20'),
      ]);
      setStaff(staffRes.data.staff);
      setActivity(activityRes.data.activity);
    } catch (err) {
      console.error('Failed to fetch staff data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeStaff = staff.filter((s) => s.removed_at === null);
  const removedStaff = staff.filter((s) => s.removed_at !== null);

  const handleAdd = async () => {
    if (!newDiscordId.trim()) {
      setAddError('Discord User ID is required');
      return;
    }
    if (!/^\d{17,20}$/.test(newDiscordId.trim())) {
      setAddError('Invalid Discord ID format (must be 17-20 digits)');
      return;
    }

    setAddLoading(true);
    setAddError('');

    try {
      await api.post('/owner/staff', {
        discordId: newDiscordId.trim(),
        role: newRole,
      });
      setShowAddForm(false);
      setNewDiscordId('');
      setNewRole('support');
      await fetchData();
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'Failed to add staff member');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateRole = async (id: number, role: string) => {
    try {
      await api.patch(`/owner/staff/${id}`, { role });
      setEditingId(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to update role', err);
    }
  };

  const handleRemove = async (id: number, username: string) => {
    if (!confirm(`Remove ${username} from staff?`)) return;

    try {
      await api.delete(`/owner/staff/${id}`);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove staff member');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">👥 Staff Management</h1>
          <p className="text-[var(--nexus-dim)]">
            Manage bot staff members and their access levels.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-[var(--nexus-cyan)] text-black rounded-lg text-sm font-medium hover:brightness-110 transition-all"
        >
          + Add Staff Member
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="nexus-card p-6 mb-6">
          <h3 className="text-sm font-medium mb-4">Add New Staff Member</h3>
          <p className="text-xs text-[var(--nexus-dim)] mb-4">
            Enter a Discord User ID — username and avatar will be resolved automatically.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-[var(--nexus-dim)] block mb-1">Discord User ID</label>
              <input
                type="text"
                value={newDiscordId}
                onChange={(e) => setNewDiscordId(e.target.value)}
                placeholder="123456789012345678"
                className="w-full bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--nexus-dim)] block mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--nexus-cyan)]"
              >
                <option value="support">Support</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>
          {addError && <p className="text-xs text-[var(--nexus-red)] mb-3">{addError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addLoading}
              className="px-4 py-2 bg-[var(--nexus-cyan)] text-black rounded-lg text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
            >
              {addLoading ? 'Adding...' : 'Add Member'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddError(''); }}
              className="px-4 py-2 bg-white/5 rounded-lg text-sm hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Total Active</p>
          <p className="text-2xl font-bold text-[var(--nexus-cyan)]">{activeStaff.length}</p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Owners</p>
          <p className="text-2xl font-bold text-[var(--nexus-yellow)]">
            {activeStaff.filter((s) => s.role === 'owner').length}
          </p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Managers</p>
          <p className="text-2xl font-bold text-[var(--nexus-blue)]">
            {activeStaff.filter((s) => s.role === 'manager').length}
          </p>
        </div>
        <div className="nexus-card p-4">
          <p className="text-xs text-[var(--nexus-dim)]">Support</p>
          <p className="text-2xl font-bold text-[var(--nexus-green)]">
            {activeStaff.filter((s) => s.role === 'support').length}
          </p>
        </div>
      </div>

      {/* Two-column: active staff + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active staff list */}
        <div className="lg:col-span-2 nexus-card overflow-hidden">
          <div className="p-4 border-b border-[var(--nexus-border)]">
            <h3 className="text-sm font-medium">Active Staff ({activeStaff.length})</h3>
          </div>
          <div className="divide-y divide-[var(--nexus-border)]/50">
            {activeStaff.map((member) => {
              const roleInfo = ROLE_CONFIG[member.role];
              const isEditing = editingId === member.id;

              return (
                <div key={member.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    {member.avatar_hash ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${member.discord_id}/${member.avatar_hash}.${member.avatar_hash.startsWith('a_') ? 'gif' : 'png'}?size=64`}
                        alt={member.username}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--nexus-border)] flex items-center justify-center font-bold text-[var(--nexus-dim)] flex-shrink-0">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.username}</p>
                      <p className="text-xs text-[var(--nexus-dim)]">{member.discord_id}</p>
                    </div>

                    {/* Role badge / editor */}
                    {isEditing ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                        className="bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-2 py-1 text-xs outline-none focus:border-[var(--nexus-cyan)]"
                      >
                        <option value="support">Support</option>
                        <option value="manager">Manager</option>
                        <option value="owner">Owner</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => member.role !== 'owner' && setEditingId(member.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          member.role === 'owner' ? 'cursor-default' : 'cursor-pointer hover:brightness-110'
                        }`}
                        style={{
                          backgroundColor: `color-mix(in srgb, ${roleInfo.color} 15%, transparent)`,
                          color: roleInfo.color,
                        }}
                        title={member.role === 'owner' ? 'Owner role cannot be changed' : 'Click to change role'}
                      >
                        {roleInfo.label}
                      </button>
                    )}

                    {/* Remove button (not for owners) */}
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(member.id, member.username)}
                        className="text-[var(--nexus-dim)] hover:text-[var(--nexus-red)] transition-colors p-1"
                        title="Remove staff member"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Added info */}
                  <div className="mt-2 pl-14 text-[10px] text-[var(--nexus-dim)]">
                    Added {new Date(member.added_at).toLocaleDateString()} • {roleInfo.description}
                  </div>
                </div>
              );
            })}
            {activeStaff.length === 0 && (
              <div className="p-8 text-center text-[var(--nexus-dim)]">
                No staff members yet
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="nexus-card overflow-hidden">
          <div className="p-4 border-b border-[var(--nexus-border)]">
            <h3 className="text-sm font-medium">Recent Activity</h3>
          </div>
          <div className="divide-y divide-[var(--nexus-border)]/50">
            {activity.map((item, i) => (
              <div key={i} className="p-3">
                <div className="flex items-start gap-2">
                  <span className="text-xs mt-0.5">💬</span>
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-medium">{item.staff_name}</span>
                      {' replied to '}
                      <span className="text-[var(--nexus-cyan)]">#{item.ticket_id}</span>
                    </p>
                    <p className="text-[10px] text-[var(--nexus-dim)] truncate mt-0.5">
                      {item.ticket_subject}
                    </p>
                    <p className="text-[10px] text-[var(--nexus-dim)] mt-0.5">
                      {getTimeAgo(item.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {activity.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--nexus-dim)]">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Removed staff */}
      {removedStaff.length > 0 && (
        <div className="mt-6 nexus-card overflow-hidden">
          <div className="p-4 border-b border-[var(--nexus-border)]">
            <h3 className="text-sm font-medium text-[var(--nexus-dim)]">
              Previously Removed ({removedStaff.length})
            </h3>
          </div>
          <div className="divide-y divide-[var(--nexus-border)]/50">
            {removedStaff.map((member) => (
              <div key={member.id} className="p-3 flex items-center gap-3 opacity-50">
                {member.avatar_hash ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${member.discord_id}/${member.avatar_hash}.png?size=32`}
                    alt={member.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--nexus-border)] flex items-center justify-center text-xs font-bold text-[var(--nexus-dim)]">
                    {member.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{member.username}</p>
                  <p className="text-[10px] text-[var(--nexus-dim)]">
                    {member.discord_id} • Removed {member.removed_at ? new Date(member.removed_at).toLocaleDateString() : ''}
                  </p>
                </div>
                <span className="text-xs text-[var(--nexus-dim)]">{member.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role reference */}
      <div className="mt-6 nexus-card p-6">
        <h3 className="text-sm font-medium mb-4 text-[var(--nexus-dim)]">Role Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(ROLE_CONFIG).map(([key, config]) => (
            <div key={key} className="border border-[var(--nexus-border)] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="font-medium text-sm" style={{ color: config.color }}>
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-[var(--nexus-dim)]">{config.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
