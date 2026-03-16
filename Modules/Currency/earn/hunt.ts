import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  addButtons,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { addCurrency, removeCurrency, getBalance, checkEarnCooldown, setEarnCooldown } from '../helpers';

const ANIMALS = [
  { name: 'Rabbit', emoji: '🐰', baseReward: 50, shootChance: 0.7, trapChance: 0.9, chaseChance: 0.4 },
  { name: 'Deer', emoji: '🦌', baseReward: 150, shootChance: 0.5, trapChance: 0.6, chaseChance: 0.3 },
  { name: 'Wild Boar', emoji: '🐗', baseReward: 200, shootChance: 0.4, trapChance: 0.5, chaseChance: 0.2 },
  { name: 'Fox', emoji: '🦊', baseReward: 100, shootChance: 0.6, trapChance: 0.7, chaseChance: 0.5 },
  { name: 'Pheasant', emoji: '🦃', baseReward: 80, shootChance: 0.8, trapChance: 0.4, chaseChance: 0.6 },
];

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.earn',
  cooldown: 2,
  data: new SlashCommandBuilder()
    .setName('earn-hunt')
    .setDescription('Hunt for animals to sell (60s cooldown)'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      // Check cooldown
      const cooldownRemaining = await checkEarnCooldown(guildId, userId, 'hunt');
      if (cooldownRemaining > 0) {
        const container = errorContainer('On Cooldown', `You're too tired to hunt. Wait ${cooldownRemaining}s.`);
        return interaction.reply({ ...v2Payload([container]), ephemeral: true });
      }

      const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];

      // Create action buttons
      const buttons = [
        new ButtonBuilder()
          .setCustomId('shoot')
          .setLabel('🏹 Shoot')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('trap')
          .setLabel('🪤 Trap')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('chase')
          .setLabel('🏃 Chase')
          .setStyle(ButtonStyle.Secondary)
      ];

      const container = moduleContainer('currency');
      addText(container, '### 🎯 Hunt');
      addText(container, `A wild **${animal.name}** ${animal.emoji} appeared!\n\nChoose your hunting method:`);
      addFields(container, [
        { name: '🏹 Shoot', value: `${Math.round(animal.shootChance * 100)}% success`, inline: true },
        { name: '🪤 Trap', value: `${Math.round(animal.trapChance * 100)}% success`, inline: true },
        { name: '🏃 Chase', value: `${Math.round(animal.chaseChance * 100)}% success`, inline: true }
      ]);
      addButtons(container, buttons);

      await interaction.deferReply();
      const response = await interaction.editReply(v2Payload([container]));

      // Collector
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
        filter: (i) => i.user.id === userId,
      });

      let collected = false;

      collector.on('collect', async (buttonInteraction) => {
        collected = true;
        collector.stop();

        await buttonInteraction.deferReply();

        const method = buttonInteraction.customId;
        let successChance = 0;

        if (method === 'shoot') successChance = animal.shootChance;
        else if (method === 'trap') successChance = animal.trapChance;
        else if (method === 'chase') successChance = animal.chaseChance;

        const success = Math.random() < successChance;
        let description = '';
        let amount = 0;

        if (success) {
          amount = Math.floor(animal.baseReward * (0.8 + Math.random() * 0.4));
          description = `Success! You caught the ${animal.name} and sold it for **${amount} coins**!`;

          // 15% chance of injury
          if (Math.random() < 0.15) {
            const injuryLoss = Math.floor(Math.random() * (100 - 50 + 1)) + 50;
            description += `\n\n⚠️ You got injured! Medical bills cost **${injuryLoss} coins**.`;

            const balance = await getBalance(guildId, userId);
            const finalAmount = Math.max(0, amount - injuryLoss);

            if (finalAmount > 0) {
              await addCurrency(guildId, userId, 'coins', finalAmount, 'hunt');
            }
            amount = finalAmount;
          } else {
            await addCurrency(guildId, userId, 'coins', amount, 'hunt');
          }
        } else {
          description = `The ${animal.name} got away! Better luck next time.`;
        }

        const balance = await getBalance(guildId, userId);
        const resultContainer = moduleContainer('currency');
        addText(resultContainer, '### 🎯 Hunt Results');
        addText(resultContainer, description);
        addFields(resultContainer, [
          { name: 'Balance', value: `${balance.coins.toLocaleString()} coins`, inline: true }
        ]);

        // Set cooldown
        await setEarnCooldown(guildId, userId, 'hunt', 60);

        await buttonInteraction.editReply(v2Payload([resultContainer]));
      });

      collector.on('end', async (_, reason) => {
        if (!collected && reason === 'time') {
          const endContainer = errorContainer('Hunt Failed', 'The animal ran away! You took too long to decide.');

          // Set cooldown anyway
          await setEarnCooldown(guildId, userId, 'hunt', 60);

          try {
            await response.edit(v2Payload([endContainer]));
          } catch {
            // Message already deleted
          }
        }
      });
    } catch (error) {
      console.error('[Earn Hunt Error]', error);
      const container = errorContainer('Hunting Error', 'An error occurred while hunting.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
