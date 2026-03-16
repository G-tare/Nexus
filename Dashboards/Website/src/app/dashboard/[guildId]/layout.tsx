'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useGuildStore } from '@/stores/guild';
import { getGuildIconUrl, getAvatarUrl, formatNumber } from '@/lib/utils';
import { MODULE_REGISTRY } from '@/lib/types';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const guildId = params.guildId as string;

  const { user, guilds, isAuthenticated, isLoading, logout } = useAuthStore();
  const { fetchGuildData, fetchModules, startSync, stopSync, stats, modules } = useGuildStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');

  const guild = guilds.find((g) => g.id === guildId);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
      return;
    }
    if (guildId) {
      fetchGuildData(guildId);
      fetchModules(guildId);
      startSync(guildId);
    }
    return () => {
      stopSync();
    };
  }, [guildId, isLoading, isAuthenticated, router, fetchGuildData, fetchModules, startSync, stopSync]);

  // Auto-expand modules section if viewing a module config page
  useEffect(() => {
    if (pathname.includes('/modules/')) {
      setModulesOpen(true);
    }
  }, [pathname]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const basePath = `/dashboard/${guildId}`;

  const filteredModules = moduleSearch
    ? MODULE_REGISTRY.filter((m) => m.name.toLowerCase().includes(moduleSearch.toLowerCase()))
    : MODULE_REGISTRY;

  // Static nav items (non-modules)
  const navItems = [
    { path: '', label: 'Overview', icon: '📊' },
    { path: '/leaderboards', label: 'Leaderboards', icon: '🏆' },
    { path: '/modlogs', label: 'Mod Logs', icon: '📋' },
    { path: '/permissions', label: 'Bot Managers', icon: '🔒' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  const isModulesGridActive = pathname === `${basePath}/modules`;
  const activeModuleKey = pathname.match(/\/modules\/([^/]+)/)?.[1] || null;

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-64 bg-[var(--nexus-card)] border-r border-[var(--nexus-border)] flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Guild header */}
        <div className="p-4 border-b border-[var(--nexus-border)]">
          <Link href="/servers" className="flex items-center gap-2 text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] text-sm mb-3 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Servers
          </Link>
          <div className="flex items-center gap-3">
            {guild?.icon ? (
              <img src={getGuildIconUrl(guildId, guild.icon, 64)} alt="" className="w-10 h-10 rounded-lg" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[var(--nexus-border)] flex items-center justify-center font-bold text-[var(--nexus-dim)]">
                {guild?.name?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold truncate text-sm">{guild?.name || 'Unknown Server'}</h2>
              {stats && (
                <p className="text-xs text-[var(--nexus-dim)]">{formatNumber(stats.totalMembers)} members</p>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto flex flex-col min-h-0">
          {/* Overview */}
          <NavLink
            href={basePath}
            icon="📊"
            label="Overview"
            active={pathname === basePath}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Modules — dropdown */}
          <div className={`flex flex-col ${modulesOpen ? 'flex-1 min-h-0' : ''}`}>
            <div className="flex items-center flex-shrink-0">
              {/* Main modules link */}
              <Link
                href={`${basePath}/modules`}
                onClick={() => setSidebarOpen(false)}
                className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-l-lg text-sm transition-colors ${
                  isModulesGridActive || activeModuleKey
                    ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] font-medium'
                    : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
                }`}
              >
                <span className="text-base">🧩</span>
                Modules
              </Link>
              {/* Dropdown toggle */}
              <button
                onClick={() => setModulesOpen(!modulesOpen)}
                className={`px-2 py-2.5 rounded-r-lg transition-colors ${
                  isModulesGridActive || activeModuleKey
                    ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)]'
                    : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
                }`}
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${modulesOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Module list dropdown — fills remaining space */}
            {modulesOpen && (
              <div className="mt-1 mb-1 flex-1 min-h-0 flex flex-col">
                {/* Search */}
                <div className="px-2 mb-1 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Search modules..."
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    className="w-full text-xs bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-md px-2 py-1.5 outline-none focus:border-[var(--nexus-cyan)] placeholder-[var(--nexus-dim)]"
                  />
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {filteredModules.map((mod) => {
                    const isActive = activeModuleKey === mod.key;
                    return (
                      <Link
                        key={mod.key}
                        href={`${basePath}/modules/${mod.key}`}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-2 px-4 py-1.5 text-xs transition-colors ${
                          isActive
                            ? 'text-[var(--nexus-cyan)] bg-[var(--nexus-cyan)]/5 font-medium'
                            : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/[0.03]'
                        }`}
                      >
                        <span className="text-sm w-5 text-center">{mod.icon}</span>
                        <span className="truncate">{mod.name}</span>
                      </Link>
                    );
                  })}
                  {filteredModules.length === 0 && (
                    <p className="text-xs text-[var(--nexus-dim)] text-center py-2">No modules found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rest of nav items */}
          <div className="flex-shrink-0">
            {navItems.slice(1).map((item) => {
              const href = `${basePath}${item.path}`;
              const isActive = pathname === href;
              return (
                <NavLink
                  key={item.path}
                  href={href}
                  icon={item.icon}
                  label={item.label}
                  active={isActive}
                  onClick={() => setSidebarOpen(false)}
                />
              );
            })}
          </div>

          {/* Server quick stats — visible when modules dropdown is collapsed */}
          {!modulesOpen && (
            <div className="mt-4 mx-1 flex-shrink-0">
              <div className="border border-[var(--nexus-border)] rounded-lg p-3 bg-white/[0.02]">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--nexus-dim)] mb-2.5">Server Stats</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-base font-bold text-[var(--nexus-cyan)]">{formatNumber(stats?.totalMembers || 0)}</p>
                    <p className="text-[10px] text-[var(--nexus-dim)]">Members</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-[var(--nexus-blue)]">{formatNumber(stats?.totalMessages || 0)}</p>
                    <p className="text-[10px] text-[var(--nexus-dim)]">Messages</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-[var(--nexus-green)]">
                      {Object.values(modules).filter((m) => m.enabled).length}/{MODULE_REGISTRY.length}
                    </p>
                    <p className="text-[10px] text-[var(--nexus-dim)]">Modules</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-[var(--nexus-purple)]">{stats?.highestLevel || 0}</p>
                    <p className="text-[10px] text-[var(--nexus-dim)]">Top Level</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-[var(--nexus-border)]">
          <div className="flex items-center gap-3">
            <img src={getAvatarUrl(user.id, user.avatar, 64)} alt="" className="w-8 h-8 rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              {user.isOwner && <p className="text-xs text-[var(--nexus-yellow)]">Bot Owner</p>}
            </div>
            <button onClick={logout} className="text-[var(--nexus-dim)] hover:text-[var(--nexus-red)] transition-colors" title="Logout">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        {/* Top bar (mobile) */}
        <div className="lg:hidden sticky top-0 z-30 bg-[var(--nexus-dark)]/95 backdrop-blur-sm border-b border-[var(--nexus-border)] px-4 h-14 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-[var(--nexus-dim)]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-sm truncate">{guild?.name || 'Dashboard'}</span>
        </div>

        <div className="p-6 lg:p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] font-medium'
          : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
      }`}
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  );
}
