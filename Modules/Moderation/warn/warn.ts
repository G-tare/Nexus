import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  createModCase, sendModDM, canModerate, buildModActionContainer,
  getModConfig, ensureGuild, ensureGuildMember, adjustReputation,
  checkWarnThresholds,
} from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { guildMembers } from '../../../Shared/src/database/models/schema';
import { eq, and, sql } from 'drizzle-orm';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the warning').setMaxLength(512))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.warn',
  premiumFeature: 'moderation.basic',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const rawReason = interaction.options.getString('reason');
    const reason = rawReason || 'No reason provided';
    const guild = interaction.guild!;

    const targetMember = await guild.members.fetch(target.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: 'User not found in this server.' });
      return;
    }

    const check = canModerate(interaction.member as any, targetMember, 'warn');
    if (check) {
      await interaction.reply({ content: check });
      return;
    }

    await interaction.deferReply();

    const config = await getModConfig(guild.id);

    // Enforce requireReason
    if (config.requireReason && !rawReason) {
      await interaction.editReply({ content: '❌ This server requires a reason for moderation actions. Please provide a reason.' });
      return;
    }

    await ensureGuild(guild);
    await ensureGuildMember(guild.id, target.id);

    const caseNumber = await createModCase({
      guildId: guild.id,
      action: 'warn',
      targetId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });

    // Increment warn count
    const db = getDb();
    await db.execute(sql`
      UPDATE guild_members SET warn_count = warn_count + 1
      WHERE guild_id = ${guild.id} AND user_id = ${target.id}
    `);

    // Get updated warn count
    const [member] = await db.select({ warnCount: guildMembers.warnCount })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guild.id), eq(guildMembers.userId, target.id)))
      .limit(1);

    const warnCount = member?.warnCount || 1;

    // DM user
    let dmSent = false;
    if (config.dmOnWarn) {
      dmSent = await sendModDM({
        user: target,
        guild,
        action: 'Warning',
        reason,
        caseNumber,
        appealEnabled: config.appealEnabled,
      });
    }

    // Reputation penalty
    if (config.reputationEnabled) {
      await adjustReputation(guild.id, target.id, -config.reputationPenalties.warn, 'Warning', interaction.user.id);
    }

    // Check thresholds for auto-escalation
    await checkWarnThresholds(guild.id, target.id, warnCount, config, guild);

    const container = buildModActionContainer({
      action: 'Warning',
      target,
      moderator: interaction.user,
      reason,
      caseNumber,
      dmSent,
      extraFields: [
        { name: 'Total Warnings', value: `${warnCount}`, inline: true },
      ],
    });

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};

export default command;
