import {
  Client,
  Interaction,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  Collection,
  PermissionFlagsBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ContainerBuilder,
  ChannelType,
} from 'discord.js';
import type { TextChannel } from 'discord.js';
import { permissionManager } from '../../../Shared/src/permissions/permissionManager';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { premiumManager } from '../../../Shared/src/middleware/premiumCheck';
import { errorEmbed } from '../../../Shared/src/utils/embed';
import { addTitleSection, addFields as addFieldsV2 } from '../../../Shared/src/utils/componentsV2';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { t } from '../../../Shared/src/i18n';
import { formatDuration } from '../../../Shared/src/utils/time';
import { eventBus } from '../../../Shared/src/events/eventBus';
import { getPool } from '../../../Shared/src/database/connection';

const logger = createModuleLogger('InteractionHandler');

// ============================================
// Default Discord permission requirements
// for commands that don't set defaultPermissions.
// Checked by prefix — first match wins.
// ============================================

const PERMISSION_PATH_DEFAULTS: [string, bigint | bigint[]][] = [
  // Moderation — bans
  ['moderation.ban',        PermissionFlagsBits.BanMembers],
  ['moderation.unban',      PermissionFlagsBits.BanMembers],
  ['moderation.tempban',    PermissionFlagsBits.BanMembers],
  ['moderation.massban',    PermissionFlagsBits.BanMembers],
  ['moderation.banlist',    PermissionFlagsBits.BanMembers],
  // Moderation — kicks
  ['moderation.kick',       PermissionFlagsBits.KickMembers],
  ['moderation.softban',    PermissionFlagsBits.KickMembers],
  // Moderation — mutes
  ['moderation.mute',       PermissionFlagsBits.ModerateMembers],
  ['moderation.unmute',     PermissionFlagsBits.ModerateMembers],
  ['moderation.mutelist',   PermissionFlagsBits.ModerateMembers],
  ['moderation.massmute',   PermissionFlagsBits.ModerateMembers],
  // Moderation — warns
  ['moderation.warn',           PermissionFlagsBits.ModerateMembers],
  ['moderation.unwarn',         PermissionFlagsBits.ModerateMembers],
  ['moderation.warnings',       PermissionFlagsBits.ModerateMembers],
  ['moderation.clearwarnings',  PermissionFlagsBits.ModerateMembers],
  ['moderation.serverwarns',    PermissionFlagsBits.ModerateMembers],
  // Moderation — channel management
  ['moderation.slowmode',   PermissionFlagsBits.ManageChannels],
  ['moderation.lock',       PermissionFlagsBits.ManageChannels],
  ['moderation.unlock',     PermissionFlagsBits.ManageChannels],
  ['moderation.lockdown',   PermissionFlagsBits.ManageChannels],
  ['moderation.unlockdown', PermissionFlagsBits.ManageChannels],
  ['moderation.nuke',       PermissionFlagsBits.ManageChannels],
  // Moderation — purge / bulk delete
  ['moderation.purge',      PermissionFlagsBits.ManageMessages],
  ['moderation.purgeuser',  PermissionFlagsBits.ManageMessages],
  ['moderation.purgebot',   PermissionFlagsBits.ManageMessages],
  ['moderation.purgehuman', PermissionFlagsBits.ManageMessages],
  ['moderation.bulkdelete', PermissionFlagsBits.ManageMessages],
  // Moderation — user management
  ['moderation.nickname',   PermissionFlagsBits.ManageNicknames],
  ['moderation.role',       PermissionFlagsBits.ManageRoles],
  ['moderation.userinfo',   PermissionFlagsBits.ModerateMembers],
  // Moderation — advanced
  ['moderation.shadowban',      PermissionFlagsBits.ModerateMembers],
  ['moderation.unshadowban',    PermissionFlagsBits.ModerateMembers],
  ['moderation.quarantine',     PermissionFlagsBits.ModerateMembers],
  ['moderation.unquarantine',   PermissionFlagsBits.ModerateMembers],
  // Moderation — investigation & cases
  ['moderation.altdetect',  PermissionFlagsBits.ModerateMembers],
  ['moderation.watchlist',  PermissionFlagsBits.ModerateMembers],
  ['moderation.case',       PermissionFlagsBits.ModerateMembers],
  ['moderation.modstats',   PermissionFlagsBits.ModerateMembers],
  ['moderation.history',    PermissionFlagsBits.ModerateMembers],
  ['moderation.note',       PermissionFlagsBits.ModerateMembers],
  ['moderation.notes',      PermissionFlagsBits.ModerateMembers],
  // Moderation — reputation management
  ['moderation.addreputation',     PermissionFlagsBits.ModerateMembers],
  ['moderation.removereputation',  PermissionFlagsBits.ModerateMembers],
  ['moderation.setreputation',     PermissionFlagsBits.ModerateMembers],
  ['moderation.reputationhistory', PermissionFlagsBits.ModerateMembers],
  // AntiRaid
  ['antiraid.raid-lockdown',   PermissionFlagsBits.ManageGuild],
  ['antiraid.raid-unlockdown', PermissionFlagsBits.ManageGuild],
  // Automod core
  ['automod.testword', PermissionFlagsBits.ManageMessages],
];

