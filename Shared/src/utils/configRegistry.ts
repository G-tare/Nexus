/**
 * Config Registry — metadata-driven configuration system.
 * Each module registers its config fields so the /configs dashboard
 * can render the UI automatically without hardcoding.
 */

// ── Field Types ──

export type ConfigFieldType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'choice'
  | 'channel'
  | 'role'
  | 'channel-array'
  | 'role-array';

export interface ConfigFieldChoice {
  label: string;
  value: string;
  description?: string;
}

export interface ConfigField {
  /** Key in the config object (e.g., 'enabled', 'channelId') */
  key: string;
  /** UI display type */
  type: ConfigFieldType;
  /** Human-readable label shown in the embed */
  label: string;
  /** Short description shown as help text */
  description: string;
  /** For 'choice' type: available options */
  choices?: ConfigFieldChoice[];
  /** For 'number' type: min value */
  min?: number;
  /** For 'number' type: max value */
  max?: number;
  /** Default value (for display purposes) */
  default?: unknown;
}

// ── Module Config Metadata ──

export type ModuleCategory =
  | 'Moderation'
  | 'Engagement'
  | 'Economy'
  | 'Fun'
  | 'Music'
  | 'Voice'
  | 'Social'
  | 'Utility'
  | 'Protection'
  | 'Entertainment';

export interface ModuleConfigMeta {
  /** Internal module key (matches moduleConfig key, e.g., 'counting') */
  moduleKey: string;
  /** Display name (e.g., 'Counting') */
  label: string;
  /** Short description of the module */
  description: string;
  /** Emoji icon for the module */
  emoji: string;
  /** Category for grouping in the UI */
  category: ModuleCategory;
  /** Config fields this module exposes */
  fields: ConfigField[];
}

// ── Registry ──

const registry = new Map<string, ModuleConfigMeta>();

/**
 * Register a module's config metadata for the /configs dashboard.
 */
export function registerModuleConfig(meta: ModuleConfigMeta): void {
  registry.set(meta.moduleKey, meta);
}

/**
 * Get a single module's config metadata by key.
 */
export function getModuleConfigMeta(moduleKey: string): ModuleConfigMeta | undefined {
  return registry.get(moduleKey);
}

/**
 * Get all registered module config metadata.
 */
export function getAllModuleConfigMeta(): ModuleConfigMeta[] {
  return Array.from(registry.values());
}

/**
 * Get modules grouped by category for the UI.
 */
export function getModulesByCategory(): Map<ModuleCategory, ModuleConfigMeta[]> {
  const grouped = new Map<ModuleCategory, ModuleConfigMeta[]>();
  for (const meta of registry.values()) {
    const list = grouped.get(meta.category) ?? [];
    list.push(meta);
    grouped.set(meta.category, list);
  }
  return grouped;
}

/**
 * Format a config value for display in an embed.
 */
export function formatConfigValue(field: ConfigField, value: unknown): string {
  if (value === undefined || value === null) return '*Not set*';

  switch (field.type) {
    case 'boolean':
      return value ? '✅ Enabled' : '❌ Disabled';
    case 'channel':
      return value ? `<#${value}>` : '*Not set*';
    case 'role':
      return value ? `<@&${value}>` : '*Not set*';
    case 'channel-array': {
      const arr = value as string[];
      return arr.length > 0 ? arr.map(id => `<#${id}>`).join(', ') : '*None*';
    }
    case 'role-array': {
      const arr = value as string[];
      return arr.length > 0 ? arr.map(id => `<@&${id}>`).join(', ') : '*None*';
    }
    case 'choice': {
      const match = field.choices?.find(c => c.value === String(value));
      return match ? match.label : String(value);
    }
    case 'number':
      return String(value);
    case 'string':
      return value ? `"${value}"` : '*Not set*';
    default:
      return String(value);
  }
}

// ── Category Emoji Map ──

export const CATEGORY_EMOJIS: Record<ModuleCategory, string> = {
  Moderation: '🛡️',
  Engagement: '🎯',
  Economy: '💰',
  Fun: '🎪',
  Music: '🎵',
  Voice: '🎙️',
  Social: '💬',
  Utility: '🔧',
  Protection: '🔒',
  Entertainment: '🎮',
};
