import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getConfessionConfig,
  getPendingConfessionData,
  removePendingConfession,
  storeConfession,
  buildConfessionEmbed,
} from '../helpers';


const command: BotCommand = {
  module: 'confessions',
  permissionPath: 'confessions.confession-approve',
  data: new SlashCommandBuilder()
    .setName('confession-approve')
    .setDescription('Approve a pending confession')
    .addIntegerOption(opt =>
      opt
        .setName('id')
        .setDescription('Confession ID number')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const confessionId = interaction.options.getInteger('id', true);

    const config = await getConfessionConfig(guildId);

    // Get pending confession
    const pendingData = await getPendingConfessionData(guildId, confessionId);
    if (!pendingData) {
      await interaction.reply({
        content: `Pending confession #${confessionId} not found.`,
        ephemeral: true,
      });
      return;
    }

    try {
      // Get confession channel
      if (!config.channelId) {
        await interaction.reply({
          content: 'Confession channel is not configured.',
          ephemeral: true,
        });
        return;
      }

      const channel = await interaction.client.channels.fetch(config.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({
          content: 'Confession channel not found.',
          ephemeral: true,
        });
        return;
      }

      // Store as approved confession
      await storeConfession(
        guildId,
        confessionId,
        pendingData.userHash,
        pendingData.content,
        pendingData.userId,
        pendingData.imageUrl
      );

      // Post to channel
      const embed = buildConfessionEmbed(confessionId, pendingData.content, config);
      if (pendingData.imageUrl) {
        embed.setImage(pendingData.imageUrl);
      }

      await (channel as any).send({ embeds: [embed] });

      // Remove from pending
      await removePendingConfession(guildId, confessionId);

      await interaction.reply({
        content: `Confession #${confessionId} approved and posted.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error approving confession:', error);
      await interaction.reply({
        content: 'Failed to approve confession.',
        ephemeral: true,
      });
    }
  },
};

export default command;
