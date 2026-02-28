/**
 * Tool Registry — Central catalog of Discord actions the AI can call.
 *
 * Each tool is permission-gated: the AI can never exceed what the
 * requesting user could do manually.
 */

import { Guild, GuildMember, Client, PermissionFlagsBits } from 'discord.js';
import { ToolDefinition } from '../providers/adapter';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('ToolRegistry');

// ============================================
// DiscordTool Interface
// ============================================

export interface ToolExecutionContext {
  guild: Guild;
  member: GuildMember;
  client: Client;
  channelId: string;
}

export interface DiscordTool {
  /** Unique ID: "category.action" e.g. "channels.create" */
  id: string;
  /** Category for grouping */
  category: string;
  /** Human-readable name */
  name: string;
  /** Description for the AI to understand when to use this tool */
  description: string;
  /** JSON Schema parameters */
  parameters: ToolDefinition['parameters'];
  /** Whether this action is destructive (requires confirmation) */
  isDestructive: boolean;
  /** Required Discord permission (null = no special perm needed, just send messages) */
  requiredPermission: bigint | null;

  /**
   * Execute the tool. Returns a human-readable result string.
   * The AI will see this result and can use it to decide what to do next.
   */
  execute(
    params: Record<string, unknown>,
    ctx: ToolExecutionContext,
  ): Promise<string>;
}

// ============================================
// Tool Registry
// ============================================

export class ToolRegistry {
  private tools: Map<string, DiscordTool> = new Map();

  /** Register a single tool. */
  register(tool: DiscordTool): void {
    if (this.tools.has(tool.id)) {
      logger.warn(`Tool "${tool.id}" already registered, overwriting`);
    }
    this.tools.set(tool.id, tool);
  }

  /** Register multiple tools at once. */
  registerAll(tools: DiscordTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** Get a tool by ID. */
  get(toolId: string): DiscordTool | undefined {
    return this.tools.get(toolId);
  }

  /** Get all registered tools. */
  getAll(): DiscordTool[] {
    return Array.from(this.tools.values());
  }

  /** Get tools by category. */
  getByCategory(category: string): DiscordTool[] {
    return this.getAll().filter(t => t.category === category);
  }

  /** Get total tool count. */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Convert all tools to AI-provider ToolDefinition format.
   * Optionally exclude disabled tools.
   */
  toToolDefinitions(disabledTools?: string[]): ToolDefinition[] {
    const disabled = new Set(disabledTools ?? []);
    return this.getAll()
      .filter(t => !disabled.has(t.id))
      .map(t => ({
        name: toolIdToFunctionName(t.id),
        description: t.description,
        parameters: t.parameters,
      }));
  }

  /**
   * Convert only tools from specific categories to ToolDefinition format.
   * Used for smart tool selection — only send tools the message actually needs.
   */
  toToolDefinitionsForCategories(categories: string[], disabledTools?: string[]): ToolDefinition[] {
    const disabled = new Set(disabledTools ?? []);
    const categorySet = new Set(categories);
    return this.getAll()
      .filter(t => categorySet.has(t.category) && !disabled.has(t.id))
      .map(t => ({
        name: toolIdToFunctionName(t.id),
        description: t.description,
        parameters: t.parameters,
      }));
  }

  /**
   * Check if a member has permission to use a tool.
   * Returns { allowed, reason }.
   */
  checkPermission(
    tool: DiscordTool,
    member: GuildMember,
  ): { allowed: boolean; reason?: string } {
    // Guild owner can do anything
    if (member.guild.ownerId === member.id) {
      return { allowed: true };
    }

    // Administrator can do anything
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return { allowed: true };
    }

    // Check specific permission
    if (tool.requiredPermission && !member.permissions.has(tool.requiredPermission)) {
      const permName = getPermissionName(tool.requiredPermission);
      return {
        allowed: false,
        reason: `You need the **${permName}** permission to do this. Ask a server admin to grant it.`,
      };
    }

    return { allowed: true };
  }
}

// ============================================
// Permission name resolver
// ============================================

const PERM_NAMES: Record<string, string> = {
  [PermissionFlagsBits.ManageChannels.toString()]: 'Manage Channels',
  [PermissionFlagsBits.ManageRoles.toString()]: 'Manage Roles',
  [PermissionFlagsBits.ManageMessages.toString()]: 'Manage Messages',
  [PermissionFlagsBits.ManageGuild.toString()]: 'Manage Server',
  [PermissionFlagsBits.ManageEmojisAndStickers.toString()]: 'Manage Emojis',
  [PermissionFlagsBits.KickMembers.toString()]: 'Kick Members',
  [PermissionFlagsBits.BanMembers.toString()]: 'Ban Members',
  [PermissionFlagsBits.ManageNicknames.toString()]: 'Manage Nicknames',
  [PermissionFlagsBits.ManageWebhooks.toString()]: 'Manage Webhooks',
  [PermissionFlagsBits.MentionEveryone.toString()]: 'Mention Everyone',
  [PermissionFlagsBits.SendMessages.toString()]: 'Send Messages',
};

function getPermissionName(perm: bigint): string {
  return PERM_NAMES[perm.toString()] ?? `Permission(${perm})`;
}

// ============================================
// Tool ID ↔ Function Name Conversion
// ============================================

/**
 * Convert tool ID (e.g. "channels.create") to a valid function name
 * for AI providers that don't allow dots (e.g. "channels_create").
 * Gemini requires: ^[a-zA-Z_][a-zA-Z0-9_]*$
 */
export function toolIdToFunctionName(id: string): string {
  return id.replace(/\./g, '_');
}

/**
 * Convert a function name back to a tool ID.
 * "channels_create" → "channels.create"
 * We only replace the FIRST underscore per segment to be safe.
 */
export function functionNameToToolId(name: string): string {
  // Our tool IDs always have format "category.action" with exactly one dot
  // so we replace the first underscore that separates category from action
  const idx = name.indexOf('_');
  if (idx === -1) return name;
  return name.substring(0, idx) + '.' + name.substring(idx + 1);
}

// ============================================
// Global Registry Instance
// ============================================

export const toolRegistry = new ToolRegistry();

// Static imports — tsx doesn't reliably resolve relative dynamic imports
import { channelTools } from './channels';
import { roleTools } from './roles';
import { messageTools } from './messages';
import { permissionTools } from './permissions';
import { serverTools } from './server';
import { botConfigTools } from './botconfig';
import { utilityTools } from './utility';

/**
 * Load all tool categories and register them.
 * Called once during module init.
 */
export async function loadAllTools(): Promise<void> {
  toolRegistry.registerAll(channelTools);
  toolRegistry.registerAll(roleTools);
  toolRegistry.registerAll(messageTools);
  toolRegistry.registerAll(permissionTools);
  toolRegistry.registerAll(serverTools);
  toolRegistry.registerAll(botConfigTools);
  toolRegistry.registerAll(utilityTools);

  logger.info(`Tool registry loaded: ${toolRegistry.size} tools across 7 categories`);
}
