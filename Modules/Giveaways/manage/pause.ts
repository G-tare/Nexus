import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getGiveaway } from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { giveaways } from '../../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

export default {
  data: new SlashCommandBuilder()
    .setName('gpause')
    .setDescription('Pause or resume a giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1)),
  module: 'giveaways',
  permissionPath: 'giveaways.manage.pause',
  premiumFeature: 'giveaways.basic',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return interaction.reply({ content: 'Server only.', ephemeral: true });
    const id = interaction.options.getInteger('id', true);
    const giveaway = await getGiveaway(id);
    if (!giveaway || giveaway.guildId !== interaction.guildId!) {
      return interaction.reply({ embeds: [errorEmbed('Giveaway not found.')] , ephemeral: true });
    }
    // Toggle active state
    const db = getDb();
    await db.update(giveaways).set({ isActive: !giveaway.isActive }).where(eq(giveaways.id, id));
    const status = giveaway.isActive ? 'paused' : 'resumed';
    return interaction.reply({ embeds: [successEmbed(`Giveaway #${id} ${status}.`)] , ephemeral: true });
  },
} as BotCommand;
