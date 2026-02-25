import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getActiveCall,
  getUserphoneConfig,
  isOnCallCooldown,
  isServerBanned,
  isContact,
  getContacts,
  createDirectCallRequest,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('directcall')
    .setDescription('Request a direct call with a saved contact')
    .addStringOption(opt =>
      opt.setName('server_id')
        .setDescription('Server ID of the contact to call')
        .setRequired(true)) as SlashCommandBuilder,

  module: 'userphone',
  permissionPath: 'userphone.directcall',
  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const channel = interaction.channel!;
    const targetGuildId = interaction.options.getString('server_id', true);
    const config = await getUserphoneConfig(guild.id);

    // Check allowed channels
    if (config.allowedChannels.length > 0 && !config.allowedChannels.includes(channel.id)) {
      await interaction.reply({
        content: `❌ Userphone can only be used in: ${config.allowedChannels.map(id => `<#${id}>`).join(', ')}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if already in a call
    const existingCall = await getActiveCall(channel.id);
    if (existingCall) {
      await interaction.reply({
        content: '📞 This channel already has an active call. Use `/hangup` to end it first.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check cooldown
    if (await isOnCallCooldown(guild.id, channel.id)) {
      await interaction.reply({
        content: '⏳ Please wait before starting another call.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check ban
    if (await isServerBanned(guild.id)) {
      await interaction.reply({
        content: '🚫 This server has been restricted from using userphone.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if target is banned
    if (await isServerBanned(targetGuildId)) {
      await interaction.reply({
        content: '❌ That server is currently restricted from using userphone.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if it's a saved contact
    const contactExists = await isContact(guild.id, targetGuildId);
    if (!contactExists) {
      await interaction.reply({
        content: '❌ That server is not in your contacts. Save a contact after a call using the **Save Contact** button.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if target guild is accessible
    const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
    if (!targetGuild) {
      await interaction.reply({
        content: '❌ Cannot reach that server. The bot may no longer be in it.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Find the target's allowed channel(s)
    const targetConfig = await getUserphoneConfig(targetGuildId);
    let targetChannelId: string | null = null;

    if (targetConfig.allowedChannels.length > 0) {
      // Try each allowed channel until we find one that exists
      for (const chId of targetConfig.allowedChannels) {
        const ch = await targetGuild.channels.fetch(chId).catch(() => null);
        if (ch && 'send' in ch) {
          targetChannelId = chId;
          break;
        }
      }
    } else {
      // No channel restriction — find the first text channel we can send to
      const textChannels = targetGuild.channels.cache.filter(
        ch => ch.type === 0 && ch.permissionsFor(targetGuild.members.me!)?.has('SendMessages'),
      );
      const firstChannel = textChannels.first();
      if (firstChannel) {
        targetChannelId = firstChannel.id;
      }
    }

    if (!targetChannelId) {
      await interaction.reply({
        content: '❌ Cannot find a valid channel in that server to send the call request to.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    // Create the direct call request
    const requestId = await createDirectCallRequest(
      guild.id,
      guild.name,
      channel.id,
      targetGuildId,
      targetChannelId,
    );

    // Send the request to the target server
    try {
      const targetChannel = await targetGuild.channels.fetch(targetChannelId).catch(() => null);
      if (!targetChannel || !('send' in targetChannel)) {
        await interaction.editReply({ content: '❌ Could not reach the target server channel.' });
        return;
      }

      const requestEmbed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('📞 Incoming Call Request')
        .setDescription(
          `**${guild.name}** wants to start a direct userphone call!\n\n` +
          `Accept to connect immediately, or decline to ignore.`,
        )
        .setFooter({ text: 'This request expires in 2 minutes.' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`userphone_dc_accept_${requestId}`)
          .setLabel('Accept Call')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📞'),
        new ButtonBuilder()
          .setCustomId(`userphone_dc_deny_${requestId}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Secondary),
      );

      await (targetChannel as TextChannel).send({ embeds: [requestEmbed], components: [row] });

      const waitEmbed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('📞 Call Request Sent')
        .setDescription(
          `Waiting for **${targetGuild.name}** to accept your call...\n\n` +
          `The request expires in **2 minutes**.`,
        );

      await interaction.editReply({ embeds: [waitEmbed] });
    } catch (err: any) {
      await interaction.editReply({ content: '❌ Failed to send call request. Please try again.' });
    }
  },
};

export default command;
