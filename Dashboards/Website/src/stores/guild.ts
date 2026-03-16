import { create } from 'zustand';
import type { Role, Channel, GuildStats, ModuleConfig, PermissionRule } from '@/lib/types';

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

/**
 * Polling interval for background refresh (ms).
 * This ensures the web dashboard stays in sync with changes made
 * on the iOS dashboard (or any other client) without requiring WebSockets.
 */
const SYNC_INTERVAL = 15_000; // 15 seconds

interface GuildState {
  guildId: string | null;
  roles: Role[];
  channels: Channel[];
  stats: GuildStats | null;
  modules: Record<string, ModuleConfig>;
  permissions: PermissionRule[];
  isLoadingGuild: boolean;

  // Sync helpers
  _syncTimer: ReturnType<typeof setInterval> | null;

  setGuildId: (id: string) => void;
  fetchGuildData: (guildId: string) => Promise<void>;
  fetchModules: (guildId: string) => Promise<void>;
  fetchPermissions: (guildId: string) => Promise<void>;
  toggleModule: (guildId: string, moduleName: string, enabled: boolean) => Promise<void>;
  updateModuleConfig: (guildId: string, moduleName: string, config: Record<string, any>) => Promise<void>;
  setPermission: (guildId: string, command: string, targetType: string, targetId: string, allowed: boolean) => Promise<void>;
  removePermission: (guildId: string, command: string, targetId: string) => Promise<void>;
  toggleCommand: (guildId: string, moduleName: string, commandName: string, disabled: boolean) => Promise<void>;

  /** Start background sync polling for the active guild */
  startSync: (guildId: string) => void;
  /** Stop background sync polling */
  stopSync: () => void;
  /** Force a full refresh of guild data + modules from the API */
  refreshAll: (guildId: string) => Promise<void>;
}

