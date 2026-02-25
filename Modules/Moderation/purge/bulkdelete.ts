import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed, Colors } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('bulkdelete')
    .setDescription('Advanced message deletion with filter options')
    .addIntegerOption(opt =>
      opt.setName('count')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .addStringOption(opt =>
      opt.setName('filter')
        .setDescription('Filter type for deletion')
        .setRequired(true)
        .addChoices(
          { name: 'Links', value: 'links' },
          { name: 'Images', value: 'images' },
          { name: 'Embeds', value: 'embeds' },
          { name: 'Mentions', value: 'mentions' },
          { name: 'All', value: 'all' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.bulkdelete',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const count = interaction.options.getInteger('count', true);
    const filter = interaction.options.getString('filter', true);
    const channel = interaction.channel as TextChannel;

    // Check if channel is a text channel
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid Channel', 'This command only works in text channels.')],
      });
      return;
    }

    await interaction.deferReply({});

    try {
      // Fetch messages based on filter
      const messages = await channel.messages.fetch({ limit: 100 });
      const now = Date.now();
      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

      let messagesToDelete = messages.filter(msg => now - msg.createdTimestamp < twoWeeksMs);

      // Apply filter
      switch (filter) {
        case 'links':
          messagesToDelete = messagesToDelete.filter(msg =>
            /https?:\/\//i.test(msg.content)
          );
          break;

        case 'images':
          messagesToDelete = messagesToDelete.filter(msg => msg.attachments.size > 0);
          break;

        case 'embeds':
          messagesToDelete = messagesToDelete.filter(msg => msg.embeds.length > 0);
          break;

        case 'mentions':
          messagesToDelete = messagesToDelete.filter(msg =>
            msg.mentions.has(interaction.client.user!) || msg.mentions.users.size > 0 || msg.mentions.roles.size > 0
          );
          break;

        case 'all':
          // No additional filtering needed
          break;
      }

      // Get up to count messages
      const toDelete = messagesToDelete.sort((a, b) => b.createdTimestamp - a.createdTimestamp).first(count);

      if (toDelete.length === 0) {
        const filterLabel = filter === 'all' ? 'messages' : `messages with ${filter}`;
        await interaction.editReply({
          embeds: [errorEmbed('No Messages', `No ${filterLabel} found that are less than 14 days old.`)],
        });
        return;
      }

      // Delete messages
      await channel.bulkDelete(toDelete, true);

      const filterLabel = {
        links: 'with links',
        images: 'with images',
        embeds: 'with embeds',
        mentions: 'with mentions',
        all: 'messages',
      }[filter] || 'messages';

      const embed = successEmbed(
        'Messages Deleted',
        `Successfully deleted **${toDelete.length}** ${filterLabel} from ${channel}.`
      ).setColor(Colors.Moderation);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Bulk delete command error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Deletion Failed', 'An error occurred while deleting messages.')],
      });
    }
  },
};

export default command;
