import { Guild, TextChannel } from 'discord.js';
import { getRedis } from '../../Shared/src/database/connection';

export type RRType = 'reaction' | 'button' | 'dropdown';
export type RRMode = 'normal' | 'unique' | 'verify' | 'drop';

export interface RRRole {
  roleId: string;
  emoji?: string;
  label?: string;
  description?: string;
  style?: number;
}

export interface RRPanel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  type: RRType;
  mode: RRMode;
  title: string;
  description?: string;
  color?: string;
  roles: RRRole[];
  maxRoles: number;
  dmConfirmation: boolean;
}

export interface ReactionRolesConfig {
  enabled: boolean;
  panels: RRPanel[];
  defaultMode: RRMode;
  defaultType: RRType;
  dmConfirmation: boolean;
  logChannelId?: string;
}

const DEFAULT_CONFIG: ReactionRolesConfig = {
  enabled: true,
  panels: [],
  defaultMode: 'normal',
  defaultType: 'button',
  dmConfirmation: false,
};

export async function getReactionRolesConfig(guildId: string): Promise<ReactionRolesConfig> {
  try {
    const stored = await (await getRedis()).get(`rr:config:${guildId}`);
    return stored ? JSON.parse(stored) : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveReactionRolesConfig(guildId: string, config: ReactionRolesConfig): Promise<void> {
  await (await getRedis()).set(`rr:config:${guildId}`, JSON.stringify(config));
}

export function getPanelById(config: ReactionRolesConfig, panelId: string): RRPanel | null {
  return config.panels.find(p => p.id === panelId) || null;
}

export async function getPanelByMessage(messageId: string): Promise<RRPanel | null> {
  try {
    const cached = await (await getRedis()).get(`rr:message:${messageId}`);
    if (cached) {
      const data = JSON.parse(cached);
      return data;
    }
  } catch {
    // Continue with search
  }
  return null;
}

export async function cachePanelByMessage(messageId: string, panel: RRPanel): Promise<void> {
  await (await getRedis()).set(`rr:message:${messageId}`, JSON.stringify(panel), 'EX', 86400 * 7);
}

export async function createPanel(
  guild: Guild,
  channel: TextChannel,
  panelData: Omit<RRPanel, 'id' | 'guildId' | 'channelId' | 'messageId'>,
): Promise<RRPanel> {
  const panelId = `panel_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const embed = buildPanelEmbed({
    ...panelData,
    id: panelId,
    guildId: guild.id,
    channelId: channel.id,
    messageId: '',
  });

  const components = buildPanelComponents({
    ...panelData,
    id: panelId,
    guildId: guild.id,
    channelId: channel.id,
    messageId: '',
  });

  const message = await (channel as any).send({
    embeds: [embed],
    components: panelData.type === 'reaction' ? [] : components,
  });

  const panel: RRPanel = {
    ...panelData,
    id: panelId,
    guildId: guild.id,
    channelId: channel.id,
    messageId: message.id,
  };

  if (panelData.type === 'reaction') {
    await addReactions(message, panel);
  }

  await cachePanelByMessage(message.id, panel);
  return panel;
}

export async function updatePanelMessage(
  guild: Guild,
  panel: RRPanel,
): Promise<void> {
  try {
    const channel = await guild.channels.fetch(panel.channelId) as TextChannel;
    const message = await channel.messages.fetch(panel.messageId);

    const embed = buildPanelEmbed(panel);
    const components = buildPanelComponents(panel);

    await message.edit({
      embeds: [embed],
      components: panel.type === 'reaction' ? message.components : components,
    });

    await cachePanelByMessage(message.id, panel);
  } catch (error) {
    console.error('Failed to update panel message:', error);
  }
}

export async function deletePanel(guild: Guild, panel: RRPanel): Promise<void> {
  try {
    const channel = await guild.channels.fetch(panel.channelId) as TextChannel;
    const message = await channel.messages.fetch(panel.messageId);
    await message.delete();
  } catch {
    // Message already deleted
  }

  await (await getRedis()).del(`rr:message:${panel.messageId}`);
}

export function buildPanelEmbed(panel: RRPanel) {
  const { EmbedBuilder } = require('discord.js');

  const embed = new EmbedBuilder()
    .setTitle(panel.title)
    .setColor(panel.color || '#2F3136')
    .setFooter({ text: `Panel ID: ${panel.id}` });

  if (panel.description) {
    embed.setDescription(panel.description);
  }

  const roleList = panel.roles
    .map(role => {
      let text = `<@&${role.roleId}>`;
      if (role.emoji) text += ` ${role.emoji}`;
      if (role.label) text += ` - ${role.label}`;
      return text;
    })
    .join('\n');

  if (roleList) {
    embed.addFields({
      name: 'Available Roles',
      value: roleList || 'No roles yet',
    });
  }

  if (panel.mode !== 'normal') {
    embed.addFields({
      name: 'Mode',
      value: `**${panel.mode.toUpperCase()}** - ${getModeDescription(panel.mode)}`,
      inline: false,
    });
  }

  if (panel.maxRoles > 0) {
    embed.addFields({
      name: 'Max Roles',
      value: `You can have up to **${panel.maxRoles}** role(s)`,
      inline: false,
    });
  }

  return embed;
}

export function buildPanelComponents(panel: RRPanel) {
  const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');

  if (panel.type === 'reaction') {
    return [];
  }

  if (panel.type === 'button') {
    const rows: any[] = [];
    let currentRow = new ActionRowBuilder();

    for (const role of panel.roles) {
      if (currentRow.components.length === 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }

      const button = new ButtonBuilder()
        .setCustomId(`rr_${panel.id}_${role.roleId}`)
        .setLabel(role.label || `Role`)
        .setStyle(role.style ? role.style : ButtonStyle.Primary);

      if (role.emoji) {
        button.setEmoji(role.emoji);
      }

      currentRow.addComponents(button);
    }

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  if (panel.type === 'dropdown') {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`rr_select_${panel.id}`)
      .setPlaceholder('Select a role')
      .setMaxValues(Math.max(1, panel.maxRoles || panel.roles.length));

    for (const role of panel.roles) {
      selectMenu.addOptions({
        label: role.label || 'Role',
        value: role.roleId,
        description: role.description || undefined,
        emoji: role.emoji || undefined,
      });
    }

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return [row];
  }

  return [];
}

export async function addReactions(message: any, panel: RRPanel): Promise<void> {
  for (const role of panel.roles) {
    if (role.emoji) {
      try {
        await message.react(role.emoji);
      } catch (error) {
        console.error(`Failed to add reaction ${role.emoji}:`, error);
      }
    }
  }
}

export async function handleRoleToggle(
  member: any,
  panel: RRPanel,
  roleId: string,
  isAdding: boolean = true,
): Promise<string> {
  const role = panel.roles.find(r => r.roleId === roleId);
  if (!role) {
    return 'Role not found in this panel.';
  }

  const discordRole = member.guild.roles.cache.get(roleId);
  if (!discordRole) {
    return 'Role not found in this guild.';
  }

  // Check if user already has max roles
  if (isAdding && panel.maxRoles > 0) {
    const userRoles = panel.roles.filter(r => member.roles.cache.has(r.roleId));
    if (userRoles.length >= panel.maxRoles) {
      return `You already have the maximum number of roles (${panel.maxRoles}).`;
    }
  }

  try {
    if (panel.mode === 'normal') {
      if (isAdding) {
        await member.roles.add(discordRole);
      } else {
        await member.roles.remove(discordRole);
      }
    } else if (panel.mode === 'unique') {
      // Remove all other roles from this panel
      for (const r of panel.roles) {
        if (r.roleId !== roleId && member.roles.cache.has(r.roleId)) {
          await member.roles.remove(r.roleId);
        }
      }
      await member.roles.add(discordRole);
    } else if (panel.mode === 'verify') {
      // One-time assign, can't remove
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(discordRole);
      }
    } else if (panel.mode === 'drop') {
      // Remove only
      await member.roles.remove(discordRole);
    }

    return '';
  } catch (error) {
    return `Failed to update role: ${error instanceof Error ? (error as any).message : 'Unknown error'}`;
  }
}

export async function createRoleIfNotExists(
  guild: Guild,
  roleName: string,
  color?: string,
): Promise<any> {
  const existing = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
  if (existing) {
    return existing;
  }

  return await guild.roles.create({
    name: roleName,
    color: (color || '#2F3136') as any,
    reason: 'Created via Reaction Roles module',
  });
}

export async function logRoleAction(
  guild: Guild,
  config: ReactionRolesConfig,
  userId: string,
  roleId: string,
  action: string,
  panelId: string,
): Promise<void> {
  if (!config.logChannelId) return;

  try {
    const channel = await guild.channels.fetch(config.logChannelId) as TextChannel;
    const { EmbedBuilder } = require('discord.js');

    const embed = new EmbedBuilder()
      .setTitle('Reaction Role Action')
      .setColor('#2F3136')
      .addFields(
        { name: 'User', value: `<@${userId}>`, inline: true },
        { name: 'Role', value: `<@&${roleId}>`, inline: true },
        { name: 'Action', value: action, inline: true },
        { name: 'Panel', value: panelId, inline: true },
        { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false },
      )
      .setFooter({ text: 'Reaction Roles Log' });

    await (channel as any).send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to log role action:', error);
  }
}

function getModeDescription(mode: RRMode): string {
  const descriptions: Record<RRMode, string> = {
    normal: 'Toggle roles on and off freely',
    unique: 'Can only have one role at a time',
    verify: 'One-time role assignment, cannot be removed',
    drop: 'Remove roles only, cannot add',
  };
  return descriptions[mode];
}
