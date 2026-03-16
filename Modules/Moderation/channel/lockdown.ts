import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successContainer, errorContainer, addFields, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { cache } from '../../../Shared/src/cache/cacheManager';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock all text channels in the server')
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for server-wide lockdown')
        .setMaxLength(512))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.lockdown',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const reason = interaction.options.getString('reason') || 'Server-wide lockdown initiated';
    const guild = interaction.guild!;

    await interaction.deferReply();

    try {
      const textChannels = guild.channels.cache.filter(
        ch => ch.type === ChannelType.GuildText && ch.viewable
      );

      if (textChannels.size === 0) {
        await interaction.editReply(v2Payload([
          errorContainer('No Channels', 'No text channels found to lock.')
        ]));
        return;
      }

      const everyoneRole = guild.roles.everyone;
      const lockedChannelIds: string[] = [];
      let successCount = 0;
      let failureCount = 0;

      // Lock all channels
      for (const [, channel] of textChannels) {
        try {
          await (channel as any).permissionOverwrites.edit(everyoneRole, {
            SendMessages: false,
          }, `Lockdown initiated by ${interaction.user.tag}: ${reason}`);

          lockedChannelIds.push(channel.id);
          successCount++;

          // Send lock notice in channel
          const noticeContainer = new ContainerBuilder();
          noticeContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### 🔒 Server Lockdown\n${reason}`)
          );
          noticeContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**Initiated By:** ${interaction.user.tag}\n**Time:** <t:${Math.floor(Date.now() / 1000)}:f>\n\n-# All channels have been locked.`)
          );

          await (channel as any).send({ components: [noticeContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        } catch {
          failureCount++;
        }
      }

      // Store locked channel IDs in cache for unlockdown command
      const lockdownKey = `lockdown:${guild.id}`;
      cache.set(lockdownKey, {
        channelIds: lockedChannelIds,
        initiatedBy: interaction.user.id,
        initiatedAt: Date.now(),
        reason,
      }, 7 * 24 * 60 * 60);

      // Reply to user
      const container = successContainer('Lockdown Initiated', 'Server-wide lockdown has been activated.');
      addFields(container, [
        { name: 'Channels Locked', value: `${successCount}`, inline: true },
        { name: 'Failed', value: `${failureCount}`, inline: true },
        { name: 'Reason', value: reason }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Lockdown error:', error);
      await interaction.editReply(v2Payload([
        errorContainer('Failed', 'Could not initiate server lockdown. Please check my permissions.')
      ]));
    }
  },
};

export default command;
