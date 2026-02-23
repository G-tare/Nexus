# Invite Tracker Module - Code Examples

## Using the Module in Other Modules

### Example 1: Integrate with Moderation's userinfo Command

```typescript
// In Modules/Moderation/core/userinfo.ts

import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getInvitedBy } from '../InviteTracker/helpers';

// In your userinfo command execution:
async execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const embed = new EmbedBuilder()
    .setTitle(`User Info - ${user.tag}`)
    .setThumbnail(user.displayAvatarURL());

  // Add invite info
  try {
    const invitedBy = await getInvitedBy(interaction.guildId!, user.id);
    if (invitedBy) {
      try {
        const inviter = await interaction.client.users.fetch(invitedBy.inviterId);
        embed.addFields({
          name: 'Invited By',
          value: `${inviter.tag} (${inviter})\nInvite Code: \`${invitedBy.code}\`\nJoined: <t:${Math.floor(invitedBy.joinedAt.getTime() / 1000)}:f>`,
          inline: false,
        });
      } catch {
        embed.addFields({
          name: 'Invited By',
          value: `User ID: ${invitedBy.inviterId}\nInvite Code: \`${invitedBy.code}\``,
          inline: false,
        });
      }
    } else {
      embed.addFields({
        name: 'Invited By',
        value: 'Unknown or manually added',
        inline: false,
      });
    }
  } catch (error) {
    console.error('Failed to fetch invite info:', error);
  }

  await interaction.reply({ embeds: [embed] });
}
```

### Example 2: Integrate with Giveaways Module

```typescript
// In Modules/Giveaways/helpers.ts or main giveaway checker

import {
  getInviterStats,
  getInviterStatsInPeriod,
} from '../InviteTracker/helpers';

// Function to check if user meets invite requirement
export async function checkInviteRequirement(
  guildId: string,
  userId: string,
  requirement: {
    type: 'total' | 'period';
    count: number;
    days?: number; // Only for 'period' type
  }
): Promise<boolean> {
  try {
    if (requirement.type === 'total') {
      const stats = await getInviterStats(guildId, userId);
      return stats.real >= requirement.count;
    } else if (requirement.type === 'period' && requirement.days) {
      const recentInvites = await getInviterStatsInPeriod(
        guildId,
        userId,
        requirement.days
      );
      return recentInvites >= requirement.count;
    }
  } catch (error) {
    console.error('Failed to check invite requirement:', error);
    return false;
  }
  return false;
}

// Usage in giveaway entry checker:
// Check if user has 5 invites in last 7 days
const meetsRequirement = await checkInviteRequirement(guildId, userId, {
  type: 'period',
  count: 5,
  days: 7,
});
```

### Example 3: Create a Giveaway Embed with Requirements

```typescript
import { EmbedBuilder } from 'discord.js';
import { getInviterStatsInPeriod } from '../InviteTracker/helpers';

async function buildGiveawayEmbed(
  giveaway: GiveawayData,
  guild: Guild
): Promise<EmbedBuilder> {
  const embed = new EmbedBuilder()
    .setTitle(giveaway.prize)
    .setColor('#5865F2');

  // Add requirements
  const requirements = [];
  for (const req of giveaway.requirements) {
    if (req.type === 'invites') {
      if (req.period) {
        requirements.push(`• ${req.count} invites in last ${req.period} days`);
      } else {
        requirements.push(`• ${req.count} total invites`);
      }
    }
  }

  if (requirements.length > 0) {
    embed.addFields({
      name: 'Requirements',
      value: requirements.join('\n'),
    });
  }

  embed.addFields({
    name: 'Winners',
    value: giveaway.winners.toString(),
  });

  return embed;
}
```

## Event Handling Examples

### Example 1: React to Invite Events

```typescript
// In your main bot initialization or a custom module

import { eventBus } from '../../src/events';

// Listen for new invites
eventBus.on('inviteTracked', async (data) => {
  console.log(`Member ${data.joinedUserId} was invited by ${data.inviterId}`);

  // Could trigger other actions:
  // - Update member roles based on inviter's role
  // - Send welcome message
  // - Track stats in external analytics
});

// Listen for leaves
eventBus.on('inviteLeft', async (data) => {
  console.log(`Member ${data.userId} left - ${data.inviterId} lost an invite`);

  // Could trigger:
  // - Remove invite-based roles
  // - Adjust member status
});

// Listen for bonus invites
eventBus.on('bonusInvitesAdded', async (data) => {
  console.log(`Added ${data.count} bonus invites to ${data.userId}`);

  // Could trigger:
  // - Grant special role at certain thresholds
  // - Log moderation action
});
```

### Example 2: Custom Event Handler in Another Module

```typescript
// Example: Auto-role module that grants roles based on invites

import { eventBus } from '../../src/events';
import { getInviterStats } from '../InviteTracker/helpers';

export function setupInviteAutoRole() {
  eventBus.on('inviteTracked', async (data) => {
    const stats = await getInviterStats(data.guildId, data.inviterId);

    const guild = await client.guilds.fetch(data.guildId);
    const member = await guild.members.fetch(data.inviterId);

    // Example: Give role at 10 invites
    if (stats.real === 10) {
      const role = guild.roles.cache.get('ROLE_ID_FOR_10_INVITES');
      if (role) {
        await member.roles.add(role);
        // Send congratulations message
      }
    }

    // Example: Give role at 25 invites
    if (stats.real === 25) {
      const role = guild.roles.cache.get('ROLE_ID_FOR_25_INVITES');
      if (role) {
        await member.roles.add(role);
      }
    }
  });
}
```

## Advanced Usage Examples

### Example 1: Export Invite Statistics

```typescript
import {
  getTopInviters,
  getInviterStats,
} from '../InviteTracker/helpers';
import { createObjectCsvWriter } from 'csv-writer';

