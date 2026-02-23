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
  permissionPath: 'leveling.staff.noxproles',
  premiumFeature: 'leveling.basic',
  defaultPermissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('noxproles')
    .setDescription('Manage roles that don\'t earn XP')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a no-XP role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to prevent from earning XP')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a no-XP role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to allow to earn XP again')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('View all no-XP roles')
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guildId!;
      const guild = interaction.guild!;
      const subcommand = interaction.options.getSubcommand();
      const config = await getLevelingConfig(guildId);

      if (subcommand === 'add') {
        const role = interaction.options.getRole('role', true);

        if (config.noXpRoles.includes(role.id)) {
          return interaction.editReply({
            embeds: [
              errorEmbed('Already Exists', `<@&${role.id}> is already set to not earn XP.`)
                .setColor(Colors.Error)
            ]
          });
        }

        config.noXpRoles.push(role.id);

        await moduleConfig.setConfig(guildId, 'leveling', config);

        return interaction.editReply({
          embeds: [
            successEmbed(
              'No-XP Role Added',
              `Members with <@&${role.id}> will no longer earn XP.`
            )
              .setColor(Colors.Leveling)
              .setTimestamp()
          ]
        });
      } else if (subcommand === 'remove') {
        const role = interaction.options.getRole('role', true);

        const index = config.noXpRoles.indexOf(role.id);
        if (index === -1) {
          return interaction.editReply({
            embeds: [
              errorEmbed('Not Found', `<@&${role.id}> is not in the no-XP roles list.`)
                .setColor(Colors.Error)
            ]
          });
        }

        config.noXpRoles.splice(index, 1);

        await moduleConfig.setConfig(guildId, 'leveling', config);

        return interaction.editReply({
          embeds: [
            successEmbed(
              'No-XP Role Removed',
              `Members with <@&${role.id}> can now earn XP again.`
            )
              .setColor(Colors.Leveling)
              .setTimestamp()
          ]
        });
      } else if (subcommand === 'list') {
        if (config.noXpRoles.length === 0) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.Leveling)
                .setTitle('No-XP Roles')
                .setDescription('No roles are currently set to not earn XP.')
                .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
                .setTimestamp()
            ]
          });
        }

        let description = '';
        for (const roleId of config.noXpRoles) {
          description += `<@&${roleId}>\n`;
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.Leveling)
          .setTitle('No-XP Roles')
          .setDescription(description)
          .setFooter({ text: `${config.noXpRoles.length} role(s) cannot earn XP`, iconURL: guild.iconURL() || undefined })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('[NoXPRoles Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while managing no-XP roles.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
