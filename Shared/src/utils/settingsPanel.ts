/**
 * Settings Panel — Dank Memer-style interactive settings UI.
 *
 * Renders module config as V2 Sections with button accessories:
 *   - Boolean fields  → On/Off toggle button (green/red)
 *   - Number fields   → Edit button (blurple) → opens modal
 *   - String fields   → Edit button (blurple) → opens modal
 *   - Choice fields   → Edit button (blurple) → opens select menu
 *   - Channel fields  → Edit button (blurple) → opens select menu
 *   - Role fields     → Edit button (blurple) → opens select menu
 *   - Array fields    → Manage button (grey) → opens select menu
 *
 * Supports pagination (5 settings per page) with nav buttons.
 * All interactions are handled via a single collector pattern.
 */

import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ComponentType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js';

import {
  getModuleConfigMeta,
  formatConfigValue,
  type ConfigField,
  type ModuleConfigMeta,
} from './configRegistry';

import {
  moduleContainer,
  addText,
  addSeparator,
  addSectionWithButton,
  addButtons,
  addFooter,
  v2Payload,
} from './componentsV2';

import { ModuleConfigManager } from '../middleware/moduleConfig';

const ITEMS_PER_PAGE = 5;
const COLLECTOR_TIMEOUT = 120_000; // 2 minutes

// ── Build Settings Page ──

