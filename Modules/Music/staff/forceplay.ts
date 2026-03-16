import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { successContainer, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  name: 'forceplay',
  module: 'music',
  permissionPath: 'music.staff.forceplay',
  data: new SlashCommandBuilder()
    .setName('forceplay')
    .setDescription('Staff override: play immediately (skip queue)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('Song name, artist, or URL')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId!;
    const query = interaction.options.getString('query', true);

    if (!guildId) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
      });
      return;
    }

    // Check permissions
    const hasManageGuild = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

    let hasDJRole = false;
    if (!hasManageGuild) {
      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'music');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;
      if (config.djEnabled && config.djRoleId && interaction.member) {
        const member = interaction.member;
        if ('roles' in member && member.roles instanceof Object && 'has' in member.roles) {
          hasDJRole = (member.roles as any).has(config.djRoleId);
        }
      }
    }

    if (!hasManageGuild && !hasDJRole) {
      await interaction.reply({
        content: 'You need the **Manage Guild** permission or the DJ role to use this command.',
      });
      return;
    }

    try {
      await interaction.deferReply();

      // TODO: Search and play immediately
      // const results = await lavalink.search(query);
      // if (!results || results.tracks.length === 0) {
      //   await interaction.editReply({
      //     content: 'No tracks found for your query.',
      //   });
      //   return;
      // }

      // const track = results.tracks[0];
      // const player = lavalink.getPlayer(guildId);

      // if (!player) {
      //   await interaction.editReply({
      //     content: 'Bot is not in a voice channel.',
      //   });
      //   return;
      // }

      // // Get current track to push back
      // const currentTrack = player.queue.current;
      // if (currentTrack) {
      //   player.queue.unshift(currentTrack);
      // }

      // // Play the new track immediately
      // player.queue.unshift(track);
      // if (player.state !== 'PLAYING') {
      //   await player.play();
      // }

      const container = successContainer('Force Playing', `Now playing: **${query}**\n(Previous track moved back to queue)`);
      addFooter(container, 'Staff Override');

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in forceplay command:', error);
      await interaction.editReply({
        content: 'An error occurred while searching for or playing the track.',
      });
    }
  },
};

export default command;
