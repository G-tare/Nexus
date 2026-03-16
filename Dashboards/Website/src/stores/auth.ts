import { create } from 'zustand';
import api from '@/lib/api';
import type { User, Guild, GuildWithBot } from '@/lib/types';

interface AuthState {
  user: User | null;
  guilds: GuildWithBot[];
  isLoading: boolean;
  isAuthenticated: boolean;

  login: () => Promise<void>;
  logout: () => void;
  setToken: (token: string, isOwner: boolean) => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  guilds: [],
  isLoading: true,
  isAuthenticated: false,

  login: async () => {
    try {
      const { data } = await api.get('/auth/login?platform=web');
      window.location.href = data.url;
    } catch (err) {
      console.error('Login failed:', err);
    }
  },

  logout: () => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    set({ user: null, guilds: [], isAuthenticated: false });
    // Go back to the landing page, not the dashboard root (which would re-trigger OAuth)
    window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000';
  },

  setToken: (token: string, isOwner: boolean) => {
    localStorage.setItem('nexus_token', token);
    // isOwner is stored with the user object after fetchUser
  },

  fetchUser: async () => {
    const token = localStorage.getItem('nexus_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      const user: User = data.user;
      const allGuilds: Guild[] = data.guilds;

      // Filter guilds where user has MANAGE_GUILD or is owner
      const manageableGuilds = allGuilds.filter(
        (g) => g.owner || (BigInt(g.permissions) & 0x20n) === 0x20n
      );

      // Check which guilds the bot is in
      let botGuildIds: string[] = [];
      if (manageableGuilds.length > 0) {
        try {
          const { data: checkData } = await api.post('/guilds/check', {
            guildIds: manageableGuilds.map((g) => g.id),
          });
          botGuildIds = checkData.activeGuildIds || checkData.active_guild_ids || [];
        } catch {
          // If check fails, show all manageable guilds
        }
      }

      const guildsWithBot: GuildWithBot[] = manageableGuilds.map((g) => ({
        ...g,
        botActive: botGuildIds.includes(g.id),
      }));

      // Sort: bot-active first, then alphabetical
      guildsWithBot.sort((a, b) => {
        if (a.botActive !== b.botActive) return a.botActive ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      set({ user, guilds: guildsWithBot, isLoading: false, isAuthenticated: true });
    } catch (err) {
      console.error('Fetch user failed:', err);
      localStorage.removeItem('nexus_token');
      set({ user: null, guilds: [], isLoading: false, isAuthenticated: false });
    }
  },
}));
