import { Guild, GuildMember, ContainerBuilder } from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { cache } from '../../Shared/src/cache/cacheManager';
import { getDb } from '../../Shared/src/database/connection';
import { shopItems, userInventory, guildMembers } from '../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { getBalance, addCurrency, CurrencyType } from '../Currency/helpers';
import { addLives } from '../Counting/helpers';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleContainer, addText, addFields } from '../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Shop');

export type ShopItemType =
  | 'role'
  | 'custom_role'
  | 'xp_boost'
  | 'counting_life'
  | 'giveaway_entry'
  | 'badge'
  | 'custom'
  | 'consumable';

export interface ShopItem {
  id: number;
  guildId: string;
  name: string;
  description: string | null;
  price: number;
  currencyType: string;
  itemType: string;
  itemData: Record<string, any>;
  stock: number | null;
  requiredRoleId: string | null;
  requiredLevel: number | null;
  isActive: boolean;
}

export interface UserInventoryItem {
  id: number;
  itemId: number;
  itemName: string;
  itemType: string;
  quantity: number;
  purchasedAt: Date;
  expiresAt: Date | null;
}

export interface ShopConfig {
  enabled: boolean;
  currencyType: CurrencyType;
  taxPercent: number;
  maxItemsPerServer: number;
  logChannelId?: string;
  showOutOfStock: boolean;
  refundsEnabled: boolean;
  refundPercent: number;
}

const DEFAULT_SHOP_CONFIG: ShopConfig = {
  enabled: true,
  currencyType: 'coins',
  taxPercent: 0,
  maxItemsPerServer: 50,
  showOutOfStock: false,
  refundsEnabled: true,
  refundPercent: 80,
};

