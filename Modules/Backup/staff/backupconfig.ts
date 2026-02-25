import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getBackupConfig, getBackupList } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('backupconfig')
    .setDescription('Configure backup settings')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current backup configuration'))
    .addSubcommand(sub =>
      sub.setName('autobackup')
        .setDescription('Set auto-backup interval')
        .addIntegerOption(opt =>
          opt.setName('hours')
            .setDescription('Auto-backup interval in hours (0 = disabled)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(168)))
    .addSubcommand(sub =>
      sub.setName('maxbackups')
        .setDescription('Set maximum number of backups to keep')
        .addIntegerOption(opt =>
          opt.setName('max')
            .setDescription('Max backups (1-25)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(25)))
    .addSubcommand(sub =>
      sub.setName('onchange')
        .setDescription('Toggle automatic backup on role/channel changes')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable or disable change-triggered backups')
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('cooldown')
            .setDescription('Cooldown between change backups in minutes (default 30)')
            .setMinValue(5)
            .setMaxValue(120)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'backup',
  permissionPath: 'backup.backupconfig',
  premiumFeature: 'backup.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();
    const config = await getBackupConfig(guild.id);

    switch (sub) {
      case 'view': {
        const backups = await getBackupList(guild.id);

        const embed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('💾 Backup Configuration')
          .addFields(
            { name: 'Backups', value: `${backups.length}/${config.maxBackups}`, inline: true },
            { name: 'Auto-Backup', value: config.autoBackupInterval > 0 ? `Every ${config.autoBackupInterval}h` : 'Disabled', inline: true },
            { name: 'Backup on Change', value: config.backupOnChange ? `On (${config.changeCooldown}min cooldown)` : 'Off', inline: true },
          );

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'autobackup': {
        const hours = interaction.options.getInteger('hours', true);
        await moduleConfig.setConfig(guild.id, 'backup', { ...config, autoBackupInterval: hours });

        if (hours === 0) {
          await interaction.reply({ content: '✅ Auto-backup disabled.' });
        } else {
          await interaction.reply({
            content: `✅ Auto-backup set to every **${hours} hours**. Takes effect on next bot restart.`,
          });
        }
        break;
      }

      case 'maxbackups': {
        const max = interaction.options.getInteger('max', true);
        await moduleConfig.setConfig(guild.id, 'backup', { ...config, maxBackups: max });
        await interaction.reply({ content: `✅ Max backups set to **${max}**.` });
        break;
      }

      case 'onchange': {
        const enabled = interaction.options.getBoolean('enabled', true);
        const cooldown = interaction.options.getInteger('cooldown') || config.changeCooldown;
        await moduleConfig.setConfig(guild.id, 'backup', {
          ...config,
          backupOnChange: enabled,
          changeCooldown: cooldown,
        });

        if (enabled) {
          await interaction.reply({
            content: `✅ Change-triggered backups enabled (${cooldown}min cooldown). A backup will be created when roles or channels are added/removed.`,
          });
        } else {
          await interaction.reply({ content: '✅ Change-triggered backups disabled.' });
        }
        break;
      }
    }
  },
};

export default command;
