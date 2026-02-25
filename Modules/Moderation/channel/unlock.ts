import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel and restore message sending')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to unlock')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.unlock',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        embeds: [errorEmbed('Invalid Channel', 'Please specify a valid text channel.')],
      });
      return;
    }

    await interaction.deferReply();

    try {
      const everyoneRole = interaction.guild!.roles.everyone;

      // Remove the SendMessages permission override to restore default behavior
      const override = (targetChannel as any).permissionOverwrites.cache.get(everyoneRole.id);
      
      if (override && override.deny.has(PermissionFlagsBits.SendMessages)) {
        await (targetChannel as any).permissionOverwrites.edit(everyoneRole, {
          SendMessages: null,
        }, `Channel unlocked by ${interaction.user.tag}`);
      } else {
        await interaction.editReply({
          embeds: [errorEmbed('Not Locked', 'This channel is not locked.')],
        });
        return;
      }

      // Reply to user
      const embed = successEmbed('Channel Unlocked', `<#${targetChannel.id}> has been unlocked.`);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({
        embeds: [errorEmbed('Failed', 'Could not unlock the channel. Please ensure I have permission to manage this channel.')],
      });
    }
  },
};

export default command;
