import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { removeChannelTranslation } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('translateremove')
    .setDescription('Remove auto-translation from a channel')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to stop auto-translating')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'translation',
  permissionPath: 'translation.translateremove',
  premiumFeature: 'translation.auto',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const channel = interaction.options.getChannel('channel', true);

    const removed = await removeChannelTranslation(guild.id, channel.id);

    if (!removed) {
      await interaction.reply({
        content: `<#${channel.id}> doesn't have auto-translation configured.`,
      });
      return;
    }

    await interaction.reply({
      content: `✅ Auto-translation removed from <#${channel.id}>.`,
    });
  },
};

export default command;
