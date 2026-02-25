import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  ChannelType,
  TextChannel,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getVoicePhoneConfig,
  getActiveVoiceCall,
  getOtherSide,
  isOnCooldown,
  isServerBanned,
  isServerTempBanned,
  isUserBanned,
  checkServerEligibility,
  findVoiceMatch,
  joinVoiceQueue,
  leaveVoiceQueue,
  startVoiceCall,
  endVoiceCall,
  setCooldown,
  buildConnectedEmbed,
  buildSearchingEmbed,
  buildCallEndedEmbed,
  buildAppealEmbed,
  formatDuration,
  hasActiveAppeal,
  getAppeal,
  submitAppeal,
  extendClipRetention,
} from '../helpers';
import { VoiceRelay, activeRelays, findRelayByVoiceChannel } from '../relay';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('voicecall')
    .setDescription('Cross-server voice calling')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a cross-server voice call'))
    .addSubcommand(sub =>
      sub.setName('hangup')
        .setDescription('End the current voice call'))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View the current voice call status'))
    .addSubcommand(sub =>
      sub.setName('appeal')
        .setDescription('Appeal a Voice Phone ban')
        .addStringOption(opt =>
          opt.setName('statement')
            .setDescription('Your explanation — why should the ban be lifted?')
            .setRequired(true)
            .setMaxLength(1000)))
    .addSubcommand(sub =>
      sub.setName('appealstatus')
        .setDescription('Check the status of your current appeal')) as SlashCommandBuilder,

  module: 'voicephone',
  permissionPath: 'voicephone.voicecall',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'start': return handleStart(interaction);
      case 'hangup': return handleHangup(interaction);
      case 'status': return handleStatus(interaction);
      case 'appeal': return handleAppeal(interaction);
      case 'appealstatus': return handleAppealStatus(interaction);
    }
  },
};

