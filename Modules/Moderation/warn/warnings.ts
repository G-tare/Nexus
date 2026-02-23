import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { modCases } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { Colors } from '../../../Shared/src/utils/embed';
import { discordTimestamp } from '../../../Shared/src/utils/time';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to check').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.warnings',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const guild = interaction.guild!;

    await interaction.deferReply();

    const db = getDb();
    const warns = await db.select()
      .from(modCases)
      .where(
        and(
          eq(modCases.guildId, guild.id),
          eq(modCases.targetId, target.id),
          eq(modCases.action, 'warn'),
          eq(modCases.isActive, true)
        )
      );

    if (warns.length === 0) {
      await interaction.editReply({ content: `${target.tag} has no active warnings.` });
      return;
    }

    const lines = warns.map(w =>
      `**Case #${w.caseNumber}** — ${discordTimestamp(w.createdAt, 'R')}\n> **Reason:** ${w.reason}\n> **By:** <@${w.moderatorId}>`
    );

    const embed = new EmbedBuilder()
      .setColor(Colors.Warning)
      .setTitle(`Warnings — ${target.tag}`)
      .setDescription(lines.join('\n\n').slice(0, 4096))
      .setThumbnail(target.displayAvatarURL())
      .setFooter({ text: `${warns.length} active warning(s)` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
