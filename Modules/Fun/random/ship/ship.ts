import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Ship two users and get a love percentage')
    .addUserOption((option) =>
      option.setName('user1').setDescription('First user').setRequired(true)
    )
    .addUserOption((option) =>
      option.setName('user2').setDescription('Second user').setRequired(true)
    ),

  module: 'fun',
  permissionPath: 'fun.random.ship',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const user1 = interaction.options.getUser('user1', true);
      const user2 = interaction.options.getUser('user2', true);

      if (user1.id === user2.id) {
        return interaction.reply({
          content: 'You cannot ship someone with themselves!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const combined = user1.id + user2.id;
      let hash = 0;
      for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash = hash & hash;
      }

      const percentage = Math.abs(hash) % 101;
      const shipName = user1.username.slice(0, Math.ceil(user1.username.length / 2)) + user2.username.slice(Math.ceil(user2.username.length / 2));

      const heartBar = '❤️'.repeat(Math.ceil(percentage / 10)) + '🖤'.repeat(10 - Math.ceil(percentage / 10));

      let commentary = '';
      if (percentage <= 20) {
        commentary = 'Not meant to be...';
      } else if (percentage <= 40) {
        commentary = 'Could work with effort.';
      } else if (percentage <= 60) {
        commentary = 'A decent match!';
      } else if (percentage <= 80) {
        commentary = 'Very compatible!';
      } else {
        commentary = 'Soulmates! 💕';
      }

      const container = moduleContainer('fun');
      addFields(container, [
        { name: 'Ship Name', value: shipName, inline: false },
        { name: 'Love %', value: `${percentage}%`, inline: false },
        { name: 'Compatibility', value: heartBar, inline: false },
        { name: 'Comment', value: commentary, inline: false }
      ]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Ship error:', error);
      await interaction.reply({
        content: 'Failed to ship users.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