/**
 * Resolve the effective Discord permission for a command.
 * Priority: command.defaultPermissions > PERMISSION_PATH_DEFAULTS > staff fallback > allow
 */
function resolveDefaultPermissions(command: { defaultPermissions?: any; permissionPath?: string }): bigint | bigint[] | null {
  // 1. Explicit defaultPermissions on the command object
  if (command.defaultPermissions) return command.defaultPermissions;

  // 2. Check the permission path defaults map
  if (command.permissionPath) {
    for (const [prefix, perms] of PERMISSION_PATH_DEFAULTS) {
      if (command.permissionPath === prefix || command.permissionPath.startsWith(prefix + '.')) {
        return perms;
      }
    }
  }

  // 3. Staff command fallback
  if (command.permissionPath?.includes('.staff.')) {
    return PermissionFlagsBits.ManageGuild;
  }

  // 4. No restriction
  return null;
}

/**
 * Central interaction handler — processes all Discord interactions.
 */
export async function handleInteraction(client: Client, interaction: Interaction): Promise<void> {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(client, interaction);
    return;
  }

  // Autocomplete
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(client, interaction);
    return;
  }

  // Buttons
  if (interaction.isButton()) {
    await handleButton(client, interaction);
    return;
  }

  // Select menus
  if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(client, interaction);
    return;
  }

  // Modals
  if (interaction.isModalSubmit()) {
    await handleModal(client, interaction);
    return;
  }

  // Context menus
  if (interaction.isMessageContextMenuCommand() || interaction.isUserContextMenuCommand()) {
    const command = client.contextMenuCommands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err: any) {
      logger.error(`Context menu error: ${interaction.commandName}`, { error: err.message });
    }
    return;
  }
}

// ============================================
// Slash Command Handler
// ============================================

