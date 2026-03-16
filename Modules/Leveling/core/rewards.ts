import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { errorReply, moduleContainer, addText, addFields, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getLevelingConfig } from '../helpers';

const command: BotCommand = {
  module: 'leveling',
  permissionPath: 'leveling.rewards',
  premiumFeature: 'leveling.basic',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('rewards')
    .setDescription('View the level role rewards for this server'),

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const guildId = interaction.guildId!;

      if (!guildId) {
        return interaction.editReply(errorReply('Error', 'This command can only be used in a server.'));
      }

      const config = await getLevelingConfig(guildId);
      const guild = interaction.guild!;

      // Sort level roles by level ascending
      const sortedRoles = [...config.levelRoles].sort((a, b) => a.level - b.level);

      if (sortedRoles.length === 0) {
        const container = moduleContainer('leveling');
        addText(container, '### Level Role Rewards\nNo level rewards have been set up yet.');
        addFooter(container, guild.name);
        return interaction.editReply(v2Payload([container]));
      }

      // Build rewards list
      let description = '';
      for (const reward of sortedRoles) {
        description += `**Level ${reward.level}** → <@&${reward.roleId}>\n`;
      }

      const stackStatus = config.stackRoles
        ? 'Roles stack (you keep all earned roles)'
        : 'Roles replace (you only have the highest level role)';

      const container = moduleContainer('leveling');
      addText(container, `### Level Role Rewards\n${description}`);
      addFields(container, [
        {
          name: 'Stack Mode',
          value: stackStatus,
        }
      ]);
      addFooter(container, guild.name);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Rewards Command Error]', error);
      return interaction.editReply(errorReply('Error', 'An error occurred while fetching the rewards.'));
    }
  }
};

export default command;
