import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { getRepConfig } from '../helpers';
import { getModConfig } from '../../Moderation/helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('repconfig')
    .setDescription('View or update reputation settings')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current reputation settings'))
    .addSubcommand(sub =>
      sub.setName('defaultrep')
        .setDescription('Set default reputation for new members')
        .addIntegerOption(opt =>
          opt.setName('amount')
            .setDescription('Default rep value')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('cooldown')
        .setDescription('Set cooldown between giving rep')
        .addIntegerOption(opt =>
          opt.setName('seconds')
            .setDescription('Cooldown in seconds (60-86400)')
            .setRequired(true)
            .setMinValue(60)
            .setMaxValue(86400)))
    .addSubcommand(sub =>
      sub.setName('dailylimit')
        .setDescription('Set max rep a user can give per day')
        .addIntegerOption(opt =>
          opt.setName('limit')
            .setDescription('Daily limit (1-50)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(50)))
    .addSubcommand(sub =>
      sub.setName('decay')
        .setDescription('Configure reputation decay')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable decay')
            .setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('after_days')
            .setDescription('Days of inactivity before decay (7-365)')
            .setMinValue(7)
            .setMaxValue(365))
        .addIntegerOption(opt =>
          opt.setName('amount')
            .setDescription('Rep lost per decay tick')
            .setMinValue(1)
            .setMaxValue(10)))
    .addSubcommand(sub =>
      sub.setName('reactions')
        .setDescription('Configure reaction-based rep')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable reaction rep')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('upvote')
            .setDescription('Upvote emoji'))
        .addStringOption(opt =>
          opt.setName('downvote')
            .setDescription('Downvote emoji')))
    .addSubcommand(sub =>
      sub.setName('logchannel')
        .setDescription('Set the rep log channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Log channel (leave empty to disable)')
            .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
      sub.setName('penalties')
        .setDescription('Configure rep penalty per punishment type')
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('Punishment type')
            .setRequired(true)
            .addChoices(
              { name: 'Warn', value: 'warn' },
              { name: 'Mute', value: 'mute' },
              { name: 'Kick', value: 'kick' },
              { name: 'Temp Ban', value: 'tempban' },
              { name: 'Ban', value: 'ban' },
            ))
        .addIntegerOption(opt =>
          opt.setName('amount')
            .setDescription('Rep to deduct (0-50)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(50)))
    .addSubcommand(sub =>
      sub.setName('viewpenalties')
        .setDescription('View current rep penalties for each punishment'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'reputation',
  permissionPath: 'reputation.repconfig',
  premiumFeature: 'reputation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const config = await getRepConfig(guild.id);
      const modConfig = await getModConfig(guild.id);
      const p = modConfig.reputationPenalties;

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('⭐ Reputation Settings')
        .addFields(
          { name: 'Default Rep', value: `${config.defaultRep}`, inline: true },
          { name: 'Give Cooldown', value: `${config.giveCooldown}s`, inline: true },
          { name: 'Daily Limit', value: `${config.dailyLimit}`, inline: true },
          { name: 'Decay', value: config.decayEnabled ? `✅ After ${config.decayAfterDays}d, -${config.decayAmount}/tick (floor: ${config.decayFloor})` : '❌ Disabled', inline: false },
          { name: 'Reaction Rep', value: config.reactionRepEnabled ? `✅ ${config.upvoteEmoji} / ${config.downvoteEmoji}` : '❌ Disabled', inline: true },
          { name: 'Allow Negative', value: config.allowNegative ? '✅' : '❌', inline: true },
          { name: 'Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set', inline: true },
          { name: 'Penalties', value: `Warn: -${p.warn} · Mute: -${p.mute} · Kick: -${p.kick} · Temp Ban: -${p.tempban} · Ban: -${p.ban}`, inline: false },
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'defaultrep') {
      const amount = interaction.options.getInteger('amount', true);
      await moduleConfig.updateConfig(guild.id, 'reputation', { defaultRep: amount });
      await interaction.reply({ content: `✅ Default reputation set to **${amount}**.` });
      return;
    }

    if (sub === 'cooldown') {
      const seconds = interaction.options.getInteger('seconds', true);
      await moduleConfig.updateConfig(guild.id, 'reputation', { giveCooldown: seconds });
      await interaction.reply({ content: `✅ Rep cooldown set to **${seconds}s**.` });
      return;
    }

    if (sub === 'dailylimit') {
      const limit = interaction.options.getInteger('limit', true);
      await moduleConfig.updateConfig(guild.id, 'reputation', { dailyLimit: limit });
      await interaction.reply({ content: `✅ Daily rep limit set to **${limit}**.` });
      return;
    }

    if (sub === 'decay') {
      const enabled = interaction.options.getBoolean('enabled', true);
      const updates: any = { decayEnabled: enabled };
      const afterDays = interaction.options.getInteger('after_days');
      const amount = interaction.options.getInteger('amount');
      if (afterDays) updates.decayAfterDays = afterDays;
      if (amount) updates.decayAmount = amount;
      await moduleConfig.updateConfig(guild.id, 'reputation', updates);
      await interaction.reply({ content: `✅ Rep decay ${enabled ? 'enabled' : 'disabled'}.${afterDays ? ` After ${afterDays} days.` : ''}${amount ? ` -${amount}/tick.` : ''}` });
      return;
    }

    if (sub === 'reactions') {
      const enabled = interaction.options.getBoolean('enabled', true);
      const updates: any = { reactionRepEnabled: enabled };
      const upvote = interaction.options.getString('upvote');
      const downvote = interaction.options.getString('downvote');
      if (upvote) updates.upvoteEmoji = upvote;
      if (downvote) updates.downvoteEmoji = downvote;
      await moduleConfig.updateConfig(guild.id, 'reputation', updates);
      await interaction.reply({ content: `✅ Reaction rep ${enabled ? 'enabled' : 'disabled'}.${upvote ? ` Upvote: ${upvote}` : ''}${downvote ? ` Downvote: ${downvote}` : ''}` });
      return;
    }

    if (sub === 'logchannel') {
      const channel = interaction.options.getChannel('channel');
      await moduleConfig.updateConfig(guild.id, 'reputation', { logChannelId: channel?.id || null });
      await interaction.reply({ content: channel ? `✅ Rep log channel set to <#${channel.id}>.` : '✅ Rep logging disabled.' });
      return;
    }

    if (sub === 'penalties') {
      const type = interaction.options.getString('type', true) as 'warn' | 'mute' | 'kick' | 'tempban' | 'ban';
      const amount = interaction.options.getInteger('amount', true);

      const modConfig = await getModConfig(guild.id);
      const penalties = { ...modConfig.reputationPenalties, [type]: amount };
      await moduleConfig.updateConfig(guild.id, 'moderation', { reputationPenalties: penalties });

      const typeNames: Record<string, string> = { warn: 'Warn', mute: 'Mute', kick: 'Kick', tempban: 'Temp Ban', ban: 'Ban' };
      await interaction.reply({ content: `✅ **${typeNames[type]}** penalty set to **-${amount}** rep.` });
      return;
    }

    if (sub === 'viewpenalties') {
      const modConfig = await getModConfig(guild.id);
      const p = modConfig.reputationPenalties;

      const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('⚖️ Reputation Penalties')
        .setDescription('Points deducted from reputation per punishment type:')
        .addFields(
          { name: '⚠️ Warn', value: `-${p.warn}`, inline: true },
          { name: '🔇 Mute', value: `-${p.mute}`, inline: true },
          { name: '👢 Kick', value: `-${p.kick}`, inline: true },
          { name: '⏳ Temp Ban', value: `-${p.tempban}`, inline: true },
          { name: '🔨 Ban', value: `-${p.ban}`, inline: true },
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
