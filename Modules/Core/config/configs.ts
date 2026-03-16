/**
 * /configs — Interactive configuration dashboard.
 *
 * Home (paginated) → Module settings (paginated fields).
 * Max 10 modules per home page.
 *
 * Features:
 * - Discord Components V2 with ContainerBuilder
 * - Nexus-branded containers with distinct colors per section
 * - 5-minute session timeout, 2-minute idle timeout
 * - Unambiguous customId routing to prevent all interaction failures
 * - Comprehensive field editing: booleans, choices, channels, roles, numbers, strings
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import {
  getAllModuleConfigMeta,
  formatConfigValue,
  ModuleConfigMeta,
  ConfigField,
  CATEGORY_EMOJIS,
} from '../../../Shared/src/utils/configRegistry';
import {
  InteractiveSession,
  PageContent,
  backButton,
  paginationButtons,
} from '../../../Shared/src/utils/interactiveEmbed';
import {
  getModuleAccentColor,
  addText,
  addSeparator,
  addSectionWithButton,
  addFooter,
} from '../../../Shared/src/utils/componentsV2';

/* ── Nexus Brand Colors ── */
const NEXUS_COLORS = {
  home: 0x5865f2,      // Blurple
} as const;

/* ── Constants ── */
const MODULES_PER_PAGE = 10;
const FIELDS_PER_PAGE = 4;

/* ─────────────────────────────────────────────
 * Home Page — Paginated module list
 * ───────────────────────────────────────────── */

function buildHomePage(userId: string, page = 0): PageContent {
  const allMeta = getAllModuleConfigMeta()
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));

  const totalPages = Math.max(1, Math.ceil(allMeta.length / MODULES_PER_PAGE));
  const validPage = Math.min(page, totalPages - 1);
  const startIdx = validPage * MODULES_PER_PAGE;
  const pageModules = allMeta.slice(startIdx, startIdx + MODULES_PER_PAGE);

  const lines = pageModules.map((m) => {
    const emoji = m.emoji ?? CATEGORY_EMOJIS[m.category] ?? '▸';
    return `${emoji} **${m.label}** — ${m.description.slice(0, 80)}`;
  });

  const container = new ContainerBuilder()
    .setAccentColor(NEXUS_COLORS.home);

  // Title
  addText(container, '### Nexus Bot • Server Configuration');

  // Description
  addText(
    container,
    `Configure **${allMeta.length}** modules for your server.\nSelect a module from the dropdown to view and edit its settings.`
  );

  // Module list
  addSeparator(container, 'small');
  addText(container, lines.join('\n'));

  // Select menu (inside container)
  const options = pageModules.map((m) => ({
    label: m.label,
    description: m.description.slice(0, 100),
    value: m.moduleKey,
    emoji: m.emoji,
  }));

  if (options.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`cfg:${userId}:selmod`)
      .setPlaceholder('⚙️ Choose a module to configure…')
      .addOptions(options);
    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    container.addActionRowComponents(selectRow);
  }

  // Pagination buttons (inside container)
  if (totalPages > 1) {
    const navRow = new ActionRowBuilder<ButtonBuilder>();
    const pagBtns = paginationButtons(validPage, totalPages, `cfg:${userId}:hp`);
    for (const btn of pagBtns) navRow.addComponents(btn);
    container.addActionRowComponents(navRow);
  }

  // Footer
  addFooter(container, `Page ${validPage + 1} of ${totalPages} • ${allMeta.length} configurable modules`);

  return { containers: [container] };
}

/* ─────────────────────────────────────────────
 * Module Settings Page — Paginated fields
 * ───────────────────────────────────────────── */

