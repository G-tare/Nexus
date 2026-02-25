import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  Events,
} from 'discord.js';
import { config } from '../../Shared/src/config';
import { connectAll, getDb } from '../../Shared/src/database/connection';
import { guilds } from '../../Shared/src/database/models/schema';
import { eq } from 'drizzle-orm';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { loadModules } from './handlers/moduleLoader';
import { handleInteraction } from './handlers/interactionHandler';
import { groupModuleCommands, GrouperResult } from './handlers/commandGrouper';
import { BotCommand, BotContextMenuCommand, BotModule } from '../../Shared/src/types/command';
import {
  syncAllGuilds,
  syncGuildRoles,
  syncGuildMembers,
  clearGuildCache,
  CachedRole,
  CachedMember,
} from '../../Shared/src/cache/guildCacheSync';

const logger = createModuleLogger('Bot');

// ============================================
// Client Setup
// ============================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
  allowedMentions: {
    parse: ['users', 'roles'],
    repliedUser: true,
  },
});

// 38 modules register many event listeners — raise the limit to avoid warnings
client.setMaxListeners(50);

// ============================================
// Collections for commands and modules
// ============================================

// Extend client with custom properties
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, BotCommand>;
    contextMenuCommands: Collection<string, BotContextMenuCommand>;
    modules: Collection<string, BotModule>;
    cooldowns: Collection<string, Collection<string, number>>;
    /** Route key → BotCommand handler (populated by commandGrouper) */
    commandRoutes: Map<string, BotCommand>;
    /** Module slug → module name for reverse lookup */
    slugToModule: Map<string, string>;
  }
}

client.commands = new Collection();
client.contextMenuCommands = new Collection();
client.modules = new Collection();
client.cooldowns = new Collection();
client.commandRoutes = new Map();
client.slugToModule = new Map();

// ============================================
// Boot Sequence
// ============================================

async function boot() {
  logger.info('Booting shard...');

  // 1. Connect to databases
  try {
    await connectAll();
  } catch (err: any) {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  }

  // 2. Load all modules
  try {
    await loadModules(client);
    logger.info(`Loaded ${client.commands.size} commands across ${client.modules.size} modules`);
  } catch (err: any) {
    logger.error('Module loading failed', { error: err.message });
    process.exit(1);
  }

  // 3. Group module commands into parent slash commands with subcommand groups
  let grouperResult: GrouperResult;
  try {
    // Convert Collection<string, BotModule> to Map<string, BotModule>
    const modulesMap = new Map<string, BotModule>();
    for (const [key, mod] of client.modules) {
      modulesMap.set(key, mod);
    }
    grouperResult = groupModuleCommands(modulesMap);
    client.commandRoutes = grouperResult.routingMap;
    client.slugToModule = grouperResult.slugToModule;
    logger.info(`Grouped into ${grouperResult.registrationData.length} parent commands, ${client.commandRoutes.size} routes`);
  } catch (err: any) {
    logger.error('Command grouping failed', { error: err.message, stack: err.stack });
    process.exit(1);
  }

  // 4. Set up event handlers (before login so Ready event is caught)
  setupEventHandlers();

  // 5. Store grouperResult for guild-specific registration after Ready
  (client as any)._grouperResult = grouperResult;

  // 6. Login (guild-specific command registration happens after Ready event)
  try {
    await client.login(config.discord.token);
  } catch (err: any) {
    logger.error('Login failed', { error: err.message });
    process.exit(1);
  }
}

// ============================================
// Register Slash Commands
// ============================================

function getCommandData(grouperResult: GrouperResult): any[] {
  return [
    ...grouperResult.registrationData,
    ...client.contextMenuCommands.map(cmd => cmd.data.toJSON()),
  ];
}

/**
 * Register commands to specific guilds for INSTANT visibility.
 * Called after Ready event when guild cache is populated.
 */
