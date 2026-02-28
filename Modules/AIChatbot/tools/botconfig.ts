/**
 * Bot Config Tools — 4 tools for enabling/disabling modules and
 * managing bot configuration through the AI.
 */

import { PermissionFlagsBits } from 'discord.js';
import { DiscordTool, ToolExecutionContext } from './registry';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

export const botConfigTools: DiscordTool[] = [
  // ─────────────────────────────
  // 1. enable_module
  // ─────────────────────────────
  {
    id: 'botconfig.enable_module',
    category: 'botconfig',
    name: 'Enable Module',
    description: 'Enable a Nexus bot module for this server. Use utility.list_modules to see available modules.',
    parameters: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'Module name (lowercase), e.g. "leveling", "music", "tickets", "fun", "moderation"' },
      },
      required: ['module_name'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageGuild,

    async execute(params, ctx) {
      const moduleName = (params.module_name as string).toLowerCase();

      // Check if module exists by trying to get its config
      const existing = await moduleConfig.getModuleConfig(ctx.guild.id, moduleName);
      // Note: getModuleConfig returns null if never configured, but that's fine — setEnabled creates it

      await moduleConfig.setEnabled(ctx.guild.id, moduleName, true);
      return `Enabled module "${moduleName}" for this server.`;
    },
  },

  // ─────────────────────────────
  // 2. disable_module
  // ─────────────────────────────
  {
    id: 'botconfig.disable_module',
    category: 'botconfig',
    name: 'Disable Module',
    description: 'Disable a Nexus bot module for this server. Commands from the disabled module will stop working.',
    parameters: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'Module name (lowercase)' },
      },
      required: ['module_name'],
    },
    isDestructive: true,
    requiredPermission: PermissionFlagsBits.ManageGuild,

    async execute(params, ctx) {
      const moduleName = (params.module_name as string).toLowerCase();

      // Don't allow disabling the aichatbot module through AI
      if (moduleName === 'aichatbot') {
        return 'Error: Cannot disable the AI Chatbot module through AI. Use the /aiconfig command directly.';
      }

      await moduleConfig.setEnabled(ctx.guild.id, moduleName, false);
      return `Disabled module "${moduleName}" for this server. Its commands will no longer work.`;
    },
  },

  // ─────────────────────────────
  // 3. update_module_config
  // ─────────────────────────────
  {
    id: 'botconfig.update_config',
    category: 'botconfig',
    name: 'Update Module Config',
    description: 'Update a specific setting for a bot module. Use botconfig.get_config to see current settings first.',
    parameters: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'Module name (lowercase)' },
        key: { type: 'string', description: 'Config key to update (e.g. "maxDuration", "cooldown", "allowedChannels")' },
        value: { type: 'string', description: 'New value. For booleans use "true"/"false", for numbers use the number as string, for arrays use JSON like ["abc","def"]' },
      },
      required: ['module_name', 'key', 'value'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageGuild,

    async execute(params, ctx) {
      const moduleName = (params.module_name as string).toLowerCase();
      const key = params.key as string;
      const rawValue = params.value as string;

      // Parse the value
      let value: unknown;
      if (rawValue === 'true') value = true;
      else if (rawValue === 'false') value = false;
      else if (/^\d+$/.test(rawValue)) value = parseInt(rawValue, 10);
      else if (/^\d+\.\d+$/.test(rawValue)) value = parseFloat(rawValue);
      else if (rawValue.startsWith('[') || rawValue.startsWith('{')) {
        try { value = JSON.parse(rawValue); } catch { value = rawValue; }
      } else {
        value = rawValue;
      }

      await moduleConfig.updateConfig(ctx.guild.id, moduleName, { [key]: value });
      return `Updated "${moduleName}" config: set "${key}" to ${JSON.stringify(value)}.`;
    },
  },

  // ─────────────────────────────
  // 4. get_module_config
  // ─────────────────────────────
  {
    id: 'botconfig.get_config',
    category: 'botconfig',
    name: 'Get Module Config',
    description: 'View the current configuration for a bot module.',
    parameters: {
      type: 'object',
      properties: {
        module_name: { type: 'string', description: 'Module name (lowercase)' },
      },
      required: ['module_name'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageGuild,

    async execute(params, ctx) {
      const moduleName = (params.module_name as string).toLowerCase();

      const result = await moduleConfig.getModuleConfig(ctx.guild.id, moduleName);
      if (!result) {
        return `Module "${moduleName}" has no configuration set (using defaults).`;
      }

      return [
        `Module: ${moduleName}`,
        `Enabled: ${result.enabled}`,
        `Config:`,
        JSON.stringify(result.config, null, 2),
      ].join('\n');
    },
  },
];
