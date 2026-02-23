import {
  Client,
  Interaction,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  Collection,
} from 'discord.js';
import { permissionManager } from '../../../Shared/src/permissions/permissionManager';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { premiumManager } from '../../../Shared/src/middleware/premiumCheck';
import { errorEmbed } from '../../../Shared/src/utils/embed';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { t } from '../../../Shared/src/i18n';
import { formatDuration } from '../../../Shared/src/utils/time';
import { eventBus } from '../../../Shared/src/events/eventBus';

const logger = createModuleLogger('InteractionHandler');

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
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  const guildId = interaction.guildId!;

  // Guild-only check
  if (command.guildOnly !== false && !guildId) {
    await interaction.reply({
      embeds: [errorEmbed('Server Only', t('common:guildOnly'))],
      ephemeral: true,
    });
    return;
  }

  if (guildId) {
    // Module enabled check
    if (command.requiresModule !== false) {
      const isEnabled = await moduleConfig.isEnabled(guildId, command.module);
      if (!isEnabled) {
        await interaction.reply({
          embeds: [errorEmbed('Module Disabled', t('common:moduleDisabled'))],
          ephemeral: true,
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
          ephemeral: true,
        });
        return;
      }
    }

    // Permission check
    const permResult = await permissionManager.canUse(interaction, command.permissionPath);
    if (!permResult.allowed) {
      await interaction.reply({
        embeds: [errorEmbed('No Permission', permResult.reason || t('common:noPermission'))],
        ephemeral: true,
      });
      return;
    }
  }

  // Cooldown check
  const cooldownSeconds = command.cooldown ?? 3;
  if (cooldownSeconds > 0) {
    if (!client.cooldowns.has(command.data.name)) {
      client.cooldowns.set(command.data.name, new Collection());
    }

    const timestamps = client.cooldowns.get(command.data.name)!;
    const now = Date.now();
    const cooldownMs = cooldownSeconds * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expiresAt = timestamps.get(interaction.user.id)! + cooldownMs;
      if (now < expiresAt) {
        const remaining = expiresAt - now;
        await interaction.reply({
          embeds: [errorEmbed('Cooldown', t('common:cooldown', { time: formatDuration(remaining) }))],
          ephemeral: true,
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
    logger.error(`Command execution error: ${interaction.commandName}`, {
      error: err.message,
      stack: err.stack,
      guild: guildId,
      user: interaction.user.id,
    });

    const errorMsg = {
      embeds: [errorEmbed('Error', t('common:error'))],
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMsg).catch(() => {});
    } else {
      await interaction.reply(errorMsg).catch(() => {});
    }
  }
}

// ============================================
// Autocomplete Handler
// ============================================

async function handleAutocomplete(client: Client, interaction: AutocompleteInteraction): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  if (!command?.autocomplete) return;

  try {
    await command.autocomplete(interaction);
  } catch (err: any) {
    logger.error(`Autocomplete error: ${interaction.commandName}`, { error: err.message });
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
