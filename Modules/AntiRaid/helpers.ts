import { Guild, GuildMember, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { getDb, getRedis } from '../../Shared/src/database/connection';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { sql } from 'drizzle-orm';

const logger = createModuleLogger('AntiRaid');

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface AntiRaidConfig {
  enabled: boolean;
  joinThreshold: number;
  joinWindow: number;
  minAccountAge: number;
  autoLockdown: boolean;
  lockdownDuration: number;
  massActionThreshold: number;
  massActionWindow: number;
  alertChannelId: string;
  quarantineRoleId: string;
  whitelistedRoles: string[];
  action: 'kick' | 'ban' | 'quarantine' | 'alert';
  verificationEnabled: boolean;
  verificationMessage: string;
}

export const defaultAntiRaidConfig: AntiRaidConfig = {
  enabled: false,
  joinThreshold: 10,
  joinWindow: 60,
  minAccountAge: 24,
  autoLockdown: false,
  lockdownDuration: 3600,
  massActionThreshold: 5,
  massActionWindow: 60,
  alertChannelId: '',
  quarantineRoleId: '',
  whitelistedRoles: [],
  action: 'quarantine',
  verificationEnabled: true,
  verificationMessage: 'Welcome! Please verify you are human by clicking the button below.',
};

// ── Config ──────────────────────────────────────────────────────────────────

export async function getAntiRaidConfig(guildId: string): Promise<AntiRaidConfig> {
  try {
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'antiraid');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
    return { ...defaultAntiRaidConfig, ...config };
  } catch {
    return defaultAntiRaidConfig;
  }
}

export async function saveAntiRaidConfig(guildId: string, config: AntiRaidConfig): Promise<void> {
  await moduleConfig.updateConfig(guildId, 'antiraid', config);
  logger.info(`AntiRaid config updated for guild ${guildId}`);
}

// ── Join Tracking ───────────────────────────────────────────────────────────

export async function recordJoin(guildId: string, userId: string, accountAge: number): Promise<void> {
  const redis = getRedis();
  const joinKey = `antiraid:joins:${guildId}`;
  const joinTimestamp = Math.floor(Date.now() / 1000);

  await redis.zadd(joinKey, joinTimestamp, `${userId}:${joinTimestamp}`);
  await redis.expire(joinKey, 3600);
}

