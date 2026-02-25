import {
  Events,
  Message,
  Client,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Interaction,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
} from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getActiveCall,
  getOtherSide,
  relayMessage,
  endCall,
  extendCall,
  getUserphoneConfig,
  storeLastCallInfo,
  getLastCallInfo,
  submitReport,
  addToBlacklist,
  formatDuration,
  saveContact,
  isContact,
  getContactRequest,
  deleteContactRequest,
  createContactRequest,
  getDirectCallRequest,
  deleteDirectCallRequest,
  startCall,
} from './helpers';
import { getRedis } from '../../Shared/src/database/connection';

const logger = createModuleLogger('Userphone:Events');

/**
 * Build the post-call action row (report + save contact).
 */
function buildPostCallRow(callId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`userphone_save_contact_${callId}`)
      .setLabel('Save Contact')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📒'),
    new ButtonBuilder()
      .setCustomId(`userphone_report_${callId}`)
      .setLabel('Report Server')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚩'),
  );
}

/**
 * Send end-of-call message with report button to a channel.
 */
async function sendCallEndMessage(
  channel: TextChannel,
  content: string,
  callId: string,
): Promise<void> {
  const row = buildPostCallRow(callId);
  await channel.send({ content, components: [row] }).catch(() => {});
}

/**
 * Relay messages during active calls.
 */
