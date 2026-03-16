'use client';

import { useState, useRef, useEffect } from 'react';
import type { Role, Channel } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────

/** Read a potentially nested config value (e.g. "welcome.enabled") */
function getNestedValue(config: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  if (parts.length === 1) return config[key];
  const parent = config[parts[0]];
  if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
    return (parent as Record<string, unknown>)[parts[1]];
  }
  return undefined;
}

/** Set a potentially nested config value */
function setNestedValue(config: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  const next = { ...config };
  const parts = key.split('.');
  if (parts.length === 1) {
    next[key] = value;
  } else {
    const parentKey = parts[0];
    const childKey = parts[1];
    const parent = (next[parentKey] && typeof next[parentKey] === 'object' && !Array.isArray(next[parentKey]))
      ? { ...(next[parentKey] as Record<string, unknown>) }
      : {};
    parent[childKey] = value;
    next[parentKey] = parent;
  }
  return next;
}

// ─── ConfigSection ────────────────────────────────────────────────────

export function ConfigSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-1.5 pl-1">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--nexus-dim)]">{title}</span>
      </div>
      <div className="nexus-card divide-y divide-[var(--nexus-border)] flex-1">
        {children}
      </div>
    </div>
  );
}

// ─── ConfigGrid ─ 2-column layout for desktop ────────────────────────

export function ConfigGrid({ children, cols }: { children: React.ReactNode; cols?: 2 | 3 }) {
  const colClass = cols === 3
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    : 'grid grid-cols-1 lg:grid-cols-2';
  return (
    <div className={colClass} style={{ columnGap: '1rem', rowGap: '1.75rem', marginBottom: '1.75rem' }}>
      {children}
    </div>
  );
}

// ─── ConfigToggle ─────────────────────────────────────────────────────

export function ConfigToggle({
  label,
  description,
  configKey,
  config,
  onChange,
}: {
  label: string;
  description?: string;
  configKey: string;
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
}) {
  const value = getNestedValue(config, configKey) as boolean | undefined;
  const checked = value === true;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <span className="text-sm">{label}</span>
        {description && <p className="text-xs text-[var(--nexus-dim)] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(setNestedValue(config, configKey, !checked))}
        className={`toggle-switch ${checked ? 'active' : ''}`}
      />
    </div>
  );
}

// ─── ConfigNumberField ────────────────────────────────────────────────

export function ConfigNumberField({
  label,
  configKey,
  config,
  onChange,
  placeholder = '0',
}: {
  label: string;
  configKey: string;
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
  placeholder?: string;
}) {
  const rawValue = getNestedValue(config, configKey);
  const numValue = typeof rawValue === 'number' ? rawValue : (Number(rawValue) || 0);

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm">{label}</span>
      <input
        type="number"
        value={numValue}
        placeholder={placeholder}
        onChange={(e) => {
          const n = e.target.value === '' ? 0 : Number(e.target.value);
          if (!isNaN(n)) onChange(setNestedValue(config, configKey, n));
        }}
        className="w-24 text-right text-sm font-mono text-[var(--nexus-cyan)] bg-transparent border-b border-[var(--nexus-border)] focus:border-[var(--nexus-cyan)] outline-none py-1"
      />
    </div>
  );
}

// ─── ConfigTextField ──────────────────────────────────────────────────

export function ConfigTextField({
  label,
  configKey,
  config,
  onChange,
  placeholder = '',
  multiline = false,
  description,
}: {
  label: string;
  configKey: string;
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
  placeholder?: string;
  multiline?: boolean;
  description?: string;
}) {
  const value = (getNestedValue(config, configKey) as string) || '';

  return (
    <div className="px-4 py-3">
      <label className="text-xs text-[var(--nexus-dim)] mb-1 block">{label}</label>
      {description && <p className="text-[10px] text-[var(--nexus-dim)] mb-1.5 opacity-70">{description}</p>}
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(setNestedValue(config, configKey, e.target.value))}
          rows={3}
          className="w-full text-sm font-mono bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 focus:border-[var(--nexus-cyan)] outline-none resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(setNestedValue(config, configKey, e.target.value))}
          className="w-full text-sm font-mono bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-3 py-2 focus:border-[var(--nexus-cyan)] outline-none"
        />
      )}
    </div>
  );
}