export async function getJoinVelocity(guildId: string): Promise<{ totalJoins: number; newAccountJoins: number; userIds: string[] }> {
  const redis = getRedis();
  const config = await getAntiRaidConfig(guildId);
  const joinKey = `antiraid:joins:${guildId}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.joinWindow;

  const joins = await redis.zrangebyscore(joinKey, windowStart, now);
  const userIds = joins.map((j: string) => j.split(':')[0]);

  let newAccountCount = 0;
  for (const join of joins) {
    const [userId] = join.split(':');
    const accountAgeKey = `antiraid:accountage:${guildId}:${userId}`;
    const accountAge = await redis.get(accountAgeKey);
    if (accountAge) {
      const ageHours = (now - parseInt(accountAge)) / 3600;
      if (ageHours < config.minAccountAge) {
        newAccountCount++;
      }
    }
  }

  return { totalJoins: joins.length, newAccountJoins: newAccountCount, userIds };
}

export async function checkRaidCondition(guildId: string): Promise<{ isRaid: boolean; joinCount: number; newAccountCount: number }> {
  const config = await getAntiRaidConfig(guildId);
  const velocity = await getJoinVelocity(guildId);

  const isRaid = velocity.totalJoins >= config.joinThreshold || velocity.newAccountJoins >= Math.ceil(config.joinThreshold * 0.5);

  return { isRaid, joinCount: velocity.totalJoins, newAccountCount: velocity.newAccountJoins };
}

// ── Mass Action Detection ───────────────────────────────────────────────────

export async function recordAction(guildId: string, userId: string, actionType: 'ban' | 'kick' | 'role_delete' | 'channel_delete'): Promise<void> {
  const redis = getRedis();
  const actionKey = `antiraid:actions:${guildId}:${actionType}`;
  const timestamp = Math.floor(new Date().getTime() / 1000);

  await redis.zadd(actionKey, timestamp, `${userId}:${timestamp}`);
  await redis.expire(actionKey, 3600);
}

export async function checkMassAction(guildId: string, userId: string): Promise<{ isMassAction: boolean; actionCount: number; actionType?: string }> {
  const redis = getRedis();
  const config = await getAntiRaidConfig(guildId);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.massActionWindow;

  const actionTypes = ['ban', 'kick', 'role_delete', 'channel_delete'];

  for (const actionType of actionTypes) {
    const actionKey = `antiraid:actions:${guildId}:${actionType}`;
    const actions = await redis.zrangebyscore(actionKey, windowStart, now);

    if (actions.length >= config.massActionThreshold) {
      return { isMassAction: true, actionCount: actions.length, actionType };
    }
  }

  return { isMassAction: false, actionCount: 0 };
}

// ── Lockdown ────────────────────────────────────────────────────────────────

export async function triggerLockdown(guild: Guild, duration: number): Promise<void> {
  const redis = getRedis();
  const lockdownKey = `antiraid:lockdown:${guild.id}`;
  const lockedChannelsKey = `antiraid:lockdown:channels:${guild.id}`;
  const expiryTime = Math.floor(Date.now() / 1000) + duration;

  await redis.setex(lockdownKey, duration, JSON.stringify({ startTime: Date.now(), duration, expiryTime }));

  try {
    const lockedChannelIds: string[] = [];

    for (const channel of guild.channels.cache.values()) {
      if (channel.isTextBased() || channel.isVoiceBased()) {
        try {
          // Skip channels that are already restricted — don't touch intentional overrides
          const everyoneOverride = (channel as any).permissionOverwrites?.cache?.get(guild.roles.everyone.id);
          if (everyoneOverride?.deny.has(PermissionFlagsBits.SendMessages)) {
            continue;
          }
          await (channel as any).permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: false,
            Connect: false,
            Speak: false,
          }, { reason: 'AntiRaid lockdown triggered' });
          lockedChannelIds.push(channel.id);
        } catch (error) {
          logger.warn(`Failed to lockdown channel ${channel.id}: ${error}`);
        }
      }
    }

    // Store which channels WE locked so we only unlock those
    await redis.setex(lockedChannelsKey, duration + 120, JSON.stringify(lockedChannelIds));

    logger.info(`Lockdown triggered for guild ${guild.id} for ${duration}s (${lockedChannelIds.length} channels locked)`);
    await sendRaidAlert(guild, { action: 'LOCKDOWN_TRIGGERED', duration, reason: 'Suspected raid detected' });

    eventBus.emit('antiraid:lockdown', { guildId: guild.id, initiatedBy: 'system', reason: 'Suspected raid detected', duration });
  } catch (error) {
    logger.error(`Failed to trigger lockdown for guild ${guild.id}:`, error);
  }
}

export async function endLockdown(guild: Guild): Promise<void> {
  const redis = getRedis();
  const lockdownKey = `antiraid:lockdown:${guild.id}`;
  const lockedChannelsKey = `antiraid:lockdown:channels:${guild.id}`;

  await redis.del(lockdownKey);

  try {
    // Only unlock channels that WE locked during the raid lockdown
    const lockedChannelsData = await redis.get(lockedChannelsKey);
    const lockedChannelIds: string[] = lockedChannelsData ? JSON.parse(lockedChannelsData) : [];

    if (lockedChannelIds.length === 0) {
      logger.info(`No tracked locked channels for guild ${guild.id} — skipping unlock`);
      await redis.del(lockedChannelsKey);
      await sendRaidAlert(guild, { action: 'LOCKDOWN_ENDED', reason: 'Manual unlock (no channels to restore)' });
      eventBus.emit('antiraid:unlockdown', { guildId: guild.id, initiatedBy: 'system' });
      return;
    }

    for (const channelId of lockedChannelIds) {
      try {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) continue;

        await (channel as any).permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: null,
          Connect: null,
          Speak: null,
        }, { reason: 'AntiRaid lockdown ended — restoring channel' });
      } catch (error) {
        logger.warn(`Failed to restore channel ${channelId}: ${error}`);
      }
    }

    await redis.del(lockedChannelsKey);

    logger.info(`Lockdown ended for guild ${guild.id} (${lockedChannelIds.length} channels restored)`);
    await sendRaidAlert(guild, { action: 'LOCKDOWN_ENDED', reason: 'Manual unlock or expiry' });

    eventBus.emit('antiraid:unlockdown', { guildId: guild.id, initiatedBy: 'system' });
  } catch (error) {
    logger.error(`Failed to end lockdown for guild ${guild.id}:`, error);
  }
}

export async function isInLockdown(guildId: string): Promise<boolean> {
  const redis = getRedis();
  const lockdownKey = `antiraid:lockdown:${guildId}`;
  const lockdown = await redis.get(lockdownKey);
  return lockdown !== null;
}

// ── Quarantine ──────────────────────────────────────────────────────────────

export async function quarantineMember(member: GuildMember, reason: string): Promise<void> {
  const config = await getAntiRaidConfig(member.guild.id);

  if (!config.quarantineRoleId) {
    logger.warn(`No quarantine role configured for guild ${member.guild.id}`);
    return;
  }

  try {
    const quarantineRole = member.guild.roles.cache.get(config.quarantineRoleId);
    if (!quarantineRole) {
      logger.warn(`Quarantine role ${config.quarantineRoleId} not found in guild ${member.guild.id}`);
      return;
    }

    await member.roles.add(quarantineRole, `AntiRaid: ${reason}`);
    logger.info(`Quarantined member ${member.id} in guild ${member.guild.id}`);

    const redis = getRedis();
    const quarantineKey = `antiraid:quarantine:${member.guild.id}:${member.id}`;
    await redis.setex(quarantineKey, 86400, JSON.stringify({ reason, timestamp: new Date() }));
  } catch (error) {
    logger.error(`Failed to quarantine member ${member.id}:`, error);
  }
}

// ── Alerts ──────────────────────────────────────────────────────────────────

export async function sendRaidAlert(guild: Guild, details: Record<string, any>): Promise<void> {
  const config = await getAntiRaidConfig(guild.id);

  if (!config.alertChannelId) {
    logger.warn(`No alert channel configured for guild ${guild.id}`);
    return;
  }

  try {
    const channel = guild.channels.cache.get(config.alertChannelId) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      logger.warn(`Alert channel ${config.alertChannelId} not found or not text-based in guild ${guild.id}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('⚠️ AntiRaid Alert')
      .setDescription('Raid detection system triggered')
      .addFields(
        { name: 'Guild', value: guild.name, inline: true },
        { name: 'Action', value: details.action || 'UNKNOWN', inline: true },
        { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: 'AntiRaid System' })
      .setTimestamp();

    if (details.joinCount) embed.addFields({ name: 'Join Count (window)', value: `${details.joinCount}`, inline: true });
    if (details.newAccountCount !== undefined) embed.addFields({ name: 'New Accounts', value: `${details.newAccountCount}`, inline: true });
    if (details.duration) embed.addFields({ name: 'Lockdown Duration', value: `${details.duration}s`, inline: true });
    if (details.reason) embed.addFields({ name: 'Reason', value: details.reason, inline: false });

    await (channel as any).send({ embeds: [embed] });
  } catch (error) {
    logger.error(`Failed to send raid alert for guild ${guild.id}:`, error);
  }
}

