'use client';

import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getGuildIconUrl, getAvatarUrl } from '@/lib/utils';

const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1475529392963981333&permissions=8&scope=bot%20applications.commands';

function GuildCard({ guild, onClick }: { guild: any; onClick: () => void }) {
  const iconUrl = getGuildIconUrl(guild.id, guild.icon, 128);

  return (
    <button
      onClick={onClick}
      className="nexus-card p-5 text-left hover:border-[var(--nexus-cyan)]/50 transition-all hover:scale-[1.02] active:scale-[0.98] group"
    >
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <img src={iconUrl} alt={guild.name} className="w-12 h-12 rounded-xl" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-[var(--nexus-border)] flex items-center justify-center text-lg font-bold text-[var(--nexus-dim)]">
            {guild.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate group-hover:text-[var(--nexus-cyan)] transition-colors">
            {guild.name}
          </h3>
          {guild.botActive ? (
            <span className="text-xs text-[var(--nexus-green)] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--nexus-green)] inline-block" />
              Manage
            </span>
          ) : (
            <span className="text-xs text-[var(--nexus-purple)] flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Invite Bot
            </span>
          )}
        </div>
        <svg
          className="w-5 h-5 text-[var(--nexus-dim)] group-hover:text-[var(--nexus-cyan)] transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

export default function ServersPage() {
  const { user, guilds, isAuthenticated, isLoading, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const withBot = guilds.filter((g) => g.botActive);
  const withoutBot = guilds.filter((g) => !g.botActive);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--nexus-border)] bg-[var(--nexus-card)]/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <span className="text-lg font-semibold">
              <span className="text-[var(--nexus-cyan)]">Nexus</span> Dashboard
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Owner dashboard button */}
            {user.isOwner && (
              <button
                onClick={() => router.push('/owner')}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--nexus-yellow)]/10 text-[var(--nexus-yellow)] border border-[var(--nexus-yellow)]/30 hover:bg-[var(--nexus-yellow)]/20 transition-colors"
              >
                Owner Panel
              </button>
            )}
            <div className="flex items-center gap-2">
              <img
                src={getAvatarUrl(user.id, user.avatar, 64)}
                alt={user.username}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm font-medium">{user.username}</span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-[var(--nexus-dim)] hover:text-[var(--nexus-red)] transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Servers</h1>
          <p className="text-[var(--nexus-dim)]">
            Manage servers with Nexus Bot, or invite it to new ones.
          </p>
        </div>

        {/* Servers with Bot */}
        <section className="mb-10">
          <h2 className="text-sm font-medium text-[var(--nexus-dim)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--nexus-green)]" />
            Servers with Nexus ({withBot.length})
          </h2>
          {withBot.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {withBot.map((guild) => (
                <GuildCard
                  key={guild.id}
                  guild={guild}
                  onClick={() => router.push(`/dashboard/${guild.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="nexus-card p-8 text-center">
              <p className="text-[var(--nexus-dim)]">
                Nexus Bot isn&apos;t in any of your servers yet. Invite it below!
              </p>
            </div>
          )}
        </section>

        {/* Servers without Bot */}
        {withoutBot.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-[var(--nexus-dim)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Nexus to a Server ({withoutBot.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {withoutBot.map((guild) => (
                <GuildCard
                  key={guild.id}
                  guild={guild}
                  onClick={() => window.open(`${INVITE_URL}&guild_id=${guild.id}`, '_blank')}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
