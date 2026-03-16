'use client';

import { useParams, useRouter } from 'next/navigation';
import { useGuildStore } from '@/stores/guild';
import { MODULE_REGISTRY } from '@/lib/types';
import { useState } from 'react';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Modules',
  moderation: 'Moderation',
  engagement: 'Engagement',
  fun: 'Fun & Games',
  economy: 'Economy',
  utility: 'Utility',
  social: 'Social',
};

export default function ModulesPage() {
  const { guildId } = useParams() as { guildId: string };
  const router = useRouter();
  const { modules, toggleModule } = useGuildStore();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const filtered = MODULE_REGISTRY.filter((mod) => {
    if (category !== 'all' && mod.category !== category) return false;
    if (search && !mod.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const categories = ['all', ...new Set(MODULE_REGISTRY.map((m) => m.category))];

  const handleToggle = async (e: React.MouseEvent, moduleKey: string, enabled: boolean) => {
    e.stopPropagation(); // Prevent card click navigation
    setToggling(moduleKey);
    try {
      await toggleModule(guildId, moduleKey, enabled);
    } catch {
      // Error handled in store
    }
    setToggling(null);
  };

  const navigateToModule = (moduleKey: string) => {
    router.push(`/dashboard/${guildId}/modules/${moduleKey}`);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Modules</h1>
      <p className="text-[var(--nexus-dim)] mb-6">Enable, disable, and configure bot modules for your server.</p>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nexus-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search modules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--nexus-card)] border border-[var(--nexus-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--nexus-cyan)]/50 transition-colors"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-[var(--nexus-cyan)]/10 text-[var(--nexus-cyan)] border border-[var(--nexus-cyan)]/30'
                  : 'text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] border border-transparent hover:border-[var(--nexus-border)]'
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((mod) => {
          const config = modules[mod.key];
          const isEnabled = config?.enabled ?? false;
          const isToggling = toggling === mod.key;

          return (
            <div
              key={mod.key}
              onClick={() => navigateToModule(mod.key)}
              className="nexus-card p-4 flex items-center gap-4 cursor-pointer hover:border-[var(--nexus-cyan)]/30 transition-all group"
            >
              <span className="text-2xl">{mod.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm group-hover:text-[var(--nexus-cyan)] transition-colors">{mod.name}</h3>
                <span className="text-xs text-[var(--nexus-dim)] capitalize">{mod.category}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Configure arrow */}
                <svg className="w-4 h-4 text-[var(--nexus-dim)] group-hover:text-[var(--nexus-cyan)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <button
                  onClick={(e) => handleToggle(e, mod.key, !isEnabled)}
                  disabled={isToggling}
                  className={`toggle-switch ${isEnabled ? 'active' : ''} ${isToggling ? 'opacity-50' : ''}`}
                  aria-label={`Toggle ${mod.name}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[var(--nexus-dim)]">
          No modules match your search.
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 text-sm text-[var(--nexus-dim)] text-center">
        {Object.values(modules).filter((m) => m.enabled).length} of {MODULE_REGISTRY.length} modules enabled
      </div>
    </div>
  );
}
