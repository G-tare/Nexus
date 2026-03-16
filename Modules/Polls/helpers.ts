import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder } from 'discord.js';

export interface PollConfig {
  enabled: boolean;
  defaultAnonymous: boolean;
  defaultShowLiveResults: boolean;
  defaultMaxVotes: number;
  maxOptions: number;
  maxDuration: number;
  logChannelId?: string;
}

export interface PollData {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  creatorId: string;
  question: string;
  options: string[];
  votes: Record<string, string[]>;
  anonymous: boolean;
  showLiveResults: boolean;
  maxVotes: number;
  endsAt?: Date;
  status: 'active' | 'ended';
  createdAt: Date;
}

const DEFAULT_CONFIG: PollConfig = {
  enabled: true,
  defaultAnonymous: false,
  defaultShowLiveResults: true,
  defaultMaxVotes: 1,
  maxOptions: 10,
  maxDuration: 168,
  logChannelId: undefined,
};

export async function getPollConfig(guildId: string, redis: any): Promise<PollConfig> {
  const key = `polls:config:${guildId}`;
  const stored = await redis.get(key);
  if (stored) {
    return JSON.parse(stored);
  }
  return { ...DEFAULT_CONFIG };
}

export async function setPollConfig(guildId: string, config: Partial<PollConfig>, redis: any): Promise<void> {
  const key = `polls:config:${guildId}`;
  const current = await getPollConfig(guildId, redis);
  const updated = { ...current, ...config };
  await redis.set(key, JSON.stringify(updated), 'EX', 2592000); // 30 days
}

export async function createPoll(data: PollData, redis: any): Promise<void> {
  const key = `polls:data:${data.id}`;
  await redis.set(key, JSON.stringify(data), 'EX', 2592000); // 30 days

  // Add to guild index
  const indexKey = `polls:guild:${data.guildId}`;
  await redis.sadd(indexKey, data.id);
}

export async function getPoll(pollId: string, redis: any): Promise<PollData | null> {
  const key = `polls:data:${pollId}`;
  const data = await redis.get(key);
  if (!data) return null;
  const poll = JSON.parse(data);
  if (poll.endsAt) {
    poll.endsAt = new Date(poll.endsAt);
  }
  if (poll.createdAt) {
    poll.createdAt = new Date(poll.createdAt);
  }
  return poll;
}

export async function getPollByMessage(messageId: string, redis: any): Promise<PollData | null> {
  const key = `polls:message:${messageId}`;
  const pollId = await redis.get(key);
  if (!pollId) return null;
  return getPoll(pollId, redis);
}

export async function storePollMessage(messageId: string, pollId: string, redis: any): Promise<void> {
  const key = `polls:message:${messageId}`;
  await redis.set(key, pollId, 'EX', 2592000);
}

export async function castVote(
  pollId: string,
  userId: string,
  optionIndex: number,
  redis: any
): Promise<{ success: boolean; reason?: string }> {
  const poll = await getPoll(pollId, redis);
  if (!poll) {
    return { success: false, reason: 'Poll not found' };
  }

  if (poll.status === 'ended') {
    return { success: false, reason: 'Poll has ended' };
  }

  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    return { success: false, reason: 'Invalid option' };
  }

  // Initialize votes array for option if needed
  if (!poll.votes[optionIndex.toString()]) {
    poll.votes[optionIndex.toString()] = [];
  }

  const userVotes = Object.values(poll.votes).flat();
  const userVoteCount = userVotes.filter((id) => id === userId).length;

  // Check max votes constraint
  if (poll.maxVotes > 0 && userVoteCount >= poll.maxVotes) {
    return { success: false, reason: `You can only vote for ${poll.maxVotes} option(s)` };
  }

  // Add vote
  if (!poll.votes[optionIndex.toString()].includes(userId)) {
    poll.votes[optionIndex.toString()].push(userId);
  }

  // Save updated poll
  const key = `polls:data:${pollId}`;
  await redis.set(key, JSON.stringify(poll), 'EX', 2592000);

  return { success: true };
}

export async function removeVote(
  pollId: string,
  userId: string,
  optionIndex: number,
  redis: any
): Promise<{ success: boolean; reason?: string }> {
  const poll = await getPoll(pollId, redis);
  if (!poll) {
    return { success: false, reason: 'Poll not found' };
  }

  const optionKey = optionIndex.toString();
  if (!poll.votes[optionKey]) {
    return { success: false, reason: 'No votes on this option' };
  }

  const index = poll.votes[optionKey].indexOf(userId);
  if (index === -1) {
    return { success: false, reason: 'You have not voted on this option' };
  }

  poll.votes[optionKey].splice(index, 1);

  const key = `polls:data:${pollId}`;
  await redis.set(key, JSON.stringify(poll), 'EX', 2592000);

  return { success: true };
}

