/**
 * Appeals Channel Auto-Setup
 *
 * When an appeals channel is selected in the config (via /configs or dashboard),
 * this automatically sets up permission overrides:
 *
 * 1. @everyone — ViewChannel: false (hidden from everyone by default)
 * 2. Quarantine role — ViewChannel: true, SendMessages: true (quarantined users can appeal)
 * 3. Bot — ViewChannel: true, SendMessages: true (bot needs to post in the channel)
 *
 * Muted users get a per-user ViewChannel: true override when muted (and removed on unmute).
 * Since Discord timeout prevents sending messages, muted users appeal via button → modal.
 *
 * Also posts a persistent "Appeal" message with a button in the channel.
 */

import {
  Client,
  TextChannel,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { eventBus } from '../../Shared/src/events/eventBus';
import { addTitleSection, addFields as addFieldsV2 } from '../../Shared/src/utils/componentsV2';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('AppealsSetup');

/**
 * Register the configUpdated listener for appeals channel auto-setup.
 * Must be called once with the bot client.
 */
export function registerAppealsSetup(client: Client): void {
  eventBus.on('configUpdated', async (data) => {
    if (data.moduleName !== 'moderation') return;

    const oldChannelId = data.oldConfig.appealChannelId as string | null | undefined;
    const newChannelId = data.newConfig.appealChannelId as string | null | undefined;
    const quarantineRoleId = data.newConfig.quarantineRoleId as string | null | undefined;

    // Only act if the appeals channel actually changed
    if (oldChannelId === newChannelId) return;

    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) return;

    // If old channel was set, clean up its overrides
    if (oldChannelId) {
      await cleanupAppealsChannel(guild, oldChannelId);
    }

    // If new channel is set, apply appeal overrides
    if (newChannelId) {
      await setupAppealsChannel(guild, newChannelId, quarantineRoleId ?? null);
    }
  });

  logger.info('Appeals channel auto-setup listener registered');
}

/**
 * Set up the appeals channel with correct permissions and post a persistent appeal message.
 */
async function setupAppealsChannel(
  guild: import('discord.js').Guild,
  channelId: string,
  quarantineRoleId: string | null,
): Promise<void> {
  const channel = guild.channels.cache.get(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    logger.warn(`Appeals channel ${channelId} not found or not a text channel in ${guild.id}`);
    return;
  }

  const textChannel = channel as TextChannel;

  logger.info(`Setting up appeals channel #${textChannel.name} in ${guild.name}`);

  try {
    // 1. Hide from @everyone
    await textChannel.permissionOverwrites.edit(guild.id, {
      ViewChannel: false,
    }, { reason: 'Appeals channel setup: hide from everyone' });

    // 2. Allow bot to see and send
    if (guild.members.me) {
      await textChannel.permissionOverwrites.edit(guild.members.me.id, {
        ViewChannel: true,
        SendMessages: true,
        EmbedLinks: true,
      }, { reason: 'Appeals channel setup: bot access' });
    }

    // 3. Allow quarantine role to see and send (if configured)
    if (quarantineRoleId) {
      await textChannel.permissionOverwrites.edit(quarantineRoleId, {
        ViewChannel: true,
        SendMessages: true,
        AddReactions: false,
      }, { reason: 'Appeals channel setup: quarantine role access' });
    }

    // 4. Post a persistent appeal instructions message
    await postAppealInstructions(textChannel, guild.id);

    logger.info(`Appeals channel setup complete for ${guild.name}`);
  } catch (err: any) {
    logger.error(`Failed to set up appeals channel in ${guild.name}`, { error: err.message });
  }
}

/**
 * Post or refresh the appeal instructions message with a button.
 */
async function postAppealInstructions(channel: TextChannel, guildId: string): Promise<void> {
  // Delete any old appeal instruction messages by the bot
  try {
    const messages = await channel.messages.fetch({ limit: 20 });
    const botMessages = messages.filter(
      m => m.author.id === channel.client.user?.id
        && m.components.length > 0
    );
    for (const [, msg] of botMessages) {
      await msg.delete().catch(() => {});
    }
  } catch {
    // Non-fatal — channel might be empty
  }

  const container = new ContainerBuilder().setAccentColor(0x5865F2);
  addTitleSection(container, '📝 Appeal Your Punishment');
  addFieldsV2(container, [
    {
      name: 'How to Appeal',
      value: 'If you have been muted or quarantined and believe it was in error, you can submit an appeal by clicking the button below.\n\n'
        + '**Please include:**\n'
        + '• Your case number (from the DM notification)\n'
        + '• Why you believe the action was unjust\n'
        + '• Any relevant context\n\n'
        + 'A moderator will review your appeal and respond.',
    },
  ]);

  const appealButton = new ButtonBuilder()
    .setCustomId(`moderation:appealform:${guildId}`)
    .setLabel('Submit Appeal')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📝');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(appealButton);
  container.addActionRowComponents(row);

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * Clean up appeals channel overrides when the channel is unset.
 */
async function cleanupAppealsChannel(
  guild: import('discord.js').Guild,
  channelId: string,
): Promise<void> {
  const channel = guild.channels.cache.get(channelId);
  if (!channel || !('permissionOverwrites' in channel)) return;

  logger.info(`Cleaning up old appeals channel overrides in ${guild.name}`);

  try {
    // Restore @everyone visibility (remove our override)
    const everyoneOverride = channel.permissionOverwrites.cache.get(guild.id);
    if (everyoneOverride) {
      await everyoneOverride.delete('Appeals channel unset: restoring default visibility');
    }
  } catch (err: any) {
    logger.debug(`Failed to clean appeals overrides: ${err.message}`);
  }
}

/**
 * Grant a muted user ViewChannel on the appeals channel so they can see the
 * appeal button. They can't send messages (Discord timeout prevents it), but
 * they CAN use buttons and submit modals via interactions.
 */
export async function grantAppealsAccess(
  guild: import('discord.js').Guild,
  userId: string,
  appealChannelId: string,
): Promise<void> {
  const channel = guild.channels.cache.get(appealChannelId);
  if (!channel || !('permissionOverwrites' in channel)) return;

  try {
    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: true,
    }, { reason: 'Muted user: grant appeals channel visibility' });
  } catch (err: any) {
    logger.debug(`Failed to grant appeals access for ${userId}: ${err.message}`);
  }
}

/**
 * Remove a user's ViewChannel override on the appeals channel.
 * Called when a mute is removed or when a user is unquarantined.
 */
export async function revokeAppealsAccess(
  guild: import('discord.js').Guild,
  userId: string,
  appealChannelId: string,
): Promise<void> {
  const channel = guild.channels.cache.get(appealChannelId);
  if (!channel || !('permissionOverwrites' in channel)) return;

  try {
    const override = channel.permissionOverwrites.cache.get(userId);
    if (override) {
      await override.delete('Punishment removed: revoke appeals channel visibility');
    }
  } catch (err: any) {
    logger.debug(`Failed to revoke appeals access for ${userId}: ${err.message}`);
  }
}
