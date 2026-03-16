import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getBackupList, getBackupConfig, formatSize } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

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
      });
      return;
    }

    const lines = backups.map((b, i) => {
      const date = new Date(b.createdAt).toLocaleString();
      const by = b.createdBy === 'auto' ? 'Auto' : `<@${b.createdBy}>`;
      return `**${i + 1}.** ${b.name} — ID: \`${b.id}\`\n   ${date} • ${formatSize(b.size)} • ${by}`;
    });

    const container = moduleContainer('backup');
    addText(container, `### 💾 Server Backups\n${lines.join('\n\n')}\n\n-# ${backups.length}/${config.maxBackups} backups • /backupinfo <id> for details`);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
