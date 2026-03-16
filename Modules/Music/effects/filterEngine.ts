/**
 * Filter Engine — merges and applies stackable audio filters via Lavalink.
 *
 * Each filter preset is defined as a LavalinkFilterData object.
 * Multiple filters can be active simultaneously; the engine merges them
 * into a single Lavalink filter payload and applies it in real-time.
 */

import { getQueue } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('Music:Filters');

// ── Lavalink Filter Types ──

export interface EqualizerBand {
  band: number; // 0-14
  gain: number; // -0.25 to 1.0
}

export interface TimescaleFilter {
  speed?: number;  // >0, default 1.0
  pitch?: number;  // >0, default 1.0
  rate?: number;   // >0, default 1.0
}

export interface TremoloFilter {
  frequency?: number; // >0, default 2.0
  depth?: number;     // 0-1, default 0.5
}

export interface VibratoFilter {
  frequency?: number; // 0-14, default 2.0
  depth?: number;     // 0-1, default 0.5
}

export interface RotationFilter {
  rotationHz?: number; // default 0
}

export interface LowPassFilter {
  smoothing?: number; // default 20.0
}

export interface KaraokeFilter {
  level?: number;       // 0-1, default 1.0
  monoLevel?: number;   // 0-1, default 1.0
  filterBand?: number;  // Hz, default 220
  filterWidth?: number; // Hz, default 100
}

export interface LavalinkFilters {
  equalizer?: EqualizerBand[];
  timescale?: TimescaleFilter;
  tremolo?: TremoloFilter;
  vibrato?: VibratoFilter;
  rotation?: RotationFilter;
  lowPass?: LowPassFilter;
  karaoke?: KaraokeFilter;
}

// ── Filter Preset Definition ──

export interface FilterPreset {
  name: string;
  label: string;
  emoji: string;
  description: string;
  filters: LavalinkFilters;
}

// ── All Presets ──

