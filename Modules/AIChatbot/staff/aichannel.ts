import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getAIConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('AIChatbot');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aichannel')
    .setDescription('Manage AI chatbot channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option.setName('channel').setDescription('Channel to toggle as AI chat channel').setRequired(true)
    ),

  module: 'aichatbot',
  permissionPath: 'aichatbot.staff.aichannel',
  premiumFeature: 'aichatbot.management',
  cooldown: 3,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);
      const config = await getAIConfig(interaction.guildId!);

      const allowedChannels = [...config.allowedChannels];
      const index = allowedChannels.indexOf(channel.id);

      let action: string;
      if (index > -1) {
        allowedChannels.splice(index, 1);
        action = 'removed from';
      } else {
        allowedChannels.push(channel.id);
        action = 'added to';
      }

      await moduleConfig.updateConfig(interaction.guildId!, 'aichatbot', { ...config, allowedChannels });

      const embed = new EmbedBuilder()
        .setTitle('📝 Channel Updated')
        .setDescription(`${channel} has been ${action} AI chat channels.`)
        .addFields({ name: 'Total AI Channels', value: allowedChannels.length.toString(), inline: true })
        .setColor(index > -1 ? '#FF0000' : '#43B581')
        .setFooter({ text: `Updated by ${interaction.user.username}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in aichannel command execution', error);
      await interaction.reply({ content: '❌ Failed to update channel configuration.', ephemeral: true });
    }
  },
};

export default command;
