import {
  Guild,
  ChannelType,
  PermissionFlagsBits,
  ColorResolvable,
  PermissionOverwrites,
  OverwriteType,
} from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Autosetup:Helpers');

export const DEFAULT_AUTOSETUP_CONFIG = {
  enabled: true,
  categoryName: 'Bot Setup',
  embedColor: '#1ABC9C',
};

export async function createTextChannel(
  guild: Guild,
  name: string,
  options?: any
): Promise<{ success: boolean; channel?: any; error?: string }> {
  try {
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      ...options,
    });
    return { success: true, channel };
  } catch (error) {
    logger.error('Error creating text channel:', error);
    return { success: false, error: 'Failed to create text channel' };
  }
}

export async function createVoiceChannel(
  guild: Guild,
  name: string,
  options?: any
): Promise<{ success: boolean; channel?: any; error?: string }> {
  try {
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      ...options,
    });
    return { success: true, channel };
  } catch (error) {
    logger.error('Error creating voice channel:', error);
    return { success: false, error: 'Failed to create voice channel' };
  }
}

export async function createCategory(
  guild: Guild,
  name: string
): Promise<{ success: boolean; category?: any; error?: string }> {
  try {
    const category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
    });
    return { success: true, category };
  } catch (error) {
    logger.error('Error creating category:', error);
    return { success: false, error: 'Failed to create category' };
  }
}

export async function createRole(
  guild: Guild,
  name: string,
  color?: ColorResolvable,
  permissions?: bigint
): Promise<{ success: boolean; role?: any; error?: string }> {
  try {
    const role = await guild.roles.create({
      name,
      color: color || '#808080',
      permissions: permissions || [],
    });
    return { success: true, role };
  } catch (error) {
    logger.error('Error creating role:', error);
    return { success: false, error: 'Failed to create role' };
  }
}

export async function enableModule(
  guildId: string,
  moduleName: string,
  config?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, moduleName);
    const currentConfig = (_cfgResult?.config ?? {}) as Record<string, any>;

    const newConfig = {
      ...currentConfig,
      enabled: true,
      ...(config || {}),
    };

    await moduleConfig.setConfig(guildId, moduleName, newConfig);
    return { success: true };
  } catch (error) {
    logger.error('Error enabling module:', error);
    return { success: false, error: 'Failed to enable module' };
  }
}

export async function getAutosetupConfig(
  guildId: string
): Promise<Record<string, any>> {
  try {
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'autosetup');
    return (_cfgResult?.config ?? DEFAULT_AUTOSETUP_CONFIG) as Record<string, any>;
  } catch (error) {
    logger.error('Error getting autosetup config:', error);
    return DEFAULT_AUTOSETUP_CONFIG;
  }
}

export async function createChannelWithCategory(
  guild: Guild,
  categoryName: string,
  channelName: string,
  type: ChannelType = ChannelType.GuildText
): Promise<{ success: boolean; channel?: any; error?: string }> {
  try {
    // Check if category exists
    let category = guild.channels.cache.find(
      (ch) => ch.type === ChannelType.GuildCategory && ch.name === categoryName
    );

    // Create category if it doesn't exist
    if (!category) {
      const catResult = await createCategory(guild, categoryName);
      if (!catResult.success) {
        return { success: false, error: 'Failed to create category' };
      }
      category = catResult.category;
    }

    // Ensure category is not undefined
    if (!category) {
      return { success: false, error: 'Category not found or created' };
    }

    // Create channel in category
    const channel = await guild.channels.create({
      name: channelName,
      type: type as ChannelType.GuildText | ChannelType.GuildVoice,
      parent: category.id,
    });

    return { success: true, channel };
  } catch (error) {
    logger.error('Error creating channel with category:', error);
    return { success: false, error: 'Failed to create channel' };
  }
}

export async function setChannelPermissions(
  channel: any,
  roleId: string,
  permissions: { allow?: bigint; deny?: bigint }
): Promise<boolean> {
  try {
    const overwriteData: any = {
      id: roleId,
      type: OverwriteType.Role,
    };

    if (permissions.allow) {
      overwriteData.allow = permissions.allow;
    }
    if (permissions.deny) {
      overwriteData.deny = permissions.deny;
    }

    await channel.permissionOverwrites.create(overwriteData);
    return true;
  } catch (error) {
    logger.error('Error setting channel permissions:', error);
    return false;
  }
}