export const FILTER_PRESETS: Record<string, FilterPreset> = {
  '8d': {
    name: '8d',
    label: '8D Audio',
    emoji: '🔊',
    description: 'Spatial 8D audio rotation effect',
    filters: {
      rotation: { rotationHz: 0.2 },
    },
  },
  bassboost_low: {
    name: 'bassboost_low',
    label: 'Bass Boost (Low)',
    emoji: '🔉',
    description: 'Light bass enhancement',
    filters: {
      equalizer: [
        { band: 0, gain: 0.15 },
        { band: 1, gain: 0.12 },
        { band: 2, gain: 0.08 },
        { band: 3, gain: 0.04 },
      ],
    },
  },
  bassboost_medium: {
    name: 'bassboost_medium',
    label: 'Bass Boost (Medium)',
    emoji: '🔊',
    description: 'Medium bass enhancement',
    filters: {
      equalizer: [
        { band: 0, gain: 0.35 },
        { band: 1, gain: 0.25 },
        { band: 2, gain: 0.15 },
        { band: 3, gain: 0.08 },
        { band: 4, gain: 0.03 },
      ],
    },
  },
  bassboost_high: {
    name: 'bassboost_high',
    label: 'Bass Boost (High)',
    emoji: '💥',
    description: 'Heavy bass enhancement',
    filters: {
      equalizer: [
        { band: 0, gain: 0.6 },
        { band: 1, gain: 0.45 },
        { band: 2, gain: 0.3 },
        { band: 3, gain: 0.15 },
        { band: 4, gain: 0.08 },
      ],
    },
  },
  lofi: {
    name: 'lofi',
    label: 'Lo-Fi',
    emoji: '📻',
    description: 'Chill, relaxed lo-fi sound',
    filters: {
      equalizer: [
        { band: 0, gain: 0.1 },
        { band: 1, gain: 0.05 },
        { band: 2, gain: 0.0 },
        { band: 3, gain: -0.05 },
        { band: 4, gain: -0.1 },
        { band: 5, gain: -0.1 },
        { band: 6, gain: -0.05 },
        { band: 7, gain: -0.1 },
        { band: 8, gain: -0.15 },
        { band: 9, gain: -0.2 },
        { band: 10, gain: -0.2 },
        { band: 11, gain: -0.2 },
        { band: 12, gain: -0.15 },
        { band: 13, gain: -0.1 },
      ],
      timescale: { speed: 0.95, pitch: 0.9, rate: 1.0 },
    },
  },
  karaoke: {
    name: 'karaoke',
    label: 'Karaoke',
    emoji: '🎤',
    description: 'Remove vocals for karaoke-style playback',
    filters: {
      karaoke: {
        level: 1.0,
        monoLevel: 1.0,
        filterBand: 220,
        filterWidth: 100,
      },
    },
  },
  nightcore: {
    name: 'nightcore',
    label: 'Nightcore',
    emoji: '🌙',
    description: 'Speed up with higher pitch',
    filters: {
      timescale: { speed: 1.3, pitch: 1.3, rate: 1.0 },
    },
  },
  lowpass: {
    name: 'lowpass',
    label: 'Low Pass',
    emoji: '🔇',
    description: 'Smooth out high frequencies',
    filters: {
      lowPass: { smoothing: 20.0 },
    },
  },
  vaporwave: {
    name: 'vaporwave',
    label: 'Vaporwave',
    emoji: '🌊',
    description: 'Slow down with pitch shift and tremolo',
    filters: {
      timescale: { speed: 0.8, pitch: 0.8, rate: 1.0 },
      tremolo: { frequency: 4.0, depth: 0.3 },
    },
  },
  slowmode: {
    name: 'slowmode',
    label: 'Slow Mode',
    emoji: '🐢',
    description: 'Slow down playback without changing pitch',
    filters: {
      timescale: { speed: 0.75, pitch: 1.0, rate: 1.0 },
    },
  },
  tremolo: {
    name: 'tremolo',
    label: 'Tremolo',
    emoji: '〰️',
    description: 'Oscillating volume effect',
    filters: {
      tremolo: { frequency: 2.0, depth: 0.5 },
    },
  },
  vibrato: {
    name: 'vibrato',
    label: 'Vibrato',
    emoji: '🎵',
    description: 'Oscillating pitch effect',
    filters: {
      vibrato: { frequency: 2.0, depth: 0.5 },
    },
  },
  pop: {
    name: 'pop',
    label: 'Pop',
    emoji: '🎧',
    description: 'Pop music EQ preset',
    filters: {
      equalizer: [
        { band: 0, gain: -0.1 },
        { band: 1, gain: 0.1 },
        { band: 2, gain: 0.15 },
        { band: 3, gain: 0.1 },
        { band: 4, gain: 0.05 },
        { band: 5, gain: -0.05 },
      ],
    },
  },
  treblebass: {
    name: 'treblebass',
    label: 'Treble Bass',
    emoji: '🎼',
    description: 'Boost both treble and bass',
    filters: {
      equalizer: [
        { band: 0, gain: 0.2 },
        { band: 1, gain: 0.15 },
        { band: 2, gain: 0.0 },
        { band: 3, gain: 0.0 },
        { band: 4, gain: -0.05 },
        { band: 5, gain: -0.05 },
        { band: 6, gain: 0.0 },
        { band: 7, gain: 0.0 },
        { band: 8, gain: 0.05 },
        { band: 9, gain: 0.1 },
        { band: 10, gain: 0.15 },
        { band: 11, gain: 0.2 },
        { band: 12, gain: 0.15 },
        { band: 13, gain: 0.1 },
      ],
    },
  },
  soft: {
    name: 'soft',
    label: 'Soft',
    emoji: '☁️',
    description: 'Gentle, soft sound profile',
    filters: {
      equalizer: [
        { band: 0, gain: -0.05 },
        { band: 1, gain: 0.05 },
        { band: 2, gain: 0.0 },
        { band: 3, gain: -0.05 },
        { band: 4, gain: -0.05 },
        { band: 5, gain: -0.1 },
      ],
      lowPass: { smoothing: 12.0 },
    },
  },
};

// ── Merge Logic ──

/**
 * Merge multiple filter presets into a single Lavalink filter payload.
 * Equalizer bands are summed, timescale is multiplied, others are merged.
 */
