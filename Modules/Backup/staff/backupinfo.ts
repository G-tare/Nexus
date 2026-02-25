import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getBackupInfo, formatSize } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('backupinfo')
    .setDescription('View detailed information about a backup')
    .addIntegerOption(opt =>
      opt.setName('backup_id')
        .setDescription('The backup ID to inspect (from /backuplist)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'backup',
  permissionPath: 'backup.backupinfo',
  premiumFeature: 'backup.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const backupId = interaction.options.getInteger('backup_id', true);

    const info = await getBackupInfo(guild.id, backupId);
    if (!info) {
      await interaction.reply({
        content: `Backup with ID \`${backupId}\` not found.`,
      });
      return;
    }

    const { backup, summary } = info;
    const createdBy = backup.createdBy === 'auto' ? 'Automatic' : `<@${backup.createdBy}>`;

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`💾 Backup: ${backup.name}`)
      .addFields(
        { name: 'ID', value: `\`${backup.id}\``, inline: true },
        { name: 'Created By', value: createdBy, inline: true },
        { name: 'Size', value: formatSize(backup.size), inline: true },
        { name: 'Roles', value: `${summary.roles}`, inline: true },
        { name: 'Categories', value: `${summary.categories}`, inline: true },
        { name: 'Channels', value: `${summary.channels}`, inline: true },
        { name: 'Emojis', value: `${summary.emojis}`, inline: true },
        { name: 'Stickers', value: `${summary.stickers ?? 0}`, inline: true },
        { name: 'Module Configs', value: `${summary.moduleConfigs}`, inline: true },
      )
      .setTimestamp(new Date(backup.createdAt))
      .setFooter({ text: 'Use /backuprestore to restore this backup' });

    // Show bot invite links if any
    if (info.bots && info.bots.length > 0) {
      const botLines = info.bots.map(b => `• **${b.name}** — [Invite](${b.inviteURL})`).slice(0, 20);
      embed.addFields({
        name: `🤖 Bots (${info.bots.length})`,
        value: botLines.join('\n') +
          (info.bots.length > 20 ? `\n...and ${info.bots.length - 20} more` : ''),
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
