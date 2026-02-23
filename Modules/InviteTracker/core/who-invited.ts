import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ColorResolvable,
  User,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getInviteConfig, getInvitedBy } from '../helpers';
import { getDb, getPool } from '../../../Shared/src/database/connection';
const db = getDb();

const command: BotCommand = {
  module: 'invitetracker',
  permissionPath: 'invitetracker.who-invited',
  premiumFeature: 'invitetracker.basic',
  data: new SlashCommandBuilder()
    .setName('who-invited')
    .setDescription('See who invited a specific user')
    .addUserOption((option) =>
      option.setName('user').setDescription('User to check').setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const config = await getInviteConfig(interaction.guildId!);
    if (!config.enabled) {
      return interaction.editReply({
        content: 'Invite tracking is disabled on this server.',
      });
    }

    const targetUser: User = interaction.options.getUser('user', true);

    try {
      // Check if user was ever in the guild
      const pool = getPool();
      const memberResult = await pool.query(
        `SELECT invited_by FROM guild_members
         WHERE guild_id = $1 AND user_id = $2`,
        [interaction.guildId!, targetUser.id]
      );

      // Get detailed invite record
      const inviteResult = await pool.query(
        `SELECT inviter_id, code, joined_at, is_fake FROM invite_records
         WHERE guild_id = $1 AND user_id = $2 AND left_at IS NULL
         ORDER BY joined_at DESC LIMIT 1`,
        [interaction.guildId!, targetUser.id]
      );

      if (inviteResult.rows.length === 0) {
        return interaction.editReply({
          content: `Could not determine who invited ${targetUser}. They may have been manually added to the server or joined before invite tracking was enabled.`,
        });
      }

      const inviteRecord = inviteResult.rows[0];

      try {
        const inviter = await interaction.client.users.fetch(inviteRecord.inviter_id);

        const embed = new EmbedBuilder()
          .setColor('#5865F2' as ColorResolvable)
          .setTitle(`Who Invited ${targetUser.tag}?`)
          .setDescription(`${targetUser} was invited by ${inviter}`)
          .addFields(
            { name: 'Inviter', value: `<@${inviteRecord.inviter_id}>`, inline: true },
            { name: 'Invite Code', value: inviteRecord.code, inline: true },
            {
              name: 'Joined At',
              value: `<t:${Math.floor(new Date(inviteRecord.joined_at).getTime() / 1000)}:f>`,
              inline: false,
            }
          );

        if (inviteRecord.is_fake) {
          embed.addFields({
            name: 'Status',
            value: '⚠️ Flagged as fake invite',
            inline: false,
          });
        }

        embed.setFooter({ text: interaction.guild!.name });

        return interaction.editReply({ embeds: [embed] });
      } catch {
        // User deleted - show basic info
        const embed = new EmbedBuilder()
          .setColor('#5865F2' as ColorResolvable)
          .setTitle(`Who Invited ${targetUser.tag}?`)
          .setDescription(`${targetUser} was invited by a deleted user`)
          .addFields(
            {
              name: 'Inviter ID',
              value: inviteRecord.inviter_id,
              inline: true,
            },
            { name: 'Invite Code', value: inviteRecord.code, inline: true },
            {
              name: 'Joined At',
              value: `<t:${Math.floor(new Date(inviteRecord.joined_at).getTime() / 1000)}:f>`,
              inline: false,
            }
          );

        if (inviteRecord.is_fake) {
          embed.addFields({
            name: 'Status',
            value: '⚠️ Flagged as fake invite',
            inline: false,
          });
        }

        embed.setFooter({ text: interaction.guild!.name });

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error in /who-invited command:', error);
      return interaction.editReply({
        content: 'An error occurred while fetching invite information.',
      });
    }
  },
};

export default command;
