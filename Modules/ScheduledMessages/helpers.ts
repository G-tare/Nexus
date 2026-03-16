import { Guild, Channel, TextChannel } from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Cron expression parser
const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([0-9]|[1-2][0-9]|3[0-1])) (\*|([0-9]|1[0-2])|\*\/([0-9]|1[0-2])) (\*|([0-9]|[1-6]))$/;

interface ScheduledMessage {
  id: string;
  guildId: string;
  channelId: string;
  creatorId: string;
  content: string | null;
  embedData: Record<string, any> | null;
  scheduledFor: Date | null;
  cronExpression: string | null;
  isRecurring: boolean;
  isActive: boolean;
  lastSentAt: Date | null;
  createdAt: Date;
}

interface EmbedOptions {
  title?: string;
  description?: string;
  color?: string;
  footer?: string;
  image?: string;
  thumbnail?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

/**
 * Validate a cron expression
 */
export function isValidCron(expression: string): boolean {
  return cronRegex.test(expression.trim());
}

/**
 * Parse cron expression and get next fire time
 * Format: minute hour day month dayOfWeek
 */
export function getNextFireTime(cronExpression: string, fromDate: Date = new Date()): Date {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Invalid cron format');
  }

  const [minStr, hourStr, dayStr, monthStr, dowStr] = parts;
  const next = new Date(fromDate);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(next.getMinutes() + 1);

  let maxIterations = 366 * 24 * 60; // Max 1 year
  while (maxIterations-- > 0) {
    if (matchesCron(next, minStr, hourStr, dayStr, monthStr, dowStr)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  throw new Error('Could not calculate next fire time');
}

/**
 * Check if a date matches cron pattern
 */
function matchesCron(date: Date, minStr: string, hourStr: string, dayStr: string, monthStr: string, dowStr: string): boolean {
  const min = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const dow = date.getDay();

  return (
    matchesCronPart(min, minStr, 0, 59) &&
    matchesCronPart(hour, hourStr, 0, 23) &&
    matchesCronPart(day, dayStr, 1, 31) &&
    matchesCronPart(month, monthStr, 1, 12) &&
    matchesCronPart(dow, dowStr, 0, 6)
  );
}

/**
 * Match a value against a cron part
 */
function matchesCronPart(value: number, part: string, min: number, max: number): boolean {
  if (part === '*') return true;

  if (part.includes(',')) {
    return part.split(',').some(p => matchesCronPart(value, p.trim(), min, max));
  }

  if (part.includes('/')) {
    const [range, step] = part.split('/');
    const stepNum = parseInt(step);
    if (range === '*') {
      return value % stepNum === min % stepNum;
    }
    const [rangeMin, rangeMax] = range.includes('-') ? range.split('-').map(Number) : [min, max];
    if (value >= rangeMin && value <= rangeMax) {
      return (value - rangeMin) % stepNum === 0;
    }
    return false;
  }

  if (part.includes('-')) {
    const [rangeMin, rangeMax] = part.split('-').map(Number);
    return value >= rangeMin && value <= rangeMax;
  }

  return value === parseInt(part);
}

/**
 * Build a simple object from options (for V2 components compatibility)
 */
export function buildEmbed(options: EmbedOptions): Record<string, any> {
  const data: Record<string, any> = {};

  if (options.title) data.title = options.title;
  if (options.description) data.description = options.description;
  if (options.color) data.color = options.color;
  if (options.footer) data.footer = options.footer;
  if (options.image) data.image = options.image;
  if (options.thumbnail) data.thumbnail = options.thumbnail;
  if (options.fields) data.fields = options.fields;

  return data;
}

/**
 * Convert options object to JSON for storage
 */
export function embedToJSON(options: EmbedOptions): Record<string, any> {
  return {
    title: options.title,
    description: options.description,
    color: options.color,
    footer: options.footer,
    image: options.image,
    thumbnail: options.thumbnail,
    fields: options.fields,
  };
}

/**
 * Get readable format of next fire time
 */
export function formatNextFireTime(scheduledFor: Date | null, cronExpression: string | null, isRecurring: boolean): string {
  if (!isRecurring && scheduledFor) {
    const now = new Date();
    if (scheduledFor <= now) return 'Overdue';
    
    const diff = scheduledFor.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    return `in ${minutes}m`;
  }

  if (isRecurring && cronExpression) {
    try {
      const nextFire = getNextFireTime(cronExpression);
      const diff = nextFire.getTime() - new Date().getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `in ${hours}h ${minutes}m (recurring)`;
    } catch {
      return 'Invalid cron';
    }
  }

  return 'Not set';
}

/**
 * Validate scheduled message data
 */
export function validateScheduledMessage(data: Partial<ScheduledMessage>): { valid: boolean; error?: string } {
  if (!data.guildId || !data.channelId) {
    return { valid: false, error: 'Guild and channel are required' };
  }

  if (!data.content && !data.embedData) {
    return { valid: false, error: 'Content or embed data is required' };
  }

  if (data.isRecurring && data.cronExpression) {
    if (!isValidCron(data.cronExpression)) {
      return { valid: false, error: 'Invalid cron expression' };
    }
  }

  if (!data.isRecurring && !data.scheduledFor) {
    return { valid: false, error: 'Scheduled time is required for one-time messages' };
  }

  return { valid: true };
}

/**
 * Format cron expression for display
 */
export function formatCron(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return cronExpression;

  const [min, hour, day, month] = parts;
  const descriptions = [];

  if (hour !== '*') descriptions.push(`at ${hour}:${min === '*' ? '00' : min}`);
  if (day !== '*') descriptions.push(`on day ${day}`);
  if (month !== '*') descriptions.push(`in month ${month}`);

  return descriptions.length > 0 ? descriptions.join(', ') : cronExpression;
}

/**
 * Parse simple interval string (e.g., "2h", "30m", "1d")
 */
export function parseSimpleInterval(interval: string): string | null {
  const match = interval.toLowerCase().match(/^(\d+)([smhd])$/);
  if (!match) return null;

  const [, value, unit] = match;
  const num = parseInt(value);

  switch (unit) {
    case 's':
      return `*/${num} * * * *`; // Every N seconds (approximated as every minute)
    case 'm':
      return `*/${num} * * * *`; // Every N minutes
    case 'h':
      return `0 */${num} * * *`; // Every N hours
    case 'd':
      return `0 0 */${num} * *`; // Every N days
    default:
      return null;
  }
}

export type { ScheduledMessage, EmbedOptions };