const messageRelayHandler: ModuleEvent = {
  event: Events.MessageCreate,
  async handler(message: Message) {
    if (!message.guild || message.author.bot) return;
    if (!message.content && message.attachments.size === 0) return;

    // Check if this channel has an active call
    const call = await getActiveCall(message.channel.id);
    if (!call) return;

    // Get the other side
    const otherSide = getOtherSide(call, message.channel.id);
    if (!otherSide) return;

    // Check if channel is allowed
    const config = await getUserphoneConfig(message.guild.id);
    if (config.allowedChannels.length > 0 && !config.allowedChannels.includes(message.channel.id)) return;

    // Check max duration
    const elapsed = (Date.now() - call.startedAt) / 1000;
    if (call.maxDuration > 0 && elapsed > call.maxDuration) {
      const redis = getRedis();
      const promptKey = `userphone:extend_prompt:${call.callId}`;
      const alreadyPrompted = await redis.get(promptKey);

      if (alreadyPrompted === 'pending') {
        return;
      }

      if (alreadyPrompted === 'declined') {
        // Store last call info for reporting
        const mySide = call.side1.channelId === message.channel.id ? call.side1 : call.side2;
        await storeLastCallInfo(mySide.channelId, call.callId, otherSide.guildId, otherSide.guildName);
        await storeLastCallInfo(otherSide.channelId, call.callId, mySide.guildId, mySide.guildName);

        await endCall(call.callId);
        await sendCallEndMessage(
          message.channel as TextChannel,
          '📞 **Call ended** — maximum duration reached.',
          call.callId,
        );
        try {
          const otherGuild = message.client.guilds.cache.get(otherSide.guildId);
          if (otherGuild) {
            const otherChannel = await otherGuild.channels.fetch(otherSide.channelId).catch(() => null);
            if (otherChannel && 'send' in otherChannel) {
              await sendCallEndMessage(
                otherChannel as TextChannel,
                '📞 **Call ended** — maximum duration reached.',
                call.callId,
              );
            }
          }
        } catch {}
        return;
      }

      // First time hitting the limit — send confirmation buttons
      await redis.setex(promptKey, 120, 'pending');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`userphone_extend_${call.callId}`)
          .setLabel('Continue Call')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📞'),
        new ButtonBuilder()
          .setCustomId(`userphone_end_${call.callId}`)
          .setLabel('End Call')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔚'),
      );

      const promptMsg = await (message.channel as any).send({
        content: `⏰ **Maximum call duration reached!** Would you like to continue the call for another ${Math.floor(call.maxDuration / 60)} minutes?`,
        components: [row],
      }).catch(() => null);

      if (!promptMsg) {
        await endCall(call.callId);
        return;
      }

      try {
        const response = await promptMsg.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 120_000,
        });

        if (response.customId === `userphone_extend_${call.callId}`) {
          const extended = await extendCall(call.callId);
          if (extended) {
            await redis.del(promptKey);
            await response.update({
              content: `📞 **Call extended!** You have another ${Math.floor(call.maxDuration / 60)} minutes. Keep chatting!`,
              components: [],
            });
          } else {
            await response.update({ content: '📞 **Call already ended.**', components: [] });
          }
        } else {
          await redis.setex(promptKey, 10, 'declined');

          // Store last call info for reporting
          const mySide = call.side1.channelId === message.channel.id ? call.side1 : call.side2;
          await storeLastCallInfo(mySide.channelId, call.callId, otherSide.guildId, otherSide.guildName);
          await storeLastCallInfo(otherSide.channelId, call.callId, mySide.guildId, mySide.guildName);

          await endCall(call.callId);
          await response.update({
            content: '📞 **Call ended.** Thanks for chatting!',
            components: [buildPostCallRow(call.callId)],
          });

          try {
            const otherGuild = message.client.guilds.cache.get(otherSide.guildId);
            if (otherGuild) {
              const otherChannel = await otherGuild.channels.fetch(otherSide.channelId).catch(() => null);
              if (otherChannel && 'send' in otherChannel) {
                await sendCallEndMessage(
                  otherChannel as TextChannel,
                  '📞 **Call ended** — the other side ended the call.',
                  call.callId,
                );
              }
            }
          } catch {}
        }
      } catch {
        await redis.setex(promptKey, 10, 'declined');

        const mySide = call.side1.channelId === message.channel.id ? call.side1 : call.side2;
        await storeLastCallInfo(mySide.channelId, call.callId, otherSide.guildId, otherSide.guildName);
        await storeLastCallInfo(otherSide.channelId, call.callId, mySide.guildId, mySide.guildName);

        await endCall(call.callId);
        await promptMsg.edit({
          content: '📞 **Call ended** — no response to continue.',
          components: [buildPostCallRow(call.callId)],
        }).catch(() => {});

        try {
          const otherGuild = message.client.guilds.cache.get(otherSide.guildId);
          if (otherGuild) {
            const otherChannel = await otherGuild.channels.fetch(otherSide.channelId).catch(() => null);
            if (otherChannel && 'send' in otherChannel) {
              await sendCallEndMessage(
                otherChannel as TextChannel,
                '📞 **Call ended** — maximum duration reached.',
                call.callId,
              );
            }
          }
        } catch {}
      }

      return;
    }

    // Get other side config for showServerName
    const otherConfig = await getUserphoneConfig(otherSide.guildId);

    // Relay the message
    try {
      const client = message.client;
      const otherGuild = client.guilds.cache.get(otherSide.guildId);
      if (!otherGuild) {
        const mySide = call.side1.channelId === message.channel.id ? call.side1 : call.side2;
        await storeLastCallInfo(mySide.channelId, call.callId, otherSide.guildId, otherSide.guildName);
        await endCall(call.callId);
        await sendCallEndMessage(
          message.channel as TextChannel,
          '📞 **Call ended** — the other server is no longer available.',
          call.callId,
        );
        return;
      }

      const targetChannel = await otherGuild.channels.fetch(otherSide.channelId).catch(() => null) as TextChannel | null;
      if (!targetChannel) {
        const mySide = call.side1.channelId === message.channel.id ? call.side1 : call.side2;
        await storeLastCallInfo(mySide.channelId, call.callId, otherSide.guildId, otherSide.guildName);
        await endCall(call.callId);
        await sendCallEndMessage(
          message.channel as TextChannel,
          '📞 **Call ended** — the other channel was deleted.',
          call.callId,
        );
        return;
      }

      await relayMessage(message, call, targetChannel, otherConfig.showServerName);
    } catch (err: any) {
      logger.error('Message relay error', { error: err.message });
    }
  },
};

/**
 * Handle report button interactions and the report modal flow.
 */
