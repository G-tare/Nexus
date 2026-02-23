/**
 * Type definitions for the Confessions module
 */

/**
 * Configuration for the confessions module per guild
 */
export interface ConfessionConfig {
  /** Whether confessions are enabled */
  enabled: boolean;

  /** Channel ID where confessions are posted */
  channelId?: string;

  /** Whether moderation queue is enabled */
  moderationEnabled: boolean;

  /** Channel ID for moderation queue */
  moderationChannelId?: string;

  /** If true, even server owner cannot see who confessed */
  fullAnonymity: boolean;

  /** Cooldown between confessions per user in seconds */
  cooldownSeconds: number;

  /** Words that automatically reject confessions */
  blacklistedWords: string[];

  /** Auto-incrementing confession counter */
  confessionCounter: number;

  /** Whether to allow image attachments */
  allowImages: boolean;

  /** Hex color for embeds */
  embedColor: string;

  /** User hashes of banned confessors */
  bannedHashes: string[];
}

/**
 * Stored confession data
 */
export interface StoredConfession {
  /** SHA256 hash of user ID */
  userHash: string;

  /** User ID (only stored if fullAnonymity is false) */
  userId?: string;

  /** Confession text */
  content: string;

  /** Unix timestamp when confession was submitted */
  timestamp: number;

  /** URL to attached image (if any) */
  imageUrl?: string;
}

/**
 * Pending confession in moderation queue
 */
export interface PendingConfession extends StoredConfession {
  /** Confession ID number */
  number: number;
}

/**
 * Approved confession ready to post
 */
export interface ApprovedConfession extends StoredConfession {
  /** Confession ID number */
  number: number;
}

/**
 * User cooldown state
 */
export interface CooldownState {
  /** Guild ID */
  guildId: string;

  /** User ID */
  userId: string;

  /** Remaining cooldown in seconds */
  remainingSeconds: number;
}

/**
 * Moderation action
 */
export interface ModerationAction {
  /** Type of action */
  type: 'approve' | 'deny';

  /** Confession ID */
  confessionId: number;

  /** Who performed the action */
  moderatorId: string;

  /** When the action was performed */
  timestamp: number;

  /** Reason for denial (if deny action) */
  reason?: string;
}

/**
 * Confession statistics for a guild
 */
export interface ConfessionStats {
  /** Total confessions submitted */
  totalConfessions: number;

  /** Total users banned */
  totalBanned: number;

  /** Total blacklisted words */
  totalBlacklistedWords: number;

  /** Whether moderation is enabled */
  moderationEnabled: boolean;

  /** Whether full anonymity is enabled */
  fullAnonymity: boolean;
}
