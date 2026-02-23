import { Guild, GuildMember, Channel, User, Role } from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('CustomCommands');

interface ParserContext {
  user?: User;
  member?: GuildMember;
  guild?: Guild;
  channel?: Channel;
  args?: string[];
  [key: string]: any;
}

export class VariableParser {
  /**
   * Parse all variables in a string
   */
  static parse(content: string, context: ParserContext): string {
    if (!content) return '';

    let result = content;

    // Parse conditionals first
    result = this.parseConditionals(result, context);

    // Parse math expressions
    result = this.parseMath(result, context);

    // Parse choose (random selection)
    result = this.parseChoose(result, context);

    // Parse user variables
    result = this.parseUserVariables(result, context);

    // Parse server/guild variables
    result = this.parseServerVariables(result, context);

    // Parse channel variables
    result = this.parseChannelVariables(result, context);

    // Parse argument variables
    result = this.parseArgumentVariables(result, context);

    // Parse random variables
    result = this.parseRandomVariables(result, context);

    // Parse time/date variables
    result = this.parseTimeVariables(result, context);

    // Parse cross-module data (level, xp, coins, reputation, messages)
    result = this.parseCrossModuleVariables(result, context);

    return result;
  }

  /**
   * Parse conditional variables: {if:condition|then|else}
   * Supports: user.id==123, user.name==John, args.1==test, etc
   */
  private static parseConditionals(content: string, context: ParserContext): string {
    const regex = /\{if:([^|]+)\|([^|]+)\|([^}]+)\}/g;