export async function endPoll(pollId: string, redis: any): Promise<{ success: boolean; poll?: PollData; reason?: string }> {
  const poll = await getPoll(pollId, redis);
  if (!poll) {
    return { success: false, reason: 'Poll not found' };
  }

  if (poll.status === 'ended') {
    return { success: false, reason: 'Poll is already ended' };
  }

  poll.status = 'ended';
  const key = `polls:data:${pollId}`;
  await redis.set(key, JSON.stringify(poll), 'EX', 2592000);

  return { success: true, poll };
}

export function buildPollContainer(poll: PollData, showResults: boolean): ContainerBuilder {
  const container = new ContainerBuilder()
    .setAccentColor(poll.status === 'ended' ? 0x808080 : 0x0099ff);

  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  let description = '';

  if (showResults && poll.status === 'active') {
    // Show live results
    for (let i = 0; i < poll.options.length; i++) {
      const voteCount = poll.votes[i.toString()]?.length || 0;
      const totalVotes = Object.values(poll.votes).flat().length;
      const percent = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
      const bar = formatPercentBar(percent, 20);
      description += `${numberEmojis[i]} ${poll.options[i]}\n${bar} ${voteCount} vote${voteCount !== 1 ? 's' : ''}\n\n`;
    }
  } else if (poll.status === 'ended') {
    // Show final results
    for (let i = 0; i < poll.options.length; i++) {
      const voteCount = poll.votes[i.toString()]?.length || 0;
      const totalVotes = Object.values(poll.votes).flat().length;
      const percent = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
      const bar = formatPercentBar(percent, 20);
      description += `${numberEmojis[i]} ${poll.options[i]}\n${bar} ${voteCount} vote${voteCount !== 1 ? 's' : ''}\n\n`;
    }
  } else {
    // Don't show results yet
    for (let i = 0; i < poll.options.length; i++) {
      description += `${numberEmojis[i]} ${poll.options[i]}\n`;
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${poll.question}\n${description.trim()}`)
  );

  let footerText = `Poll ID: ${poll.id}`;
  const visibility = poll.anonymous ? 'Anonymous' : 'Public';
  footerText += ` • ${visibility}`;

  if (poll.maxVotes > 0) {
    footerText += ` • Max ${poll.maxVotes} vote${poll.maxVotes !== 1 ? 's' : ''}`;
  } else {
    footerText += ' • Unlimited votes';
  }

  if (poll.endsAt) {
    const timeLeft = Math.round((poll.endsAt.getTime() - Date.now()) / 1000);
    if (timeLeft > 0) {
      footerText += ` • Ends in ${formatTime(timeLeft)}`;
    } else {
      footerText += ' • Ended';
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${footerText}`)
  );

  return container;
}

export function buildResultsContainer(poll: PollData): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0x28a745);

  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  let description = '';
  let maxVotes = 0;
  const voteCounts: number[] = [];

  for (let i = 0; i < poll.options.length; i++) {
    const voteCount = poll.votes[i.toString()]?.length || 0;
    voteCounts.push(voteCount);
    maxVotes = Math.max(maxVotes, voteCount);
  }

  const totalVotes = voteCounts.reduce((a, b) => a + b, 0);

  for (let i = 0; i < poll.options.length; i++) {
    const voteCount = voteCounts[i];
    const percent = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
    const bar = formatPercentBar(percent, 20);
    const isWinner = maxVotes > 0 && voteCount === maxVotes;
    const prefix = isWinner ? '🏆 ' : '';
    description += `${prefix}${numberEmojis[i]} ${poll.options[i]}\n${bar} ${voteCount} vote${voteCount !== 1 ? 's' : ''}\n\n`;
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### Results: ${poll.question}\n${description.trim()}`)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Total votes: ${totalVotes}`)
  );

  return container;
}

export function buildPollComponents(poll: PollData): ActionRowBuilder<ButtonBuilder>[] {
  const buttons: ButtonBuilder[] = [];
  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  for (let i = 0; i < poll.options.length; i++) {
    const button = new ButtonBuilder()
      .setCustomId(`poll_vote_${poll.id}_${i}`)
      .setLabel(poll.options[i])
      .setStyle(ButtonStyle.Primary)
      .setEmoji(numberEmojis[i]);

    buttons.push(button);
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5));
    rows.push(row);
  }

  return rows;
}

export function generatePollId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function formatPercentBar(percent: number, length: number): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${bar} ${percent.toFixed(1)}%`;
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)([smhd])$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}