// ===========================
// /voicecall start
// ===========================
async function handleStart(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild!;
  const member = interaction.member as GuildMember;
  const config = await getVoicePhoneConfig(guild.id);

  // Check if user is in a voice channel
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ You must be in a voice channel to start a voice call.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check allowed channels
  if (config.allowedChannels.length > 0 && !config.allowedChannels.includes(voiceChannel.id)) {
    await interaction.reply({
      content: `❌ Voice calls can only be started from: ${config.allowedChannels.map(id => `<#${id}>`).join(', ')}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if this VC already has an active voice call
  const existingCall = await getActiveVoiceCall(voiceChannel.id);
  if (existingCall) {
    await interaction.reply({
      content: '📞 This voice channel already has an active call. Use `/voicecall hangup` to end it first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check cooldown
  if (await isOnCooldown(guild.id, voiceChannel.id)) {
    await interaction.reply({
      content: '⏳ Please wait before starting another voice call.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if server is globally banned
  if (await isServerBanned(guild.id)) {
    await interaction.reply({
      content: '🚫 This server has been restricted from using voice calls.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if server is temp-banned (safety circumvention)
  const serverTempBan = await isServerTempBanned(guild.id);
  if (serverTempBan.banned) {
    const remaining = serverTempBan.expiresAt ? Math.max(0, Math.floor((serverTempBan.expiresAt - Date.now()) / 1000)) : 0;
    await interaction.reply({
      content: `🚫 This server is temporarily banned from Voice Phone.\n📋 Reason: ${serverTempBan.reason ?? 'Safety violation'}\n⏱️ Expires in: **${formatDuration(remaining)}**`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if user is banned from voice phone (temp or permanent)
  const userBan = await isUserBanned(member.id);
  if (userBan.banned) {
    if (userBan.permanent) {
      const appealId = await hasActiveAppeal(member.id);
      await interaction.reply({
        content: `⛔ You are **permanently banned** from Voice Phone.\n📋 Reason: ${userBan.reason ?? 'Repeated violations'}\n\n` +
          (appealId ? `📝 You have a pending appeal: \`${appealId}\`` : 'You can submit an appeal using `/voicecall appeal`.'),
        flags: MessageFlags.Ephemeral,
      });
    } else {
      const remaining = userBan.expiresAt ? Math.max(0, Math.floor((userBan.expiresAt - Date.now()) / 1000)) : 0;
      const banCountMsg = userBan.banNumber ? ` (Ban ${userBan.banNumber}/3 — 3 temp bans = permanent ban)` : '';
      await interaction.reply({
        content: `🚫 You are temporarily banned from Voice Phone.${banCountMsg}\n📋 Reason: ${userBan.reason ?? 'Repeated violations'}\n⏱️ Expires in: **${formatDuration(remaining)}**`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // Check server eligibility (min size, community requirement)
  const eligibilityError = await checkServerEligibility(guild);
  if (eligibilityError) {
    await interaction.reply({
      content: eligibilityError,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  // Try to find a match
  const match = await findVoiceMatch(guild.id, voiceChannel.id);

  if (match) {
    // Found a match — start the voice call
    const call = await startVoiceCall(
      { guildId: guild.id, voiceChannelId: voiceChannel.id, guildName: guild.name },
      { guildId: match.guildId, voiceChannelId: match.voiceChannelId, guildName: match.guildName },
    );

    // Create and initialize the voice relay
    const otherConfig = await getVoicePhoneConfig(match.guildId);
    const relay = new VoiceRelay(
      call.callId,
      guild.id,
      voiceChannel.id,
      match.guildId,
      match.voiceChannelId,
      {
        maxSpeakersPerSide: Math.min(config.maxSpeakersPerSide, otherConfig.maxSpeakersPerSide),
        bitrate: Math.min(config.bitrate, otherConfig.bitrate),
      },
    );

    try {
      await relay.initialize(interaction.client);
      activeRelays.set(call.callId, relay);
    } catch {
      // Failed to connect — clean up
      relay.cleanup();
      await interaction.editReply({
        content: '❌ Failed to establish voice connection. Please try again.',
      });
      return;
    }

    // Send connected embed to this side
    const maxDurText = call.maxDuration > 0 ? `${Math.floor(call.maxDuration / 60)}m` : 'Unlimited';
    const embed1 = buildConnectedEmbed(
      config.showServerName ? match.guildName : 'another server',
      true,
    ).setFooter({ text: `Max duration: ${maxDurText}` });

    await interaction.editReply({ embeds: [embed1] });

    // Notify the other side via text channel
    try {
      const otherGuild = interaction.client.guilds.cache.get(match.guildId);
      if (otherGuild) {
        const textChannel = findTextChannel(otherGuild);
        if (textChannel) {
          const embed2 = buildConnectedEmbed(
            otherConfig.showServerName ? guild.name : 'another server',
            true,
          ).setFooter({ text: `Max duration: ${maxDurText}` });

          await textChannel.send({ embeds: [embed2] });
        }
      }
    } catch {
      // Non-critical
    }

    // Set up auto-end timer
    if (call.maxDuration > 0) {
      setTimeout(async () => {
        const activeRelay = activeRelays.get(call.callId);
        if (activeRelay && !activeRelay.isDestroyed) {
          activeRelay.cleanup();
          activeRelays.delete(call.callId);
          const helpers = await import('../helpers');
          await helpers.endVoiceCall(call.callId);
          await helpers.setCooldown(guild.id, voiceChannel.id);
          await helpers.setCooldown(match.guildId, match.voiceChannelId);

          // Notify both sides
          const endEmbed = helpers.buildCallEndedEmbed(call.maxDuration, 'Maximum duration reached');
          try {
            const ch = interaction.channel;
            if (ch && 'send' in ch) await (ch as TextChannel).send({ embeds: [endEmbed] });
          } catch {}
          try {
            const otherGuild = interaction.client.guilds.cache.get(match.guildId);
            if (otherGuild) {
              const textCh = findTextChannel(otherGuild);
              if (textCh) await textCh.send({ embeds: [endEmbed] });
            }
          } catch {}
        }
      }, call.maxDuration * 1000);
    }
  } else {
    // No match — join the queue
    await joinVoiceQueue(guild.id, voiceChannel.id, guild.name);

    const embed = buildSearchingEmbed();
    await interaction.editReply({ embeds: [embed] });
  }
}

// ===========================
// /voicecall hangup
// ===========================
async function handleHangup(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild!;
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ You must be in a voice channel to hang up a voice call.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const call = await getActiveVoiceCall(voiceChannel.id);

  if (!call) {
    // Maybe they're in the queue — leave it
    await leaveVoiceQueue(voiceChannel.id);
    await interaction.reply({
      content: '📞 No active voice call found. Cancelled any pending search.',
    });
    return;
  }

  await interaction.deferReply();

  const duration = Math.floor((Date.now() - call.startedAt) / 1000);

  // Clean up the audio relay
  const relay = activeRelays.get(call.callId);
  if (relay) {
    relay.cleanup();
    activeRelays.delete(call.callId);
  }

  // End the call in Redis + save history
  await endVoiceCall(call.callId);

  // Set cooldowns for both sides
  await setCooldown(call.side1.guildId, call.side1.voiceChannelId);
  await setCooldown(call.side2.guildId, call.side2.voiceChannelId);

  // Send "Call Ended" embed
  const embed = buildCallEndedEmbed(duration, 'Hung up');
  await interaction.editReply({ embeds: [embed] });

  // Notify the other side
  const otherSide = getOtherSide(call, voiceChannel.id);
  if (otherSide) {
    try {
      const otherGuild = interaction.client.guilds.cache.get(otherSide.guildId);
      if (otherGuild) {
        const textChannel = otherGuild.channels.cache
          .filter(ch => ch.type === ChannelType.GuildText)
          .filter(ch => {
            const perms = ch.permissionsFor(otherGuild.members.me!);
            return perms?.has('SendMessages') ?? false;
          })
          .first() as TextChannel | undefined;

        if (textChannel) {
          const otherEmbed = buildCallEndedEmbed(duration, 'The other server hung up');
          await textChannel.send({ embeds: [otherEmbed] });
        }
      }
    } catch {
      // Non-critical
    }
  }
}

// ===========================
// /voicecall status
// ===========================
async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild!;
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({
      content: '❌ You must be in a voice channel to check call status.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const call = await getActiveVoiceCall(voiceChannel.id);
  if (!call) {
    await interaction.reply({
      content: '📞 No active voice call in this channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const config = await getVoicePhoneConfig(guild.id);
  const otherSide = getOtherSide(call, voiceChannel.id);
  const relay = findRelayByVoiceChannel(voiceChannel.id);

  const elapsed = Math.floor((Date.now() - call.startedAt) / 1000);
  const remaining = call.maxDuration > 0 ? Math.max(0, call.maxDuration - elapsed) : 0;

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('📞 Voice Call Status')
    .addFields(
      {
        name: 'Connected To',
        value: config.showServerName && otherSide
          ? `**${otherSide.guildName}**`
          : 'Another server',
        inline: true,
      },
      {
        name: 'Duration',
        value: `**${formatDuration(elapsed)}**`,
        inline: true,
      },
      {
        name: 'Time Remaining',
        value: call.maxDuration > 0
          ? `**${formatDuration(remaining)}**`
          : '**Unlimited**',
        inline: true,
      },
    );

  if (relay) {
    const side1Speakers = relay.getSpeakerCount('side1');
    const side2Speakers = relay.getSpeakerCount('side2');
    const mySide = relay.side1.voiceChannelId === voiceChannel.id ? 'side1' : 'side2';
    const theirSide = mySide === 'side1' ? 'side2' : 'side1';

    embed.addFields(
      {
        name: 'Your Side — Active Speakers',
        value: `**${mySide === 'side1' ? side1Speakers : side2Speakers}** / ${config.maxSpeakersPerSide}`,
        inline: true,
      },
      {
        name: 'Other Side — Active Speakers',
        value: `**${theirSide === 'side1' ? side1Speakers : side2Speakers}**`,
        inline: true,
      },
      {
        name: 'Audio Bitrate',
        value: `**${config.bitrate / 1000}kbps**`,
        inline: true,
      },
    );
  }

  embed
    .setFooter({ text: `Call ID: ${call.callId}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// ===========================
// /voicecall appeal
// ===========================
async function handleAppeal(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;

  // Check if the user is actually banned
  const banStatus = await isUserBanned(userId);
  if (!banStatus.banned) {
    await interaction.reply({
      content: '✅ You are not currently banned from Voice Phone. No appeal needed!',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if they already have a pending appeal
  const existingAppealId = await hasActiveAppeal(userId);
  if (existingAppealId) {
    const existingAppeal = await getAppeal(existingAppealId);
    const statusText = existingAppeal?.status === 'pending'
      ? '⏳ **Pending review**'
      : existingAppeal?.status === 'approved'
        ? '✅ **Approved**'
        : existingAppeal?.status === 'denied'
          ? '❌ **Denied**'
          : '⏳ **Pending**';

    await interaction.reply({
      content: `📝 You already have an active appeal.\n\n🆔 Appeal ID: \`${existingAppealId}\`\nStatus: ${statusText}\n\nYou cannot submit a new appeal until the current one is resolved.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const statement = interaction.options.getString('statement', true);
  const banType = banStatus.permanent ? 'permanent' : 'temp' as const;

  const appeal = await submitAppeal(
    userId,
    interaction.guild?.id ?? 'DM',
    banType,
    statement,
  );

  // Extend retention of any flagged audio clips (7 days → 30 days)
  if (appeal.audioClipIds.length > 0) {
    await extendClipRetention(appeal.audioClipIds);
  }

  const embed = buildAppealEmbed(appeal.appealId, appeal.audioClipIds.length);
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ===========================
// /voicecall appealstatus
// ===========================
async function handleAppealStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const appealId = await hasActiveAppeal(userId);

  if (!appealId) {
    await interaction.reply({
      content: '📝 You have no active appeals. If you\'re banned, use `/voicecall appeal` to file one.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const appeal = await getAppeal(appealId);
  if (!appeal) {
    await interaction.reply({
      content: '❌ Could not load your appeal. It may have expired. You can submit a new one with `/voicecall appeal`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const statusEmoji = appeal.status === 'pending' ? '⏳' : appeal.status === 'approved' ? '✅' : '❌';
  const statusText = appeal.status === 'pending'
    ? 'Pending review'
    : appeal.status === 'approved'
      ? 'Approved — your ban has been lifted'
      : `Denied${appeal.resolution ? ` — ${appeal.resolution}` : ''}`;

  const ageMs = Date.now() - appeal.createdAt;
  const ageHours = Math.floor(ageMs / 3_600_000);
  const ageDays = Math.floor(ageHours / 24);
  const ageText = ageDays > 0 ? `${ageDays}d ${ageHours % 24}h ago` : `${ageHours}h ago`;

  await interaction.reply({
    content: [
      '📝 **Your Voice Phone Appeal**',
      '',
      `🆔 Appeal ID: \`${appealId}\``,
      `${statusEmoji} Status: **${statusText}**`,
      `📅 Submitted: ${ageText}`,
      `🎙️ Audio clips: **${appeal.audioClipIds.length}**`,
      `📋 Ban type: **${appeal.banType}**`,
      '',
      appeal.status === 'pending'
        ? '*Your appeal is being reviewed. You will be notified when a decision is made.*'
        : '',
    ].filter(Boolean).join('\n'),
    flags: MessageFlags.Ephemeral,
  });
}

// ===========================
// Utility
// ===========================
function findTextChannel(guild: import('discord.js').Guild): TextChannel | null {
  const channels = guild.channels.cache
    .filter(ch => ch.type === ChannelType.GuildText)
    .filter(ch => {
      const perms = ch.permissionsFor(guild.members.me!);
      return perms?.has('SendMessages') ?? false;
    });

  const preferred = channels.find(ch =>
    ch.name.includes('general') || ch.name.includes('chat') || ch.name.includes('bot'),
  );
  return (preferred ?? channels.first() ?? null) as TextChannel | null;
}

export default command;
