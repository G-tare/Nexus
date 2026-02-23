import EventEmitter from 'eventemitter3';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('EventBus');

/**
 * Centralized event bus for cross-module communication.
 *
 * Modules publish events here, and other modules subscribe.
 * This prevents circular dependencies between modules.
 *
 * Example:
 *   // In Leveling module: emit when user levels up
 *   eventBus.emit('levelUp', { guildId, userId, oldLevel: 4, newLevel: 5 });
 *
 *   // In Currency module: listen for level-ups to grant bonus
 *   eventBus.on('levelUp', ({ guildId, userId, newLevel }) => {
 *     grantCurrency(guildId, userId, newLevel * 10);
 *   });
 */

// ============================================
// Event Type Definitions
// ============================================

export interface BotEvents {
  // Leveling
  levelUp: { guildId: string; userId: string; oldLevel: number; newLevel: number };
  xpGain: { guildId: string; userId: string; amount: number; source: string };

  // Currency
  currencyEarned: { guildId: string; userId: string; amount: number; currencyType: string; source: string };
  currencySpent: { guildId: string; userId: string; amount: number; currencyType: string; source: string };
  currencyTransfer: { guildId: string; fromUserId: string; toUserId: string; amount: number; currencyType: string; tax?: number };

  // Moderation
  modAction: { guildId: string; action: string; targetId: string; moderatorId: string; reason?: string; caseNumber: number };
  warnThresholdReached: { guildId: string; userId: string; warnCount: number; threshold: number; action: string };

  // Activity
  messageCreated: { guildId: string; userId: string; channelId: string; messageId: string };
  voiceStateUpdate: { guildId: string; userId: string; channelId: string | null; action: 'join' | 'leave' | 'move' };

  // Invites
  memberInvited: { guildId: string; inviterId: string; invitedId: string; inviteCode: string };

  // Giveaways
  giveawayEnded: { guildId: string; giveawayId: number; winners: string[]; prize: string };

  // Games
  gameWon: { guildId: string; userId: string; game: string; reward?: number; bet?: number };
  gameLost: { guildId: string; userId: string; game: string; penalty?: number; bet?: number };

  // Boards
  messageStarred: { guildId: string; userId: string; messageId: string; boardType: string; count: number };

  // Counting
  countMilestone: { guildId: string; userId: string; count: number };

  // Tickets
  ticketCreated: { guildId: string; userId: string; ticketNumber: number; channelId: string };
  ticketClosed: { guildId: string; userId: string; ticketNumber: number; closedBy: string };

  // Reputation
  repGiven: { guildId: string; fromUserId: string; toUserId: string };

  // Welcome
  memberJoined: { guildId: string; userId: string; inviterId?: string };
  memberLeft: { guildId: string; userId: string };

  // Suggestions
  suggestionStatusChanged: { guildId: string; suggestionId: number; oldStatus: string; newStatus: string };

  // Generic logging hook
  auditLog: { guildId: string; type: string; data: Record<string, any> };

  // Shop
  itemPurchased: { guildId: string; userId: string; itemId: number; itemType: string; price: number; currencyType: string };

  // Confessions
  confessionCreated: { guildId: string; confessionNumber: number; messageId?: string };

  // Birthday
  birthdayTriggered: { guildId: string; userId: string };

  // Streak
  dailyClaimed: { guildId: string; userId: string; streak: number; multiplier?: number };

  // Premium
  premiumActivated: { guildId: string; tier: string; expiresAt: Date };
  premiumExpired: { guildId: string };

  // Anti-raid
  raidDetected: { guildId: string; joinCount: number; timeWindow: number };
  nukeDetected: { guildId: string; actionType: string; count: number; perpetratorId: string };

  // Forms
  formSubmitted: { guildId: string; formId: number; formName: string; userId: string; responseId: number };
  formReviewed: { guildId: string; formId: number; responseId: number; reviewerId: string; action: 'approve' | 'deny' };

  // Scheduled Messages
  scheduledMessageSent: { guildId: string; messageId: number; channelId: string; isRecurring: boolean };

  // Custom Commands
  customCommandTriggered: { guildId: string; commandName: string; userId: string; channelId: string };

  // Temp Voice
  tempVoiceCreated: { guildId: string; channelId: string; ownerId: string };
  tempVoiceDeleted: { guildId: string; channelId: string; ownerId: string; reason: 'empty' | 'inactivity' | 'force' };

  // Sticky Messages
  stickyReposted: { guildId: string; channelId: string; stickyId: number };

  // Activity Tracking
  'activityTracking:update': { guildId: string; userId: string; type: string; data: Record<string, any>; timestamp?: Date };

  // Anti-Raid extended
  'antiraid:lockdown': { guildId: string; initiatedBy: string; reason: string; duration?: number };
  'antiraid:unlockdown': { guildId: string; initiatedBy: string; timestamp?: Date };

  // AutoRoles
  autoRoleRuleCreated: { guildId: string; ruleId: string; type: string; roleId?: string };

  // Invite Tracker extended
  bonusInvitesAdded: { guildId: string; userId: string; amount: number; addedBy: string };
  bonusInvitesRemoved: { guildId: string; userId: string; amount: number; removedBy: string };
  inviteLeft: { guildId: string; userId: string; inviterId: string };
  inviteTracked: { guildId: string; inviterId: string; invitedId: string; code: string };
  invitesReset: { guildId: string; userId?: string; resetBy: string };

  // Reputation extended
  giveReputation: { guildId: string; fromUserId: string; toUserId: string; amount: number; delta?: number; givenBy?: string; reason?: string };
  reputationChanged: { guildId: string; userId: string; oldRep: number; newRep: number; reason: string; delta?: number };

  // Userphone
  userphoneCallStarted: { guildId1: string; guildId2: string; channelId1: string; channelId2: string; callId?: string; side1?: string; side2?: string; userId1?: string; userId2?: string };
  userphoneCallEnded: { guildId1: string; guildId2: string; reason: string; callId?: string; duration?: number; channelId1?: string; channelId2?: string };

  // XP Boost
  xpBoostExpired: { guildId: string; userId: string; boostType: string };
}

// ============================================
// Typed Event Bus
// ============================================

class TypedEventBus {
  private emitter = new EventEmitter();

  emit<K extends keyof BotEvents>(event: K, data: BotEvents[K]): boolean {
    logger.debug(`Event emitted: ${String(event)}`, { data });
    return this.emitter.emit(String(event), data);
  }

  on<K extends keyof BotEvents>(event: K, listener: (data: BotEvents[K]) => void): this {
    this.emitter.on(String(event), listener);
    return this;
  }

  once<K extends keyof BotEvents>(event: K, listener: (data: BotEvents[K]) => void): this {
    this.emitter.once(String(event), listener);
    return this;
  }

  off<K extends keyof BotEvents>(event: K, listener: (data: BotEvents[K]) => void): this {
    this.emitter.off(String(event), listener);
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
    return this;
  }
}

export const eventBus = new TypedEventBus();
export default eventBus;
