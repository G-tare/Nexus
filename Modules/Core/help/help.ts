/**
 * /help — Interactive help dashboard for REGULAR USERS only.
 *
 * Home (paginated) → Module commands (paginated) → Command detail (paginated).
 *
 * IMPORTANT: This help system ONLY shows commands that everyone can use.
 * Staff, admin, mod, and owner commands are completely hidden.
 *
 * Features:
 * - Module-specific emojis for each module
 * - Nexus-branded containers with unique visual styling per level (V2 Components)
 * - Discord-style command usage image showing multiple variations
 * - 5-minute session timeout, 2-minute idle timeout
 * - Cycle button to rotate through usage example images for subcommands
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  Client,
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} from 'discord.js';
import { BotCommand, BotModule } from '../../../Shared/src/types/command';
import {
  InteractiveSession,
  PageContent,
  backButton,
  paginationButtons,
} from '../../../Shared/src/utils/interactiveEmbed';
import { generateCommandImageFromData } from '../../../Shared/src/utils/commandImageGen';
import { getModuleColor } from '../../../Shared/src/utils/embed';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { runTicketFlow } from './ticketFlow';

/* ── Nexus Brand Colors ── */
const NEXUS = {
  home: 0x5865f2,        // Blurple — main brand
  divider: '─────────────────────────',
} as const;

/* ── Discord option type constants ── */
const SUB_COMMAND = 1;
const SUB_COMMAND_GROUP = 2;

const OPTION_TYPE_NAMES: Record<number, string> = {
  3: 'Text', 4: 'Integer', 5: 'True/False', 6: 'User',
  7: 'Channel', 8: 'Role', 9: 'User or Role', 10: 'Number', 11: 'File',
};

function optTypeName(type: number): string {
  return OPTION_TYPE_NAMES[type] ?? 'Unknown';
}

/* ── Pagination constants ── */
const MODULES_PER_PAGE = 10;
const COMMANDS_PER_PAGE = 8;
const SUBCMDS_PER_PAGE = 3;

/* ── Module-Specific Emoji Map ── */
const MODULE_EMOJIS: Record<string, string> = {
  afk: '💤', aichatbot: '🤖', activitytracking: '📊', antiraid: '🛡️',
  automod: '⚔️', autoroles: '🏷️', autosetup: '⚙️', backup: '💾',
  birthdays: '🎂', casino: '🎰', colorroles: '🎨', confessions: '🤫',
  core: '💎', counting: '🔢', currency: '💰', customcommands: '✨',
  donationtracking: '💝', family: '👨‍👩‍👧‍👦', forms: '📋', fun: '🎮',
  giveaways: '🎁', images: '🖼️', invitetracker: '📨', leaderboards: '🏆',
  leveling: '⬆️', logging: '📝', messagetracking: '📈', moderation: '🔨',
  music: '🎵', polls: '📊', profile: '👤', quoteboard: '💬',
  raffles: '🎟️', reactionroles: '🏅', reminders: '⏰', reputation: '⭐',
  scheduledmessages: '📢', shop: '🛒', soundboard: '🔊', statschannels: '📉',
  stickymessages: '📌', suggestions: '💡', tempvoice: '🎙️', tickets: '🎫',
  timers: '⏱️', translation: '🌐', userphone: '📞', utilities: '🔧',
  voicephone: '☎️', welcome: '👋',
};

function getModuleEmoji(name: string): string {
  return MODULE_EMOJIS[name] ?? '▸';
}

/* ─────────────────────────────────────────────
 * Permission filter — only public commands
 * ───────────────────────────────────────────── */

function isPublicCommand(cmd: BotCommand): boolean {
  const cmdJson = (cmd.data as any).toJSON();
  if (cmdJson.default_member_permissions !== null &&
      cmdJson.default_member_permissions !== undefined) return false;
  if (cmd.defaultPermissions) return false;
  return true;
}

function getPublicCommands(module: BotModule): BotCommand[] {
  return (module.commands ?? []).filter(isPublicCommand);
}