async function buildModulePage(
  guildId: string,
  meta: ModuleConfigMeta,
  userId: string,
  page = 0,
  useColors = true,
): Promise<PageContent> {
  const configResult = await moduleConfig.getModuleConfig(guildId, meta.moduleKey);
  const config = (configResult?.config as Record<string, any>) ?? {};
  const moduleEnabled = configResult?.enabled ?? false;

  const totalPages = Math.max(1, Math.ceil(meta.fields.length / FIELDS_PER_PAGE));
  const validPage = Math.min(page, totalPages - 1);
  const startIdx = validPage * FIELDS_PER_PAGE;
  const pageFields = meta.fields.slice(startIdx, startIdx + FIELDS_PER_PAGE);

  const modColor = getModuleAccentColor(meta.moduleKey, useColors);

  const container = new ContainerBuilder()
    .setAccentColor(modColor);

  // Header
  addText(container, `### ${meta.emoji} ${meta.label} — Settings\nYou can also adjust settings in the [dashboard](https://nexus-bot.tech/dashboard).`);

  // Module enable/disable toggle — always visible
  addSectionWithButton(
    container,
    `**Module Enabled**\n${moduleEnabled ? 'This module is currently active.' : 'This module is currently disabled.'}`,
    new ButtonBuilder()
      .setCustomId(`cfg:${userId}:modtoggle:${meta.moduleKey}`)
      .setLabel(moduleEnabled ? 'On' : 'Off')
      .setStyle(moduleEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
  );

  // Setting rows — each as a Section with button accessory
  for (const field of pageFields) {
    const rawValue = config[field.key];

    if (field.type === 'boolean') {
      const isOn = Boolean(rawValue ?? field.default);
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}`,
        new ButtonBuilder()
          .setCustomId(`cfg:${userId}:toggle:${meta.moduleKey}:${field.key}`)
          .setLabel(isOn ? 'On' : 'Off')
          .setStyle(isOn ? ButtonStyle.Success : ButtonStyle.Danger),
      );
    } else if (field.type === 'number' || field.type === 'string') {
      const displayValue = formatConfigValue(field, rawValue);
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}\nCurrent: ${displayValue}`,
        new ButtonBuilder()
          .setCustomId(`cfg:${userId}:edit:${meta.moduleKey}:${field.key}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary),
      );
    } else if (field.type === 'choice') {
      const displayValue = formatConfigValue(field, rawValue);
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}\nCurrent: ${displayValue}`,
        new ButtonBuilder()
          .setCustomId(`cfg:${userId}:choicebtn:${meta.moduleKey}:${field.key}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary),
      );
    } else if (field.type === 'channel' || field.type === 'channel-array') {
      const displayValue = formatConfigValue(field, rawValue);
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}\nCurrent: ${displayValue}`,
        new ButtonBuilder()
          .setCustomId(`cfg:${userId}:chanbtn:${meta.moduleKey}:${field.key}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary),
      );
    } else if (field.type === 'role' || field.type === 'role-array') {
      const displayValue = formatConfigValue(field, rawValue);
      addSectionWithButton(
        container,
        `**${field.label}**\n${field.description}\nCurrent: ${displayValue}`,
        new ButtonBuilder()
          .setCustomId(`cfg:${userId}:rolebtn:${meta.moduleKey}:${field.key}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary),
      );
    }
  }

  addSeparator(container, 'small');

  // Footer + pagination
  addFooter(container, `Page ${validPage + 1} of ${totalPages}`);

  // Navigation: back + pagination
  const navRow = new ActionRowBuilder<ButtonBuilder>();
  navRow.addComponents(
    backButton(`cfg:${userId}:home`),
    new ButtonBuilder()
      .setCustomId(`cfg:${userId}:fp:${meta.moduleKey}:prev`)
      .setLabel('‹')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(validPage <= 0),
    new ButtonBuilder()
      .setCustomId(`cfg:${userId}:fp:${meta.moduleKey}:next`)
      .setLabel('›')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(validPage >= totalPages - 1),
  );
  container.addActionRowComponents(navRow);

  return { containers: [container] };
}

/* ─────────────────────────────────────────────
 * Main Command
 * ───────────────────────────────────────────── */

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('configs')
    .setDescription('Interactive server configuration dashboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  module: 'core',
  permissionPath: 'core.configs',
  requiresModule: false,
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const session = new InteractiveSession(interaction, { timeout: 300_000 }); // 5 minutes
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    // Read core config to check if per-module embed colors are enabled
    let useColors = true;
    try {
      const coreConfig = await moduleConfig.getModuleConfig(guildId, 'core');
      const cfg = (coreConfig?.config as Record<string, unknown>) ?? {};
      if (cfg.configEmbedColors === false) useColors = false;
    } catch { /* default to enabled */ }

    // State
    let homePage = 0;
    let currentModuleKey: string | null = null;
    let fieldPage = 0;

    await session.start(buildHomePage(userId, 0));

    while (!session.isEnded) {
      const component = await session.awaitComponent(120_000); // 2-minute idle
      if (!component) break;

      const cid = component.customId;

      /* ── Home navigation ── */
      if (cid === `cfg:${userId}:home`) {
        await component.deferUpdate();
        currentModuleKey = null;
        fieldPage = 0;
        await session.setPage(buildHomePage(userId, homePage));
        continue;
      }

      /* ── Home page pagination ── */
      if (cid === `cfg:${userId}:hp:prev`) {
        await component.deferUpdate();
        homePage = Math.max(0, homePage - 1);
        await session.setPage(buildHomePage(userId, homePage));
        continue;
      }
      if (cid === `cfg:${userId}:hp:next`) {
        await component.deferUpdate();
        homePage += 1;
        await session.setPage(buildHomePage(userId, homePage));
        continue;
      }

      /* ── Module selected from dropdown ── */
      if (cid === `cfg:${userId}:selmod` && component.isStringSelectMenu()) {
        await component.deferUpdate();
        const moduleKey = component.values[0];
        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        if (meta) {
          currentModuleKey = moduleKey;
          fieldPage = 0;
          await session.setPage(await buildModulePage(guildId, meta, userId, 0, useColors));
        }
        continue;
      }

      /* ── Field page pagination: cfg:{userId}:fp:{moduleKey}:prev|next ── */
      if (cid.startsWith(`cfg:${userId}:fp:`) && (cid.endsWith(':prev') || cid.endsWith(':next'))) {
        await component.deferUpdate();
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const direction = parts[4];
        if (direction === 'prev') fieldPage = Math.max(0, fieldPage - 1);
        else if (direction === 'next') fieldPage += 1;

        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        if (meta) {
          await session.setPage(await buildModulePage(guildId, meta, userId, fieldPage, useColors));
        }
        continue;
      }

      /* ── Toggle boolean ── */
      if (cid.startsWith(`cfg:${userId}:toggle:`)) {
        await component.deferUpdate();
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const fieldKey = parts[4];
        const configResult = await moduleConfig.getModuleConfig(guildId, moduleKey);
        const cfg = (configResult?.config as Record<string, any>) ?? {};
        cfg[fieldKey] = !cfg[fieldKey];
        await moduleConfig.updateConfig(guildId, moduleKey, cfg);

        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        if (meta) {
          await session.setPage(await buildModulePage(guildId, meta, userId, fieldPage, useColors));
        }
        continue;
      }

      /* ── Module enable/disable toggle ── */
      if (cid.startsWith(`cfg:${userId}:modtoggle:`)) {
        await component.deferUpdate();
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const configResult = await moduleConfig.getModuleConfig(guildId, moduleKey);
        const wasEnabled = configResult?.enabled ?? false;
        await moduleConfig.setEnabled(guildId, moduleKey, !wasEnabled);

        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        if (meta) {
          await session.setPage(await buildModulePage(guildId, meta, userId, fieldPage, useColors));
        }
        continue;
      }

      /* ── Choice button → ephemeral select menu ── */
      if (cid.startsWith(`cfg:${userId}:choicebtn:`)) {
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const fieldKey = parts[4];
        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        const field = meta?.fields.find((f: ConfigField) => f.key === fieldKey);
        if (!field || !field.choices) { await component.deferUpdate().catch(() => {}); continue; }

        const configResult = await moduleConfig.getModuleConfig(guildId, moduleKey);
        const cfg = (configResult?.config as Record<string, any>) ?? {};

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`cfg:${userId}:choice:${moduleKey}:${fieldKey}`)
          .setPlaceholder(`Select ${field.label}`)
          .addOptions(
            field.choices.map((c: any) => ({
              label: c.label,
              value: c.value,
              description: c.description?.slice(0, 100),
              default: cfg[fieldKey] === c.value,
            })),
          );
        await component.reply({
          components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
          ephemeral: true,
        });
        continue;
      }

      /* ── Choice selection (from ephemeral select menu) ── */
      if (cid.startsWith(`cfg:${userId}:choice:`) && component.isStringSelectMenu()) {
        await component.deferUpdate();
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const fieldKey = parts[4];
        const newValue = component.values[0];
        const configResult = await moduleConfig.getModuleConfig(guildId, moduleKey);
        const cfg = (configResult?.config as Record<string, any>) ?? {};
        cfg[fieldKey] = newValue;
        await moduleConfig.updateConfig(guildId, moduleKey, cfg);

        if (currentModuleKey) {
          const allMeta = getAllModuleConfigMeta();
          const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === currentModuleKey);
          if (meta) {
            await session.setPage(await buildModulePage(guildId, meta, userId, fieldPage, useColors));
          }
        }
        continue;
      }

      /* ── Channel button → ephemeral select menu ── */
      if (cid.startsWith(`cfg:${userId}:chanbtn:`)) {
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const fieldKey = parts[4];
        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        const field = meta?.fields.find((f: ConfigField) => f.key === fieldKey);
        if (!field) { await component.deferUpdate().catch(() => {}); continue; }

        const isArray = field.type === 'channel-array';
        const channelMenu = new ChannelSelectMenuBuilder()
          .setCustomId(`cfg:${userId}:channel:${moduleKey}:${fieldKey}`)
          .setPlaceholder(`Select ${field.label}`)
          .setChannelTypes(ChannelType.GuildText)
          .setMinValues(isArray ? 0 : 1)
          .setMaxValues(isArray ? 10 : 1);
        await component.reply({
          components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu)],
          ephemeral: true,
        });
        continue;
      }

      /* ── Channel selection (from ephemeral select menu) ── */
      if (cid.startsWith(`cfg:${userId}:channel:`) && component.isChannelSelectMenu()) {
        await component.deferUpdate();
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const fieldKey = parts[4];
        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        const field = meta?.fields.find((f: ConfigField) => f.key === fieldKey);
        const isArray = field?.type === 'channel-array';

        const selectedValue = isArray ? component.values : (component.values[0] ?? null);
        const configResult = await moduleConfig.getModuleConfig(guildId, moduleKey);
        const cfg = (configResult?.config as Record<string, any>) ?? {};
        cfg[fieldKey] = selectedValue;
        await moduleConfig.updateConfig(guildId, moduleKey, cfg);

        if (currentModuleKey) {
          const m = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === currentModuleKey);
          if (m) {
            await session.setPage(await buildModulePage(guildId, m, userId, fieldPage, useColors));
          }
        }
        continue;
      }

      /* ── Role button → ephemeral select menu ── */
      if (cid.startsWith(`cfg:${userId}:rolebtn:`)) {
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const fieldKey = parts[4];
        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        const field = meta?.fields.find((f: ConfigField) => f.key === fieldKey);
        if (!field) { await component.deferUpdate().catch(() => {}); continue; }

        const isArray = field.type === 'role-array';
        const roleMenu = new RoleSelectMenuBuilder()
          .setCustomId(`cfg:${userId}:role:${moduleKey}:${fieldKey}`)
          .setPlaceholder(`Select ${field.label}`)
          .setMinValues(isArray ? 0 : 1)
          .setMaxValues(isArray ? 10 : 1);
        await component.reply({
          components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleMenu)],
          ephemeral: true,
        });
        continue;
      }

      /* ── Role selection (from ephemeral select menu) ── */
      if (cid.startsWith(`cfg:${userId}:role:`) && component.isRoleSelectMenu()) {
        await component.deferUpdate();
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const fieldKey = parts[4];
        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        const field = meta?.fields.find((f: ConfigField) => f.key === fieldKey);
        const isArray = field?.type === 'role-array';

        const selectedValue = isArray ? component.values : (component.values[0] ?? null);
        const configResult = await moduleConfig.getModuleConfig(guildId, moduleKey);
        const cfg = (configResult?.config as Record<string, any>) ?? {};
        cfg[fieldKey] = selectedValue;
        await moduleConfig.updateConfig(guildId, moduleKey, cfg);

        if (currentModuleKey) {
          const m = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === currentModuleKey);
          if (m) {
            await session.setPage(await buildModulePage(guildId, m, userId, fieldPage, useColors));
          }
        }
        continue;
      }

      /* ── Edit number/string via modal ── */
      if (cid.startsWith(`cfg:${userId}:edit:`)) {
        const parts = cid.split(':');
        const moduleKey = parts[3];
        const fieldKey = parts[4];
        const allMeta = getAllModuleConfigMeta();
        const meta = allMeta.find((m: ModuleConfigMeta) => m.moduleKey === moduleKey);
        if (!meta) {
          await component.deferUpdate().catch(() => {});
          continue;
        }
        const field = meta.fields.find((f: ConfigField) => f.key === fieldKey);
        if (!field) {
          await component.deferUpdate().catch(() => {});
          continue;
        }

        const configResult = await moduleConfig.getModuleConfig(guildId, moduleKey);
        const cfg = (configResult?.config as Record<string, any>) ?? {};
        const currentValue = cfg[fieldKey];

        const result = await session.showModal(component, {
          title: `Edit ${field.label}`.slice(0, 45),
          fieldId: `${moduleKey}:${fieldKey}`,
          label: field.label.slice(0, 45),
          placeholder: field.type === 'number'
            ? `Enter a number${field.min !== undefined ? ` (min: ${field.min})` : ''}${field.max !== undefined ? ` (max: ${field.max})` : ''}`
            : 'Enter a value',
          value: currentValue !== undefined && currentValue !== null ? String(currentValue) : undefined,
        });

        if (result) {
          let parsedValue: string | number = result.value;
          if (field.type === 'number') {
            parsedValue = Number(result.value);
            if (isNaN(parsedValue)) {
              await result.modalInteraction.reply({
                content: '❌ Invalid number.',
                ephemeral: true,
              });
              continue;
            }
            if (field.min !== undefined && parsedValue < field.min) parsedValue = field.min;
            if (field.max !== undefined && parsedValue > field.max) parsedValue = field.max;
          }

          cfg[fieldKey] = parsedValue;
          await moduleConfig.updateConfig(guildId, moduleKey, cfg);
          await result.modalInteraction.deferUpdate();
          await session.setPage(await buildModulePage(guildId, meta, userId, fieldPage, useColors));
        }
        continue;
      }

      // Fallback: defer to prevent "interaction failed"
      if (!component.deferred && !component.replied) {
        await component.deferUpdate().catch(() => {});
      }
    }

    await session.end();
  },
};

export default command;
