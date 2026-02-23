import {
  Guild,
  GuildMember,
  EmbedBuilder,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  CategoryChannel,
  OverwriteResolvable,
  PermissionOverwrites,
  Message,
} from 'discord.js';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { getRedis, getDb } from '../../Shared/src/database/connection';
import { tickets } from '../../Shared/src/database/models/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { Colors } from '../../Shared/src/utils/embed';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Tickets');

// ============================================================================
// INTERFACES
// ============================================================================

export interface TicketCategory {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  categoryChannelId?: string;
  staffRoles: string[];
  namingFormat: string;
  welcomeMessage?: string;
  claimEnabled: boolean;
}

export interface TicketPanel {
  id: string;
  channelId: string;
  messageId: string;
  type: 'button' | 'dropdown';
  title: string;
  description: string;
  color?: string;
  categoryIds: string[];
}

export interface TicketConfig {
  enabled: boolean;
  categories: TicketCategory[];
  globalStaffRoles: string[];
  maxOpenTicketsPerUser: number;
  ticketCounter: number;
  panels: TicketPanel[];
  claimEnabled: boolean;
  priorityEnabled: boolean;
  feedbackEnabled: boolean;
  transcriptEnabled: boolean;
  transcriptChannelId?: string;
  autoCloseEnabled: boolean;
  autoCloseHours: number;
  autoCloseWarningHours: number;
  closeConfirmation: boolean;
  deleteOnClose: boolean;
  closeDelay: number;
  logChannelId?: string;
}

export interface TicketData {
  id: number;
  guildId: string;
  channelId: string;
  userId: string;
  categoryId: string;
  ticketNumber: number;
  status: 'open' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  claimedBy?: string;
  closedBy?: string;
  closedAt?: Date;
  createdAt: Date;
  reason?: string;
  feedbackRating?: number;
  feedbackComment?: string;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

export const DEFAULT_TICKET_CONFIG: TicketConfig = {
  enabled: true,
  categories: [
    {
      id: 'general',
      name: 'General',
      emoji: '📋',
      description: 'General support and inquiries',
      staffRoles: [],
      namingFormat: 'ticket-{number}',
      claimEnabled: true,
    },
  ],
  globalStaffRoles: [],
  maxOpenTicketsPerUser: 3,
  ticketCounter: 0,
  panels: [],
  claimEnabled: true,
  priorityEnabled: true,
  feedbackEnabled: false,
  transcriptEnabled: false,
  autoCloseEnabled: false,
  autoCloseHours: 24,
  autoCloseWarningHours: 1,
  closeConfirmation: true,
  deleteOnClose: false,
  closeDelay: 5,
};

// ============================================================================
// CORE HELPERS
// ============================================================================

/**
 * Get ticket config for guild with defaults
 */
export async function getTicketConfig(guildId: string): Promise<TicketConfig> {
  try {
    const result = await moduleConfig.getModuleConfig<TicketConfig>(
      guildId,
      'tickets'
    );

    const config = result?.config || DEFAULT_TICKET_CONFIG;

    // Ensure categories array exists
    if (!config.categories || config.categories.length === 0) {
      config.categories = DEFAULT_TICKET_CONFIG.categories;
    }

    // Ensure at least one category
    if (config.categories.length === 0) {
      config.categories.push(DEFAULT_TICKET_CONFIG.categories[0]);
    }

    return config;
  } catch (error) {
    logger.error(`Failed to get ticket config for guild ${guildId}:`, error);
    return DEFAULT_TICKET_CONFIG;
  }
}

/**
 * Get next ticket number using Redis INCR for atomicity
 */
export async function getNextTicketNumber(guildId: string): Promise<number> {
  try {
    const redis = getRedis();
    const key = `tickets:counter:${guildId}`;
    const nextNumber = await redis.incr(key);
    return nextNumber;
  } catch (error) {
    logger.error(`Failed to get next ticket number for guild ${guildId}:`, error);
    // Fallback: use timestamp
    return Math.floor(Date.now() / 1000);
  }
}

/**
 * Format ticket channel name from template
 */
export function formatTicketName(
  format: string,
  data: { number: number; username: string; category: string }
): string {
  let name = format
    .replace('{number}', data.number.toString())
    .replace('{username}', data.username)
    .replace('{category}', data.category);

  // Sanitize for Discord channel name
  name = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);

  // Ensure not empty
  if (!name) {
    name = `ticket-${data.number}`;
  }