/* ─────────────────────────────────────────────
 * Parameter formatting helpers
 * ───────────────────────────────────────────── */

function formatParam(opt: any): string {
  const req = opt.required ? '`Required`' : '`Optional`';
  const type = optTypeName(opt.type);
  let line = `╰ **\`${opt.name}\`** · ${type} ${req}`;

  if (opt.description) line += `\n\u2003\u2003*${opt.description}*`;

  if (opt.choices?.length) {
    const cl = opt.choices.map((c: any) => `\`${c.name}\``).join(' · ');
    line += `\n\u2003\u2003Choices: ${cl}`;
  }

  if (opt.min_value !== undefined || opt.max_value !== undefined) {
    const mn = opt.min_value ?? '—';
    const mx = opt.max_value ?? '—';
    line += `\n\u2003\u2003Range: \`${mn}\` to \`${mx}\``;
  }

  return line;
}

function formatParamList(options: any[]): string {
  if (!options.length) return '*No parameters*';
  return options.map(formatParam).join('\n');
}

/* ─────────────────────────────────────────────
 * Home Page — Paginated module list
 * ───────────────────────────────────────────── */

function buildHomePage(userId: string, client: Client<true>, page = 0, useColors = true): PageContent {
  const modules = client.modules;
  if (!modules) {
    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xed4245)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('Bot modules not loaded.'));
    return { containers: [errorContainer] };
  }

  const moduleList = Array.from(modules.values())
    .filter((m) => getPublicCommands(m).length > 0)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const totalPages = Math.max(1, Math.ceil(moduleList.length / MODULES_PER_PAGE));
  const validPage = Math.min(page, totalPages - 1);
  const startIdx = validPage * MODULES_PER_PAGE;
  const pageModules = moduleList.slice(startIdx, startIdx + MODULES_PER_PAGE);

  const totalCmds = moduleList.reduce((acc, m) => acc + getPublicCommands(m).length, 0);

  const lines = pageModules.map((m) => {
    const emoji = getModuleEmoji(m.name);
    const cnt = getPublicCommands(m).length;
    return `${emoji} **${m.displayName}** — \`${cnt}\` command${cnt !== 1 ? 's' : ''}`;
  });

  const container = new ContainerBuilder()
    .setAccentColor(NEXUS.home);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('### NEXUS · Command Center')
  );

  // Subtitle
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**${moduleList.length}** modules · **${totalCmds}** commands ready to go\n` +
      `Pick a module from the dropdown to explore.`
    )
  );

  // Separator
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
      .setDivider(true)
  );

  // Module list
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n'))
  );

  // Separator before controls
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
      .setDivider(true)
  );

  // Module selector menu
  const menuOptions = pageModules.map((m) => ({
    label: m.displayName,
    description: (m.description ?? 'No description').slice(0, 100),
    value: m.name,
    emoji: getModuleEmoji(m.name),
  }));

  if (menuOptions.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`help:${userId}:selmod`)
      .setPlaceholder('📂 Choose a module…')
      .addOptions(menuOptions);

    const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    container.addActionRowComponents(menuRow);
  }

  // Pagination buttons (if needed)
  if (totalPages > 1) {
    const paginationBtns = paginationButtons(validPage, totalPages, `help:${userId}:hp`);
    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...paginationBtns);
    container.addActionRowComponents(navRow);
  }

  // Contact Support button
  const supportBtn = new ButtonBuilder()
    .setCustomId(`help:${userId}:ticket`)
    .setLabel('🎫 Contact Support')
    .setStyle(ButtonStyle.Primary);

  const supportRow = new ActionRowBuilder<ButtonBuilder>().addComponents(supportBtn);
  container.addActionRowComponents(supportRow);

  // Footer
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# Page ${validPage + 1}/${totalPages} · ${moduleList.length} modules loaded`
    )
  );

  return { containers: [container] };
}

/* ─────────────────────────────────────────────
 * Module Page — Paginated public command list
 * ───────────────────────────────────────────── */

