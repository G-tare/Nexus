import {  SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getGiveaway } from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { giveaways } from '../../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

export default {
  data: new SlashCommandBuilder()
    .setName('gcancel')
    .setDescription('Cancel an active giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1)),
  module: 'giveaways',
  permissionPath: 'giveaways.manage.cancel',
  premiumFeature: 'giveaways.basic',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Server only.' });
    const id = interaction.options.getInteger('id', true);
    const giveaway = await getGiveaway(id);
    if (!giveaway || giveaway.guildId !== interaction.guildId!) {
      return interaction.reply({ embeds: [errorEmbed('Giveaway not found.')]  });
    }
    if (!giveaway.isActive) {
      return interaction.reply({ embeds: [errorEmbed('Giveaway is not active.')]  });
    }
    const db = getDb();
    await db.update(giveaways).set({ isActive: false, endedAt: new Date() }).where(eq(giveaways.id, id));
    return interaction.reply({ embeds: [successEmbed(`Giveaway #${id} cancelled.`)]  });
  },
} as BotCommand;
