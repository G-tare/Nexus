import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getBackupList, getBackupConfig, formatSize } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('backuplist')
    .setDescription('View all server backups')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'backup',
  permissionPath: 'backup.backuplist',
  premiumFeature: 'backup.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const backups = await getBackupList(guild.id);
    const config = await getBackupConfig(guild.id);

    if (backups.length === 0) {
      await interaction.reply({
        content: 'No backups found. Use `/backupcreate` to create one.',
        ephemeral: true,
      });
      return;
    }

    const lines = backups.map((b, i) => {
      const date = new Date(b.createdAt).toLocaleString();
      const by = b.createdBy === 'auto' ? 'Auto' : `<@${b.createdBy}>`;
      return `**${i + 1}.** ${b.name} — ID: \`${b.id}\`\n   ${date} • ${formatSize(b.size)} • ${by}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('💾 Server Backups')
      .setDescription(lines.join('\n\n'))
      .setFooter({ text: `${backups.length}/${config.maxBackups} backups • /backupinfo <id> for details` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
