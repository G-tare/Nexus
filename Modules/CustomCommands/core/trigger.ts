import { Message, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { VariableParser } from '../parser';
import { CustomCommandsHelper } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('CustomCommands');

export class CustomCommandTrigger {
  constructor(private helper: CustomCommandsHelper) {}

  /**
   * Trigger a custom command
   */
  async trigger(
    message: Message,
    commandName: string,
    args: string[] = [],
    isSlash: boolean = false
  ): Promise<boolean> {
    try {
      // Get the command from database
      const command = await this.helper.getCommand(message.guildId!, commandName);
      if (!command) return false;

      // Check if user has required role
      if (command.requiredRoleId) {
        const member = message.member;
        if (!member?.roles.cache.has(command.requiredRoleId)) {
          if (!isSlash) {
            await message.reply('You do not have permission to use this command.');
          }
          return false;
        }
      }

      // Check cooldown
      const cooldownRemaining = await this.helper.getCooldown(
        message.guildId!,
        command.id,
        message.author.id
      );

      if (cooldownRemaining > 0) {
        const seconds = Math.ceil(cooldownRemaining / 1000);
        if (!isSlash) {
          await message.reply(`This command is on cooldown. Please wait ${seconds}s.`);
        }
        return false;
      }

      // Check channel restrictions
      if (command.allowedChannels && command.allowedChannels.length > 0) {
        if (!command.allowedChannels.includes(message.channelId)) {
          if (!isSlash) {
            await message.reply('This command cannot be used in this channel.');
          }
          return false;
        }
      }

      // Set cooldown if applicable
      if (command.cooldown && command.cooldown > 0) {
        await this.helper.setCooldown(
          message.guildId!,
          command.id,
          message.author.id,
          command.cooldown * 1000
        );
      }

      // Parse variables
      const parserContext = {
        user: message.author,
        member: message.member || undefined,
        guild: message.guild || undefined,
        channel: message.channel,
        args: args,
        crossModuleData: {} // Could be populated by other modules
      };

      const parsedResponse = VariableParser.parse(command.response, parserContext);

      // Send response
      let sent = false;

      if (command.dm) {
        // Send as DM
        try {
          await message.author.send(parsedResponse);
          sent = true;
        } catch (error) {
          logger.warn('Failed to send DM', error);
          await message.reply('Could not send DM. Please check your privacy settings.');
        }
      } else if (command.embedResponse) {
        // Send as embed
        const embed = new EmbedBuilder()
          .setDescription(parsedResponse)
          .setColor('#2f3136')
          .setTimestamp();

        const sendOptions: any = { embeds: [embed] };
        if (command.ephemeral) {
          sendOptions.ephemeral = true;
        }

        await message.reply(sendOptions);
        sent = true;
      } else {
        // Send as regular message
        const sendOptions: any = {};
        if (command.ephemeral) {
          sendOptions.ephemeral = true;
        }

        await message.reply({ content: parsedResponse, ...sendOptions });
        sent = true;
      }

      // Delete invocation if configured
      if (command.deleteInvocation && message.deletable) {
        try {
          await message.delete();
        } catch (error) {
          logger.warn('Failed to delete invocation message', error);
        }
      }

      // Add reaction if configured
      if (command.addReaction && sent) {
        try {
          await message.react(command.addReaction);
        } catch (error) {
          logger.warn('Failed to add reaction', error);
        }
      }

      // Increment use count
      await this.helper.incrementUseCount(command.id);

      return true;
    } catch (error) {
      logger.error(`Failed to trigger custom command: ${commandName}`, error);
      return false;
    }
  }

  /**
   * Check if a user has permission to manage custom commands
   */
  checkManagePermission(message: Message): boolean {
    return message.member?.permissions.has(PermissionFlagsBits.ManageGuild) || false;
  }
}

export default CustomCommandTrigger;