  return name;
}

/**
 * Check if a channel is a ticket
 */
export async function isTicketChannel(
  guildId: string,
  channelId: string
): Promise<TicketData | null> {
  try {
    const redis = getRedis();
    const cacheKey = `ticket:channel:${guildId}:${channelId}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const db = getDb();
    const [result] = await db.select().from(tickets).where(
      and(eq(tickets.guildId, guildId), eq(tickets.channelId, channelId))
    ).limit(1);

    if (result) {
      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(result));
      return result as unknown as TicketData;
    }

    return null;
  } catch (error) {
    logger.error(`Failed to check if channel is ticket:`, error);
    return null;
  }
}

/**
 * Check if member is ticket staff
 */
export function isTicketStaff(
  member: GuildMember,
  config: TicketConfig,
  categoryId?: string
): boolean {
  // Admins are always staff
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check global staff roles
  if (config.globalStaffRoles.some((roleId) => member.roles.cache.has(roleId))) {
    return true;
  }

  // Check category-specific staff roles
  if (categoryId) {
    const category = config.categories.find((c) => c.id === categoryId);
    if (category?.staffRoles.some((roleId) => member.roles.cache.has(roleId))) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// TICKET CREATION
// ============================================================================

/**
 * Full ticket creation flow
 */
export async function createTicket(
  guild: Guild,
  member: GuildMember,
  categoryId: string,
  reason?: string
): Promise<{ channel: TextChannel; ticketData: TicketData } | null> {
  try {
    const config = await getTicketConfig(guild.id);

    // Check if tickets are enabled
    if (!config.enabled) {
      logger.warn(`Tickets disabled for guild ${guild.id}`);
      return null;
    }

    // Check max open tickets
    const openCount = await getOpenTicketCount(guild.id, member.id);
    if (config.maxOpenTicketsPerUser > 0 && openCount >= config.maxOpenTicketsPerUser) {
      logger.warn(
        `User ${member.id} exceeded max open tickets (${config.maxOpenTicketsPerUser})`
      );
      return null;
    }

    // Get category
    const category = config.categories.find((c) => c.id === categoryId);
    if (!category) {
      logger.error(`Category ${categoryId} not found for guild ${guild.id}`);
      return null;
    }

    // Get next ticket number
    const ticketNumber = await getNextTicketNumber(guild.id);

    // Format channel name
    const channelName = formatTicketName(category.namingFormat, {
      number: ticketNumber,
      username: member.user.username,
      category: category.name,
    });

    // Determine parent category
    let parentId: string | null = null;
    if (category.categoryChannelId) {
      const parentChannel = guild.channels.cache.get(category.categoryChannelId);
      if (parentChannel?.type === ChannelType.GuildCategory) {
        parentId = category.categoryChannelId;
      }
    }

    // Build permissions
    const permissionOverwrites: OverwriteResolvable[] = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    // Add staff role permissions
    for (const roleId of category.staffRoles) {
      permissionOverwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageChannels,
        ],
      });
    }

    // Add global staff role permissions
    for (const roleId of config.globalStaffRoles) {
      permissionOverwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageChannels,
        ],
      });
    }

    // Create channel
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentId || undefined,
      permissionOverwrites,
      topic: `Ticket #${ticketNumber} • Opened by ${member.user.username}${reason ? ` • ${reason}` : ''}`,
    });

    if (!ticketChannel) {
      logger.error(`Failed to create ticket channel for guild ${guild.id}`);
      return null;
    }

    // Create database entry
    const db = getDb();
    const ticketData: TicketData = {
      id: 0, // Will be auto-assigned by DB
      guildId: guild.id,
      channelId: ticketChannel.id,
      userId: member.id,
      categoryId: categoryId,
      ticketNumber,
      status: 'open',
      priority: null,
      createdAt: new Date(),
      reason,
    };

    const insertResult = await db
      .insert(tickets)
      .values({
        guildId: guild.id,
        channelId: ticketChannel.id,
        userId: member.id,
        categoryName: categoryId,
        ticketNumber,
        status: 'open',
        createdAt: new Date(),
        closeReason: reason,
      })
      .returning();

    if (insertResult.length === 0) {
      logger.error(`Failed to insert ticket into database`);
      await ticketChannel.delete();
      return null;
    }

    ticketData.id = insertResult[0].id;

    // Cache in Redis
    const redis = getRedis();
    await redis.setex(
      `ticket:channel:${guild.id}:${ticketChannel.id}`,
      3600,
      JSON.stringify(ticketData)
    );

    // Send welcome message
    const { embed: welcomeEmbed, components } = buildTicketWelcomeEmbed(
      ticketData,
      category,
      config
    );

    await ticketChannel.send({
      embeds: [welcomeEmbed],
      components,
    });

    // Send custom welcome message if configured
    if (category.welcomeMessage) {
      await ticketChannel.send(category.welcomeMessage);
    }

    // Log action
    await logTicketAction(
      guild,
      config,
      'Ticket Created',
      ticketNumber,
      member.id,
      `Category: ${category.name}${reason ? ` • Reason: ${reason}` : ''}`
    );

    logger.info(
      `Ticket #${ticketNumber} created in guild ${guild.id} by ${member.id}`
    );

    return { channel: ticketChannel, ticketData };
  } catch (error) {
    logger.error(`Failed to create ticket:`, error);
    return null;
  }
}