function buildSettingsPage(
  meta: ModuleConfigMeta,
  config: Record<string, unknown>,
  page: number,
  moduleEnabled: boolean,
  uniqueId: string,
): ReturnType<typeof v2Payload> {
  const totalPages = Math.max(1, Math.ceil(meta.fields.length / ITEMS_PER_PAGE));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageFields = meta.fields.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const container = moduleContainer(meta.moduleKey);

  // Header
  addText(container, `### ${meta.emoji} ${meta.label} — Settings`);
  addText(container, meta.description);

  // Module enable/disable toggle (always first)
  addSeparator(container, 'small');
  addSectionWithButton(
    container,
    `**Module Enabled**\n${moduleEnabled ? '✅ This module is active' : '❌ This module is disabled'}`,
    new ButtonBuilder()
      .setCustomId(`sp:toggle_module:${uniqueId}`)
      .setLabel(moduleEnabled ? 'On' : 'Off')
      .setStyle(moduleEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
  );

  // Settings rows
  addSeparator(container, 'small');

  for (let i = 0; i < pageFields.length; i++) {
    const field = pageFields[i];
    const value = config[field.key];
    const displayValue = formatConfigValue(field, value);
    const fieldIdx = startIdx + i;

    if (field.type === 'boolean') {
      const isOn = Boolean(value ?? field.default);
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}`,
        new ButtonBuilder()
          .setCustomId(`sp:toggle:${uniqueId}:${fieldIdx}`)
          .setLabel(isOn ? 'On' : 'Off')
          .setStyle(isOn ? ButtonStyle.Success : ButtonStyle.Danger),
      );
    } else if (field.type === 'number' || field.type === 'string') {
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}\nCurrent: ${displayValue}`,
        new ButtonBuilder()
          .setCustomId(`sp:edit:${uniqueId}:${fieldIdx}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary),
      );
    } else if (field.type === 'choice') {
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}\nCurrent: ${displayValue}`,
        new ButtonBuilder()
          .setCustomId(`sp:choice:${uniqueId}:${fieldIdx}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary),
      );
    } else if (field.type === 'channel' || field.type === 'channel-array') {
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}\nCurrent: ${displayValue}`,
        new ButtonBuilder()
          .setCustomId(`sp:channel:${uniqueId}:${fieldIdx}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary),
      );
    } else if (field.type === 'role' || field.type === 'role-array') {
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}\nCurrent: ${displayValue}`,
        new ButtonBuilder()
          .setCustomId(`sp:role:${uniqueId}:${fieldIdx}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary),
      );
    }
  }

  // Pagination footer
  addSeparator(container, 'small');
  addFooter(container, `Page ${currentPage} of ${totalPages}`);

  // Navigation buttons
  if (totalPages > 1) {
    const navButtons: ButtonBuilder[] = [
      new ButtonBuilder()
        .setCustomId(`sp:first:${uniqueId}`)
        .setLabel('«')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1),
      new ButtonBuilder()
        .setCustomId(`sp:prev:${uniqueId}`)
        .setLabel('‹')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1),
      new ButtonBuilder()
        .setCustomId(`sp:refresh:${uniqueId}`)
        .setLabel('⟳')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`sp:next:${uniqueId}`)
        .setLabel('›')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages),
      new ButtonBuilder()
        .setCustomId(`sp:last:${uniqueId}`)
        .setLabel('»')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages),
    ];
    addButtons(container, navButtons);
  }

  return v2Payload([container]);
}

// ── Main Entry Point ──

/**
 * Display an interactive settings panel for a module.
 * Handles all button interactions, modals, and select menus internally.
 *
 * @param interaction - The slash command interaction
 * @param moduleKey  - The module key (e.g., 'currency', 'leveling')
 * @param moduleConfig - The ModuleConfigManager instance
 */
export async function showSettingsPanel(
  interaction: ChatInputCommandInteraction,
  moduleKey: string,
  moduleConfig: ModuleConfigManager,
): Promise<void> {
  const meta = getModuleConfigMeta(moduleKey);
  if (!meta) {
    await interaction.reply({
      components: [],
      content: `No config metadata found for module: ${moduleKey}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId!;
  const uniqueId = `${moduleKey}:${interaction.user.id}`;
  let currentPage = 1;

  // Fetch current config
  const fetchConfig = async () => {
    const result = await moduleConfig.getModuleConfig(guildId, moduleKey);
    return {
      config: (result?.config ?? {}) as Record<string, unknown>,
      enabled: result?.enabled ?? false,
    };
  };

  let state = await fetchConfig();

  // Send initial message
  const msg = await interaction.reply({
    ...buildSettingsPage(meta, state.config, currentPage, state.enabled, uniqueId),
    fetchReply: true,
  });

  // ── Collector ──

  const collector = msg.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(`sp:`) && i.customId.includes(uniqueId),
    time: COLLECTOR_TIMEOUT,
  });

  collector.on('collect', async (i) => {
    try {
      const parts = i.customId.split(':');
      const action = parts[1]; // toggle, edit, choice, channel, role, toggle_module, first, prev, next, last, refresh

      // ── Navigation ──
      if (action === 'first') { currentPage = 1; }
      else if (action === 'prev') { currentPage = Math.max(1, currentPage - 1); }
      else if (action === 'next') { currentPage++; }
      else if (action === 'last') { currentPage = Math.ceil(meta.fields.length / ITEMS_PER_PAGE); }
      else if (action === 'refresh') { /* just re-render */ }

      if (['first', 'prev', 'next', 'last', 'refresh'].includes(action)) {
        state = await fetchConfig();
        await (i as ButtonInteraction).update(
          buildSettingsPage(meta, state.config, currentPage, state.enabled, uniqueId),
        );
        return;
      }

      // ── Module Toggle ──
      if (action === 'toggle_module') {
        const newEnabled = !state.enabled;
        await moduleConfig.setEnabled(guildId, moduleKey, newEnabled);
        state.enabled = newEnabled;
        await (i as ButtonInteraction).update(
          buildSettingsPage(meta, state.config, currentPage, state.enabled, uniqueId),
        );
        return;
      }

      // ── Boolean Toggle ──
      if (action === 'toggle') {
        const fieldIdx = parseInt(parts[3], 10);
        const field = meta.fields[fieldIdx];
        if (!field) { await i.deferUpdate(); return; }

        const current = Boolean(state.config[field.key] ?? field.default);
        state.config[field.key] = !current;
        await moduleConfig.updateConfig(guildId, moduleKey, { [field.key]: !current });
        await (i as ButtonInteraction).update(
          buildSettingsPage(meta, state.config, currentPage, state.enabled, uniqueId),
        );
        return;
      }

      // ── Number/String Edit (Modal) ──
      if (action === 'edit') {
        const fieldIdx = parseInt(parts[3], 10);
        const field = meta.fields[fieldIdx];
        if (!field) { await i.deferUpdate(); return; }

        const modal = new ModalBuilder()
          .setCustomId(`sp:modal:${uniqueId}:${fieldIdx}`)
          .setTitle(`Edit ${field.label}`)
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('value')
                .setLabel(field.label)
                .setPlaceholder(
                  field.type === 'number'
                    ? `Enter a number${field.min !== undefined ? ` (min: ${field.min}` : ''}${field.max !== undefined ? `, max: ${field.max})` : field.min !== undefined ? ')' : ''}`
                    : 'Enter a value',
                )
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(state.config[field.key] != null ? String(state.config[field.key]) : ''),
            ),
          );

        await (i as ButtonInteraction).showModal(modal);

        // Await modal submission
        const modalSubmit = await i.awaitModalSubmit({
          filter: (ms) => ms.customId === `sp:modal:${uniqueId}:${fieldIdx}`,
          time: 60_000,
        }).catch(() => null);

        if (!modalSubmit) return;

        const rawValue = (modalSubmit as ModalSubmitInteraction).fields.getTextInputValue('value').trim();

        if (field.type === 'number') {
          const num = Number(rawValue);
          if (isNaN(num)) {
            await modalSubmit.reply({
              content: 'Invalid number.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          if (field.min !== undefined && num < field.min) {
            await modalSubmit.reply({
              content: `Value must be at least ${field.min}.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          if (field.max !== undefined && num > field.max) {
            await modalSubmit.reply({
              content: `Value must be at most ${field.max}.`,
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
          state.config[field.key] = num;
          await moduleConfig.updateConfig(guildId, moduleKey, { [field.key]: num });
        } else {
          state.config[field.key] = rawValue;
          await moduleConfig.updateConfig(guildId, moduleKey, { [field.key]: rawValue });
        }

        await modalSubmit.deferUpdate();
        await msg.edit(
          buildSettingsPage(meta, state.config, currentPage, state.enabled, uniqueId),
        );
        return;
      }

      // ── Choice Select ──
      if (action === 'choice') {
        const fieldIdx = parseInt(parts[3], 10);
        const field = meta.fields[fieldIdx];
        if (!field || !field.choices) { await i.deferUpdate(); return; }

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`sp:choicesel:${uniqueId}:${fieldIdx}`)
            .setPlaceholder(`Select ${field.label}`)
            .addOptions(
              field.choices.map((c) => ({
                label: c.label,
                value: c.value,
                description: c.description,
                default: state.config[field.key] === c.value,
              })),
            ),
        );

        await (i as ButtonInteraction).reply({
          components: [selectRow],
          flags: MessageFlags.Ephemeral,
        });

        const selectCollector = (await (i as ButtonInteraction).fetchReply()).createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          filter: (si) => si.user.id === interaction.user.id,
          time: 30_000,
          max: 1,
        });

        selectCollector.on('collect', async (si: StringSelectMenuInteraction) => {
          const selected = si.values[0];
          state.config[field.key] = selected;
          await moduleConfig.updateConfig(guildId, moduleKey, { [field.key]: selected });
          await si.update({ content: `✅ **${field.label}** set to **${field.choices!.find((c) => c.value === selected)?.label ?? selected}**`, components: [] });
          await msg.edit(
            buildSettingsPage(meta, state.config, currentPage, state.enabled, uniqueId),
          );
        });
        return;
      }

      // ── Channel Select ──
      if (action === 'channel') {
        const fieldIdx = parseInt(parts[3], 10);
        const field = meta.fields[fieldIdx];
        if (!field) { await i.deferUpdate(); return; }

        const selectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId(`sp:chansel:${uniqueId}:${fieldIdx}`)
            .setPlaceholder(`Select ${field.label}`)
            .setMinValues(field.type === 'channel-array' ? 0 : 1)
            .setMaxValues(field.type === 'channel-array' ? 10 : 1),
        );

        await (i as ButtonInteraction).reply({
          components: [selectRow],
          flags: MessageFlags.Ephemeral,
        });

        const selectCollector = (await (i as ButtonInteraction).fetchReply()).createMessageComponentCollector({
          componentType: ComponentType.ChannelSelect,
          filter: (si) => si.user.id === interaction.user.id,
          time: 30_000,
          max: 1,
        });

        selectCollector.on('collect', async (si: ChannelSelectMenuInteraction) => {
          const selected = field.type === 'channel-array'
            ? si.values
            : si.values[0];
          state.config[field.key] = selected;
          await moduleConfig.updateConfig(guildId, moduleKey, { [field.key]: selected });
          const display = field.type === 'channel-array'
            ? (si.values as string[]).map((id) => `<#${id}>`).join(', ') || 'None'
            : `<#${si.values[0]}>`;
          await si.update({ content: `✅ **${field.label}** set to ${display}`, components: [] });
          await msg.edit(
            buildSettingsPage(meta, state.config, currentPage, state.enabled, uniqueId),
          );
        });
        return;
      }

      // ── Role Select ──
      if (action === 'role') {
        const fieldIdx = parseInt(parts[3], 10);
        const field = meta.fields[fieldIdx];
        if (!field) { await i.deferUpdate(); return; }

        const selectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
          new RoleSelectMenuBuilder()
            .setCustomId(`sp:rolesel:${uniqueId}:${fieldIdx}`)
            .setPlaceholder(`Select ${field.label}`)
            .setMinValues(field.type === 'role-array' ? 0 : 1)
            .setMaxValues(field.type === 'role-array' ? 10 : 1),
        );

        await (i as ButtonInteraction).reply({
          components: [selectRow],
          flags: MessageFlags.Ephemeral,
        });

        const selectCollector = (await (i as ButtonInteraction).fetchReply()).createMessageComponentCollector({
          componentType: ComponentType.RoleSelect,
          filter: (si) => si.user.id === interaction.user.id,
          time: 30_000,
          max: 1,
        });

        selectCollector.on('collect', async (si: RoleSelectMenuInteraction) => {
          const selected = field.type === 'role-array'
            ? si.values
            : si.values[0];
          state.config[field.key] = selected;
          await moduleConfig.updateConfig(guildId, moduleKey, { [field.key]: selected });
          const display = field.type === 'role-array'
            ? (si.values as string[]).map((id) => `<@&${id}>`).join(', ') || 'None'
            : `<@&${si.values[0]}>`;
          await si.update({ content: `✅ **${field.label}** set to ${display}`, components: [] });
          await msg.edit(
            buildSettingsPage(meta, state.config, currentPage, state.enabled, uniqueId),
          );
        });
        return;
      }

      // Fallback
      await i.deferUpdate();
    } catch (err) {
      // Silently handle expired interactions
      if (i.replied || i.deferred) return;
      await i.deferUpdate().catch(() => {});
    }
  });

  collector.on('end', async () => {
    // Delete the message when the collector expires (same as interactive sessions)
    await msg.delete().catch(() => {});
  });
}