    return content.replace(regex, (match, condition, thenStr, elseStr) => {
      try {
        const result = this.evaluateCondition(condition.trim(), context);
        return result ? thenStr.trim() : elseStr.trim();
      } catch (error) {
        logger.warn(`Failed to evaluate conditional: ${condition}`, error);
        return match;
      }
    });
  }

  /**
   * Evaluate a condition string
   */
  private static evaluateCondition(condition: string, context: ParserContext): boolean {
    condition = condition.trim();

    // Support ==, !=, >, <, >=, <=
    const operators = ['==', '!=', '>=', '<=', '>', '<'];
    let operator = '';
    let operatorIndex = -1;

    for (const op of operators) {
      const index = condition.indexOf(op);
      if (index !== -1) {
        operator = op;
        operatorIndex = index;
        break;
      }
    }

    if (!operator) {
      // Simple truthy check
      const value = this.getVariableValue(condition, context);
      return Boolean(value);
    }

    const left = condition.substring(0, operatorIndex).trim();
    const right = condition.substring(operatorIndex + operator.length).trim();

    const leftValue = this.getVariableValue(left, context);
    const rightValue = this.getVariableValue(right, context);

    // Try numeric comparison
    const leftNum = Number(leftValue);
    const rightNum = Number(rightValue);

    if (!isNaN(leftNum) && !isNaN(rightNum)) {
      switch (operator) {
        case '==': return leftNum === rightNum;
        case '!=': return leftNum !== rightNum;
        case '>': return leftNum > rightNum;
        case '<': return leftNum < rightNum;
        case '>=': return leftNum >= rightNum;
        case '<=': return leftNum <= rightNum;
      }
    }

    // String comparison
    const leftStr = String(leftValue);
    const rightStr = String(rightValue);

    switch (operator) {
      case '==': return leftStr === rightStr;
      case '!=': return leftStr !== rightStr;
      case '>': return leftStr > rightStr;
      case '<': return leftStr < rightStr;
      case '>=': return leftStr >= rightStr;
      case '<=': return leftStr <= rightStr;
      default: return false;
    }
  }

  /**
   * Get the value of a variable or literal
   */
  private static getVariableValue(key: string, context: ParserContext): any {
    key = key.trim();

    // Check if it's a number
    if (/^\d+$/.test(key)) {
      return parseInt(key);
    }

    // Check if it's a quoted string
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      return key.slice(1, -1);
    }

    // Check nested properties (e.g., user.id, server.name)
    if (key.includes('.')) {
      const parts = key.split('.');
      let value: any = context[parts[0]];

      for (let i = 1; i < parts.length; i++) {
        if (value && typeof value === 'object') {
          value = value[parts[i]];
        } else {
          return undefined;
        }
      }

      return value;
    }

    // Check direct context properties
    return context[key];
  }

  /**
   * Parse math expressions: {math:2+2*3}
   */
  private static parseMath(content: string, context: ParserContext): string {
    const regex = /\{math:([^}]+)\}/g;

    return content.replace(regex, (match, expression) => {
      try {
        // Only allow safe math operations
        const safeExpression = expression
          .replace(/[^0-9+\-*/.()]/g, '')
          .trim();

        if (!safeExpression) return match;

        // eslint-disable-next-line no-eval
        const result = Function('"use strict"; return (' + safeExpression + ')')();
        return String(result);
      } catch (error) {
        logger.warn(`Failed to evaluate math expression: ${expression}`, error);
        return match;
      }
    });
  }

  /**
   * Parse choose/random selection: {choose:option1|option2|option3}
   */
  private static parseChoose(content: string, context: ParserContext): string {
    const regex = /\{choose:([^}]+)\}/g;

    return content.replace(regex, (match, options) => {
      const optionList = options.split('|').map((opt: string) => opt.trim());
      const randomIndex = Math.floor(Math.random() * optionList.length);
      return optionList[randomIndex];
    });
  }

  /**
   * Parse user-related variables
   */
  private static parseUserVariables(content: string, context: ParserContext): string {
    let result = content;
    const user = context.user;
    const member = context.member;

    if (user) {
      result = result.replace(/{user}/g, user.username);
      result = result.replace(/{user\.mention}/g, user.toString());
      result = result.replace(/{user\.id}/g, user.id);
      result = result.replace(/{user\.name}/g, user.username);
      result = result.replace(/{user\.tag}/g, user.tag);
      result = result.replace(/{user\.avatar}/g, user.avatarURL() || 'N/A');
    }

    if (member) {
      const joinDate = member.joinedAt ? member.joinedAt.toISOString() : 'N/A';
      result = result.replace(/{user\.joindate}/g, joinDate);
    }

    if (user) {
      const createDate = user.createdAt.toISOString();
      result = result.replace(/{user\.createdate}/g, createDate);
    }

    return result;
  }

  /**
   * Parse server/guild variables
   */
  private static parseServerVariables(content: string, context: ParserContext): string {
    let result = content;
    const guild = context.guild;

    if (guild) {
      result = result.replace(/{server}/g, guild.name);
      result = result.replace(/{server\.name}/g, guild.name);
      result = result.replace(/{server\.id}/g, guild.id);
      result = result.replace(/{server\.membercount}/g, String(guild.memberCount));
      result = result.replace(/{server\.icon}/g, guild.iconURL() || 'N/A');
      result = result.replace(/{server\.boosts}/g, String(guild.premiumSubscriptionCount || 0));
    }

    return result;
  }

  /**
   * Parse channel variables
   */
  private static parseChannelVariables(content: string, context: ParserContext): string {
    let result = content;
    const channel = context.channel;

    if (channel && 'name' in channel) {
      result = result.replace(/{channel}/g, channel.name || '');
      result = result.replace(/{channel\.name}/g, channel.name || '');
      result = result.replace(/{channel\.id}/g, channel.id);

      if ('topic' in channel) {
        result = result.replace(/{channel\.topic}/g, channel.topic || 'No topic');
      }

      result = result.replace(/{channel\.mention}/g, channel.toString());
    }

    return result;
  }

  /**
   * Parse argument variables: {args}, {args.1}, {args.2}, etc
   */
  private static parseArgumentVariables(content: string, context: ParserContext): string {
    let result = content;
    const args = context.args || [];

    // {args} - all arguments joined
    result = result.replace(/{args}/g, args.join(' '));

    // {args.N} - specific argument
    const argRegex = /\{args\.(\d+)\}/g;
    result = result.replace(argRegex, (match, index) => {
      const idx = parseInt(index) - 1; // Convert to 0-indexed
      return args[idx] || '';
    });

    return result;
  }

  /**
   * Parse random variables: {random.1-100}, {random.member}, {random.channel}, {random.role}
   */
  private static parseRandomVariables(content: string, context: ParserContext): string {
    let result = content;

    // {random.number-number} for range
    const rangeRegex = /\{random\.(\d+)-(\d+)\}/g;
    result = result.replace(rangeRegex, (match, min, max) => {
      const minNum = parseInt(min);
      const maxNum = parseInt(max);
      const random = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
      return String(random);
    });

    // {random.member} - random guild member
    if (context.guild && result.includes('{random.member}')) {
      const members = context.guild.members.cache.random();
      result = result.replace(/{random\.member}/g, members?.user.toString() || 'unknown');
    }

    // {random.channel} - random channel
    if (context.guild && result.includes('{random.channel}')) {
      const channels = context.guild.channels.cache.random();
      result = result.replace(/{random\.channel}/g, channels?.toString() || 'unknown');
    }

    // {random.role} - random role
    if (context.guild && result.includes('{random.role}')) {
      const roles = context.guild.roles.cache.filter(r => !r.managed).random();
      result = result.replace(/{random\.role}/g, roles?.toString() || 'unknown');
    }

    return result;
  }

  /**
   * Parse time and date variables
   */
  private static parseTimeVariables(content: string, context: ParserContext): string {
    let result = content;

    const now = new Date();

    // {time} and {time.utc} - current time
    const timeStr = now.toLocaleTimeString();
    result = result.replace(/{time}/g, timeStr);
    result = result.replace(/{time\.utc}/g, now.toUTCString());

    // {date} and {date.utc} - current date
    const dateStr = now.toLocaleDateString();
    result = result.replace(/{date}/g, dateStr);
    result = result.replace(/{date\.utc}/g, now.toUTCString());

    return result;
  }

  /**
   * Parse cross-module variables: {level}, {xp}, {coins}, {reputation}, {messages}
   * These are placeholders - actual implementation depends on other modules
   */
  private static parseCrossModuleVariables(content: string, context: ParserContext): string {
    let result = content;

    // These would be populated by other modules
    const crossModuleData = context.crossModuleData || {};

    result = result.replace(/{level}/g, String(crossModuleData.level || 0));
    result = result.replace(/{xp}/g, String(crossModuleData.xp || 0));
    result = result.replace(/{coins}/g, String(crossModuleData.coins || 0));
    result = result.replace(/{reputation}/g, String(crossModuleData.reputation || 0));
    result = result.replace(/{messages}/g, String(crossModuleData.messages || 0));

    return result;
  }
}

export default VariableParser;