export const useGuildStore = create<GuildState>((set, get) => ({
  guildId: null,
  roles: [],
  channels: [],
  stats: null,
  modules: {},
  permissions: [],
  isLoadingGuild: false,
  _syncTimer: null,

  setGuildId: (id: string) => set({ guildId: id }),

  fetchGuildData: async (guildId: string) => {
    set({ isLoadingGuild: true });
    try {
      const [rolesData, channelsData, statsData] = await Promise.all([
        fetchWithAuth(`/guilds/${guildId}/roles`),
        fetchWithAuth(`/guilds/${guildId}/channels`),
        fetchWithAuth(`/guilds/${guildId}/stats`),
      ]);

      set({
        guildId,
        roles: rolesData.roles || [],
        channels: channelsData.channels || [],
        stats: statsData,
        isLoadingGuild: false,
      });
    } catch (err) {
      console.error('Fetch guild data failed:', err);
      set({ isLoadingGuild: false });
    }
  },

  fetchModules: async (guildId: string) => {
    try {
      const data = await fetchWithAuth(`/modules/${guildId}`);
      set({ modules: data });
    } catch (err) {
      console.error('Fetch modules failed:', err);
    }
  },

  fetchPermissions: async (guildId: string) => {
    try {
      const data = await fetchWithAuth(`/permissions/${guildId}`);
      // API returns Record<string, PermissionRule[]> grouped by command.
      // Flatten into a single array with `command` field on each rule.
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const flat: PermissionRule[] = [];
        for (const [command, rules] of Object.entries(data)) {
          for (const rule of rules as PermissionRule[]) {
            flat.push({ ...rule, command });
          }
        }
        set({ permissions: flat });
      } else if (Array.isArray(data)) {
        set({ permissions: data });
      } else {
        set({ permissions: [] });
      }
    } catch (err) {
      console.error('Fetch permissions failed:', err);
    }
  },

  setPermission: async (guildId: string, command: string, targetType: string, targetId: string, allowed: boolean) => {
    await fetchWithAuth(`/permissions/${guildId}`, {
      method: 'POST',
      body: JSON.stringify({ command, targetType, targetId, allowed }),
    });
    await get().fetchPermissions(guildId);
  },

  removePermission: async (guildId: string, command: string, targetId: string) => {
    await fetchWithAuth(`/permissions/${guildId}`, {
      method: 'DELETE',
      body: JSON.stringify({ command, targetId }),
    });
    await get().fetchPermissions(guildId);
  },

  toggleCommand: async (guildId: string, moduleName: string, commandName: string, disabled: boolean) => {
    // Optimistic update
    const prevModules = { ...get().modules };
    const mod = prevModules[moduleName];
    if (mod) {
      const existingConfig = mod.config || {};
      const disabledCommands: string[] = (existingConfig as Record<string, any>).disabledCommands || [];
      const updated = disabled
        ? disabledCommands.includes(commandName) ? disabledCommands : [...disabledCommands, commandName]
        : disabledCommands.filter((c: string) => c !== commandName);
      const optimistic = { ...prevModules };
      optimistic[moduleName] = { ...mod, config: { ...existingConfig, disabledCommands: updated } };
      set({ modules: optimistic });
    }

    try {
      await fetchWithAuth(`/modules/${guildId}/${moduleName}/commands/${commandName}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled }),
      });
      await get().fetchModules(guildId);
    } catch (err) {
      // Rollback
      set({ modules: prevModules });
      console.error('Toggle command failed:', err);
      throw err;
    }
  },

  toggleModule: async (guildId: string, moduleName: string, enabled: boolean) => {
    // Optimistic update
    const prevModules = { ...get().modules };
    const optimistic = { ...prevModules };
    if (optimistic[moduleName]) {
      optimistic[moduleName] = { ...optimistic[moduleName], enabled };
    } else {
      optimistic[moduleName] = { enabled, config: {} };
    }
    set({ modules: optimistic });

    try {
      await fetchWithAuth(`/modules/${guildId}/${moduleName}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      // Refetch from server to ensure consistency with other dashboards
      await get().fetchModules(guildId);
    } catch (err) {
      // Rollback optimistic update on failure
      set({ modules: prevModules });
      console.error('Toggle module failed:', err);
      throw err;
    }
  },

  updateModuleConfig: async (guildId: string, moduleName: string, config: Record<string, any>) => {
    // Optimistic update
    const prevModules = { ...get().modules };
    const optimistic = { ...prevModules };
    if (optimistic[moduleName]) {
      optimistic[moduleName] = { ...optimistic[moduleName], config };
    }
    set({ modules: optimistic });

    try {
      await fetchWithAuth(`/modules/${guildId}/${moduleName}/config`, {
        method: 'PUT',
        body: JSON.stringify({ config }),
      });
      // Refetch from server to ensure consistency with other dashboards
      await get().fetchModules(guildId);
    } catch (err) {
      // Rollback optimistic update on failure
      set({ modules: prevModules });
      console.error('Update module config failed:', err);
      throw err;
    }
  },

  startSync: (guildId: string) => {
    // Clear any existing timer
    const existing = get()._syncTimer;
    if (existing) clearInterval(existing);

    // Poll for fresh data every SYNC_INTERVAL
    const timer = setInterval(async () => {
      // Only sync if this guild is still active
      if (get().guildId !== guildId) {
        get().stopSync();
        return;
      }
      try {
        const data = await fetchWithAuth(`/modules/${guildId}`);
        set({ modules: data });
      } catch {
        // Silent fail — next poll will retry
      }
    }, SYNC_INTERVAL);

    set({ _syncTimer: timer });
  },

  stopSync: () => {
    const timer = get()._syncTimer;
    if (timer) clearInterval(timer);
    set({ _syncTimer: null });
  },

  refreshAll: async (guildId: string) => {
    await Promise.all([
      get().fetchGuildData(guildId),
      get().fetchModules(guildId),
      get().fetchPermissions(guildId),
    ]);
  },
}));
