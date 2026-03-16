import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';
import { cache } from '../../../Shared/src/cache/cacheManager';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('unlockdown')
    .setDescription('Reverse a server-wide lockdown and unlock all channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,

  module: 'moderation',
  permissionPath: 'moderation.unlockdown',
  premiumFeature: 'moderation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    await interaction.deferReply();

    try {
      const lockdownKey = `lockdown:${guild.id}`;
      const lockdownData = cache.get<any>(lockdownKey);

      if (!lockdownData) {
        await interaction.editReply({
          embeds: [errorEmbed('No Active Lockdown', 'There is no active lockdown to reverse.')],
        });
        return;
      }

      const { channelIds, reason } = lockdownData;
      const everyoneRole = guild.roles.everyone;
      let successCount = 0;
      let failureCount = 0;

      // Unlock all channels
      for (const channelId of channelIds) {
        try {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            await (channel as any).permissionOverwrites.edit(everyoneRole, {
              SendMessages: null,
            }, `Lockdown reversed by ${interaction.user.tag}`);

            successCount++;
          }
        } catch {
          failureCount++;
        }
      }

      // Remove lockdown data from cache
      cache.del(lockdownKey);

      // Reply to user
      const embed = successEmbed('Lockdown Reversed', `Server-wide lockdown has been lifted.`)
        .addFields(
          { name: 'Channels Unlocked', value: `${successCount}`, inline: true },
          { name: 'Failed', value: `${failureCount}`, inline: true },
          { name: 'Previous Reason', value: reason }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Unlockdown error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Failed', 'Could not reverse lockdown. Please check my permissions.')],
      });
    }
  },
};

export default command;
