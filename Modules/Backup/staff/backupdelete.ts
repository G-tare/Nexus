import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { deleteBackup, getBackupList } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('backupdelete')
    .setDescription('Delete a server backup')
    .addIntegerOption(opt =>
      opt.setName('backup_id')
        .setDescription('The backup ID to delete (from /backuplist)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'backup',
  permissionPath: 'backup.backupdelete',
  premiumFeature: 'backup.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const backupId = interaction.options.getInteger('backup_id', true);

    const backups = await getBackupList(guild.id);
    const backup = backups.find(b => b.id === backupId);

    if (!backup) {
      await interaction.reply({
        content: `Backup with ID \`${backupId}\` not found.`,
        ephemeral: true,
      });
      return;
    }

    await deleteBackup(guild.id, backupId);

    await interaction.reply({
      content: `✅ Backup **"${backup.name}"** (ID: \`${backupId}\`) deleted.`,
      ephemeral: true,
    });
  },
};

export default command;