async function registerCommandsToGuilds(grouperResult: GrouperResult) {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const commandData = getCommandData(grouperResult);
  const guildIds = [...client.guilds.cache.keys()];

  if (guildIds.length === 0) return;

  logger.info(`Registering commands to ${guildIds.length} guilds for instant visibility...`);

  for (const guildId of guildIds) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(config.discord.clientId, guildId),
          { body: commandData },
        );
        logger.info(`Registered commands to guild: ${guildId} (instant)`);
        break;
      } catch (err: any) {
        const isTransient =
          err.message?.includes('other side closed') ||
          err.message?.includes('ECONNRESET') ||
          err.message?.includes('ETIMEDOUT') ||
          err.message?.includes('socket hang up') ||
          err.status === 500 ||
          err.status === 502 ||
          err.status === 503;

        if (isTransient && attempt < maxRetries) {
          const delay = attempt * 2000;
          logger.warn(`Transient error registering to guild ${guildId}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
            error: err.message,
          });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        logger.error(`Failed to register commands to guild ${guildId}`, {
          error: err.message,
          status: err.status,
          body: JSON.stringify(err.rawError || err.errors || {}).slice(0, 500),
        });
        break;
      }
    }
  }
}

// ============================================
// Event Handlers
// ============================================

/**
 * Extract guildId from any Discord.js event arguments.
 * Handles all common event shapes: messages, members, roles, channels,
 * interactions, reactions, voice states, invites, bans, etc.
 */
function extractGuildId(args: any[]): string | null {
  const first = args[0];
  if (!first) return null;

  // Direct guildId property (Interaction, Ban)
  if (first.guildId) return first.guildId;

  // Guild object with id (GuildMember, Role, GuildChannel, VoiceState, Invite)
  if (first.guild?.id) return first.guild.id;

  // Message-based events (Message, MessageReaction → message.guild)
  if (first.message?.guild?.id) return first.message.guild.id;

  // MessageBulkDelete → Collection of messages
  if (typeof first.first === 'function') {
    const firstMsg = first.first();
    if (firstMsg?.guild?.id) return firstMsg.guild.id;
  }

  // Second arg fallback (MessageUpdate: oldMessage, newMessage)
  const second = args[1];
  if (second?.guild?.id) return second.guild.id;
  if (second?.guildId) return second.guildId;

  return null;
}

function setupEventHandlers() {
  // Core: interaction handling (commands, buttons, modals, etc.)
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleInteraction(client, interaction);
    } catch (err: any) {
      logger.error('Interaction handler error', {
        error: err.message,
        interaction: interaction.isCommand() ? interaction.commandName : 'non-command',
      });
    }
  });

  // Ready event — sync all current guilds to DB + Redis
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Shard ready! Logged in as ${readyClient.user.tag}`);
    logger.info(`Serving ${readyClient.guilds.cache.size} guilds`);

    // Run startup tasks in background so the ready event resolves immediately
    // (prevents "Client took too long to become ready" shard timeout)
    setImmediate(async () => {
      // Clear stale global commands (they cause duplicates with guild-specific ones)
      try {
        const rest = new REST({ version: '10' }).setToken(config.discord.token);
        await rest.put(Routes.applicationCommands(config.discord.clientId), { body: [] });
        logger.info('Cleared global commands to prevent duplicates');
      } catch (err: any) {
        logger.warn('Failed to clear global commands', { error: err.message });
      }

      // Register commands to guilds for INSTANT visibility
      const grouperResult = (client as any)._grouperResult as GrouperResult | undefined;
      if (grouperResult) {
        try {
          await registerCommandsToGuilds(grouperResult);
        } catch (err: any) {
          logger.error('Guild command registration failed', { error: err.message });
        }
      }
      // Sync all guilds the bot is currently in to the database
      try {
        const db = getDb();
        let synced = 0;
        for (const [, guild] of readyClient.guilds.cache) {
          await db.insert(guilds).values({
            id: guild.id,
            name: guild.name,
            ownerId: guild.ownerId,
          }).onConflictDoUpdate({
            target: guilds.id,
            set: { name: guild.name, ownerId: guild.ownerId, isActive: true, leftAt: null },
          });
          synced++;
        }
        logger.info(`Synced ${synced} guilds to database`);
      } catch (err: any) {
        logger.error('Failed to sync guilds on startup', { error: err.message });
      }

      // Sync all guild roles & members to Redis for instant dashboard access
      try {
        await syncAllGuilds(readyClient.guilds.cache);
      } catch (err: any) {
        logger.error('Failed to sync guild cache to Redis', { error: err.message });
      }
    });
  });

  // Guild events
  client.on(Events.GuildCreate, async (guild) => {
    logger.info(`Joined guild: ${guild.name} (${guild.id})`);
    try {
      const db = getDb();
      await db.insert(guilds).values({
        id: guild.id,
        name: guild.name,
        ownerId: guild.ownerId,
      }).onConflictDoUpdate({
        target: guilds.id,
        set: { name: guild.name, ownerId: guild.ownerId, isActive: true, leftAt: null },
      });
      logger.info(`Guild ${guild.name} (${guild.id}) saved to database`);
    } catch (err: any) {
      logger.error('Failed to save guild to database', { error: err.message });
    }

    // Sync roles & members to Redis for the new guild
    try {
      const roles: CachedRole[] = guild.roles.cache.map((r) => ({
        id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed ?? false,
      }));
      await syncGuildRoles(guild.id, roles);

      const members: CachedMember[] = guild.members.cache
        .filter((m) => !m.user.bot)
        .first(100)
        .map((m) => ({
          id: m.user.id,
          username: m.user.username,
          displayName: m.nickname ?? m.user.globalName ?? m.user.username,
          avatar: m.user.avatar
            ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.webp?size=64`
            : null,
        }));
      await syncGuildMembers(guild.id, members);
    } catch (err: any) {
      logger.warn('Failed to sync new guild cache', { error: err.message });
    }
  });

  client.on(Events.GuildDelete, async (guild) => {
    logger.info(`Left guild: ${guild.name} (${guild.id})`);
    try {
      const db = getDb();
      await db.update(guilds)
        .set({ isActive: false, leftAt: new Date() })
        .where(eq(guilds.id, guild.id));
      logger.info(`Guild ${guild.name} (${guild.id}) marked inactive`);
    } catch (err: any) {
      logger.error('Failed to mark guild inactive', { error: err.message });
    }
    // Clear Redis cache for the guild we left
    await clearGuildCache(guild.id);
  });

  // ── Role events: keep Redis in sync when roles change ──
  client.on(Events.GuildRoleCreate, async (role) => {
    const g = role.guild;
    const roles: CachedRole[] = g.roles.cache.map((r) => ({
      id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed ?? false,
    }));
    await syncGuildRoles(g.id, roles);
  });

  client.on(Events.GuildRoleUpdate, async (_oldRole, newRole) => {
    const g = newRole.guild;
    const roles: CachedRole[] = g.roles.cache.map((r) => ({
      id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed ?? false,
    }));
    await syncGuildRoles(g.id, roles);
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    const g = role.guild;
    const roles: CachedRole[] = g.roles.cache.map((r) => ({
      id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed ?? false,
    }));
    await syncGuildRoles(g.id, roles);
  });

  // ── Member events: refresh the member snapshot when members change ──
  client.on(Events.GuildMemberAdd, async (member) => {
    const g = member.guild;
    const members: CachedMember[] = g.members.cache
      .filter((m) => !m.user.bot)
      .first(100)
      .map((m) => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.nickname ?? m.user.globalName ?? m.user.username,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.webp?size=64`
          : null,
      }));
    await syncGuildMembers(g.id, members);
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    const g = member.guild;
    const members: CachedMember[] = g.members.cache
      .filter((m) => !m.user.bot)
      .first(100)
      .map((m) => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.nickname ?? m.user.globalName ?? m.user.username,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.webp?size=64`
          : null,
      }));
    await syncGuildMembers(g.id, members);
  });

  client.on(Events.GuildMemberUpdate, async (_oldMember, newMember) => {
    const g = newMember.guild;
    const members: CachedMember[] = g.members.cache
      .filter((m) => !m.user.bot)
      .first(100)
      .map((m) => ({
        id: m.user.id,
        username: m.user.username,
        displayName: m.nickname ?? m.user.globalName ?? m.user.username,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.webp?size=64`
          : null,
      }));
    await syncGuildMembers(g.id, members);
  });

  // Register module event listeners (wrapped with module-enabled check)
  for (const [, module] of client.modules) {
    if (module.events) {
      for (const event of module.events) {
        // ClientReady events are global setup — no guild to check
        const isGlobalEvent = event.event === Events.ClientReady;

        const wrappedHandler = isGlobalEvent
          ? event.handler
          : async (...args: any[]) => {
              const guildId = extractGuildId(args);
              if (guildId) {
                const enabled = await moduleConfig.isEnabled(guildId, module.name);
                if (!enabled) return;
              }
              return event.handler(...args);
            };

        if (event.once) {
          client.once(event.event, wrappedHandler);
        } else {
          client.on(event.event, wrappedHandler);
        }
      }
    }
  }

  logger.info('Event handlers registered');
}

// ============================================
// Graceful Shutdown
// ============================================

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  client.destroy();
  const { disconnectAll } = require('../../Shared/src/database/connection');
  await disconnectAll();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (error: any) => {
  logger.error('Unhandled rejection', { error: error?.message || error });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start
boot();
