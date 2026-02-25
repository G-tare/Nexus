import { 
  Client,
  Interaction,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  Collection,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { permissionManager } from '../../../Shared/src/permissions/permissionManager';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { premiumManager } from '../../../Shared/src/middleware/premiumCheck';
import { errorEmbed } from '../../../Shared/src/utils/embed';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { t } from '../../../Shared/src/i18n';
import { formatDuration } from '../../../Shared/src/utils/time';
import { eventBus } from '../../../Shared/src/events/eventBus';

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

  if (!sub) {
    // All commands should be subcommands after grouping — this shouldn't happen
    logger.warn(`No subcommand found for /${slug}`);
    return;
  }

  const routeKey = group ? `${slug}:${group}:${sub}` : `${slug}::${sub}`;
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
    // Module enabled check
    if (command.requiresModule !== false) {
      const isEnabled = await moduleConfig.isEnabled(guildId, moduleName);
      if (!isEnabled) {
        await interaction.reply({
          embeds: [errorEmbed('Module Disabled', t('common:moduleDisabled'))],
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
  try {
    await command.execute(interaction);

    // Track command usage for activity
    if (guildId) {
      eventBus.emit('messageCreated', {
        guildId,
        userId: interaction.user.id,
        channelId: interaction.channelId!,
        messageId: interaction.id,
      });
    }
  } catch (err: any) {
    logger.error(`Command execution error: /${slug} ${group || ''} ${sub}`, {
      error: err.message,
      stack: err.stack,
      guild: guildId,
      user: interaction.user.id,
      routeKey,
    });

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
  // Button customIds follow format: module:action:data
  // e.g., "giveaway:enter:123", "ticket:close:456", "confession:approve:789"
  const [moduleName, action, ...dataParts] = interaction.customId.split(':');
  const data = dataParts.join(':');

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

  logger.debug(`Modal submit: ${moduleName}:${action}`, { data });
}
