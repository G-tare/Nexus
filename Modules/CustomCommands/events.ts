import { Events, Message } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { eventBus } from '../../Shared/src/events/eventBus';
import { getDb } from '../../Shared/src/database/connection';
import { customCommands } from '../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';

const logger = createModuleLogger('CustomCommands:Events');

/**
 * Custom Commands event listeners.
 * Listens for prefix-based messages and triggers custom commands.
 */
export const customCommandsEvents: ModuleEvent[] = [
  { event: Events.MessageCreate,
    async handler(message: Message) {
      try {
        // Ignore bots and DMs
        if (message.author.bot || !message.guild) return;

        const db = getDb();

        // Get guild config to check if enabled and get prefix
        // Using moduleConfig pattern
        const { moduleConfig } = require('../../Shared/src/middleware/moduleConfig');
        const _cfgResult = await moduleConfig.getModuleConfig(message.guildId!, 'customcommands');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;

        if (!config || !config.enabled) return;

        const prefix = config.prefix || '!';

        // Check if message starts with prefix
        if (!message.content.startsWith(prefix)) return;

        // Extract command name and args
        const args = message.content.slice(prefix.length).trim().split(/\s+/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        // Look up the custom command in the database
        const results = await db
          .select()
          .from(customCommands)
          .where(
            and(
              eq(customCommands.guildId, message.guildId!),
              eq(customCommands.name, commandName)
            )
          )
          .limit(1);

        if (!results.length) {
          // Check aliases
          const allCommands = await db
            .select()
            .from(customCommands)
            .where(eq(customCommands.guildId, message.guildId!));

          const aliasMatch = allCommands.find((cmd) => {
            const aliases = (cmd.aliases as string[]) || [];
            return aliases.includes(commandName);
          });

          if (!aliasMatch) return;
          results[0] = aliasMatch;
        }

        const cmd = results[0];

        // Check required role
        if (cmd.requiredRoleId && message.member) {
          if (!message.member.roles.cache.has(cmd.requiredRoleId)) return;
        }

        // Process response with variable replacement
        const { default: VariableParser } = require('./parser');
        const response = VariableParser.parse(cmd.response, {
          user: message.author,
          member: message.member!,
          guild: message.guild,
          channel: message.channel,
          args,
        });

        // Send response
        if (cmd.embedResponse) {
          const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = await import('discord.js');
          const { v2Payload } = await import('../../Shared/src/utils/componentsV2');
          const container = new ContainerBuilder().setAccentColor(0x5865F2);
          container.addTextDisplayComponents(new TextDisplayBuilder().setContent(response));
          const payload = v2Payload([container]);
          await (message.channel as any).send(payload);
        } else {
          await (message.channel as any).send(response);
        }

        // Update use count
        await db
          .update(customCommands)
          .set({ useCount: (cmd.useCount || 0) + 1 })
          .where(eq(customCommands.id, cmd.id));

        // Emit event
        eventBus.emit('customCommandTriggered', {
          guildId: message.guildId!,
          commandName: cmd.name,
          userId: message.author.id,
          channelId: message.channelId,
        });

        logger.debug(`Custom command triggered: ${commandName} in ${message.guildId!}`);
      } catch (error) {
        logger.error('Error handling custom command message:', error);
      }
    },
  },
];
