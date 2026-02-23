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
  permissionPath: 'leveling.staff.xpmultiplier',
  premiumFeature: 'leveling.basic',
  defaultPermissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('xpmultiplier')
    .setDescription('Manage role-based XP multipliers')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set an XP multiplier for a role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to set the multiplier for')
            .setRequired(true)
        )
        .addNumberOption(option =>
          option
            .setName('multiplier')
            .setDescription('The XP multiplier (0.1 to 10.0)')
            .setMinValue(0.1)
            .setMaxValue(10)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove an XP multiplier from a role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to remove the multiplier from')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('View all role XP multipliers')
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guildId!;
      const guild = interaction.guild!;
      const subcommand = interaction.options.getSubcommand();
      const config = await getLevelingConfig(guildId);

      if (subcommand === 'set') {
        const role = interaction.options.getRole('role', true);
        const multiplier = interaction.options.getNumber('multiplier', true);

        config.roleMultipliers[role.id] = multiplier;

        await moduleConfig.setConfig(guildId, 'leveling', config);

        return interaction.editReply({
          embeds: [
            successEmbed(
              'Multiplier Set',
              `<@&${role.id}> members will earn **${multiplier}x** XP.`
            )
              .setColor(Colors.Leveling)
              .setTimestamp()
          ]
        });
      } else if (subcommand === 'remove') {
        const role = interaction.options.getRole('role', true);

        if (!config.roleMultipliers[role.id]) {
          return interaction.editReply({
            embeds: [
              errorEmbed('Not Found', `<@&${role.id}> doesn't have an XP multiplier set.`)
                .setColor(Colors.Error)
            ]
          });
        }

        const removedMultiplier = config.roleMultipliers[role.id];
        delete config.roleMultipliers[role.id];

        await moduleConfig.setConfig(guildId, 'leveling', config);

        return interaction.editReply({
          embeds: [
            successEmbed(
              'Multiplier Removed',
              `Removed **${removedMultiplier}x** XP multiplier from <@&${role.id}>.`
            )
              .setColor(Colors.Leveling)
              .setTimestamp()
          ]
        });
      } else if (subcommand === 'list') {
        const multipliers = Object.entries(config.roleMultipliers);

        if (multipliers.length === 0) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Leveling)
                .setTitle('Role XP Multipliers')
                .setDescription('No role multipliers have been configured yet.')
                .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
                .setTimestamp()
            ]
          });
        }

        let description = '';
        for (const [roleId, mult] of multipliers) {
          description += `<@&${roleId}> → **${mult}x** XP\n`;
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.Leveling)
          .setTitle('Role XP Multipliers')
          .setDescription(description)
          .setFooter({ text: `${multipliers.length} multipliers configured`, iconURL: guild.iconURL() || undefined })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('[XPMultiplier Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while managing XP multipliers.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
