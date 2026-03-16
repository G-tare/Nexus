'use client';

import { useState, useMemo } from 'react';
import { useGuildStore } from '@/stores/guild';
import { getCommandsForModule, DEFAULT_ACCESS_LABELS } from '@/lib/commandRegistry';
import type { CommandDef, DefaultAccess } from '@/lib/commandRegistry';
import type { PermissionRule, Role } from '@/lib/types';

// ─── Access Level Colors ─────────────────────────────────────
const ACCESS_COLORS: Record<DefaultAccess, string> = {
  everyone: 'var(--nexus-green)',
  staffOnly: 'var(--nexus-yellow)',
  adminOnly: 'var(--nexus-red)',
  ownerOnly: 'var(--nexus-purple)',
};

// ─── Main Component: Command List for a Module ──────────────
export function CommandPermissions({ moduleKey, guildId }: { moduleKey: string; guildId: string }) {
  const { permissions, roles } = useGuildStore();
  const commands = useMemo(() => getCommandsForModule(moduleKey), [moduleKey]);
  const [searchText, setSearchText] = useState('');
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null);

  const filteredCommands = useMemo(() => {
    if (!searchText) return commands;
    const q = searchText.toLowerCase();
    return commands.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [commands, searchText]);

  // Count total permission rules for this module's commands
  const moduleCommandNames = useMemo(() => new Set(commands.map((c) => c.name)), [commands]);
  const totalRules = useMemo(
    () => permissions.filter((p) => moduleCommandNames.has(p.command)).length,
    [permissions, moduleCommandNames]
  );

  if (commands.length === 0) return null;

  return (
    <div className="mt-8">
      {/* Section header */}
      <h2 className="text-sm font-semibold text-[var(--nexus-dim)] uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Command Permissions
      </h2>

      {/* Stats bar */}
      <div className="nexus-card p-4 mb-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-2xl font-bold text-[var(--nexus-cyan)]">{commands.length}</span>
            <span className="text-xs text-[var(--nexus-dim)] ml-1.5">Commands</span>
          </div>
          <div className="w-px h-8 bg-[var(--nexus-border)]" />
          <div>
            <span className="text-2xl font-bold text-[var(--nexus-cyan)]">{totalRules}</span>
            <span className="text-xs text-[var(--nexus-dim)] ml-1.5">Permission Rules</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="nexus-card p-3 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-[var(--nexus-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search commands..."
          className="bg-transparent outline-none text-sm text-[var(--nexus-text)] placeholder-[var(--nexus-dim)] flex-1"
        />
      </div>

      {/* Command list */}
      {filteredCommands.length === 0 ? (
        <div className="nexus-card p-8 text-center">
          <p className="text-sm text-[var(--nexus-dim)]">
            {searchText ? 'No commands match your search.' : 'This module has no registered commands.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCommands.map((cmd) => {
            const cmdRules = permissions.filter((p) => p.command === cmd.name);
            const isExpanded = expandedCommand === cmd.id;

            return (
              <div key={cmd.id} className="nexus-card overflow-hidden">
                {/* Command row — clickable to expand */}
                <button
                  onClick={() => setExpandedCommand(isExpanded ? null : cmd.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--nexus-cyan)]/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-[var(--nexus-cyan)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-mono text-[var(--nexus-text)]">/{cmd.name}</span>
                    <p className="text-xs text-[var(--nexus-dim)] truncate">{cmd.description}</p>
                  </div>

                  {/* Rule count badge */}
                  {cmdRules.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)]">
                      {cmdRules.length} rule{cmdRules.length !== 1 ? 's' : ''}
                    </span>
                  )}

                  <svg
                    className={`w-4 h-4 text-[var(--nexus-dim)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Expanded permission editor */}
                {isExpanded && (
                  <CommandPermissionEditor
                    command={cmd}
                    rules={cmdRules}
                    roles={roles}
                    guildId={guildId}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Per-Command Permission Editor (expanded view) ──────────
function CommandPermissionEditor({
  command,
  rules,
  roles,
  guildId,
}: {
  command: CommandDef;
  rules: PermissionRule[];
  roles: Role[];
  guildId: string;
}) {
  const { setPermission, removePermission } = useGuildStore();
  const [showAddModal, setShowAddModal] = useState<{ targetType: 'role' | 'user'; allowed: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const allowedRoles = rules.filter((r) => r.targetType === 'role' && r.allowed);
  const deniedRoles = rules.filter((r) => r.targetType === 'role' && !r.allowed);
  const allowedUsers = rules.filter((r) => r.targetType === 'user' && r.allowed);
  const deniedUsers = rules.filter((r) => r.targetType === 'user' && !r.allowed);
  const channelRules = rules.filter((r) => r.targetType === 'channel');

  const accessColor = ACCESS_COLORS[command.defaultAccess];

  const handleRemove = async (rule: PermissionRule) => {
    setSaving(true);
    try {
      await removePermission(guildId, command.name, rule.targetId);
    } catch {
      console.error('Failed to remove permission');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPermission = async (targetType: string, targetId: string, allowed: boolean) => {
    setSaving(true);
    try {
      await setPermission(guildId, command.name, targetType, targetId, allowed);
      setShowAddModal(null);
    } catch {
      console.error('Failed to set permission');
    } finally {
      setSaving(false);
    }
  };

  const resolveRoleName = (targetId: string): string => {
    const role = roles.find((r) => r.id === targetId);
    return role ? role.name : targetId;
  };

  return (
    <div className="border-t border-[var(--nexus-border)] bg-[var(--nexus-dark)]/30 p-4 space-y-4">
      {/* Default access badge */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${accessColor} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${accessColor} 20%, transparent)` }}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accessColor }} />
        <span className="text-xs font-semibold" style={{ color: accessColor }}>
          Default: {DEFAULT_ACCESS_LABELS[command.defaultAccess]}
        </span>
        <span className="text-xs text-[var(--nexus-dim)] ml-auto">Custom rules work alongside this default</span>
      </div>

      {/* Priority info banner */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--nexus-yellow)]/[0.06] border border-[var(--nexus-yellow)]/20">
        <svg className="w-4 h-4 text-[var(--nexus-yellow)] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-[var(--nexus-dim)]">
          Rules are additive. User ID overrides Role: if someone has an allowed role but their ID is denied, they cannot use this command.
        </p>
      </div>

      {/* Permission sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <PermissionSection
          title="Allowed Roles"
          color="var(--nexus-green)"
          items={allowedRoles}
          resolveLabel={resolveRoleName}
          onRemove={handleRemove}
          onAdd={() => setShowAddModal({ targetType: 'role', allowed: true })}
          emptyText="No roles explicitly allowed"
          saving={saving}
        />
        <PermissionSection
          title="Denied Roles"
          color="var(--nexus-red)"
          items={deniedRoles}
          resolveLabel={resolveRoleName}
          onRemove={handleRemove}
          onAdd={() => setShowAddModal({ targetType: 'role', allowed: false })}
          emptyText="No roles explicitly denied"
          saving={saving}
        />
        <PermissionSection
          title="Allowed Users"
          color="var(--nexus-green)"
          items={allowedUsers}
          resolveLabel={(id) => id}
          onRemove={handleRemove}
          onAdd={() => setShowAddModal({ targetType: 'user', allowed: true })}
          emptyText="No users explicitly allowed"
          saving={saving}
        />
        <PermissionSection
          title="Denied Users"
          color="var(--nexus-red)"
          items={deniedUsers}
          resolveLabel={(id) => id}
          onRemove={handleRemove}
          onAdd={() => setShowAddModal({ targetType: 'user', allowed: false })}
          emptyText="No users explicitly denied"
          saving={saving}
        />
      </div>

      {/* Channel overrides if any */}
      {channelRules.length > 0 && (
        <PermissionSection
          title="Channel Overrides"
          color="var(--nexus-yellow)"
          items={channelRules}
          resolveLabel={(id) => id}
          onRemove={handleRemove}
          emptyText=""
          saving={saving}
        />
      )}

      {/* Subcommands */}
      {command.subcommands.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <svg className="w-3.5 h-3.5 text-[var(--nexus-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-xs font-semibold text-[var(--nexus-dim)] uppercase">Subcommands</span>
          </div>
          <div className="rounded-lg overflow-hidden bg-[var(--nexus-card)]">
            {command.subcommands.map((sub, idx) => (
              <div key={sub}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <svg className="w-3 h-3 text-[var(--nexus-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs font-mono text-[var(--nexus-text)]">/{command.name} {sub}</span>
                </div>
                {idx < command.subcommands.length - 1 && (
                  <div className="mx-3 border-b border-[var(--nexus-border)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Permission Modal */}
      {showAddModal && (
        <AddPermissionModal
          targetType={showAddModal.targetType}
          allowed={showAddModal.allowed}
          roles={roles}
          existingIds={new Set(rules.filter((r) => r.targetType === showAddModal.targetType).map((r) => r.targetId))}
          onSave={(targetId) => handleAddPermission(showAddModal.targetType, targetId, showAddModal.allowed)}
          onClose={() => setShowAddModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ─── Permission Section (allowed/denied roles/users) ────────
function PermissionSection({
  title,
  color,
  items,
  resolveLabel,
  onRemove,
  onAdd,
  emptyText,
  saving,
}: {
  title: string;
  color: string;
  items: PermissionRule[];
  resolveLabel: (id: string) => string;
  onRemove: (rule: PermissionRule) => void;
  onAdd?: () => void;
  emptyText: string;
  saving: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <span className="text-xs font-semibold text-[var(--nexus-dim)] uppercase">{title}</span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
        >
          {items.length}
        </span>
        <div className="flex-1" />
        {onAdd && (
          <button
            onClick={onAdd}
            disabled={saving}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      <div className="rounded-lg overflow-hidden bg-[var(--nexus-card)]">
        {items.length === 0 ? (
          <p className="px-3 py-2.5 text-xs text-[var(--nexus-dim)]">{emptyText}</p>
        ) : (
          items.map((rule, idx) => (
            <div key={rule.targetId}>
              <div className="flex items-center gap-2 px-3 py-2">
                <svg className="w-3.5 h-3.5 shrink-0" style={{ color }} fill="currentColor" viewBox="0 0 20 20">
                  {rule.allowed ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  )}
                </svg>
                <span className="text-xs text-[var(--nexus-text)] flex-1 truncate">
                  {resolveLabel(rule.targetId)}
                </span>
                <button
                  onClick={() => onRemove(rule)}
                  disabled={saving}
                  className="p-1 rounded hover:bg-[var(--nexus-red)]/10 text-[var(--nexus-red)]/60 hover:text-[var(--nexus-red)] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              {idx < items.length - 1 && (
                <div className="mx-3 border-b border-[var(--nexus-border)]" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Add Permission Modal ───────────────────────────────────
function AddPermissionModal({
  targetType,
  allowed,
  roles,
  existingIds,
  onSave,
  onClose,
  saving,
}: {
  targetType: 'role' | 'user';
  allowed: boolean;
  roles: Role[];
  existingIds: Set<string>;
  onSave: (targetId: string) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [searchText, setSearchText] = useState('');
  const [userIdInput, setUserIdInput] = useState('');

  const color = allowed ? 'var(--nexus-green)' : 'var(--nexus-red)';
  const title = `${allowed ? 'Allow' : 'Deny'} ${targetType === 'role' ? 'Role' : 'User'}`;

  const filteredRoles = useMemo(() => {
    const available = roles.filter((r) => !existingIds.has(r.id) && !r.managed);
    if (!searchText) return available;
    const q = searchText.toLowerCase();
    return available.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, existingIds, searchText]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] rounded-xl bg-[var(--nexus-dark)] border border-[var(--nexus-border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--nexus-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-[var(--nexus-dim)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {targetType === 'role' ? (
          <>
            {/* Search for roles */}
            <div className="p-3 border-b border-[var(--nexus-border)]">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search roles..."
                className="w-full px-3 py-2 rounded-lg bg-[var(--nexus-card)] text-sm text-[var(--nexus-text)] placeholder-[var(--nexus-dim)] outline-none border border-[var(--nexus-border)] focus:border-[var(--nexus-cyan)]/50"
              />
            </div>

            {/* Role list */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredRoles.length === 0 ? (
                <p className="text-xs text-[var(--nexus-dim)] text-center py-4">No roles available</p>
              ) : (
                filteredRoles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => onSave(role.id)}
                    disabled={saving}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : 'var(--nexus-dim)' }}
                    />
                    <span className="text-sm text-[var(--nexus-text)]">{role.name}</span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          /* User ID input */
          <div className="p-4">
            <p className="text-xs text-[var(--nexus-dim)] mb-3">Enter the Discord User ID to {allowed ? 'allow' : 'deny'}:</p>
            <input
              type="text"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="e.g. 123456789012345678"
              className="w-full px-3 py-2 rounded-lg bg-[var(--nexus-card)] text-sm text-[var(--nexus-text)] placeholder-[var(--nexus-dim)] outline-none border border-[var(--nexus-border)] focus:border-[var(--nexus-cyan)]/50 font-mono"
            />
            <button
              onClick={() => userIdInput.trim() && onSave(userIdInput.trim())}
              disabled={saving || !userIdInput.trim()}
              className="mt-3 w-full py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: color }}
            >
              {saving ? 'Saving...' : `${allowed ? 'Allow' : 'Deny'} User`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
