import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { compareBackup, getBackupList, BackupDiff } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('backupcompare')
    .setDescription('Compare a backup against the current server state')
    .addIntegerOption(opt =>
      opt.setName('backup_id')
        .setDescription('The backup ID to compare against (from /backuplist)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'backup',
  permissionPath: 'backup.backupcompare',
  premiumFeature: 'backup.basic',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const backupId = interaction.options.getInteger('backup_id', true);

    await interaction.deferReply();

    const diff = await compareBackup(guild, backupId);
    if (!diff) {
      await interaction.editReply({ content: `Backup with ID \`${backupId}\` not found.` });
      return;
    }

    const totalChanges =
      diff.roles.added.length + diff.roles.removed.length + diff.roles.changed.length +
      diff.channels.added.length + diff.channels.removed.length + diff.channels.changed.length +
      diff.categories.added.length + diff.categories.removed.length +
      diff.emojis.added.length + diff.emojis.removed.length +
      diff.bots.added.length + diff.bots.removed.length +
      diff.settings.length;

    if (totalChanges === 0) {
      const container = moduleContainer('backup');
      container.setAccentColor(0x2ECC71);
      addText(container, '### ✅ No Differences Found\nThe current server matches this backup perfectly.');
      await interaction.editReply(v2Payload([container]));
      return;
    }

    const sections: string[] = [];

    // Roles diff
    if (diff.roles.added.length > 0 || diff.roles.removed.length > 0 || diff.roles.changed.length > 0) {
      const lines: string[] = ['**Roles:**'];
      if (diff.roles.added.length > 0) {
        lines.push(`  🟢 Added: ${truncateList(diff.roles.added, 8)}`);
      }
      if (diff.roles.removed.length > 0) {
        lines.push(`  🔴 Removed: ${truncateList(diff.roles.removed, 8)}`);
      }
      for (const c of diff.roles.changed.slice(0, 5)) {
        lines.push(`  🟡 ${c.name}: ${c.changes.join(', ')}`);
      }
      if (diff.roles.changed.length > 5) {
        lines.push(`  ...and ${diff.roles.changed.length - 5} more changed`);
      }
      sections.push(lines.join('\n'));
    }

    // Categories diff
    if (diff.categories.added.length > 0 || diff.categories.removed.length > 0) {
      const lines: string[] = ['**Categories:**'];
      if (diff.categories.added.length > 0) lines.push(`  🟢 Added: ${truncateList(diff.categories.added, 8)}`);
      if (diff.categories.removed.length > 0) lines.push(`  🔴 Removed: ${truncateList(diff.categories.removed, 8)}`);
      sections.push(lines.join('\n'));
    }

    // Channels diff
    if (diff.channels.added.length > 0 || diff.channels.removed.length > 0 || diff.channels.changed.length > 0) {
      const lines: string[] = ['**Channels:**'];
      if (diff.channels.added.length > 0) lines.push(`  🟢 Added: ${truncateList(diff.channels.added, 8)}`);
      if (diff.channels.removed.length > 0) lines.push(`  🔴 Removed: ${truncateList(diff.channels.removed, 8)}`);
      for (const c of diff.channels.changed.slice(0, 5)) {
        lines.push(`  🟡 #${c.name}: ${c.changes.join(', ')}`);
      }
      if (diff.channels.changed.length > 5) {
        lines.push(`  ...and ${diff.channels.changed.length - 5} more changed`);
      }
      sections.push(lines.join('\n'));
    }

    // Emojis diff
    if (diff.emojis.added.length > 0 || diff.emojis.removed.length > 0) {
      const lines: string[] = ['**Emojis:**'];
      if (diff.emojis.added.length > 0) lines.push(`  🟢 Added: ${truncateList(diff.emojis.added, 10)}`);
      if (diff.emojis.removed.length > 0) lines.push(`  🔴 Removed: ${truncateList(diff.emojis.removed, 10)}`);
      sections.push(lines.join('\n'));
    }

    // Bots diff
    if (diff.bots.added.length > 0 || diff.bots.removed.length > 0) {
      const lines: string[] = ['**Bots/Apps:**'];
      if (diff.bots.added.length > 0) lines.push(`  🟢 New: ${truncateList(diff.bots.added, 8)}`);
      if (diff.bots.removed.length > 0) lines.push(`  🔴 Gone: ${truncateList(diff.bots.removed, 8)}`);
      sections.push(lines.join('\n'));
    }

    // Settings diff
    if (diff.settings.length > 0) {
      const lines: string[] = ['**Server Settings:**'];
      for (const s of diff.settings) {
        lines.push(`  🟡 ${s}`);
      }
      sections.push(lines.join('\n'));
    }

    const container = moduleContainer('backup');
    container.setAccentColor(0xE67E22);
    const description = sections.join('\n\n').slice(0, 4000);
    addText(container, `### 🔍 Backup Comparison — ${totalChanges} differences\n${description}\n\n-# 🟢 = new since backup • 🔴 = missing since backup • 🟡 = changed`);

    await interaction.editReply(v2Payload([container]));
  },
};

/**
 * Truncate a list of names for display.
 */
function truncateList(items: string[], max: number): string {
  if (items.length <= max) return items.join(', ');
  return items.slice(0, max).join(', ') + ` (+${items.length - max} more)`;
}

export default command;
