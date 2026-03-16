import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  ChannelType,
  TextBasedChannel,
  GuildTextBasedChannel,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';

export default {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something')
    .addStringOption((option) =>
      option.setName('message').setDescription('Message to say').setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to send to (optional)')
        .addChannelTypes(ChannelType.GuildText)
    ),

  module: 'fun',
  permissionPath: 'fun.random.say',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const message = interaction.options.getString('message', true);
      let channel = interaction.options.getChannel('channel') || interaction.channel;

      if (!channel || channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM) {
        return interaction.reply({
          content: 'Invalid channel!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const guildChannel = channel as GuildTextBasedChannel;
      const botMember = await interaction.guild!.members.fetchMe();
      if (!guildChannel.permissionsFor(botMember).has('SendMessages')) {
        return interaction.reply({
          content: 'I don\'t have permission to send messages there!',
          flags: MessageFlags.Ephemeral,
        });
      }

      await guildChannel.send(message);

      try {
        await interaction.deleteReply();
      } catch (e) {
        await interaction.reply({
          content: 'Message sent!',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      console.error('Say error:', error);
      await interaction.reply({
        content: 'Failed to send message.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
