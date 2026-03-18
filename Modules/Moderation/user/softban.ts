import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorContainer } from '../../../Shared/src/utils/componentsV2';
import {
  canModerate,
  createModCase,
  sendModDM,
  buildModActionContainer,
  getModConfig,
  ensureGuild,
  ensureGuildMember,
  adjustReputation,
  deductFine,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Soft ban a user - ban then immediately unban to purge messages')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to soft ban')
        .setRequired(true),
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Reason for soft ban')
        .setMaxLength(512),
    )
    .addIntegerOption(option =>
      option
        .setName('delete_days')
        .setDescription('Days of messages to delete (1-7, default 1)')
        .setMinValue(1)
        .setMaxValue(7),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

  module: 'moderation',
  premiumFeature: 'moderation.basic',
  permissionPath: 'moderation.softban',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('user', true);
    const rawReason = interaction.options.getString('reason');
    const reason = rawReason || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 1;
    const guild = interaction.guild!;
    const moderator = interaction.user;

    const targetMember = await guild.members.fetch(target.id).catch(() => null);

    // Hierarchy check (only if target is in guild)
    if (targetMember) {
      const check = canModerate(interaction.member as GuildMember, targetMember, 'softban');
      if (check) {
        await interaction.reply({
          components: [errorContainer('Cannot Softban', check)],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }
    }

    await interaction.deferReply();

    try {
      const config = await getModConfig(guild.id);

      // Enforce requireReason
      if (config.requireReason && !rawReason) {
        await interaction.editReply({
          components: [errorContainer('Reason Required', 'This server requires a reason for moderation actions. Please provide a reason.')],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }

      // Ensure records
      await ensureGuild(guild);
      await ensureGuildMember(guild.id, target.id);

      // Create case
      const caseNumber = await createModCase({
        guildId: guild.id,
        action: 'softban',
        targetId: target.id,
        moderatorId: moderator.id,
        reason,
      });

      // DM user before softban (uses dmOnBan since softban is a ban variant)
      let dmSent = false;
      if (config.dmOnBan) {
        dmSent = await sendModDM({
          user: target,
          guild,
          action: 'Softban',
          reason,
          caseNumber,
          appealEnabled: config.appealEnabled,
        });
      }

      // Execute ban
      await guild.members.ban(target.id, {
        reason: `[Case #${caseNumber}] ${reason} (by ${moderator.tag})`,
        deleteMessageSeconds: deleteDays * 86400,
      });

      // Immediately unban
      await guild.bans.remove(target.id, `[Case #${caseNumber}] Softban unban`);

      // Adjust reputation
      if (config.reputationEnabled) {
        await adjustReputation(guild.id, target.id, -config.reputationPenalties.ban, 'Softban', moderator.id);
      }

      // Currency fine (uses 'kick' fine since softban is a kick variant)
      await deductFine(guild.id, target.id, 'kick', config);

      // Reply
      const container = buildModActionContainer({
        action: 'Softban',
        target,
        moderator,
        reason,
        caseNumber,
        dmSent,
        extraFields: [
          { name: 'Messages Deleted', value: `Last ${deleteDays} day(s)`, inline: true },
        ],
      });

      await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch (err: any) {
      console.error('Error in softban command:', err);
      await interaction.editReply({
        components: [errorContainer('Softban Failed', `Failed to softban user: ${err.message}`)],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    }
  },
};

export default command;
