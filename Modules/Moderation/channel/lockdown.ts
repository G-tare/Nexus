import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';
import { getRedis } from '../../../Shared/src/database/connection';

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
        await interaction.editReply({
          embeds: [errorEmbed('No Channels', 'No text channels found to lock.')],
        });
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
          const notice = new EmbedBuilder()
            .setColor(Colors.Warning)
            .setTitle('🔒 Server Lockdown')
            .setDescription(reason)
            .addFields(
              { name: 'Initiated By', value: `${interaction.user.tag}`, inline: true },
              { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
            )
            .setFooter({ text: 'All channels have been locked.' });

          await (channel as any).send({ embeds: [notice] }).catch(() => {});
        } catch {
          failureCount++;
        }
      }

      // Store locked channel IDs in Redis for unlockdown command
      const redis = getRedis();
      const lockdownKey = `lockdown:${guild.id}`;
      await redis.setex(lockdownKey, 7 * 24 * 60 * 60, JSON.stringify({
        channelIds: lockedChannelIds,
        initiatedBy: interaction.user.id,
        initiatedAt: Date.now(),
        reason,
      }));

      // Reply to user
      const embed = successEmbed('Lockdown Initiated', `Server-wide lockdown has been activated.`)
        .addFields(
          { name: 'Channels Locked', value: `${successCount}`, inline: true },
          { name: 'Failed', value: `${failureCount}`, inline: true },
          { name: 'Reason', value: reason }
        )
        .setColor(Colors.Warning);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Lockdown error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Failed', 'Could not initiate server lockdown. Please check my permissions.')],
      });
    }
  },
};

export default command;
