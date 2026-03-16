import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createModCase, ensureGuild, ensureGuildMember } from '../helpers';
import { moduleContainer, addText, addFields, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('massban')
    .setDescription('Ban multiple users at once (space-separated IDs)')
    .addStringOption(opt =>
      opt.setName('user_ids')
        .setDescription('Space-separated user IDs to ban')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for the mass ban')
        .setMaxLength(512))
    .addIntegerOption(opt =>
      opt.setName('delete_days')
        .setDescription('Days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.massban',
  premiumFeature: 'moderation.basic',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const idsRaw = interaction.options.getString('user_ids', true);
    const reason = interaction.options.getString('reason') || 'Mass ban';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const guild = interaction.guild!;

    // Parse IDs
    const ids = idsRaw.split(/[\s,]+/).filter(id => /^\d{17,20}$/.test(id.trim()));

    if (ids.length === 0) {
      await interaction.reply({ content: 'No valid user IDs provided.' });
      return;
    }

    if (ids.length > 50) {
      await interaction.reply({ content: 'Maximum 50 users per mass ban.' });
      return;
    }

    await interaction.deferReply();
    await ensureGuild(guild);

    const results = { success: [] as string[], failed: [] as string[] };

    for (const userId of ids) {
      try {
        await ensureGuildMember(guild.id, userId);

        const caseNumber = await createModCase({
          guildId: guild.id,
          action: 'ban',
          targetId: userId,
          moderatorId: interaction.user.id,
          reason: `[MASSBAN] ${reason}`,
        });

        await guild.members.ban(userId, {
          reason: `[Case #${caseNumber}] [MASSBAN] ${reason} (by ${interaction.user.tag})`,
          deleteMessageSeconds: deleteDays * 86400,
        });

        results.success.push(userId);
      } catch {
        results.failed.push(userId);
      }
    }

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Banned', value: `${results.success.length} users`, inline: true },
      { name: 'Failed', value: `${results.failed.length} users`, inline: true },
      { name: 'Reason', value: reason },
    ];

    if (results.failed.length > 0) {
      fields.push({
        name: 'Failed IDs',
        value: results.failed.join(', ').slice(0, 1024),
      });
    }

    const container = moduleContainer('moderation');
    addText(container, '### Mass Ban Complete');
    addFields(container, fields);
    addFooter(container, `Executed by ${interaction.user.tag}`);

    await interaction.editReply(v2Payload([container]));
  },
};

export default command;
