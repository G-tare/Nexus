import {  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, errorEmbed } from '../../../Shared/src/utils/embed';
import { getLevelingConfig } from '../helpers';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.rewards',
  premiumFeature: 'leveling.basic',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('rewards')
    .setDescription('View the level role rewards for this server'),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const guildId = interaction.guildId!;

      if (!guildId) {
        return interaction.editReply({
          embeds: [
            errorEmbed('Error', 'This command can only be used in a server.')
              .setColor(Colors.Error)
          ]
        });
      }

      const config = await getLevelingConfig(guildId);
      const guild = interaction.guild!;

      // Sort level roles by level ascending
      const sortedRoles = [...config.levelRoles].sort((a, b) => a.level - b.level);

      if (sortedRoles.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.Leveling)
              .setTitle('Level Role Rewards')
              .setDescription('No level rewards have been set up yet.')
              .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
              .setTimestamp()
          ]
        });
      }

      // Build rewards list
      let description = '';
      for (const reward of sortedRoles) {
        description += `**Level ${reward.level}** → <@&${reward.roleId}>\n`;
      }

      const stackStatus = config.stackRoles
        ? 'Roles stack (you keep all earned roles)'
        : 'Roles replace (you only have the highest level role)';

      const embed = new EmbedBuilder()
        .setColor(Colors.Leveling)
        .setTitle('Level Role Rewards')
        .setDescription(description)
        .addFields(
          {
            name: 'Stack Mode',
            value: stackStatus,
            inline: false
          }
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[Rewards Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while fetching the rewards.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