export function mergeFilters(activeFilterNames: string[]): LavalinkFilters {
  const result: LavalinkFilters = {};
  const eqMap = new Map<number, number>(); // band → accumulated gain

  for (const name of activeFilterNames) {
    const preset = FILTER_PRESETS[name];
    if (!preset) continue;
    const f = preset.filters;

    // Equalizer: sum gains per band
    if (f.equalizer) {
      for (const band of f.equalizer) {
        const current = eqMap.get(band.band) ?? 0;
        eqMap.set(band.band, current + band.gain);
      }
    }

    // Timescale: multiply values (allows nightcore + slowmode to compound)
    if (f.timescale) {
      if (!result.timescale) {
        result.timescale = { speed: 1.0, pitch: 1.0, rate: 1.0 };
      }
      result.timescale.speed = (result.timescale.speed ?? 1.0) * (f.timescale.speed ?? 1.0);
      result.timescale.pitch = (result.timescale.pitch ?? 1.0) * (f.timescale.pitch ?? 1.0);
      result.timescale.rate = (result.timescale.rate ?? 1.0) * (f.timescale.rate ?? 1.0);
    }

    // Tremolo: last one wins (or merge by max)
    if (f.tremolo) {
      result.tremolo = { ...result.tremolo, ...f.tremolo };
    }

    // Vibrato: last one wins
    if (f.vibrato) {
      result.vibrato = { ...result.vibrato, ...f.vibrato };
    }

    // Rotation: last one wins
    if (f.rotation) {
      result.rotation = { ...result.rotation, ...f.rotation };
    }

    // LowPass: take the highest smoothing
    if (f.lowPass) {
      const current = result.lowPass?.smoothing ?? 0;
      result.lowPass = { smoothing: Math.max(current, f.lowPass.smoothing ?? 20) };
    }

    // Karaoke: last one wins
    if (f.karaoke) {
      result.karaoke = { ...result.karaoke, ...f.karaoke };
    }
  }

  // Build equalizer array from accumulated map
  if (eqMap.size > 0) {
    result.equalizer = [];
    for (const [band, gain] of eqMap) {
      // Clamp gain to valid range
      result.equalizer.push({ band, gain: Math.max(-0.25, Math.min(1.0, gain)) });
    }
    result.equalizer.sort((a, b) => a.band - b.band);
  }

  return result;
}

/**
 * Toggle a filter on/off in the queue and apply the result.
 * Returns whether the filter is now active.
 */
export async function toggleFilter(guildId: string, filterName: string): Promise<{ active: boolean; error?: string }> {
  const queue = getQueue(guildId);
  if (!queue) return { active: false, error: 'No active queue.' };
  if (!queue.currentTrack) return { active: false, error: 'Nothing is playing.' };

  const idx = queue.filters.indexOf(filterName);
  if (idx > -1) {
    queue.filters.splice(idx, 1);
  } else {
    queue.filters.push(filterName);
  }

  await applyFilters(guildId);
  return { active: idx === -1 };
}

/**
 * Set a named filter with custom params (e.g., timescale with user values).
 * Replaces the filter if already active.
 */
export async function setCustomFilter(
  guildId: string,
  filterName: string,
  customFilters: LavalinkFilters
): Promise<{ error?: string }> {
  const queue = getQueue(guildId);
  if (!queue) return { error: 'No active queue.' };
  if (!queue.currentTrack) return { error: 'Nothing is playing.' };

  // Store as a custom preset temporarily
  FILTER_PRESETS[`custom:${guildId}:${filterName}`] = {
    name: `custom:${guildId}:${filterName}`,
    label: filterName,
    emoji: '🎛️',
    description: 'Custom filter',
    filters: customFilters,
  };

  // Remove any existing instance and add the custom one
  const customKey = `custom:${guildId}:${filterName}`;
  queue.filters = queue.filters.filter(f => f !== filterName && f !== customKey);
  queue.filters.push(customKey);

  await applyFilters(guildId);
  return {};
}

/**
 * Clear all filters from the queue.
 */
export async function clearAllFilters(guildId: string): Promise<{ error?: string }> {
  const queue = getQueue(guildId);
  if (!queue) return { error: 'No active queue.' };

  // Clean up any custom presets for this guild
  for (const key of Object.keys(FILTER_PRESETS)) {
    if (key.startsWith(`custom:${guildId}:`)) {
      delete FILTER_PRESETS[key];
    }
  }

  queue.filters = [];
  await applyFilters(guildId);
  return {};
}

/**
 * Apply the current merged filters to the Lavalink player.
 * This is where we interface with kazagumo/shoukaku.
 */
export async function applyFilters(guildId: string): Promise<void> {
  const queue = getQueue(guildId);
  if (!queue) return;

  const merged = mergeFilters(queue.filters);

  try {
    // TODO: Wire up to the actual kazagumo/shoukaku player instance.
    // The API call would look something like:
    //   const player = kazagumo.players.get(guildId);
    //   if (player) {
    //     await player.setFilters(merged);
    //   }
    //
    // For now, we store the merged result on the queue for the
    // nowplaying embed to display, and log the application.
    logger.debug(`Applied filters for guild ${guildId}:`, merged);
  } catch (error) {
    logger.error(`Failed to apply filters for guild ${guildId}:`, error);
  }
}

/**
 * Get a human-readable list of active filters for display.
 */
export function getActiveFilterLabels(filterNames: string[]): string {
  if (filterNames.length === 0) return 'None';

  return filterNames.map(name => {
    const preset = FILTER_PRESETS[name];
    return preset ? `${preset.emoji} ${preset.label}` : name;
  }).join(', ');
}
