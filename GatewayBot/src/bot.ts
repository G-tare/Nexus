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
import { connectAll } from '../../Shared/src/database/connection';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { loadModules } from './handlers/moduleLoader';
import { handleInteraction } from './handlers/interactionHandler';
import { BotCommand, BotContextMenuCommand, BotModule } from '../../Shared/src/types/command';

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
  }
}

client.commands = new Collection();
client.contextMenuCommands = new Collection();
client.modules = new Collection();
client.cooldowns = new Collection();

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

  // 3. Register slash commands with Discord
  try {
    await registerCommands();
  } catch (err: any) {
    logger.error('Command registration failed', { error: err.message });
    // Non-fatal: bot can still work with previously registered commands
  }

  // 4. Set up event handlers
  setupEventHandlers();

  // 5. Login
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

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  const commandData = [
    ...client.commands.map(cmd => cmd.data.toJSON()),
    ...client.contextMenuCommands.map(cmd => cmd.data.toJSON()),
  ];

  logger.info(`Registering ${commandData.length} application commands...`);

  if (config.isDev) {
    // In development, register to a test guild for instant updates
    // In production, register globally (takes up to 1 hour to propagate)
    const testGuildId = process.env.DEV_GUILD_ID;
    if (testGuildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, testGuildId),
        { body: commandData }
      );
      logger.info(`Registered commands to dev guild: ${testGuildId}`);
    } else {
      await rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commandData }
      );
      logger.info('Registered commands globally (dev mode, no DEV_GUILD_ID set)');
    }
  } else {
    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commandData }
    );
    logger.info('Registered commands globally');
  }
}

// ============================================
// Event Handlers
// ============================================

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

  // Ready event
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Shard ready! Logged in as ${readyClient.user.tag}`);
    logger.info(`Serving ${readyClient.guilds.cache.size} guilds`);
  });

  // Guild events (for auto-setup)
  client.on(Events.GuildCreate, async (guild) => {
    logger.info(`Joined guild: ${guild.name} (${guild.id})`);
    // Guild setup handled by welcome module / database upsert
  });

  client.on(Events.GuildDelete, async (guild) => {
    logger.info(`Left guild: ${guild.name} (${guild.id})`);
  });

  // Register module event listeners
  for (const [, module] of client.modules) {
    if (module.events) {
      for (const event of module.events) {
        if (event.once) {
          client.once(event.event, event.handler);
        } else {
          client.on(event.event, event.handler);
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