function buildModulePage(module: BotModule, userId: string, page = 0, useColors = true): PageContent {
  const commands = getPublicCommands(module);
  const emoji = getModuleEmoji(module.name);
  const modColor = getModuleColor(module.name, useColors);

  const totalPages = Math.max(1, Math.ceil(commands.length / COMMANDS_PER_PAGE));
  const validPage = Math.min(page, totalPages - 1);
  const startIdx = validPage * COMMANDS_PER_PAGE;
  const pageCommands = commands.slice(startIdx, startIdx + COMMANDS_PER_PAGE);

  const container = new ContainerBuilder()
    .setAccentColor(modColor);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${emoji} ${module.displayName}`)
  );

  // Description
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `> ${module.description ?? 'No description'}\n\n` +
      `Select a command to see full usage details, examples, and parameters.`
    )
  );

  // Separator
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
      .setDivider(true)
  );

  // Command fields
  const fieldLines: string[] = [];
  for (const cmd of pageCommands) {
    const cmdData = (cmd.data as any).toJSON();
    const opts = cmdData.options ?? [];
    const subCnt = opts.filter((o: any) => o.type === SUB_COMMAND || o.type === SUB_COMMAND_GROUP).length;
    const paramCnt = opts.filter((o: any) => o.type > SUB_COMMAND_GROUP).length;

    let badge = '`run`';
    if (subCnt > 0) badge = `\`${subCnt} sub${subCnt !== 1 ? 's' : ''}\``;
    else if (paramCnt > 0) badge = `\`${paramCnt} param${paramCnt !== 1 ? 's' : ''}\``;

    const cmdDesc = (cmdData.description ?? 'No description').slice(0, 85);
    fieldLines.push(`**\`/${cmdData.name}\` ${badge}**\n${cmdDesc}`);
  }

  if (fieldLines.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(fieldLines.join('\n\n'))
    );
  }

  // Separator before controls
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
      .setDivider(true)
  );

  // Command selector menu
  const cmdOpts = pageCommands.map((c) => {
    const d = (c.data as any).toJSON();
    return {
      label: `/${d.name}`.slice(0, 100),
      description: (d.description ?? '').slice(0, 100),
      value: d.name
    };
  });

  if (cmdOpts.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`help:${userId}:selcmd`)
      .setPlaceholder('🔍 Select a command…')
      .addOptions(cmdOpts);

    const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    container.addActionRowComponents(menuRow);
  }

  // Navigation buttons
  const navBtns: ButtonBuilder[] = [backButton(`help:${userId}:home`)];
  if (totalPages > 1) {
    navBtns.push(...paginationButtons(validPage, totalPages, `help:${userId}:mp`));
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...navBtns);
  container.addActionRowComponents(navRow);

  // Footer
  const footerText = totalPages > 1
    ? `Page ${validPage + 1}/${totalPages} · ${commands.length} commands`
    : `${commands.length} command${commands.length !== 1 ? 's' : ''} · Select one below`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${footerText}`)
  );

  return { containers: [container] };
}

/* ─────────────────────────────────────────────
 * Command Detail Page — with usage image
 * ───────────────────────────────────────────── */

async function buildCommandDetailPage(
  module: BotModule,
  cmd: BotCommand,
  userId: string,
  page = 0,
  useColors = true,
): Promise<PageContent> {
  const cmdData = (cmd.data as any).toJSON();
  const cmdName = cmdData.name;
  const cmdDesc = cmdData.description ?? 'No description';
  const options = cmdData.options ?? [];
  const emoji = getModuleEmoji(module.name);
  const modColor = getModuleColor(module.name, useColors);

  const subcommands = options.filter((o: any) => o.type === SUB_COMMAND);
  const subGroups = options.filter((o: any) => o.type === SUB_COMMAND_GROUP);
  const topLevelParams = options.filter((o: any) => o.type > SUB_COMMAND_GROUP);

  const allSubcmds: any[] = [...subcommands];
  for (const group of subGroups) {
    for (const sub of (group.options ?? [])) {
      if (sub.type === SUB_COMMAND) {
        allSubcmds.push({ ...sub, name: `${group.name} ${sub.name}`, groupName: group.name });
      }
    }
  }

  const hasSubcmds = allSubcmds.length > 0;
  const files: AttachmentBuilder[] = [];

  /* ─── CASE 1: Command with subcommands (paginated) ─── */
  if (hasSubcmds) {
    const totalPages = Math.max(1, Math.ceil(allSubcmds.length / SUBCMDS_PER_PAGE));
    const validPage = Math.min(page, totalPages - 1);
    const startIdx = validPage * SUBCMDS_PER_PAGE;
    const pageSubs = allSubcmds.slice(startIdx, startIdx + SUBCMDS_PER_PAGE);

    const container = new ContainerBuilder()
      .setAccentColor(modColor);

    // Title
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${emoji} /${cmdName}`)
    );

    // Description section
    let desc = `> ${cmdDesc}\n\n`;
    desc += `**Module:** ${module.displayName}\n`;
    if (cmd.cooldown) desc += `**Cooldown:** ${cmd.cooldown}s\n`;
    desc += `**Subcommands:** ${allSubcmds.length} total`;

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(desc)
    );

    // Separator
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true)
    );

    // Generate image for the first subcommand on this page
    try {
      const firstSub = pageSubs[0];
      const imgBuf = await generateCommandImageFromData(cmdData, firstSub.name);
      const att = new AttachmentBuilder(imgBuf, { name: 'usage.png' });
      files.push(att);
      // Add media gallery with the usage image
      const gallery = new MediaGalleryBuilder();
      const item = new MediaGalleryItemBuilder().setURL('attachment://usage.png');
      gallery.addItems(item);
      container.addMediaGalleryComponents(gallery);
    } catch { /* continue without image */ }

    // Subcommand details
    const subLines: string[] = [];
    for (const sub of pageSubs) {
      const subParams = (sub.options ?? []).filter((o: any) => o.type > SUB_COMMAND_GROUP);
      const subDesc = sub.description ?? 'No description';

      const usageParts = subParams.map((p: any) => p.required ? `<${p.name}>` : `[${p.name}]`);
      const usage = `\`/${cmdName} ${sub.name}${usageParts.length ? ' ' + usageParts.join(' ') : ''}\``;

      const paramLines = subParams.length > 0
        ? subParams.map((p: any) => {
            const req = p.required ? '`Req`' : '`Opt`';
            return `╰ **\`${p.name}\`** · ${optTypeName(p.type)} ${req}`;
          }).join('\n')
        : '*No parameters*';

      subLines.push(
        `**▸ ${sub.name}**\n${subDesc}\n\n**Usage:** ${usage}\n\n${paramLines}`
      );
    }

    if (subLines.length > 0) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(subLines.join('\n\n'))
      );
    }

    // Separator before controls
    container.addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true)
    );

    // Subcommand cycle dropdown (if multiple on this page)
    if (pageSubs.length > 1) {
      const subOpts = pageSubs.map((s: any) => ({
        label: `/${cmdName} ${s.name}`.slice(0, 100),
        description: (s.description ?? '').slice(0, 100),
        value: s.name,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`help:${userId}:cycsub`)
        .setPlaceholder('🔄 View usage for a different subcommand…')
        .addOptions(subOpts);

      const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      container.addActionRowComponents(menuRow);
    }

    // Navigation buttons
    const navBtns: ButtonBuilder[] = [backButton(`help:${userId}:backcmds`)];
    if (totalPages > 1) {
      navBtns.push(...paginationButtons(validPage, totalPages, `help:${userId}:cp`));
    }

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...navBtns);
    container.addActionRowComponents(navRow);

    // Footer
    const footerText = totalPages > 1
      ? `${startIdx + 1}–${Math.min(startIdx + SUBCMDS_PER_PAGE, allSubcmds.length)} of ${allSubcmds.length} subs · Page ${validPage + 1}/${totalPages}`
      : `${allSubcmds.length} subcommand${allSubcmds.length !== 1 ? 's' : ''}`;

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${footerText}`)
    );

    return { containers: [container], files };
  }

  /* ─── CASE 2: Simple command (no subcommands) ─── */
  const container = new ContainerBuilder()
    .setAccentColor(modColor);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${emoji} /${cmdName}`)
  );

  // Description section
  let desc = `> ${cmdDesc}\n\n`;
  desc += `**Module:** ${module.displayName}\n`;
  if (cmd.cooldown) desc += `**Cooldown:** ${cmd.cooldown}s\n`;

  const usageParts = topLevelParams.map((p: any) => p.required ? `<${p.name}>` : `[${p.name}]`);
  const usage = `\`/${cmdName}${usageParts.length ? ' ' + usageParts.join(' ') : ''}\``;
  desc += `**Usage:** ${usage}`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(desc)
  );

  // Separator
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
      .setDivider(true)
  );

  // Generate usage image
  try {
    const imgBuf = await generateCommandImageFromData(cmdData);
    const att = new AttachmentBuilder(imgBuf, { name: 'usage.png' });
    files.push(att);
    // Add media gallery with the usage image
    const { MediaGalleryBuilder, MediaGalleryItemBuilder } = await import('discord.js');
    const gallery = new MediaGalleryBuilder();
    gallery.addItems(new MediaGalleryItemBuilder().setURL('attachment://usage.png'));
    container.addMediaGalleryComponents(gallery);
  } catch { /* continue without image */ }

  // Parameters section
  if (topLevelParams.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**📋 Parameters (${topLevelParams.length})**\n${formatParamList(topLevelParams)}`)
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**📋 How to use**\nJust type ${usage} and hit enter — no parameters needed!`)
    );
  }

  // Navigation button
  const navRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(backButton(`help:${userId}:backcmds`));

  container.addActionRowComponents(navRow);

  // Footer
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${module.displayName} · ← Back to return`)
  );

  return { containers: [container], files };
}

/* ─────────────────────────────────────────────
 * Main Command
 * ───────────────────────────────────────────── */

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Browse all available commands and modules'),

  module: 'core',
  permissionPath: 'core.help',
  requiresModule: false,
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as Client<true>;
    const session = new InteractiveSession(interaction, { timeout: 300_000 });
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    // Read core config to check if per-module embed colors are enabled
    let useColors = true;
    if (guildId) {
      try {
        const coreConfig = await moduleConfig.getModuleConfig(guildId, 'core');
        const cfg = (coreConfig?.config as Record<string, unknown>) ?? {};
        if (cfg.helpEmbedColors === false) useColors = false;
      } catch { /* default to enabled */ }
    }

    let homePage = 0;
    let currentModule: BotModule | null = null;
    let modulePage = 0;
    let currentCmd: BotCommand | null = null;
    let cmdPage = 0;

    await session.start(buildHomePage(userId, client, 0, useColors));

    while (!session.isEnded) {
      const component = await session.awaitComponent(120_000);
      if (!component) break;

      const cid = component.customId;

      /* ── Home ── */
      if (cid === `help:${userId}:home`) {
        await component.deferUpdate();
        currentModule = null;
        currentCmd = null;
        modulePage = 0;
        cmdPage = 0;
        await session.setPage(buildHomePage(userId, client, homePage, useColors));
        continue;
      }

      /* ── Contact Support ticket button ── */
      if (cid === `help:${userId}:ticket`) {
        const wantsBack = await runTicketFlow(session, component);
        if (wantsBack) {
          // User pressed "Back to Help" — restore home page
          await session.setPage(buildHomePage(userId, client, homePage, useColors));
        }
        continue;
      }

      /* ── Home pagination ── */
      if (cid === `help:${userId}:hp:prev`) {
        await component.deferUpdate();
        homePage = Math.max(0, homePage - 1);
        await session.setPage(buildHomePage(userId, client, homePage, useColors));
        continue;
      }
      if (cid === `help:${userId}:hp:next`) {
        await component.deferUpdate();
        homePage += 1;
        await session.setPage(buildHomePage(userId, client, homePage, useColors));
        continue;
      }

      /* ── Module selected ── */
      if (cid === `help:${userId}:selmod` && component.isStringSelectMenu()) {
        await component.deferUpdate();
        const mod = client.modules?.get(component.values[0]);
        if (mod) {
          currentModule = mod;
          currentCmd = null;
          modulePage = 0;
          cmdPage = 0;
          await session.setPage(buildModulePage(mod, userId, 0, useColors));
        }
        continue;
      }

      /* ── Module pagination ── */
      if (cid === `help:${userId}:mp:prev`) {
        await component.deferUpdate();
        if (currentModule) {
          modulePage = Math.max(0, modulePage - 1);
          await session.setPage(buildModulePage(currentModule, userId, modulePage, useColors));
        }
        continue;
      }
      if (cid === `help:${userId}:mp:next`) {
        await component.deferUpdate();
        if (currentModule) {
          modulePage += 1;
          await session.setPage(buildModulePage(currentModule, userId, modulePage, useColors));
        }
        continue;
      }

      /* ── Command selected ── */
      if (cid === `help:${userId}:selcmd` && component.isStringSelectMenu()) {
        await component.deferUpdate();
        if (currentModule) {
          const found = getPublicCommands(currentModule).find(
            (c) => (c.data as any).toJSON().name === component.values[0],
          );
          if (found) {
            currentCmd = found;
            cmdPage = 0;
            await session.setPage(await buildCommandDetailPage(currentModule, found, userId, 0, useColors));
          }
        }
        continue;
      }

      /* ── Subcommand cycle dropdown — regenerate image for selected sub ── */
      if (cid === `help:${userId}:cycsub` && component.isStringSelectMenu()) {
        await component.deferUpdate();
        if (currentModule && currentCmd) {
          const subName = component.values[0];
          const cmdData = (currentCmd.data as any).toJSON();
          // Regenerate with the selected subcommand's image
          const page = await buildCommandDetailPageForSub(currentModule, currentCmd, userId, cmdPage, subName, useColors);
          await session.setPage(page);
        }
        continue;
      }

      /* ── Command detail pagination ── */
      if (cid === `help:${userId}:cp:prev`) {
        await component.deferUpdate();
        if (currentModule && currentCmd) {
          cmdPage = Math.max(0, cmdPage - 1);
          await session.setPage(await buildCommandDetailPage(currentModule, currentCmd, userId, cmdPage, useColors));
        }
        continue;
      }
      if (cid === `help:${userId}:cp:next`) {
        await component.deferUpdate();
        if (currentModule && currentCmd) {
          cmdPage += 1;
          await session.setPage(await buildCommandDetailPage(currentModule, currentCmd, userId, cmdPage, useColors));
        }
        continue;
      }

      /* ── Back from command detail → module page ── */
      if (cid === `help:${userId}:backcmds`) {
        await component.deferUpdate();
        currentCmd = null;
        cmdPage = 0;
        if (currentModule) {
          await session.setPage(buildModulePage(currentModule, userId, modulePage, useColors));
        } else {
          await session.setPage(buildHomePage(userId, client, homePage, useColors));
        }
        continue;
      }

      // Fallback: defer anything unhandled
      if (!component.deferred && !component.replied) {
        await component.deferUpdate().catch(() => {});
      }
    }

    await session.end();
  },
};

/**
 * Build command detail page but generate the image for a specific subcommand.
 * Used when the user picks a different sub from the cycle dropdown.
 */
async function buildCommandDetailPageForSub(
  module: BotModule,
  cmd: BotCommand,
  userId: string,
  page: number,
  targetSubName: string,
  useColors = true,
): Promise<PageContent> {
  const cmdData = (cmd.data as any).toJSON();
  const cmdName = cmdData.name;
  const cmdDesc = cmdData.description ?? 'No description';
  const options = cmdData.options ?? [];
  const emoji = getModuleEmoji(module.name);
  const modColor = getModuleColor(module.name, useColors);

  const subcommands = options.filter((o: any) => o.type === SUB_COMMAND);
  const subGroups = options.filter((o: any) => o.type === SUB_COMMAND_GROUP);
  const allSubcmds: any[] = [...subcommands];
  for (const group of subGroups) {
    for (const sub of (group.options ?? [])) {
      if (sub.type === SUB_COMMAND) {
        allSubcmds.push({ ...sub, name: `${group.name} ${sub.name}`, groupName: group.name });
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(allSubcmds.length / SUBCMDS_PER_PAGE));
  const validPage = Math.min(page, totalPages - 1);
  const startIdx = validPage * SUBCMDS_PER_PAGE;
  const pageSubs = allSubcmds.slice(startIdx, startIdx + SUBCMDS_PER_PAGE);

  const container = new ContainerBuilder()
    .setAccentColor(modColor);

  // Title
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${emoji} /${cmdName}`)
  );

  // Description section
  let desc = `> ${cmdDesc}\n\n`;
  desc += `**Module:** ${module.displayName}\n`;
  if (cmd.cooldown) desc += `**Cooldown:** ${cmd.cooldown}s\n`;
  desc += `**Subcommands:** ${allSubcmds.length} total`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(desc)
  );

  // Separator
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
      .setDivider(true)
  );

  const files: AttachmentBuilder[] = [];

  // Generate image for the TARGET subcommand
  try {
    const imgBuf = await generateCommandImageFromData(cmdData, targetSubName);
    const att = new AttachmentBuilder(imgBuf, { name: 'usage.png' });
    files.push(att);
    // Add media gallery with the usage image
    const { MediaGalleryBuilder, MediaGalleryItemBuilder } = await import('discord.js');
    const gallery = new MediaGalleryBuilder();
    gallery.addItems(new MediaGalleryItemBuilder().setURL('attachment://usage.png'));
    container.addMediaGalleryComponents(gallery);
  } catch { /* continue without image */ }

  // Subcommand details
  const subLines: string[] = [];
  for (const sub of pageSubs) {
    const subParams = (sub.options ?? []).filter((o: any) => o.type > SUB_COMMAND_GROUP);
    const subDesc = sub.description ?? 'No description';
    const usageParts = subParams.map((p: any) => p.required ? `<${p.name}>` : `[${p.name}]`);
    const usage = `\`/${cmdName} ${sub.name}${usageParts.length ? ' ' + usageParts.join(' ') : ''}\``;
    const paramLines = subParams.length > 0
      ? subParams.map((p: any) => {
          const req = p.required ? '`Req`' : '`Opt`';
          return `╰ **\`${p.name}\`** · ${optTypeName(p.type)} ${req}`;
        }).join('\n')
      : '*No parameters*';

    subLines.push(
      `**▸ ${sub.name}**\n${subDesc}\n\n**Usage:** ${usage}\n\n${paramLines}`
    );
  }

  if (subLines.length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(subLines.join('\n\n'))
    );
  }

  // Separator before controls
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
      .setDivider(true)
  );

  // Subcommand cycle dropdown (if multiple on this page)
  if (pageSubs.length > 1) {
    const subOpts = pageSubs.map((s: any) => ({
      label: `/${cmdName} ${s.name}`.slice(0, 100),
      description: (s.description ?? '').slice(0, 100),
      value: s.name,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`help:${userId}:cycsub`)
      .setPlaceholder('🔄 View usage for a different subcommand…')
      .addOptions(subOpts);

    const menuRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    container.addActionRowComponents(menuRow);
  }

  // Navigation buttons
  const navBtns: ButtonBuilder[] = [backButton(`help:${userId}:backcmds`)];
  if (totalPages > 1) {
    navBtns.push(...paginationButtons(validPage, totalPages, `help:${userId}:cp`));
  }

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...navBtns);
  container.addActionRowComponents(navRow);

  // Footer
  const footerText = totalPages > 1
    ? `${startIdx + 1}–${Math.min(startIdx + SUBCMDS_PER_PAGE, allSubcmds.length)} of ${allSubcmds.length} subs · Page ${validPage + 1}/${totalPages}`
    : `${allSubcmds.length} subcommand${allSubcmds.length !== 1 ? 's' : ''}`;

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# ${footerText}`)
  );

  return { containers: [container], files };
}

export default command;
