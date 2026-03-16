'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { getAvatarUrl } from '@/lib/utils';
import api from '@/lib/api';
import Link from 'next/link';

/* ── Sidebar navigation items ── */

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: string;
  hasDropdown?: boolean;
}

const TICKET_CATEGORIES = [
  { key: '', label: 'All Tickets', icon: '📋', path: '/tickets' },
  { key: 'help', label: 'Help', icon: '❓', path: '/tickets/help' },
  { key: 'appeal', label: 'Appeals', icon: '⚖️', path: '/tickets/appeals' },
  { key: 'suggestion', label: 'Suggestions', icon: '💡', path: '/tickets/suggestions' },
  { key: 'bug', label: 'Bugs', icon: '🐛', path: '/tickets/bugs' },
  { key: 'feedback', label: 'Feedback', icon: '💬', path: '/tickets/feedback' },
];

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Dashboard',
    items: [
      { path: '', label: 'Overview', icon: '📊' },
      { path: '/tickets', label: 'Tickets', icon: '🎫', hasDropdown: true },
      { path: '/staff', label: 'Staff', icon: '👥' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { path: '/commands', label: 'Command Usage', icon: '📈' },
      { path: '/servers', label: 'Servers', icon: '🌐' },
      { path: '/revenue', label: 'Revenue', icon: '💰' },
    ],
  },
  {
    label: 'Management',
    items: [
      { path: '/modules', label: 'Global Modules', icon: '🧩' },
      { path: '/moderation', label: 'Moderation', icon: '🛡️' },
      { path: '/alerts', label: 'Alerts', icon: '🔔' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/health', label: 'Health & Performance', icon: '💓' },
      { path: '/infrastructure', label: 'Infrastructure', icon: '🖥️' },
    ],
  },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({});

  // Auto-expand tickets dropdown when on the tickets page
  useEffect(() => {
    if (pathname.startsWith('/owner/tickets')) {
      setTicketsOpen(true);
    }
  }, [pathname]);

  // Fetch ticket category counts
  const fetchTicketCounts = useCallback(async () => {
    try {
      const { data } = await api.get('/owner/tickets/stats');
      setTicketCounts({
        all: parseInt(data.open_count || '0', 10) + parseInt(data.claimed_count || '0', 10),
        help: parseInt(data.help_count || '0', 10),
        appeal: parseInt(data.appeal_count || '0', 10),
        suggestion: parseInt(data.suggestion_count || '0', 10),
        bug: parseInt(data.bug_count || '0', 10),
        feedback: parseInt(data.feedback_count || '0', 10),
      });
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.isOwner) {
      fetchTicketCounts();
    }
  }, [isAuthenticated, user, fetchTicketCounts]);

  // Auth guard
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user?.isOwner)) {
      router.push('/servers');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || !user?.isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const basePath = '/owner';

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-64 bg-[var(--nexus-card)] border-r border-[var(--nexus-border)] flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header */}
        <div className="p-4 border-b border-[var(--nexus-border)]">
          <Link
            href="/servers"
            className="flex items-center gap-2 text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] text-sm mb-3 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Servers
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h2 className="font-semibold text-sm">
                <span className="text-[var(--nexus-yellow)]">Owner</span> Panel
              </h2>
              <p className="text-xs text-[var(--nexus-dim)]">Bot Administration</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--nexus-dim)] px-3 mb-1.5">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const href = `${basePath}${item.path}`;
                  const isActive = item.path === ''
                    ? pathname === basePath
                    : pathname.startsWith(href);

                  // Tickets dropdown
                  if (item.hasDropdown && item.path === '/tickets') {
                    return (
                      <div key={item.path}>
                        <div className="flex items-center">
                          <Link
                            href={href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-l-lg text-sm transition-colors ${
                              isActive
                                ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] font-medium'
                                : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
                            }`}
                          >
                            <span className="text-base">{item.icon}</span>
                            <span className="flex-1">{item.label}</span>
                            {ticketCounts.all > 0 && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--nexus-green)]/20 text-[var(--nexus-green)]">
                                {ticketCounts.all}
                              </span>
                            )}
                          </Link>
                          <button
                            onClick={() => setTicketsOpen(!ticketsOpen)}
                            className={`px-2 py-2.5 rounded-r-lg transition-colors ${
                              isActive
                                ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)]'
                                : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
                            }`}
                          >
                            <svg
                              className={`w-3.5 h-3.5 transition-transform ${ticketsOpen ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                        {ticketsOpen && (
                          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[var(--nexus-border)] pl-3">
                            {TICKET_CATEGORIES.map((cat) => {
                              const catHref = `${basePath}${cat.path}`;
                              const isCatActive = cat.key === ''
                                ? pathname === `${basePath}/tickets`
                                : pathname === catHref;
                              const count = cat.key ? ticketCounts[cat.key] : ticketCounts.all;

                              return (
                                <Link
                                  key={cat.key || 'all'}
                                  href={catHref}
                                  onClick={() => setSidebarOpen(false)}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                    isCatActive
                                      ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] font-medium'
                                      : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
                                  }`}
                                >
                                  <span>{cat.icon}</span>
                                  <span className="flex-1">{cat.label}</span>
                                  {count !== undefined && count > 0 && (
                                    <span className="text-[10px] text-[var(--nexus-dim)]">{count}</span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.path}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] font-medium'
                          : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:bg-white/5'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--nexus-red)] text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-[var(--nexus-border)]">
          <div className="flex items-center gap-3">
            <img
              src={getAvatarUrl(user.id, user.avatar, 64)}
              alt={user.username}
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-[var(--nexus-yellow)]">Bot Owner</p>
            </div>
            <button
              onClick={logout}
              className="text-[var(--nexus-dim)] hover:text-[var(--nexus-red)] transition-colors"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-[var(--nexus-dark)]/95 backdrop-blur-sm border-b border-[var(--nexus-border)] px-4 h-14 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-[var(--nexus-dim)]">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-2xl">⚡</span>
          <span className="font-semibold text-sm">
            <span className="text-[var(--nexus-yellow)]">Owner</span> Panel
          </span>
        </div>

        <div className="h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