// ── Verification ────────────────────────────────────────────────────────────

export async function sendVerification(member: GuildMember): Promise<void> {
  const config = await getAntiRaidConfig(member.guild.id);

  if (!config.verificationEnabled) return;

  try {
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('Welcome to ' + member.guild.name)
      .setDescription(config.verificationMessage)
      .setThumbnail(member.guild.iconURL() || null)
      .setFooter({ text: 'Verification required to proceed' })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`antiraidverify:${member.id}`)
      .setLabel('Verify')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await member.send({ embeds: [embed], components: [row] });
    logger.info(`Verification message sent to member ${member.id}`);
  } catch (error) {
    logger.warn(`Failed to send verification to member ${member.id}:`, error);
  }
}

// ── Raid Logging ────────────────────────────────────────────────────────────

export async function logRaidAction(guild: Guild, action: string, details: Record<string, any>): Promise<void> {
  const db = getDb();

  try {
    await db.execute(sql`
      INSERT INTO raid_logs (guild_id, action, details, created_at)
      VALUES (${guild.id}, ${action}, ${JSON.stringify(details)}, NOW())
    `);

    logger.info(`Raid action logged: ${action} for guild ${guild.id}`);
  } catch (error) {
    logger.error(`Failed to log raid action:`, error);
  }
}

// ── Utility ─────────────────────────────────────────────────────────────────

export async function storeAccountAge(guildId: string, userId: string, joinTimestamp: number): Promise<void> {
  const redis = getRedis();
  const accountAgeKey = `antiraid:accountage:${guildId}:${userId}`;
  await redis.setex(accountAgeKey, 86400, joinTimestamp.toString());
}

export async function cleanupOldJoins(guildId: string): Promise<void> {
  const redis = getRedis();
  const config = await getAntiRaidConfig(guildId);
  const joinKey = `antiraid:joins:${guildId}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.joinWindow;

  await redis.zremrangebyscore(joinKey, '-inf', windowStart);
  logger.debug(`Cleaned up old joins for guild ${guildId}`);
}
