import { 
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getActivityConfig, getInactiveMembers } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('ActivityTracking');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('inactivelist')
    .setDescription('View a list of inactive members in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  module: 'activitytracking',
  permissionPath: 'activitytracking.staff.inactivelist',
  premiumFeature: 'activitytracking.management',
  cooldown: 10,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.' });
        return;
      }

      await interaction.deferReply();

      const config = await getActivityConfig(interaction.guild.id);
      const members = await interaction.guild.members.fetch();

      // Get users who HAVE activity in the threshold period (active users)
      const activeUserIds = new Set(await getInactiveMembers(interaction.guild.id, config.inactiveThresholdDays));

      // Find inactive members (members NOT in the active set)
      const inactiveMembers = members.filter((member) => {
        if (member.user.bot) return false;
        const memberRoles = member.roles.cache.map((r) => r.id);
        if (memberRoles.some((roleId) => config.excludedRoles.includes(roleId))) return false;
        return !activeUserIds.has(member.id);
      });

      if (inactiveMembers.size === 0) {
        await interaction.editReply({
          content: `No inactive members found. All members have been active in the last ${config.inactiveThresholdDays} days.`,
        });
        return;
      }

      // Sort by join date (oldest first)
      const sortedMembers = inactiveMembers.sort((a, b) => (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0));

      const embedList: EmbedBuilder[] = [];
      const membersPerEmbed = 25;
      const memberArray = sortedMembers.toJSON();

      for (let i = 0; i < memberArray.length; i += membersPerEmbed) {
        const batch = memberArray.slice(i, i + membersPerEmbed);

        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle(`Inactive Members (${config.inactiveThresholdDays} days) - Page ${Math.floor(i / membersPerEmbed) + 1}`)
          .setDescription(
            batch
              .map(
                (member, index) =>
                  `**${i + index + 1}.** ${member.user.username}\nJoined: <t:${Math.floor((member.joinedTimestamp || 0) / 1000)}:R>`
              )
              .join('\n\n')
          )
          .setFooter({ text: `Total inactive members: ${inactiveMembers.size}` })
          .setTimestamp();

        embedList.push(embed);
      }

      await interaction.editReply({ embeds: [embedList[0]] });

      for (let i = 1; i < Math.min(embedList.length, 5); i++) {
        await interaction.followUp({ embeds: [embedList[i]] });
      }
    } catch (error) {
      logger.error('Error executing inactivelist command', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ An error occurred while fetching the inactive members list.' });
      } else {
        await interaction.reply({ content: '❌ An error occurred.' });
      }
    }
  },
};

export default command;
