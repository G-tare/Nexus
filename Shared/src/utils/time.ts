import ms from 'ms';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Parse a human-readable duration string into milliseconds.
 * Supports: "1h", "30m", "1d", "2w", "1h30m", "1 day", "in 2 hours", etc.
 */
export function parseDuration(input: string): number | null {
  // Clean up common natural language patterns
  let cleaned = input.trim().toLowerCase();
  cleaned = cleaned.replace(/^in\s+/, '');
  cleaned = cleaned.replace(/\s+/g, '');

  // Try the ms library first (handles "1h", "2d", "30s", etc.)
  const result = ms(cleaned);
  if (result && result > 0) return result;

  // Handle compound durations like "1h30m", "2d12h"
  const compoundRegex = /(\d+)(d|h|m|s|w)/g;
  let total = 0;
  let match;
  while ((match = compoundRegex.exec(cleaned)) !== null) {
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 'w': total += value * 7 * 24 * 60 * 60 * 1000; break;
      case 'd': total += value * 24 * 60 * 60 * 1000; break;
      case 'h': total += value * 60 * 60 * 1000; break;
      case 'm': total += value * 60 * 1000; break;
      case 's': total += value * 1000; break;
    }
  }

  return total > 0 ? total : null;
}

/**
 * Format milliseconds into a human-readable string.
 * e.g., 3661000 → "1h 1m 1s"
 */
export function formatDuration(milliseconds: number): string {
  const d = dayjs.duration(milliseconds);
  const parts: string[] = [];

  const days = Math.floor(d.asDays());
  if (days > 0) parts.push(`${days}d`);

  const hours = d.hours();
  if (hours > 0) parts.push(`${hours}h`);

  const minutes = d.minutes();
  if (minutes > 0) parts.push(`${minutes}m`);

  const seconds = d.seconds();
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Get a relative time string.
 * e.g., "2 hours ago", "in 5 minutes"
 */
export function relativeTimeStr(date: Date): string {
  return dayjs(date).fromNow();
}

/**
 * Get a Discord timestamp string.
 * Discord renders these natively based on user's timezone.
 */
export function discordTimestamp(date: Date, style: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'f'): string {
  const unix = Math.floor(date.getTime() / 1000);
  return `<t:${unix}:${style}>`;
}

/**
 * Get time until a future date in a readable format.
 */
export function timeUntil(date: Date): string {
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff <= 0) return 'now';
  return formatDuration(diff);
}

export { dayjs };
