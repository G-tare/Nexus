import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createBackup, formatSize } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('backupcreate')
    .setDescription('Create a full backup of the server configuration')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name for this backup (optional)')
        .setMaxLength(64))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'backup',
  permissionPath: 'backup.backupcreate',
  premiumFeature: 'backup.basic',
  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const date = new Date().toISOString().split('T')[0];
    const name = interaction.options.getString('name')?.trim() || `Backup ${date}`;

    await interaction.deferReply();

    const backup = await createBackup(guild, name, interaction.user.id);

    if (!backup) {
      await interaction.editReply({ content: '❌ Failed to create backup.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('💾 Backup Created')
      .setDescription(`**${name}**`)
      .addFields(
        { name: 'Backup ID', value: `\`${backup.id}\``, inline: true },
        { name: 'Size', value: formatSize(backup.size), inline: true },
        { name: 'Roles', value: `${backup.components.roles.length}`, inline: true },
        { name: 'Categories', value: `${backup.components.categories.length}`, inline: true },
        { name: 'Channels', value: `${backup.components.channels.length}`, inline: true },
        { name: 'Emojis', value: `${backup.components.emojis.length}`, inline: true },
        { name: 'Bots Tracked', value: `${backup.components.bots?.length ?? 0}`, inline: true },
        { name: 'Stickers', value: `${backup.components.stickers?.length ?? 0}`, inline: true },
      )
      .setFooter({ text: 'Use /backuprestore to restore • /backuplist to view all' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