export const shopHelpers = {
  async getShopConfig(guildId: string): Promise<ShopConfig> {
    try {
      const result = await moduleConfig.getModuleConfig<ShopConfig>(guildId, 'shop');
      if (!result) return { ...DEFAULT_SHOP_CONFIG };
      return { ...DEFAULT_SHOP_CONFIG, ...result.config };
    } catch (error) {
      logger.error('getShopConfig error:', error);
      return { ...DEFAULT_SHOP_CONFIG };
    }
  },

  async getShopItems(guildId: string): Promise<ShopItem[]> {
    try {
      const db = getDb();
      const items = await db.select().from(shopItems)
        .where(and(eq(shopItems.guildId, guildId), eq(shopItems.isActive, true)))
        .orderBy(shopItems.name);

      return items.map((row) => ({
        id: row.id,
        guildId: row.guildId,
        name: row.name,
        description: row.description,
        price: row.price,
        currencyType: row.currencyType,
        itemType: row.itemType,
        itemData: (row.itemData as Record<string, any>) || {},
        stock: row.stock,
        requiredRoleId: row.requiredRoleId,
        requiredLevel: row.requiredLevel,
        isActive: row.isActive,
      }));
    } catch (error) {
      logger.error('getShopItems error:', error);
      return [];
    }
  },

  async getShopItem(guildId: string, itemId: number): Promise<ShopItem | null> {
    try {
      const db = getDb();
      const rows = await db.select().from(shopItems)
        .where(and(eq(shopItems.guildId, guildId), eq(shopItems.id, itemId)))
        .limit(1);

      if (!rows.length) return null;
      const row = rows[0];
      return {
        id: row.id,
        guildId: row.guildId,
        name: row.name,
        description: row.description,
        price: row.price,
        currencyType: row.currencyType,
        itemType: row.itemType,
        itemData: (row.itemData as Record<string, any>) || {},
        stock: row.stock,
        requiredRoleId: row.requiredRoleId,
        requiredLevel: row.requiredLevel,
        isActive: row.isActive,
      };
    } catch (error) {
      logger.error('getShopItem error:', error);
      return null;
    }
  },

  async getShopItemByName(guildId: string, name: string): Promise<ShopItem | null> {
    try {
      const db = getDb();
      const rows = await db.select().from(shopItems)
        .where(and(eq(shopItems.guildId, guildId), eq(shopItems.name, name)))
        .limit(1);

      if (!rows.length) return null;
      const row = rows[0];
      return {
        id: row.id,
        guildId: row.guildId,
        name: row.name,
        description: row.description,
        price: row.price,
        currencyType: row.currencyType,
        itemType: row.itemType,
        itemData: (row.itemData as Record<string, any>) || {},
        stock: row.stock,
        requiredRoleId: row.requiredRoleId,
        requiredLevel: row.requiredLevel,
        isActive: row.isActive,
      };
    } catch (error) {
      logger.error('getShopItemByName error:', error);
      return null;
    }
  },

  async addShopItem(guildId: string, item: {
    name: string;
    description?: string;
    price: number;
    currencyType?: string;
    itemType: string;
    itemData?: Record<string, any>;
    stock?: number | null;
    requiredRoleId?: string | null;
    requiredLevel?: number | null;
  }): Promise<ShopItem | null> {
    try {
      const db = getDb();
      const config = await shopHelpers.getShopConfig(guildId);

      const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(shopItems)
        .where(eq(shopItems.guildId, guildId));
      if ((countResult[0]?.count || 0) >= config.maxItemsPerServer) {
        return null;
      }

      const rows = await db.insert(shopItems).values({
        guildId,
        name: item.name,
        description: item.description || null,
        price: item.price,
        currencyType: item.currencyType || 'coins',
        itemType: item.itemType,
        itemData: item.itemData || {},
        stock: item.stock ?? null,
        requiredRoleId: item.requiredRoleId || null,
        requiredLevel: item.requiredLevel || null,
      }).returning();

      const row = rows[0];
      return {
        id: row.id,
        guildId: row.guildId,
        name: row.name,
        description: row.description,
        price: row.price,
        currencyType: row.currencyType,
        itemType: row.itemType,
        itemData: (row.itemData as Record<string, any>) || {},
        stock: row.stock,
        requiredRoleId: row.requiredRoleId,
        requiredLevel: row.requiredLevel,
        isActive: row.isActive,
      };
    } catch (error) {
      logger.error('addShopItem error:', error);
      return null;
    }
  },

  async removeShopItem(guildId: string, itemId: number): Promise<boolean> {
    try {
      const db = getDb();
      const result = await db.delete(shopItems)
        .where(and(eq(shopItems.guildId, guildId), eq(shopItems.id, itemId)));
      return true;
    } catch (error) {
      logger.error('removeShopItem error:', error);
      return false;
    }
  },

  async editShopItem(
    guildId: string,
    itemId: number,
    updates: Partial<{ name: string; description: string; price: number; stock: number | null; isActive: boolean; itemData: Record<string, any> }>
  ): Promise<ShopItem | null> {
    try {
      const db = getDb();
      const rows = await db.update(shopItems)
        .set(updates)
        .where(and(eq(shopItems.guildId, guildId), eq(shopItems.id, itemId)))
        .returning();

      if (!rows.length) return null;
      const row = rows[0];
      return {
        id: row.id,
        guildId: row.guildId,
        name: row.name,
        description: row.description,
        price: row.price,
        currencyType: row.currencyType,
        itemType: row.itemType,
        itemData: (row.itemData as Record<string, any>) || {},
        stock: row.stock,
        requiredRoleId: row.requiredRoleId,
        requiredLevel: row.requiredLevel,
        isActive: row.isActive,
      };
    } catch (error) {
      logger.error('editShopItem error:', error);
      return null;
    }
  },

  async canBuy(
    guildId: string,
    userId: string,
    member: GuildMember,
    item: ShopItem,
    quantity: number = 1
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      if (!item.isActive) {
        return { allowed: false, reason: 'This item is currently disabled.' };
      }

      if (item.requiredRoleId) {
        if (!member.roles.cache.has(item.requiredRoleId)) {
          return {
            allowed: false,
            reason: 'You do not have the required role to buy this item.',
          };
        }
      }

      if (item.requiredLevel) {
        const db = getDb();
        const memberRows = await db.select().from(guildMembers)
          .where(and(eq(guildMembers.userId, userId), eq(guildMembers.guildId, guildId)))
          .limit(1);
        const memberData = memberRows[0];
        if (!memberData || (memberData.level || 0) < item.requiredLevel) {
          return {
            allowed: false,
            reason: `You need to be level ${item.requiredLevel} or higher.`,
          };
        }
      }

      const balance = await getBalance(guildId, userId);
      const currencyKey = item.currencyType === 'gems' ? 'gems' : item.currencyType === 'event_tokens' ? 'eventTokens' : 'coins';
      const userBalance = balance[currencyKey as keyof typeof balance];
      const totalCost = item.price * quantity;

      if (userBalance < totalCost) {
        return {
          allowed: false,
          reason: `You don't have enough currency. Need ${totalCost}, have ${userBalance}.`,
        };
      }

      if (item.stock !== null && item.stock > 0) {
        if (item.stock < quantity) {
          return {
            allowed: false,
            reason: `Not enough stock. Available: ${item.stock}, requested: ${quantity}.`,
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('canBuy error:', error);
      return { allowed: false, reason: 'An error occurred while checking if you can buy this item.' };
    }
  },

  async purchaseItem(
    guildId: string,
    userId: string,
    member: GuildMember,
    item: ShopItem,
    quantity: number = 1
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      const canBuyCheck = await shopHelpers.canBuy(guildId, userId, member, item, quantity);
      if (!canBuyCheck.allowed) {
        return { success: false, reason: canBuyCheck.reason };
      }

      const config = await shopHelpers.getShopConfig(guildId);
      const totalCost = item.price * quantity;
      const tax = Math.floor((totalCost * config.taxPercent) / 100);
      const finalCost = totalCost + tax;

      const currencyType: CurrencyType = item.currencyType === 'gems' ? 'gems' : item.currencyType === 'event_tokens' ? 'event_tokens' : 'coins';
      await addCurrency(guildId, userId, currencyType, -finalCost, 'shop_purchase');

      if (item.stock !== null && item.stock > 0) {
        await shopHelpers.editShopItem(guildId, item.id, { stock: item.stock - quantity });
      }

      await shopHelpers.addToInventory(guildId, userId, item, quantity);

      eventBus.emit('itemPurchased', {
        guildId,
        userId,
        itemId: item.id,
        itemType: item.itemType,
        price: finalCost,
        currencyType,
      });

      return { success: true };
    } catch (error) {
      logger.error('purchaseItem error:', error);
      return { success: false, reason: 'An error occurred during purchase.' };
    }
  },

  async getUserInventory(guildId: string, userId: string): Promise<UserInventoryItem[]> {
    try {
      const db = getDb();
      const rows = await db.select({
        id: userInventory.id,
        itemId: userInventory.itemId,
        quantity: userInventory.quantity,
        purchasedAt: userInventory.purchasedAt,
        expiresAt: userInventory.expiresAt,
        itemName: shopItems.name,
        itemType: shopItems.itemType,
      })
        .from(userInventory)
        .innerJoin(shopItems, eq(userInventory.itemId, shopItems.id))
        .where(and(eq(userInventory.guildId, guildId), eq(userInventory.userId, userId)));

      const now = new Date();
      const activeItems: UserInventoryItem[] = [];
      const expiredIds: number[] = [];

      for (const row of rows) {
        if (row.expiresAt && row.expiresAt < now) {
          expiredIds.push(row.id);
          continue;
        }
        activeItems.push({
          id: row.id,
          itemId: row.itemId,
          itemName: row.itemName,
          itemType: row.itemType,
          quantity: row.quantity,
          purchasedAt: row.purchasedAt,
          expiresAt: row.expiresAt,
        });
      }

      // Clean up expired items
      if (expiredIds.length > 0) {
        for (const expiredId of expiredIds) {
          await db.delete(userInventory).where(eq(userInventory.id, expiredId));
        }
      }

      return activeItems;
    } catch (error) {
      logger.error('getUserInventory error:', error);
      return [];
    }
  },

  async addToInventory(
    guildId: string,
    userId: string,
    item: ShopItem,
    quantity: number = 1
  ): Promise<boolean> {
    try {
      const db = getDb();

      // Check if user already has this item
      const existing = await db.select().from(userInventory)
        .where(and(
          eq(userInventory.guildId, guildId),
          eq(userInventory.userId, userId),
          eq(userInventory.itemId, item.id)
        ))
        .limit(1);

      if (existing.length) {
        // Update quantity
        await db.update(userInventory)
          .set({ quantity: sql`${userInventory.quantity} + ${quantity}` })
          .where(eq(userInventory.id, existing[0].id));
      } else {
        // Calculate expiry for timed items
        let expiresAt: Date | null = null;
        if (item.itemType === 'xp_boost' && item.itemData.duration) {
          const durationMs = parseDuration(item.itemData.duration);
          expiresAt = new Date(Date.now() + durationMs);
        }

        await db.insert(userInventory).values({
          guildId,
          userId,
          itemId: item.id,
          quantity,
          expiresAt,
        });
      }

      return true;
    } catch (error) {
      logger.error('addToInventory error:', error);
      return false;
    }
  },

  async removeFromInventory(
    guildId: string,
    userId: string,
    itemId: number,
    quantity: number = 1
  ): Promise<boolean> {
    try {
      const db = getDb();

      const existing = await db.select().from(userInventory)
        .where(and(
          eq(userInventory.guildId, guildId),
          eq(userInventory.userId, userId),
          eq(userInventory.itemId, itemId)
        ))
        .limit(1);

      if (!existing.length) return false;

      const row = existing[0];
      if (row.quantity <= quantity) {
        await db.delete(userInventory).where(eq(userInventory.id, row.id));
      } else {
        await db.update(userInventory)
          .set({ quantity: row.quantity - quantity })
          .where(eq(userInventory.id, row.id));
      }

      return true;
    } catch (error) {
      logger.error('removeFromInventory error:', error);
      return false;
    }
  },

  async useItem(
    guildId: string,
    userId: string,
    member: GuildMember,
    itemId: number
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      const item = await shopHelpers.getShopItem(guildId, itemId);
      if (!item) {
        return { success: false, reason: 'Item not found.' };
      }

      const inventory = await shopHelpers.getUserInventory(guildId, userId);
      const invItem = inventory.find((i) => i.itemId === itemId);
      if (!invItem) {
        return { success: false, reason: 'You do not own this item.' };
      }

      switch (item.itemType) {
        case 'role': {
          const roleId = item.itemData.roleId as string;
          const role = member.guild.roles.cache.get(roleId);
          if (!role) {
            return { success: false, reason: 'Role not found.' };
          }
          await member.roles.add(role);
          break;
        }

        case 'custom_role': {
          const color = (item.itemData.color as string) || '#FFFFFF';
          const role = await member.guild.roles.create({
            name: (item.itemData.roleName as string) || `Custom Role - ${member.user.username}`,
            color: color as any,
          });
          await member.roles.add(role);
          break;
        }

        case 'xp_boost': {
          const durationMs = parseDuration(item.itemData.duration as string);
          const key = `xp_boost:${guildId}:${userId}`;
          await cache.set(
            key,
            {
              multiplier: item.itemData.multiplier,
              expiresAt: new Date(Date.now() + durationMs),
            },
            Math.ceil(durationMs / 1000)
          );
          break;
        }

        case 'counting_life': {
          await addLives(guildId, userId, (item.itemData.lives as number) || 1);
          break;
        }

        case 'giveaway_entry': {
          return {
            success: false,
            reason: 'Use /use with the giveaway ID as target to use giveaway entries.',
          };
        }

        case 'badge':
        case 'consumable':
        case 'custom':
        default:
          // Generic use — just remove from inventory
          break;
      }

      await shopHelpers.removeFromInventory(guildId, userId, itemId, 1);

      return { success: true };
    } catch (error) {
      logger.error('useItem error:', error);
      return { success: false, reason: 'An error occurred while using the item.' };
    }
  },

  async checkGiveawayEntryLimit(
    guildId: string,
    userId: string,
    giveawayId: string
  ): Promise<boolean> {
    try {
      const key = `shop:gentry:${guildId}:${giveawayId}:${userId}`;
      const exists = await cache.has(key);
      return exists;
    } catch (error) {
      logger.error('checkGiveawayEntryLimit error:', error);
      return false;
    }
  },

  async addGiveawayEntry(
    guildId: string,
    userId: string,
    giveawayId: string
  ): Promise<boolean> {
    try {
      const key = `shop:gentry:${guildId}:${giveawayId}:${userId}`;
      await cache.set(key, '1', 86400 * 30);
      return true;
    } catch (error) {
      logger.error('addGiveawayEntry error:', error);
      return false;
    }
  },

  buildShopEmbed(
    items: ShopItem[],
    page: number = 1,
    _config: ShopConfig
  ): ContainerBuilder {
    const itemsPerPage = 10;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const safePage = Math.max(1, Math.min(page, totalPages || 1));

    const start = (safePage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = items.slice(start, end);

    const container = moduleContainer('shop').setAccentColor(0xF1C40F);

    addText(container, '### Shop');

    if (pageItems.length === 0) {
      addText(container, 'No items available in the shop.');
      addText(container, `-# Page ${safePage} / ${totalPages || 1}`);
      return container;
    }

    const descriptions = pageItems.map((item) => {
      const stock = item.stock === null ? '∞' : item.stock;
      return `**${item.name}** - \`${item.price}\` ${item.currencyType}\nStock: ${stock} | ${item.description || 'No description'}`;
    });

    addText(container, descriptions.join('\n\n'));
    addText(container, `-# Page ${safePage} / ${totalPages || 1}`);

    return container;
  },

  buildItemEmbed(item: ShopItem): ContainerBuilder {
    const container = moduleContainer('shop').setAccentColor(0x5865F2);
    addText(container, `### ${item.name}`);
    addFields(container, [
      { name: 'Description', value: item.description || 'No description', inline: false },
      { name: 'Price', value: `${item.price} ${item.currencyType}`, inline: true },
      { name: 'Type', value: item.itemType, inline: true },
      { name: 'Stock', value: item.stock === null ? 'Unlimited' : `${item.stock}`, inline: true }
    ]);

    if (item.requiredLevel) {
      addFields(container, [{ name: 'Min Level', value: `${item.requiredLevel}`, inline: true }]);
    }

    return container;
  },

  buildInventoryEmbed(inventory: UserInventoryItem[], page: number = 1): ContainerBuilder {
    const itemsPerPage = 15;
    const totalPages = Math.ceil(inventory.length / itemsPerPage);
    const safePage = Math.max(1, Math.min(page, totalPages || 1));

    const start = (safePage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = inventory.slice(start, end);

    const container = moduleContainer('shop').setAccentColor(0x57F287);
    addText(container, '### Your Inventory');

    if (pageItems.length === 0) {
      addText(container, 'Your inventory is empty.');
      addText(container, `-# Page ${safePage} / ${totalPages || 1}`);
      return container;
    }

    const descriptions = pageItems.map((item) => {
      let line = `**${item.itemName}** (${item.itemType}) x${item.quantity}`;
      if (item.expiresAt) {
        const expiresIn = Math.floor((new Date(item.expiresAt).getTime() - Date.now()) / 1000);
        if (expiresIn > 0) {
          line += ` - Expires in ${formatSeconds(expiresIn)}`;
        } else {
          line += ' - Expired';
        }
      }
      return line;
    });

    addText(container, descriptions.join('\n'));
    addText(container, `-# Page ${safePage} / ${totalPages || 1}`);

    return container;
  },

  async logShopAction(
    guild: Guild,
    config: ShopConfig,
    action: string,
    userId: string,
    itemName: string,
    price?: number
  ): Promise<void> {
    try {
      if (!config.logChannelId) return;

      const channel = guild.channels.cache.get(config.logChannelId);
      if (!channel || !channel.isTextBased()) return;

      const container = moduleContainer('shop').setAccentColor(0x5865F2);
      addText(container, '### Shop Action');
      const fields = [
        { name: 'Action', value: action, inline: true },
        { name: 'User', value: `<@${userId}>`, inline: true },
        { name: 'Item', value: itemName, inline: true }
      ];
      if (price !== undefined) {
        fields.push({ name: 'Price', value: `${price}`, inline: true });
      }
      addFields(container, fields);

      const { v2Payload } = require('../../Shared/src/utils/componentsV2');
      await (channel as any).send(v2Payload([container]));
    } catch (error) {
      logger.error('logShopAction error:', error);
    }
  },
};

function parseDuration(durationStr: string): number {
  const match = durationStr.match(/^(\d+)([smhd])$/);
  if (!match) return 3600000;

  const value = parseInt(match[1]);
  const unit = match[2];

  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (units[unit] || 3600000);
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
