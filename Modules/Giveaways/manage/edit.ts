import {  SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getGiveaway } from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { giveaways } from '../../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';
import { parseDuration } from '../../../Shared/src/utils/time';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

export default {
  data: new SlashCommandBuilder()
    .setName('gedit')
    .setDescription('Edit an active giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
    .addStringOption((opt) => opt.setName('prize').setDescription('New prize name'))
    .addIntegerOption((opt) => opt.setName('winners').setDescription('New winner count').setMinValue(1).setMaxValue(20))
    .addStringOption((opt) => opt.setName('duration').setDescription('New duration (e.g. 1h, 2d)')),
  module: 'giveaways',
  permissionPath: 'giveaways.manage.edit',
  premiumFeature: 'giveaways.basic',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Server only.' });
    const id = interaction.options.getInteger('id', true);
    const giveaway = await getGiveaway(id);
    if (!giveaway || giveaway.guildId !== interaction.guildId!) {
      return interaction.reply({ embeds: [errorEmbed('Giveaway not found.')]  });
    }
    const updates: any = {};
    const prize = interaction.options.getString('prize');
    if (prize) updates.prize = prize;
    const winners = interaction.options.getInteger('winners');
    if (winners) updates.winnerCount = winners;
    const duration = interaction.options.getString('duration');
    if (duration) {
      const ms = parseDuration(duration);
      if (ms) updates.endsAt = new Date(Date.now() + ms);
    }
    if (Object.keys(updates).length === 0) {
      return interaction.reply({ embeds: [errorEmbed('No changes specified.')]  });
    }
    const db = getDb();
    await db.update(giveaways).set(updates).where(eq(giveaways.id, id));
    return interaction.reply({ embeds: [successEmbed(`Giveaway #${id} updated.`)]  });
  },
} as BotCommand;