// ============================================================================
// TICKET CLOSING
// ============================================================================

/**
 * Full ticket close flow
 */
export async function closeTicket(
  channelId: string,
  guildId: string,
  closedBy: string,
  reason?: string
): Promise<boolean> {
  try {
    const db = getDb();
    const redis = getRedis();

    // Get ticket data
    const ticketData = await isTicketChannel(guildId, channelId);
    if (!ticketData) {
      logger.warn(`Ticket not found for channel ${channelId}`);
      return false;
    }

    // Update database
    await db
      .update(tickets)
      .set({
        status: 'closed',
        closedBy,
        closedAt: new Date(),
      })
      .where(eq(tickets.channelId, channelId));

    // Clear cache
    await redis.del(`ticket:channel:${guildId}:${channelId}`);

    // Get guild and channel
    const guild = await (global as any).client.guilds.fetch(guildId);
    const channel = (await guild.channels.fetch(channelId)) as TextChannel;
    if (!channel) {
      logger.error(`Channel ${channelId} not found`);
      return false;
    }

    const config = await getTicketConfig(guildId);

    // Generate transcript if enabled
    if (config.transcriptEnabled) {
      const transcript = await generateTranscript(channelId, guild);
      if (transcript && config.transcriptChannelId) {
        const transcriptChannel = (await guild.channels.fetch(
          config.transcriptChannelId
        )) as TextChannel;
        if (transcriptChannel) {
          const fileName = `ticket-${ticketData.ticketNumber}-${Date.now()}.html`;
          await transcriptChannel.send({
            content: `Transcript for Ticket #${ticketData.ticketNumber}`,
            files: [{ attachment: Buffer.from(transcript), name: fileName }],
          });
        }
      }
    }

    // Send feedback prompt if enabled
    if (config.feedbackEnabled) {
      const userDM = await (global as any).client.users.fetch(ticketData.userId);
      if (userDM) {
        const { embed: feedbackEmbed, components } = buildFeedbackPrompt(
          ticketData.ticketNumber
        );
        await userDM
          .send({
            embeds: [feedbackEmbed],
            components,
          })
          .catch((err: any) => {
            logger.warn(
              `Failed to send feedback prompt to user ${ticketData.userId}:`,
              err
            );
          });
      }
    }

    // Delete or lock channel
    if (config.deleteOnClose) {
      setTimeout(async () => {
        try {
          await channel.delete();
          logger.info(`Deleted ticket channel ${channelId}`);
        } catch (error) {
          logger.error(`Failed to delete ticket channel ${channelId}:`, error);
        }
      }, config.closeDelay * 1000);
    } else {
      // Lock channel
      await (channel as any).permissionOverwrites.edit(ticketData.userId, {
        SendMessages: false,
        ViewChannel: true,
      });

      const closedEmbed = new EmbedBuilder()
        .setColor(Colors.Error)
        .setTitle('Ticket Closed')
        .setDescription(
          `This ticket was closed by <@${closedBy}>${reason ? `\n\nReason: ${reason}` : ''}`
        )
        .setTimestamp();

      await (channel as any).send({ embeds: [closedEmbed] });
    }

    // Log action
    await logTicketAction(
      guild,
      config,
      'Ticket Closed',
      ticketData.ticketNumber,
      closedBy,
      reason
    );

    logger.info(`Ticket #${ticketData.ticketNumber} closed`);
    return true;
  } catch (error) {
    logger.error(`Failed to close ticket:`, error);
    return false;
  }
}