async function handleSlashCommand(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  // Build the route key to find the correct command handler.
  // Route keys follow the format: "slug:group:subcommand" or "slug::subcommand" (no group)
  const slug = interaction.commandName;
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(false);

  let routeKey: string;
  if (sub) {
    routeKey = group ? `${slug}:${group}:${sub}` : `${slug}::${sub}`;
  } else {
    // Top-level command (no subcommand) — e.g. /configs, /help
    routeKey = `${slug}::`;
  }
  const command = client.commandRoutes.get(routeKey);

  if (!command) {
    logger.warn(`No route found for key: ${routeKey}`);
    return;
  }

  // Look up the module name from the slug for module-enabled checks
  const moduleName = client.slugToModule.get(slug) || command.module;
  const guildId = interaction.guildId!;

  // Guild-only check
  if (command.guildOnly !== false && !guildId) {
    await interaction.reply({
      embeds: [errorEmbed('Server Only', t('common:guildOnly'))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (guildId) {
    // Module enabled check (hierarchy: global disable > server ban > server config)
    if (command.requiresModule !== false) {
      const moduleStatus = await moduleConfig.getModuleStatus(guildId, moduleName);
      let moduleDisabled = !moduleStatus.enabled;

      // If the module itself is enabled, also check cross-module toggles.
      // The moderation config's "reputationEnabled" toggle should disable:
      // 1. The reputation module's own commands (slug "rep")
      // 2. The moderation module's reputation commands (slug "modrep": addreputation, removereputation, etc.)
      if (!moduleDisabled) {
        const isRepModule = moduleName === 'reputation';
        const isModRepCommand = moduleName === 'moderation' && command.permissionPath?.includes('reputation');
        if (isRepModule || isModRepCommand) {
          const modConfig = await moduleConfig.getModuleConfig(guildId, 'moderation');
          if (modConfig?.config) {
            const modCfg = modConfig.config as Record<string, any>;
            if (modCfg.reputationEnabled === false) {
              moduleDisabled = true;
            }
          }
        }
      }

      if (moduleDisabled) {
        let title = 'Module Disabled';
        let description = t('common:moduleDisabled');

        if (moduleStatus.globallyDisabled) {
          title = 'Module Temporarily Unavailable';
          description = `This module has been temporarily disabled by the bot team.`;
          if (moduleStatus.reason) description += `\n**Reason:** ${moduleStatus.reason}`;
          if (moduleStatus.reasonDetail) description += `\n${moduleStatus.reasonDetail}`;
        } else if (moduleStatus.serverBanned) {
          title = 'Module Restricted';
          description = `This module has been restricted for this server by the bot team.`;
          if (moduleStatus.reason) description += `\n**Reason:** ${moduleStatus.reason}`;
        }

        await interaction.reply({
          embeds: [errorEmbed(title, description)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // Per-command disabled check
    if (command.permissionPath) {
      // Extract command name from permissionPath (e.g., "moderation.ban" → "ban")
      const cmdParts = command.permissionPath.split('.');
      const cmdName = cmdParts.length > 1 ? cmdParts.slice(1).join('.') : cmdParts[0];
      const cmdDisabled = await moduleConfig.isCommandDisabled(guildId, moduleName, cmdName);
      if (cmdDisabled) {
        await interaction.reply({
          embeds: [errorEmbed('Command Disabled', 'This command has been disabled by a server administrator.')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // Premium check
    if (command.premiumFeature) {
      const hasAccess = await premiumManager.hasFeature(guildId, command.premiumFeature);
      if (!hasAccess) {
        const requiredTier = premiumManager.getRequiredTier(command.premiumFeature);
        await interaction.reply({
          embeds: [errorEmbed('Premium Required',
            `This feature requires **${requiredTier}** tier. Upgrade at the dashboard to unlock it!`
          )],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // Permission check
    const effectivePerms = resolveDefaultPermissions(command);
    const permResult = await permissionManager.canUse(interaction, command.permissionPath, effectivePerms);
    if (!permResult.allowed) {
      await interaction.reply({
        embeds: [errorEmbed('No Permission', permResult.reason || t('common:noPermission'))],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  // Cooldown check — use routeKey as cooldown key to avoid collisions
  // (multiple modules may have commands with the same name, e.g., "config")
  const cooldownSeconds = command.cooldown ?? 3;
  if (cooldownSeconds > 0) {
    if (!client.cooldowns.has(routeKey)) {
      client.cooldowns.set(routeKey, new Collection());
    }

    const timestamps = client.cooldowns.get(routeKey)!;
    const now = Date.now();
    const cooldownMs = cooldownSeconds * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expiresAt = timestamps.get(interaction.user.id)! + cooldownMs;
      if (now < expiresAt) {
        const remaining = expiresAt - now;
        await interaction.reply({
          embeds: [errorEmbed('Cooldown', t('common:cooldown', { time: formatDuration(remaining) }))],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownMs);
  }

  // Execute command
  const startTime = Date.now();
  try {
    await command.execute(interaction);
    const executionMs = Date.now() - startTime;

    // Track command usage for activity
    if (guildId) {
      eventBus.emit('messageCreated', {
        guildId,
        userId: interaction.user.id,
        channelId: interaction.channelId!,
        messageId: interaction.id,
      });

      // Log command usage to analytics table (fire-and-forget)
      logCommandUsage(guildId, interaction.user.id, moduleName, slug, group, sub, executionMs, true);
    }
  } catch (err: any) {
    const executionMs = Date.now() - startTime;
    logger.error(`Command execution error: /${slug} ${group || ''} ${sub}`, {
      error: err.message,
      stack: err.stack,
      guild: guildId,
      user: interaction.user.id,
      routeKey,
    });

    // Log failed command execution
    if (guildId) {
      logCommandUsage(guildId, interaction.user.id, moduleName, slug, group, sub, executionMs, false);
    }

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed('Error', t('common:error'))], flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [errorEmbed('Error', t('common:error'))], flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}

// ============================================
// Autocomplete Handler
// ============================================

async function handleAutocomplete(client: Client, interaction: AutocompleteInteraction): Promise<void> {
  // Build the same route key as slash commands to find the correct handler
  const slug = interaction.commandName;
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(false);

  if (!sub) return;

  const routeKey = group ? `${slug}:${group}:${sub}` : `${slug}::${sub}`;
  const command = client.commandRoutes.get(routeKey);
  if (!command?.autocomplete) return;

  try {
    await command.autocomplete(interaction);
  } catch (err: any) {
    logger.error(`Autocomplete error: ${routeKey}`, { error: err.message });
    await interaction.respond([]).catch(() => {});
  }
}

// ============================================
// Button Handler
// ============================================

async function handleButton(client: Client, interaction: ButtonInteraction): Promise<void> {
  // Buttons prefixed with "cfg:" belong to InteractiveSession collectors (e.g. /configs)
  // — do NOT process them here or the collector won't be able to acknowledge them
  if (interaction.customId.startsWith('cfg:')) return;

  // Button customIds follow format: module:action:data
  // e.g., "giveaway:enter:123", "ticket:close:456", "confession:approve:789"
  const [moduleName, action, ...dataParts] = interaction.customId.split(':');
  const data = dataParts.join(':');

  // Handle appeal buttons specifically — show modal for appeal submission
  if (moduleName === 'moderation' && (action === 'appeal' || action === 'appealform')) {
    await handleAppealButton(interaction, action, data);
    return;
  }

  const module = client.modules.get(moduleName);
  if (!module) {
    logger.debug(`No module handler for button: ${interaction.customId}`);
    return;
  }

  // Modules handle their own buttons via event bus
  // We emit a standardized event that modules listen for
  eventBus.emit('auditLog', {
    guildId: interaction.guildId! || '',
    type: 'button_interaction',
    data: { module: moduleName, action, data, userId: interaction.user.id },
  });
}

// ============================================
// Select Menu Handler
// ============================================

async function handleSelectMenu(client: Client, interaction: StringSelectMenuInteraction): Promise<void> {
  // Select menus prefixed with "cfg:" belong to InteractiveSession collectors (e.g. /configs)
  if (interaction.customId.startsWith('cfg:')) return;

  const [moduleName, action, ...dataParts] = interaction.customId.split(':');
  const data = dataParts.join(':');

  logger.debug(`Select menu: ${moduleName}:${action}`, { data, values: interaction.values });
}

// ============================================
// Modal Handler
// ============================================

async function handleModal(client: Client, interaction: ModalSubmitInteraction): Promise<void> {
  const [moduleName, action, ...dataParts] = interaction.customId.split(':');
  const data = dataParts.join(':');

  // Handle appeal modal submissions
  if (moduleName === 'moderation' && action === 'appealsubmit') {
    await handleAppealModalSubmit(interaction, data);
    return;
  }

  logger.debug(`Modal submit: ${moduleName}:${action}`, { data });
}

// ============================================
// Appeal Handlers
// ============================================

/**
 * Handle appeal button click — show a modal for the user to fill out.
 * Works for both DM appeal buttons (moderation:appeal:guildId:caseNumber)
 * and in-channel appeal buttons (moderation:appealform:guildId).
 */
async function handleAppealButton(interaction: ButtonInteraction, action: string, data: string): Promise<void> {
  const parts = data.split(':');
  const guildId = parts[0];
  const caseNumber = action === 'appeal' ? parts[1] : undefined;

  const modal = new ModalBuilder()
    .setCustomId(`moderation:appealsubmit:${guildId}${caseNumber ? `:${caseNumber}` : ''}`)
    .setTitle('Submit Appeal');

  const caseInput = new TextInputBuilder()
    .setCustomId('case_number')
    .setLabel('Case Number')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 42')
    .setRequired(true)
    .setMaxLength(10);

  if (caseNumber) {
    caseInput.setValue(caseNumber);
  }

  const reasonInput = new TextInputBuilder()
    .setCustomId('appeal_reason')
    .setLabel('Why should this action be reversed?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Explain why you believe this punishment was unjust or provide any relevant context...')
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(1000);

  const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(caseInput);
  const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
  modal.addComponents(row1, row2);

  await interaction.showModal(modal);
}

/**
 * Handle appeal modal submission — post the appeal to the appeals channel
 * (or a fallback mod log channel) for staff review.
 */
async function handleAppealModalSubmit(interaction: ModalSubmitInteraction, data: string): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const parts = data.split(':');
  const guildId = parts[0];

  const caseNumberStr = interaction.fields.getTextInputValue('case_number');
  const appealReason = interaction.fields.getTextInputValue('appeal_reason');
  const caseNum = parseInt(caseNumberStr, 10);

  if (isNaN(caseNum) || caseNum < 1) {
    await interaction.editReply({ content: 'Invalid case number. Please provide a valid case number.' });
    return;
  }

  // Verify the case exists and belongs to this user
  const pool = getPool();
  const caseResult = await pool.query(
    'SELECT case_number, action, reason, moderator_id, created_at FROM mod_cases WHERE guild_id = $1 AND case_number = $2 AND target_id = $3',
    [guildId, caseNum, interaction.user.id],
  );

  if (caseResult.rows.length === 0) {
    await interaction.editReply({
      content: 'No case found with that number for your account. Make sure you entered the correct case number.',
    });
    return;
  }

  const caseRow = caseResult.rows[0];

  // Get moderation config to find the appeals channel
  const modCfg = await moduleConfig.getModuleConfig(guildId, 'moderation');
  const appealChannelId = (modCfg?.config as Record<string, any>)?.appealChannelId as string | undefined;

  // Try to find a channel to post the appeal
  const guild = interaction.client.guilds.cache.get(guildId);
  if (!guild) {
    await interaction.editReply({ content: 'Unable to process appeal — server not found.' });
    return;
  }

  let targetChannel: TextChannel | null = null;

  if (appealChannelId) {
    const ch = guild.channels.cache.get(appealChannelId);
    if (ch && ch.type === ChannelType.GuildText) {
      targetChannel = ch as TextChannel;
    }
  }

  if (!targetChannel) {
    await interaction.editReply({
      content: 'Your appeal has been noted. A moderator will review it shortly.',
    });
    return;
  }

  // Post the appeal to the appeals channel
  const container = new ContainerBuilder().setAccentColor(0xFFA500); // Orange for pending appeals

  addTitleSection(container, `📨 New Appeal — Case #${caseNum}`);
  addFieldsV2(container, [
    { name: 'User', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
    { name: 'Case Number', value: `#${caseNum}`, inline: true },
    { name: 'Original Action', value: caseRow.action, inline: true },
    { name: 'Original Reason', value: caseRow.reason || 'No reason provided' },
    { name: 'Appeal Reason', value: appealReason },
  ]);

  try {
    await targetChannel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.editReply({
      content: '✅ Your appeal has been submitted successfully. A moderator will review it and respond.',
    });
  } catch (err: any) {
    logger.error('Failed to post appeal', { error: err.message, guildId });
    await interaction.editReply({
      content: 'Your appeal has been noted but could not be posted to the appeals channel. A moderator has been notified.',
    });
  }
}

// ============================================
// Command Usage Logging
// ============================================

/**
 * Log command execution to the command_usage analytics table.
 * Fire-and-forget — errors are logged but never block command execution.
 */
function logCommandUsage(
  guildId: string,
  userId: string,
  moduleName: string,
  commandName: string,
  subcommandGroup: string | null,
  subcommandName: string | null,
  executionMs: number,
  success: boolean,
): void {
  const pool = getPool();
  pool.query(
    `INSERT INTO command_usage (guild_id, user_id, module_name, command_name, subcommand_name, execution_ms, success)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      guildId,
      userId,
      moduleName,
      commandName,
      subcommandGroup ? `${subcommandGroup} ${subcommandName}` : subcommandName,
      executionMs,
      success,
    ],
  ).catch((err) => {
    logger.error('Failed to log command usage', { error: err.message });
  });
}
