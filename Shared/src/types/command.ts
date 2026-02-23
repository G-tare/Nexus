import {
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  PermissionResolvable,
} from 'discord.js';

/**
 * Base interface for all slash commands.
 * Each command file exports a default object implementing this interface.
 */
export interface BotCommand {
  /** The slash command data (name, description, options) */
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

  /** The module this command belongs to (e.g., "moderation", "fun") */
  module: string;

  /** The command path for permissions (e.g., "moderation.ban") */
  permissionPath: string;

  /** Premium feature key (e.g., "moderation.basic") - checked against premium tiers */
  premiumFeature?: string;

  /** Default Discord permissions required (before custom permission overrides) */
  defaultPermissions?: PermissionResolvable;

  /** Whether this command can only be used in guilds (default: true) */
  guildOnly?: boolean;

  /** Whether this command requires the module to be enabled (default: true) */
  requiresModule?: boolean;

  /** Cooldown in seconds (default: 3) */
  cooldown?: number;

  /** Display name for the command */
  name?: string;

  /** Command category for grouping */
  category?: string;

  /** Whether this is a premium command */
  premium?: boolean;

  /** Whether the reply should be ephemeral by default */
  ephemeral?: boolean;

  /** Whether this command can be used in DMs */
  allowDM?: boolean;

  /** Execute the command */
  execute(interaction: ChatInputCommandInteraction, ...args: any[]): Promise<any>;

  /** Handle autocomplete (optional) */
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

/**
 * Context menu command (right-click on message or user).
 */
export interface BotContextMenuCommand {
  data: ContextMenuCommandBuilder;
  module: string;
  permissionPath: string;
  premiumFeature?: string;

  execute(interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction): Promise<void>;
}

/**
 * Module definition — each module registers itself with this.
 */
export interface BotModule {
  /** Unique module identifier (e.g., "moderation", "leveling") */
  name: string;

  /** Display name for dashboard */
  displayName: string;

  /** Module description */
  description: string;

  /** Module category for grouping in dashboard */
  category: 'moderation' | 'engagement' | 'economy' | 'fun' | 'utility' | 'social' | 'music' | 'protection' | 'entertainment';

  /** Module version */
  version?: string;

  /** Whether the module is enabled by default */
  enabled?: boolean;

  /** All commands in this module */
  commands: BotCommand[];

  /** Context menu commands */
  contextMenuCommands?: BotContextMenuCommand[];

  /** Event listeners to register */
  events?: ModuleEvent[];

  /** Called when the module is loaded */
  onLoad?(): Promise<void>;

  /** Called when the module is unloaded */
  onUnload?(): Promise<void>;

  /** Default config for new guilds */
  defaultConfig?: Record<string, any>;
}

/**
 * Module event handler — listens to Discord.js events.
 */
export interface ModuleEvent {
  /** Display name for this event handler */
  name?: string;

  /** Discord.js event name */
  event: string;

  /** Whether to use .once() instead of .on() */
  once?: boolean;

  /** The event handler */
  handler(...args: any[]): Promise<any>;
}
