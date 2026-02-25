import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { restoreBackup, getBackupInfo, RestoreComponent } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('backuprestore')
    .setDescription('Restore the server from a backup')
    .addIntegerOption(opt =>
      opt.setName('backup_id')
        .setDescription('The backup ID to restore (from /backuplist)')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('components')
        .setDescription('What to restore (default: all)')
        .addChoices(
          { name: 'Everything', value: 'all' },
          { name: 'Roles only', value: 'roles' },
          { name: 'Channels only', value: 'channels' },
          { name: 'Server settings only', value: 'settings' },
          { name: 'Emojis only', value: 'emojis' },
          { name: 'Stickers only', value: 'stickers' },
          { name: 'Bot configs only', value: 'configs' },
        ))
    .addBooleanOption(opt =>
      opt.setName('full_setup')
        .setDescription('Wipe server & rebuild from backup (for setting up a new server from scratch)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'backup',
  permissionPath: 'backup.backuprestore',
  premiumFeature: 'backup.basic',
  cooldown: 60,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const backupId = interaction.options.getInteger('backup_id', true);
    const componentChoice = (interaction.options.getString('components') || 'all') as RestoreComponent;
    const fullSetup = interaction.options.getBoolean('full_setup') ?? false;

    // Get backup info first
    const info = await getBackupInfo(guild.id, backupId);
    if (!info) {
      await interaction.reply({ content: `Backup with ID \`${backupId}\` not found.` });
      return;
    }

    const components: RestoreComponent[] = componentChoice === 'all'
      ? ['all']
      : [componentChoice];

    // Confirmation
    const componentLabel = componentChoice === 'all' ? 'everything' : componentChoice;
    const modeLabel = fullSetup
      ? '🚨 **FULL SERVER SETUP** — this will **DELETE all existing channels and roles** then rebuild from backup'
      : `This will recreate missing ${componentLabel} from the backup. Existing items with the same name will be skipped (not overwritten).`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('backuprestore:confirm')
        .setLabel(fullSetup ? 'Yes, WIPE & REBUILD' : `Yes, restore ${componentLabel}`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('backuprestore:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    const botsLine = info.summary.bots > 0 ? `, ${info.summary.bots} bots tracked` : '';
    const stickersLine = info.summary.stickers > 0 ? `, ${info.summary.stickers} stickers` : '';

    const reply = await interaction.reply({
      content: `⚠️ **Restore backup "${info.backup.name}"?**\n\n${modeLabel}\n\n**Contains:** ${info.summary.roles} roles, ${info.summary.categories} categories, ${info.summary.channels} channels, ${info.summary.emojis} emojis, ${info.summary.moduleConfigs} configs${stickersLine}${botsLine}`,
      components: [row],
      fetchReply: true,
    });

    try {
      const btn = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 30_000,
      });

      if (btn.customId === 'backuprestore:confirm') {
        await btn.update({ content: '🔄 Restoring... This may take a while.', components: [] });

        const result = await restoreBackup(guild, backupId, components, fullSetup);

        const embed = new EmbedBuilder()
          .setColor(result.success ? 0x2ECC71 : 0xE67E22)
          .setTitle(result.success ? '✅ Backup Restored' : '⚠️ Backup Partially Restored')
          .addFields(
            { name: 'Restored', value: result.restored.join('\n') || 'Nothing' },
          );

        if (result.errors.length > 0) {
          embed.addFields({
            name: 'Errors',
            value: result.errors.slice(0, 10).join('\n') +
              (result.errors.length > 10 ? `\n...and ${result.errors.length - 10} more` : ''),
          });
        }

        if ((result as any).botInvites && (result as any).botInvites.length > 0) {
          const botLines = (result as any).botInvites.map((b: any) => `• [${b.name}](${b.inviteURL})`).slice(0, 15);
          embed.addFields({
            name: '🤖 Bots to Re-add',
            value: botLines.join('\n') +
              ((result as any).botInvites.length > 15 ? `\n...and ${(result as any).botInvites.length - 15} more` : ''),
          });
        }

        await interaction.editReply({ embeds: [embed], components: [] });
      } else {
        await btn.update({ content: '❌ Cancelled.', components: [] });
      }
    } catch {
      await interaction.editReply({ content: '⏰ Timed out.', components: [] });
    }
  },
};

export default command;