const reportButtonHandler: ModuleEvent = {
  event: Events.InteractionCreate,
  async handler(interaction: Interaction) {
    // Handle report button click -> show modal
    if (interaction.isButton() && interaction.customId.startsWith('userphone_report_')) {
      const callId = interaction.customId.replace('userphone_report_', '');

      const modal = new ModalBuilder()
        .setCustomId(`userphone_report_modal_${callId}`)
        .setTitle('Report Server');

      const reasonInput = new TextInputBuilder()
        .setCustomId('report_reason')
        .setLabel('Why are you reporting this server?')
        .setPlaceholder('Describe what happened during the call...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
      return;
    }

    // Handle modal submit
    if (interaction.isModalSubmit() && interaction.customId.startsWith('userphone_report_modal_')) {
      const callId = interaction.customId.replace('userphone_report_modal_', '');
      const reason = interaction.fields.getTextInputValue('report_reason');

      if (!interaction.guild) {
        await interaction.reply({ content: '❌ This can only be used in a server.', ephemeral: true });
        return;
      }

      // Get last call info to find out who was reported
      const lastCall = await getLastCallInfo(interaction.channel?.id || '');
      if (!lastCall || lastCall.callId !== callId) {
        await interaction.reply({
          content: '❌ Report window has expired. Reports must be submitted within 10 minutes of the call ending.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        const reportId = await submitReport(
          callId,
          interaction.guild.id,
          interaction.user.id,
          lastCall.otherGuildId,
          reason,
        );

        // Confirmation embed with blacklist option
        const confirmEmbed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('🚩 Report Submitted')
          .setDescription(
            `Your report (#${reportId}) has been filed and will be reviewed by the bot staff.\n\n` +
            `**Reported Server:** ${lastCall.otherGuildName} (\`${lastCall.otherGuildId}\`)\n` +
            `**Reason:** ${reason}\n\n` +
            `Would you also like to **blacklist** this server so they can't match with your server again?`,
          )
          .setFooter({ text: 'The transcript has been saved with the report.' });

        const blacklistRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`userphone_blacklist_yes_${lastCall.otherGuildId}`)
            .setLabel('Yes, Blacklist')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🚫'),
          new ButtonBuilder()
            .setCustomId(`userphone_blacklist_no_${lastCall.otherGuildId}`)
            .setLabel('No, Skip')
            .setStyle(ButtonStyle.Secondary),
        );

        await interaction.editReply({
          embeds: [confirmEmbed],
          components: [blacklistRow],
        });
      } catch (err: any) {
        logger.error('Failed to submit report', { error: err.message });
        await interaction.editReply({ content: '❌ Failed to submit report. Please try again.' });
      }
      return;
    }

    // Handle blacklist yes/no buttons after report
    if (interaction.isButton() && interaction.customId.startsWith('userphone_blacklist_')) {
      const parts = interaction.customId.split('_');
      const action = parts[2]; // 'yes' or 'no'
      const targetGuildId = parts.slice(3).join('_');

      if (!interaction.guild) return;

      if (action === 'yes') {
        await addToBlacklist(interaction.guild.id, targetGuildId);
        await (interaction as ButtonInteraction).update({
          content: '✅ **Report submitted and server blacklisted.** They will no longer be able to match with your server.',
          embeds: [],
          components: [],
        });
      } else {
        await (interaction as ButtonInteraction).update({
          content: '✅ **Report submitted.** The bot staff will review it shortly.',
          embeds: [],
          components: [],
        });
      }
      return;
    }

    // ==========================================
    // Save Contact button (after call ends)
    // ==========================================
    if (interaction.isButton() && interaction.customId.startsWith('userphone_save_contact_')) {
      const callId = interaction.customId.replace('userphone_save_contact_', '');

      if (!interaction.guild) return;

      const lastCall = await getLastCallInfo(interaction.channel?.id || '');
      if (!lastCall || lastCall.callId !== callId) {
        await interaction.reply({
          content: '❌ Contact save window has expired.',
          ephemeral: true,
        });
        return;
      }

      // Check if already contacts
      const alreadySaved = await isContact(interaction.guild.id, lastCall.otherGuildId);
      if (alreadySaved) {
        await interaction.reply({
          content: '📒 You already have this server saved as a contact!',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Send consent request to the other server
      try {
        const otherGuild = interaction.client.guilds.cache.get(lastCall.otherGuildId);
        if (!otherGuild) {
          await interaction.editReply({ content: '❌ Cannot reach the other server.' });
          return;
        }

        // Find the other channel from the last call info
        const otherLastCall = await getLastCallInfo(
          // We need to find the other side's channel — check for their lastcall entry
          // The other side's lastcall stores OUR guild as the contact
          '' // fallback
        );

        // We don't have the other channel ID directly, so look for an allowed channel
        const otherConfig = await getUserphoneConfig(lastCall.otherGuildId);
        let targetChannelId: string | null = null;
        if (otherConfig.allowedChannels.length > 0) {
          for (const chId of otherConfig.allowedChannels) {
            const ch = await otherGuild.channels.fetch(chId).catch(() => null);
            if (ch && 'send' in ch) {
              targetChannelId = chId;
              break;
            }
          }
        } else {
          const textChannels = otherGuild.channels.cache.filter(
            ch => ch.type === 0 && ch.permissionsFor(otherGuild.members.me!)?.has('SendMessages'),
          );
          const first = textChannels.first();
          if (first) targetChannelId = first.id;
        }

        if (!targetChannelId) {
          await interaction.editReply({ content: '❌ Cannot find a channel in the other server to send the request.' });
          return;
        }

        const requestId = await createContactRequest(
          interaction.guild.id,
          interaction.guild.name,
          interaction.channel?.id || '',
          interaction.user.id,
          lastCall.otherGuildId,
          lastCall.otherGuildName,
          targetChannelId,
        );

        const targetChannel = await otherGuild.channels.fetch(targetChannelId).catch(() => null);
        if (!targetChannel || !('send' in targetChannel)) {
          await interaction.editReply({ content: '❌ Cannot send to the other server.' });
          return;
        }

        const consentEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('📒 Contact Request')
          .setDescription(
            `**${interaction.guild.name}** wants to save your server as a userphone contact!\n\n` +
            `If you accept, both servers will be able to use \`/directcall\` to request calls with each other.`,
          )
          .setFooter({ text: 'This request expires in 5 minutes.' });

        const consentRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`userphone_contact_accept_${requestId}`)
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`userphone_contact_deny_${requestId}`)
            .setLabel('Decline')
            .setStyle(ButtonStyle.Secondary),
        );

        await (targetChannel as TextChannel).send({ embeds: [consentEmbed], components: [consentRow] });

        await interaction.editReply({
          content: `📒 Contact request sent to **${lastCall.otherGuildName}**! They need to accept for both servers to be saved.`,
        });
      } catch (err: any) {
        logger.error('Failed to send contact request', { error: err.message });
        await interaction.editReply({ content: '❌ Failed to send contact request.' });
      }
      return;
    }

    // ==========================================
    // Contact request accept/deny
    // ==========================================
    if (interaction.isButton() && interaction.customId.startsWith('userphone_contact_accept_')) {
      const requestId = interaction.customId.replace('userphone_contact_accept_', '');
      const request = await getContactRequest(requestId);

      if (!request) {
        await interaction.reply({ content: '❌ This contact request has expired.', ephemeral: true });
        return;
      }

      if (!interaction.guild) return;

      await saveContact(
        request.requesterGuildId,
        request.requesterGuildName,
        request.targetGuildId,
        request.targetGuildName,
        request.requesterUserId,
      );

      await deleteContactRequest(requestId);

      await (interaction as ButtonInteraction).update({
        content: `📒 **Contact saved!** Both **${request.requesterGuildName}** and **${request.targetGuildName}** can now use \`/directcall\` to connect.`,
        embeds: [],
        components: [],
      });

      // Notify the requester's channel
      try {
        const requesterGuild = interaction.client.guilds.cache.get(request.requesterGuildId);
        if (requesterGuild && request.requesterChannelId) {
          const requesterChannel = await requesterGuild.channels.fetch(request.requesterChannelId).catch(() => null);
          if (requesterChannel && 'send' in requesterChannel) {
            await (requesterChannel as TextChannel).send({
              content: `📒 **${request.targetGuildName}** accepted your contact request! Use \`/directcall ${request.targetGuildId}\` to call them.`,
            });
          }
        }
      } catch {}
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('userphone_contact_deny_')) {
      const requestId = interaction.customId.replace('userphone_contact_deny_', '');
      await deleteContactRequest(requestId);

      await (interaction as ButtonInteraction).update({
        content: '📒 Contact request declined.',
        embeds: [],
        components: [],
      });
      return;
    }

    // ==========================================
    // Direct call accept/deny
    // ==========================================
    if (interaction.isButton() && interaction.customId.startsWith('userphone_dc_accept_')) {
      const requestId = interaction.customId.replace('userphone_dc_accept_', '');
      const request = await getDirectCallRequest(requestId);

      if (!request) {
        await interaction.reply({ content: '❌ This call request has expired.', ephemeral: true });
        return;
      }

      if (!interaction.guild) return;

      await deleteDirectCallRequest(requestId);

      // Start the call directly
      try {
        const requesterGuild = interaction.client.guilds.cache.get(request.requesterGuildId);
        if (!requesterGuild) {
          await interaction.reply({ content: '❌ The requesting server is no longer reachable.', ephemeral: true });
          return;
        }

        const call = await startCall(
          { guildId: request.requesterGuildId, channelId: request.requesterChannelId, guildName: request.requesterGuildName },
          { guildId: interaction.guild.id, channelId: request.targetChannelId, guildName: interaction.guild.name },
        );

        const connectedEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('📞 Connected!')
          .setDescription(`You're now on a direct call with **${request.requesterGuildName}**.\n\nType messages here to talk. Use \`/hangup\` to end the call.`)
          .setFooter({ text: `Max duration: ${call.maxDuration > 0 ? `${Math.floor(call.maxDuration / 60)}m` : 'Unlimited'}` });

        await (interaction as ButtonInteraction).update({
          embeds: [connectedEmbed],
          components: [],
        });

        // Notify the requester
        const requesterChannel = await requesterGuild.channels.fetch(request.requesterChannelId).catch(() => null);
        if (requesterChannel && 'send' in requesterChannel) {
          const reqEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('📞 Connected!')
            .setDescription(`**${interaction.guild.name}** accepted your call!\n\nType messages here to talk. Use \`/hangup\` to end the call.`)
            .setFooter({ text: `Max duration: ${call.maxDuration > 0 ? `${Math.floor(call.maxDuration / 60)}m` : 'Unlimited'}` });

          await (requesterChannel as TextChannel).send({ embeds: [reqEmbed] });
        }
      } catch (err: any) {
        logger.error('Failed to start direct call', { error: err.message });
        await interaction.reply({ content: '❌ Failed to connect the call.', ephemeral: true });
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('userphone_dc_deny_')) {
      const requestId = interaction.customId.replace('userphone_dc_deny_', '');
      const request = await getDirectCallRequest(requestId);
      await deleteDirectCallRequest(requestId);

      await (interaction as ButtonInteraction).update({
        content: '📞 Call request declined.',
        embeds: [],
        components: [],
      });

      // Notify the requester
      if (request) {
        try {
          const requesterGuild = interaction.client.guilds.cache.get(request.requesterGuildId);
          if (requesterGuild) {
            const requesterChannel = await requesterGuild.channels.fetch(request.requesterChannelId).catch(() => null);
            if (requesterChannel && 'send' in requesterChannel) {
              await (requesterChannel as TextChannel).send({
                content: `📞 **${interaction.guild?.name || 'The other server'}** declined your call request.`,
              });
            }
          }
        } catch {}
      }
      return;
    }
  },
};

export const userphoneEvents: ModuleEvent[] = [
  messageRelayHandler,
  reportButtonHandler,
];
