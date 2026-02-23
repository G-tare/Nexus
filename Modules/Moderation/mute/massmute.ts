import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModCase, ensureGuild, ensureGuildMember } from '../helpers';
import { parseDuration, formatDuration } from '../../../Shared/src/utils/time';
import { Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('massmute')
    .setDescription('Mute multiple users at once (space-separated IDs)')
    .addStringOption(opt =>
      opt.setName('user_ids').setDescription('Space-separated user IDs to mute').setRequired(true))
    .addStringOption(opt =>
      opt.setName('duration').setDescription('Mute duration (e.g., 1h, 1d)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the mass mute').setMaxLength(512))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.massmute',
  premiumFeature: 'moderation.basic',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const idsRaw = interaction.options.getString('user_ids', true);
    const durationStr = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') || 'Mass mute';
    const guild = interaction.guild!;

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 60000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      await interaction.reply({ content: 'Invalid duration. Must be between 1 minute and 28 days.', ephemeral: true });
      return;
    }

    const ids = idsRaw.split(/[\s,]+/).filter(id => /^\d{17,20}$/.test(id.trim()));
    if (ids.length === 0) {
      await interaction.reply({ content: 'No valid user IDs provided.', ephemeral: true });
      return;
    }
    if (ids.length > 50) {
      await interaction.reply({ content: 'Maximum 50 users per mass mute.', ephemeral: true });
      return;
    }

    await interaction.deferReply();
    await ensureGuild(guild);

    const results = { success: [] as string[], failed: [] as string[] };

    for (const userId of ids) {
      try {
        const member = await guild.members.fetch(userId);
        await ensureGuildMember(guild.id, userId);

        const caseNumber = await createModCase({
          guildId: guild.id,
          action: 'mute',
          targetId: userId,
          moderatorId: interaction.user.id,
          reason: `[MASSMUTE] ${reason}`,
          duration: Math.floor(durationMs / 1000),
        });

        await member.timeout(durationMs, `[Case #${caseNumber}] [MASSMUTE] ${reason}`);
        results.success.push(userId);
      } catch {
        results.failed.push(userId);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Moderation)
      .setTitle('Mass Mute Complete')
      .addFields(
        { name: 'Muted', value: `${results.success.length} users`, inline: true },
        { name: 'Failed', value: `${results.failed.length} users`, inline: true },
        { name: 'Duration', value: formatDuration(durationMs), inline: true },
        { name: 'Reason', value: reason },
      )
      .setFooter({ text: `Executed by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
