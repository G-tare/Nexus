import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getBirthdayConfig,
  getBirthday,
  getAge,
  parseAnnouncementMessage,
  buildBirthdayAnnouncementEmbed,
  markBirthdayAnnounced,
  trackBirthdayRole,
} from '../helpers';
import { eventBus } from '../../../Shared/src/events/eventBus';

const command: BotCommand = {
  module: 'birthdays',
  permissionPath: 'birthdays.announce',
  premiumFeature: 'birthdays.basic',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('birthdayannounce')
    .setDescription('Manually trigger a birthday announcement (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to announce birthday for')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const config = await getBirthdayConfig(interaction.guildId!);
      if (!config.enabled) {
        return await interaction.editReply({
          content: '❌ Birthday module is disabled in this server.',
        });
      }

      if (!config.channelId) {
        return await interaction.editReply({
          content: '❌ No birthday announcement channel is set. Use `/birthdayconfig channel` to set one.',
        });
      }

      const targetUser = interaction.options.getUser('user', true);
      const entry = await getBirthday(targetUser.id);

      if (!entry) {
        return await interaction.editReply({
          content: `❌ ${targetUser.username} doesn't have a birthday set.`,
        });
      }

      const channel = interaction.guild!.channels.cache.get(config.channelId) as TextChannel;
      if (!channel || !channel.isTextBased()) {
        return await interaction.editReply({
          content: '❌ Birthday announcement channel is invalid or inaccessible.',
        });
      }

      // Calculate age
      const age = entry.birthdayYear ? getAge(entry.birthdayYear, entry.birthday) : null;
      const showAge = config.showAge && age !== null;

      // Build announcement
      const displayName = entry.globalName || entry.username || targetUser.username;
      const message = parseAnnouncementMessage(
        config.announcementMessage,
        targetUser.id,
        displayName,
        showAge ? age : null
      ).replace(/\{server\}/g, interaction.guild!.name);

      const embed = buildBirthdayAnnouncementEmbed(
        targetUser.id,
        displayName,
        message,
        showAge ? age : null,
        config.showAge
      );
      embed.setThumbnail(targetUser.displayAvatarURL({ size: 256 }));
      embed.setFooter({ text: `Manually announced by ${interaction.user.username}` });

      await (channel as any).send({ embeds: [embed] });
      await markBirthdayAnnounced(interaction.guildId!, targetUser.id);

      // Assign birthday role if configured
      if (config.roleId) {
        try {
          const member = await interaction.guild!.members.fetch(targetUser.id);
          if (member) {
            await member.roles.add(config.roleId, 'Birthday role (manual announce)');
            await trackBirthdayRole(interaction.guildId!, targetUser.id);
          }
        } catch (err) {
          console.error('[Birthdays] Failed to assign birthday role:', err);
        }
      }

      eventBus.emit('birthdayTriggered', {
        guildId: interaction.guildId!,
        userId: targetUser.id,
      });

      eventBus.emit('auditLog', {
        guildId: interaction.guildId!,
        type: 'BIRTHDAY_MANUAL_ANNOUNCE',
        data: {
          targetId: targetUser.id,
          announcedBy: interaction.user.id,
        },
      });

      await interaction.editReply({
        content: `✅ Birthday announcement sent for ${targetUser.username} in <#${config.channelId}>.`,
      });
    } catch (error) {
      console.error('[Birthdays] /birthdayannounce error:', error);
      await interaction.editReply({
        content: '❌ An error occurred while sending the announcement.',
      });
    }
  },
};

export default command;