// Function to export leaderboard to CSV
export async function exportLeaderboardAsCSV(guildId: string): Promise<string> {
  const topInviters = await getTopInviters(guildId, 100);

  const records = [];
  for (const inviter of topInviters) {
    const stats = await getInviterStats(guildId, inviter.userId);
    try {
      const user = await client.users.fetch(inviter.userId);
      records.push({
        rank: records.length + 1,
        username: user.tag,
        userId: user.id,
        realInvites: stats.real,
        total: stats.total,
        leaves: stats.leaves,
        fakes: stats.fakes,
        bonus: stats.bonus,
      });
    } catch {
      records.push({
        rank: records.length + 1,
        username: 'Unknown',
        userId: inviter.userId,
        realInvites: stats.real,
        total: stats.total,
        leaves: stats.leaves,
        fakes: stats.fakes,
        bonus: stats.bonus,
      });
    }
  }

  // Create CSV and return path
  const csvWriter = createObjectCsvWriter({
    path: `invites_${guildId}_${Date.now()}.csv`,
    header: [
      { id: 'rank', title: 'Rank' },
      { id: 'username', title: 'Username' },
      { id: 'userId', title: 'User ID' },
      { id: 'realInvites', title: 'Real Invites' },
      { id: 'total', title: 'Total' },
      { id: 'leaves', title: 'Leaves' },
      { id: 'fakes', title: 'Fakes' },
      { id: 'bonus', title: 'Bonus' },
    ],
  });

  await csvWriter.writeRecords(records);
  return csvWriter.filename;
}
```

### Example 2: Invite Milestone Notifications

```typescript
import { eventBus } from '../../src/events';
import { getInviterStats } from '../InviteTracker/helpers';

const MILESTONES = [5, 10, 25, 50, 100];

export function setupMilestoneNotifications() {
  eventBus.on('inviteTracked', async (data) => {
    const stats = await getInviterStats(data.guildId, data.inviterId);

    if (MILESTONES.includes(stats.real)) {
      const guild = await client.guilds.fetch(data.guildId);
      const user = await client.users.fetch(data.inviterId);
      const channel = guild.channels.cache.find(
        (ch) => ch.name === 'welcome' || ch.name === 'announcements'
      );

      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎉 Invite Milestone Reached!')
          .setDescription(`${user} has reached **${stats.real} invites**!`)
          .setThumbnail(user.displayAvatarURL());

        await channel.send({ embeds: [embed] });
      }
    }
  });
}
```

### Example 3: Period-Specific Leaderboard Command

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { getTopInviters, buildLeaderboardEmbed } from '../InviteTracker/helpers';

const command = new SlashCommandBuilder()
  .setName('top-inviters-today')
  .setDescription('View top inviters from today')
  .addIntegerOption((opt) =>
    opt.setName('page').setDescription('Page number').setRequired(false).setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const page = interaction.options.getInteger('page') || 1;

  // Get invites from today (last 1 day)
  const topInviters = await getTopInviters(interaction.guildId!, 10, 1);

  const embed = buildLeaderboardEmbed(
    topInviters,
    interaction.guild!.name,
    page,
    1 // 1 day
  );

  await interaction.editReply({ embeds: [embed] });
}
```

### Example 4: Invite Requirement Verification

```typescript
// Advanced giveaway requirement checker

export interface InviteRequirement {
  type: 'total' | 'recent';
  count: number;
  days?: number; // For 'recent' type
}

export async function verifyInviteRequirements(
  guildId: string,
  userId: string,
  requirements: InviteRequirement[]
): Promise<{ passes: boolean; details: string[] }> {
  const details: string[] = [];

  for (const req of requirements) {
    if (req.type === 'total') {
      const stats = await getInviterStats(guildId, userId);
      if (stats.real >= req.count) {
        details.push(`✅ ${stats.real}/${req.count} total invites`);
      } else {
        details.push(`❌ ${stats.real}/${req.count} total invites`);
      }
    } else if (req.type === 'recent' && req.days) {
      const recent = await getInviterStatsInPeriod(guildId, userId, req.days);
      if (recent >= req.count) {
        details.push(`✅ ${recent}/${req.count} invites in last ${req.days} days`);
      } else {
        details.push(`❌ ${recent}/${req.count} invites in last ${req.days} days`);
      }
    }
  }

  const passes = details.every((d) => d.startsWith('✅'));
  return { passes, details };
}
```

## Utility Functions

### Check User Invite Status

```typescript
async function getUserInviteStatus(guildId: string, userId: string) {
  const stats = await getInviterStats(guildId, userId);

  return {
    isTopInviter: stats.real >= 10,
    isActiveinviter: stats.real >= 5,
    hasSuspiciousActivity: stats.fakes > stats.total * 0.5,
    hasBonus: stats.bonus > 0,
    realCount: stats.real,
  };
}
```

### Bulk Update Bonus Invites

```typescript
async function awardBonusInvitesToRole(
  guild: Guild,
  roleId: string,
  bonusAmount: number
) {
  const role = guild.roles.cache.get(roleId);
  if (!role) return;

  const members = await role.members;
  let updated = 0;

  for (const [, member] of members) {
    await addBonusInvites(guild.id, member.id, bonusAmount);
    updated++;
  }

  console.log(`Awarded ${bonusAmount} bonus invites to ${updated} members`);
}
```
