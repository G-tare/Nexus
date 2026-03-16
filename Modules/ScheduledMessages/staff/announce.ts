import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelSelectMenuBuilder,
  ActionRowBuilder,
  Colors,
  TextChannel,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to send announcement to')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('message')
        .setDescription('Message content')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('title')
        .setDescription('Embed title (optional)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('description')
        .setDescription('Embed description (optional)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('color')
        .setDescription('Embed color in hex (e.g., #FF5733)')
        .setRequired(false)
    ),

  module: 'scheduledmessages',
  permissionPath: 'scheduledmessages.staff.announce',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const channel = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message', true);
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const colorInput = interaction.options.getString('color');

      // Validate channel is text-based - check the type property for API channels
      const isTextBased = typeof (channel as any).isTextBased === 'function'
        ? (channel as any).isTextBased()
        : (channel as any).type === 0; // 0 = GuildText for API channels

      if (!isTextBased) {
        await interaction.editReply({
          content: '❌ Please select a text channel.',
        });
        return;
      }

      const textChannel = channel as TextChannel;

      // Build the announcement
      let announcementContent = message;

      if (title || description || colorInput) {
        // Create container with color
        const color = colorInput ?
          (colorInput.startsWith('#') ? parseInt(colorInput.slice(1), 16) : 0x2ECC71)
          : 0x2ECC71;
        const container = new ContainerBuilder().setAccentColor(color);
        const titleText = title || description || message;
        const descText = description && title ? description : (title ? '' : message);
        const content = title ? `### ${titleText}\n${descText}` : titleText;
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

        // Send container
        await textChannel.send(v2Payload([container]));
      } else {
        // Send plain text
        await textChannel.send({ content: message });
      }

      // Confirm to user
      const container = moduleContainer('scheduled_messages');
      container.setAccentColor(0x4CAF50);
      const titleText = '✅ Announcement Sent';
      const descText = `Announcement sent to **${textChannel.name}**\n\n**Message Preview:**\n${message.substring(0, 200)}`;
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${titleText}\n${descText}`));

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in announce command:', error);
      await interaction.editReply({
        content: 'An error occurred while sending the announcement.',
      });
    }
  },
};

export default command;
