import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getLevelingConfig } from '../helpers';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.staff.levelroles',
  premiumFeature: 'leveling.basic',
  defaultPermissions: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageGuild],
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('Manage level-based role rewards')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a role reward for reaching a level')
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('The level required to earn this role')
            .setMinValue(0)
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to award')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a level role reward')
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('The level to remove the role reward from')
            .setMinValue(0)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('View all level role rewards')
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guildId!;
      const guild = interaction.guild!;
      const subcommand = interaction.options.getSubcommand();
      const config = await getLevelingConfig(guildId);

      if (subcommand === 'add') {
        const level = interaction.options.getInteger('level', true);
        const role = interaction.options.getRole('role', true);

        // Check if this level already has a reward
        const existing = config.levelRoles.find(lr => lr.level === level);
        if (existing) {
          return interaction.editReply({
            embeds: [
              errorEmbed('Already Exists', `Level ${level} already has a role reward: <@&${existing.roleId}>`)
                .setColor(Colors.Error)
            ]
          });
        }

        // Add the new reward
        config.levelRoles.push({ level, roleId: role.id });
        config.levelRoles.sort((a, b) => a.level - b.level);

        await moduleConfig.setConfig(guildId, 'leveling', config);

        return interaction.editReply({
          embeds: [
            successEmbed(
              'Level Role Added',
              `Members reaching **Level ${level}** will now receive <@&${role.id}>.`
            )
              .setColor(Colors.Leveling)
              .setTimestamp()
          ]
        });
      } else if (subcommand === 'remove') {
        const level = interaction.options.getInteger('level', true);

        const index = config.levelRoles.findIndex(lr => lr.level === level);
        if (index === -1) {
          return interaction.editReply({
            embeds: [
              errorEmbed('Not Found', `No level role reward exists for level ${level}.`)
                .setColor(Colors.Error)
            ]
          });
        }

        const removed = config.levelRoles.splice(index, 1)[0];
        await moduleConfig.setConfig(guildId, 'leveling', config);

        return interaction.editReply({
          embeds: [
            successEmbed(
              'Level Role Removed',
              `Removed role reward from level ${level}: <@&${removed.roleId}>`
            )
              .setColor(Colors.Leveling)
              .setTimestamp()
          ]
        });
      } else if (subcommand === 'list') {
        if (config.levelRoles.length === 0) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Leveling)
                .setTitle('Level Role Rewards')
                .setDescription('No level rewards have been configured yet.')
                .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
                .setTimestamp()
            ]
          });
        }

        const sorted = [...config.levelRoles].sort((a, b) => a.level - b.level);
        let description = '';

        for (const reward of sorted) {
          description += `**Level ${reward.level}** → <@&${reward.roleId}>\n`;
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.Leveling)
          .setTitle('Level Role Rewards')
          .setDescription(description)
          .setFooter({ text: `${sorted.length} level rewards configured`, iconURL: guild.iconURL() || undefined })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('[LevelRoles Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while managing level roles.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
