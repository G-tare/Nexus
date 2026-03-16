import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getLevelingConfig } from '../helpers';
import { parseDuration, formatDuration } from '../../../Shared/src/utils/time';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.staff.doublexp',
  premiumFeature: 'leveling.advanced',
  defaultPermissions: [PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles],
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('doublexp')
    .setDescription('Manage double XP events')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start a double XP event')
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('Duration (e.g., "2h", "1d", "12h30m") - leave empty for indefinite')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Stop the current double XP event')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Check if double XP is active')
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const guild = interaction.guild!;
      const subcommand = interaction.options.getSubcommand();
      const config = await getLevelingConfig(guildId);

      if (subcommand === 'start') {
        const durationInput = interaction.options.getString('duration', false);

        if (config.doubleXpActive && config.doubleXpExpiresAt) {
          const expiresDate = new Date(config.doubleXpExpiresAt);
          if (expiresDate > new Date()) {
            return interaction.editReply({
              embeds: [
                errorEmbed(
                  'Double XP Already Active',
                  `Double XP is already active and expires <t:${Math.floor(expiresDate.getTime() / 1000)}:R>.`
                )
                  .setColor(Colors.Error)
              ]
            });
          }
        }

        let expiresAt: string | undefined = undefined;

        if (durationInput) {
          const durationMs = parseDuration(durationInput);
          if (!durationMs) {
            return interaction.editReply({
              embeds: [
                errorEmbed(
                  'Invalid Duration',
                  `Could not parse duration "${durationInput}". Try "2h", "1d", "12h30m", etc.`
                )
                  .setColor(Colors.Error)
              ]
            });
          }

          expiresAt = new Date(Date.now() + durationMs).toISOString();
        }

        config.doubleXpActive = true;
        config.doubleXpExpiresAt = expiresAt;

        await moduleConfig.setConfig(guildId, 'leveling', config);

        const description = expiresAt
          ? `Double XP is now **active** for **${formatDuration(parseDuration(durationInput!)!)}**!\n\nExpires <t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>.`
          : 'Double XP is now **active** indefinitely!';

        return interaction.editReply({
          embeds: [
            successEmbed('Double XP Started', description)
              .setColor(Colors.Leveling)
              .setTimestamp()
          ]
        });
      } else if (subcommand === 'stop') {
        if (!config.doubleXpActive) {
          return interaction.editReply({
            embeds: [
              errorEmbed('Not Active', 'Double XP is not currently active.')
                .setColor(Colors.Error)
            ]
          });
        }

        config.doubleXpActive = false;
        config.doubleXpExpiresAt = undefined;

        await moduleConfig.setConfig(guildId, 'leveling', config);

        return interaction.editReply({
          embeds: [
            successEmbed('Double XP Stopped', 'Double XP has been deactivated.')
              .setColor(Colors.Leveling)
              .setTimestamp()
          ]
        });
      } else if (subcommand === 'status') {
        const embed = new EmbedBuilder()
          .setColor(Colors.Leveling)
          .setTitle('Double XP Status')
          .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
          .setTimestamp();

        if (!config.doubleXpActive) {
          embed.setDescription('Double XP is currently **off**.');
        } else if (!config.doubleXpExpiresAt) {
          embed.setDescription('Double XP is **active indefinitely**.').setColor(0x00ff00);
        } else {
          const expiresDate = new Date(config.doubleXpExpiresAt);
          const now = new Date();

          if (expiresDate <= now) {
            embed.setDescription('Double XP has expired and is no longer active.');
          } else {
            const timeRemaining = formatDuration(expiresDate.getTime() - now.getTime());
            embed
              .setDescription(`Double XP is **active** and expires in **${timeRemaining}**.`)
              .setColor(0x00ff00)
              .addFields({
                name: 'Expires At',
                value: `<t:${Math.floor(expiresDate.getTime() / 1000)}:f>`,
                inline: false
              });
          }
        }

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('[DoubleXP Command Error]', error);
      return interaction.editReply({
        embeds: [
          errorEmbed('Error', 'An error occurred while managing double XP.')
            .setColor(Colors.Error)
        ]
      });
    }
  }
};

export default command;
