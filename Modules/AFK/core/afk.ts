import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getAFKConfig,
  setAFK,
  isAFKBanned,
  getAFK,
} from '../helpers';

const command: BotCommand = {
  module: 'afk',
  permissionPath: 'afk.afk',
  premium: false,
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status with an optional message')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Your AFK message (max 200 characters)')
        .setRequired(false)
        .setMaxLength(200)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Check if AFK module is enabled
      const config = await getAFKConfig(interaction.guildId!);
      if (!config.enabled) {
        return await interaction.editReply({
          content: '❌ AFK module is disabled in this server.',
        });
      }

      // Check if user is banned from AFK
      const isBanned = await isAFKBanned(interaction.guildId!, interaction.user.id);
      if (isBanned) {
        return await interaction.editReply({
          content: '❌ You are banned from using the AFK system.',
        });
      }

      // Check if already AFK
      const alreadyAFK = await getAFK(interaction.guildId!, interaction.user.id);
      if (alreadyAFK) {
        return await interaction.editReply({
          content: '⚠️ You are already AFK. Remove your AFK status first.',
        });
      }

      const message = interaction.options.getString('message') || 'AFK';

      // Try to update nickname with AFK prefix
      // Store the original nickname — even if null (meaning no custom nick)
      // so we can restore properly when they return
      const memberObj = interaction.member as any;
      const originalNickname: string | null = memberObj?.nickname ?? null;

      try {
        const newNickname = `[AFK] ${originalNickname || interaction.user.username}`.slice(0, 32);
        if (interaction.member && 'setNickname' in interaction.member) {
          await interaction.member.setNickname(newNickname);
        }
      } catch {
        // Nickname change is not critical — bot may lack permission for server owner or higher-ranked roles
      }

      // Set AFK in database — use sentinel "__NONE__" when no nickname, so we know to restore to null
      await setAFK(interaction.guildId!, interaction.user.id, message, originalNickname ?? '__NONE__');

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('✅ AFK Status Set')
        .setDescription(message)
        .addFields({
          name: 'Status',
          value: 'You are now AFK. You will be notified when you return.',
          inline: false,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /afk command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while setting your AFK status.',
      });
    }
  },
};

export default command;