// ─── ConfigPicker (Dropdown) ──────────────────────────────────────────

export function ConfigPicker({
  label,
  configKey,
  config,
  onChange,
  options,
}: {
  label: string;
  configKey: string;
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
  options: { value: string; label: string }[];
}) {
  const value = (getNestedValue(config, configKey) as string) || options[0]?.value || '';

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(setNestedValue(config, configKey, e.target.value))}
        className="text-sm text-[var(--nexus-cyan)] bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-2 py-1 outline-none focus:border-[var(--nexus-cyan)] cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── ConfigChannelPicker ──────────────────────────────────────────────

export function ConfigChannelPicker({
  label,
  configKey,
  config,
  onChange,
  channels,
  voiceOnly = false,
}: {
  label: string;
  configKey: string;
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
  channels: Channel[];
  voiceOnly?: boolean;
}) {
  const value = (getNestedValue(config, configKey) as string) || '';
  const filtered = voiceOnly ? channels.filter((c) => c.type === 2) : channels.filter((c) => c.type === 0 || c.type === 5);
  const typeIcons: Record<number, string> = { 0: '#', 2: '🔊', 5: '📢' };

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(setNestedValue(config, configKey, e.target.value || null))}
        className="text-sm text-[var(--nexus-cyan)] bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-2 py-1 outline-none focus:border-[var(--nexus-cyan)] cursor-pointer max-w-[200px]"
      >
        <option value="">None</option>
        {filtered.map((ch) => (
          <option key={ch.id} value={ch.id}>
            {typeIcons[ch.type] || '#'} {ch.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── ConfigRolePicker ─────────────────────────────────────────────────

export function ConfigRolePicker({
  label,
  configKey,
  config,
  onChange,
  roles,
}: {
  label: string;
  configKey: string;
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
  roles: Role[];
}) {
  const value = (getNestedValue(config, configKey) as string) || '';
  const selectable = roles.filter((r) => !r.managed);

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(setNestedValue(config, configKey, e.target.value || null))}
        className="text-sm text-[var(--nexus-cyan)] bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg px-2 py-1 outline-none focus:border-[var(--nexus-cyan)] cursor-pointer max-w-[200px]"
      >
        <option value="">None</option>
        {selectable.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── ConfigColorPicker ────────────────────────────────────────────────

const PRESET_COLORS = [
  '#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245',
  '#00D4FF', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444',
  '#3498DB', '#2ECC71', '#E74C3C', '#9B59B6', '#F39C12',
  '#1ABC9C', '#E67E22', '#FF6B35', '#FFD700', '#FFFFFF',
];

export function ConfigColorPicker({
  label,
  configKey,
  config,
  onChange,
  defaultColor = '#5865F2',
}: {
  label: string;
  configKey: string;
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
  defaultColor?: string;
}) {
  const value = (getNestedValue(config, configKey) as string) || defaultColor;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex items-center justify-between px-4 py-3 relative" ref={ref}>
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1 border border-[var(--nexus-border)] rounded-lg hover:border-[var(--nexus-cyan)] transition-colors"
      >
        <div className="w-5 h-5 rounded" style={{ backgroundColor: value }} />
        <span className="text-xs font-mono text-[var(--nexus-dim)]">{value}</span>
      </button>

      {open && (
        <div className="absolute right-4 top-full mt-1 z-50 nexus-card p-3 shadow-lg w-56">
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(setNestedValue(config, configKey, c)); setOpen(false); }}
                className="w-8 h-8 rounded border border-[var(--nexus-border)] hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const hex = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(hex)) {
                onChange(setNestedValue(config, configKey, hex));
              }
            }}
            placeholder="#FFFFFF"
            className="w-full text-xs font-mono bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded px-2 py-1 outline-none focus:border-[var(--nexus-cyan)]"
          />
        </div>
      )}
    </div>
  );
}