// ============================================================================
// TRANSCRIPT GENERATION
// ============================================================================

/**
 * Generate HTML transcript of ticket channel
 */
export async function generateTranscript(
  channelId: string,
  guild: Guild
): Promise<string> {
  try {
    const channel = (await guild.channels.fetch(channelId)) as TextChannel;
    if (!channel) {
      logger.error(`Channel ${channelId} not found`);
      return '';
    }

    const messages: Message[] = [];
    let lastId: string | undefined;

    // Fetch all messages
    while (true) {
      const batch = await channel.messages.fetch({
        limit: 100,
        before: lastId,
      });

      if (batch.size === 0) break;

      messages.unshift(...batch.reverse().values());
      lastId = batch.last()?.id;

      if (batch.size < 100) break;
    }

    // Build HTML
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket Transcript - ${channel.name}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #2c2f33; color: #dcddde; padding: 20px; }
    .transcript { max-width: 800px; margin: 0 auto; background: #36393f; padding: 20px; border-radius: 8px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #2c2f33; padding-bottom: 10px; }
    .message { margin: 10px 0; padding: 10px; background: #2c2f33; border-radius: 4px; }
    .author { font-weight: bold; color: #7289da; }
    .timestamp { font-size: 0.8em; color: #72767d; margin-left: 10px; }
    .content { margin-top: 5px; word-wrap: break-word; }
    .attachment { margin-top: 5px; color: #72767d; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="transcript">
    <div class="header">
      <h1>${channel.name}</h1>
      <p>Transcript generated on ${new Date().toISOString()}</p>
    </div>`;

    for (const msg of messages) {
      const timestamp = msg.createdTimestamp
        ? new Date(msg.createdTimestamp).toLocaleString()
        : 'Unknown';

      html += `
    <div class="message">
      <span class="author">${msg.author.username}</span>
      <span class="timestamp">${timestamp}</span>
      <div class="content">${msg.content || '(no text content)'}</div>`;

      if (msg.attachments.size > 0) {
        html += `<div class="attachment">Attachments: ${msg.attachments
          .map((a) => `<a href="${a.url}">${a.name}</a>`)
          .join(', ')}</div>`;
      }

      html += `</div>`;
    }

    html += `
  </div>
</body>
</html>`;

    return html;
  } catch (error) {
    logger.error(`Failed to generate transcript:`, error);
    return '';
  }
}

// ============================================================================
// EMBED BUILDERS
// ============================================================================

/**
 * Build welcome embed for new tickets
 */
export function buildTicketWelcomeEmbed(
  ticketData: TicketData,
  category: TicketCategory,
  config: TicketConfig
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(Colors.Primary)
    .setTitle(`${category.emoji || '🎫'} Ticket #${ticketData.ticketNumber}`)
    .setDescription('Thank you for opening a support ticket. Our staff will assist you shortly.')
    .addFields(
      {
        name: 'Category',
        value: category.name,
        inline: true,
      },
      {
        name: 'Status',
        value: 'Open',
        inline: true,
      }
    );

  if (ticketData.reason) {
    embed.addFields({
      name: 'Reason',
      value: ticketData.reason,
      inline: false,
    });
  }

  embed.setFooter({ text: `Opened by ${ticketData.userId}` }).setTimestamp();

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  const buttonRow = new ActionRowBuilder<ButtonBuilder>();

  // Close button
  buttonRow.addComponents(
    new ButtonBuilder()
      .setCustomId('ticket-close')
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
  );

  // Claim button
  if (config.claimEnabled && category.claimEnabled) {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId('ticket-claim')
        .setLabel('Claim')
        .setStyle(ButtonStyle.Primary)
    );
  }

  // Transcript button
  if (config.transcriptEnabled) {
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId('ticket-transcript')
        .setLabel('Transcript')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  components.push(buttonRow);

  // Priority selector if enabled
  if (config.priorityEnabled) {
    const priorityRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket-priority')
        .setPlaceholder('Set priority...')
        .addOptions(
          { label: 'Low', value: 'low', emoji: '🟢' },
          { label: 'Medium', value: 'medium', emoji: '🟡' },
          { label: 'High', value: 'high', emoji: '🔴' },
          { label: 'Urgent', value: 'urgent', emoji: '🚨' }
        )
    );
    components.push(priorityRow);
  }

  return { embed, components };
}

/**
 * Build ticket panel embed
 */
export function buildPanelEmbed(
  panel: TicketPanel,
  categories: TicketCategory[]
): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor((panel.color || Colors.Primary) as any)
    .setTitle(panel.title)
    .setDescription(panel.description);

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  const applicableCategories = categories.filter((c) => panel.categoryIds.includes(c.id));

  if (panel.type === 'button') {
    // One button per category
    for (const category of applicableCategories) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket-create:${category.id}`)
          .setLabel(`${category.emoji || ''} ${category.name}`.trim())
          .setStyle(ButtonStyle.Primary)
      );
      components.push(row);
    }
  } else {
    // Dropdown with all categories
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket-create-dropdown')
        .setPlaceholder('Select a ticket category...')
        .addOptions(
          applicableCategories.map((c) => ({
            label: c.name,
            value: c.id,
            emoji: c.emoji,
            description: c.description,
          }))
        )
    );
    components.push(row);
  }

  return { embed, components };
}

/**
 * Build feedback prompt embed
 */
export function buildFeedbackPrompt(ticketNumber: number): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setColor(Colors.Primary)
    .setTitle('Ticket Feedback')
    .setDescription(
      `Thank you for using our support system!\n\nPlease rate your experience for Ticket #${ticketNumber}:`
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket-feedback:1')
      .setLabel('1 ⭐')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket-feedback:2')
      .setLabel('2 ⭐')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket-feedback:3')
      .setLabel('3 ⭐')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket-feedback:4')
      .setLabel('4 ⭐')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket-feedback:5')
      .setLabel('5 ⭐')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, components: [row] };
}

// ============================================================================
// STATISTICS & QUERIES
// ============================================================================

/**
 * Get open ticket count for user
 */
export async function getOpenTicketCount(
  guildId: string,
  userId: string
): Promise<number> {
  try {
    const db = getDb();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(
        and(
          eq(tickets.guildId, guildId),
          eq(tickets.userId, userId),
          eq(tickets.status, 'open')
        )
      );

    return result[0]?.count || 0;
  } catch (error) {
    logger.error(`Failed to get open ticket count:`, error);
    return 0;
  }
}

/**
 * Get ticket statistics for guild
 */
export async function getTicketStats(
  guildId: string
): Promise<{
  open: number;
  closedToday: number;
  closedWeek: number;
  avgResponseMinutes: number;
}> {
  try {
    const db = getDb();

    // Open tickets
    const openResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(and(eq(tickets.guildId, guildId), eq(tickets.status, 'open')));

    const open = openResult[0]?.count || 0;

    // Closed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closedTodayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(
        and(
          eq(tickets.guildId, guildId),
          eq(tickets.status, 'closed'),
          sql`${tickets.closedAt} >= ${today}`
        )
      );

    const closedToday = closedTodayResult[0]?.count || 0;

    // Closed this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const closedWeekResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tickets)
      .where(
        and(
          eq(tickets.guildId, guildId),
          eq(tickets.status, 'closed'),
          sql`${tickets.closedAt} >= ${weekAgo}`
        )
      );

    const closedWeek = closedWeekResult[0]?.count || 0;

    // Average response time (placeholder - would need additional timestamp tracking)
    const avgResponseMinutes = 0;

    return {
      open,
      closedToday,
      closedWeek,
      avgResponseMinutes,
    };
  } catch (error) {
    logger.error(`Failed to get ticket stats:`, error);
    return {
      open: 0,
      closedToday: 0,
      closedWeek: 0,
      avgResponseMinutes: 0,
    };
  }
}

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Log ticket action to log channel
 */
export async function logTicketAction(
  guild: Guild,
  config: TicketConfig,
  action: string,
  ticketNumber: number,
  userId: string,
  details?: string
): Promise<void> {
  try {
    if (!config.logChannelId) {
      return;
    }

    const logChannel = (await guild.channels.fetch(config.logChannelId)) as TextChannel;
    if (!logChannel) {
      logger.warn(`Log channel ${config.logChannelId} not found`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.Info)
      .setTitle(`${action} - Ticket #${ticketNumber}`)
      .addFields({
        name: 'User',
        value: `<@${userId}>`,
        inline: true,
      })
      .setTimestamp();

    if (details) {
      embed.addFields({
        name: 'Details',
        value: details,
        inline: false,
      });
    }

    await (logChannel as any).send({ embeds: [embed] });
  } catch (error) {
    logger.error(`Failed to log ticket action:`, error);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types exported inline above
