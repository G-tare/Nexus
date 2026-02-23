import { createModuleLogger } from '../../Shared/src/utils/logger';

interface ActivityRecord {
  timestamp: number;
}

interface ChannelActivity {
  messages: ActivityRecord[];
}

export class ActivityTracker {
  private activities: Map<string, ChannelActivity> = new Map();
  private windowSize = 60000; // 1 minute in milliseconds

  recordMessage(channelId: string): void {
    if (!this.activities.has(channelId)) {
      this.activities.set(channelId, { messages: [] });
    }

    const activity = this.activities.get(channelId)!;
    const now = Date.now();

    // Add new message
    activity.messages.push({ timestamp: now });

    // Remove messages outside the window
    activity.messages = activity.messages.filter(
      (msg) => now - msg.timestamp < this.windowSize
    );
  }

  getActivityLevel(channelId: string): 'low' | 'medium' | 'high' {
    const activity = this.activities.get(channelId);
    if (!activity) return 'low';

    const now = Date.now();
    const recentMessages = activity.messages.filter(
      (msg) => now - msg.timestamp < this.windowSize
    );

    const messagesPerMinute = recentMessages.length;

    if (messagesPerMinute < 1) return 'low';
    if (messagesPerMinute <= 5) return 'medium';
    return 'high';
  }

  getThreshold(
    channelId: string,
    baseInterval: number,
    mode: 'interval' | 'activity' | 'hybrid'
  ): number {
    if (mode === 'interval') return baseInterval;

    const activityLevel = this.getActivityLevel(channelId);

    if (mode === 'activity') {
      switch (activityLevel) {
        case 'low':
          return 3;
        case 'medium':
          return 8;
        case 'high':
          return 15;
        default:
          return baseInterval;
      }
    }

    // Hybrid mode: use minimum of baseInterval, but adjust up based on activity
    if (mode === 'hybrid') {
      const activityThreshold = this.getActivityThreshold(activityLevel);
      return Math.max(baseInterval, activityThreshold);
    }

    return baseInterval;
  }

  private getActivityThreshold(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low':
        return 3;
      case 'medium':
        return 8;
      case 'high':
        return 15;
    }
  }

  cleanup(channelId: string): void {
    this.activities.delete(channelId);
  }

  cleanupAll(): void {
    this.activities.clear();
  }
}

export const activityTracker = new ActivityTracker();
