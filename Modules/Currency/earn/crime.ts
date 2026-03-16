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
import { addCurrency, removeCurrency, getBalance, checkEarnCooldown, setEarnCooldown, setJail, getCurrencyConfig } from '../helpers';
import { getDb } from '../../../Shared/src/database/connection';
import { sql } from 'drizzle-orm';

const CRIMES = {
  pickpocket: { name: 'Pickpocket', emoji: '👜', successChance: 0.6, minReward: 50, maxReward: 200, failFine: 100 },
  hack: { name: 'Hack ATM', emoji: '🖥️', successChance: 0.4, minReward: 200, maxReward: 600, failFine: 300 },
  heist: { name: 'Bank Heist', emoji: '💎', successChance: 0.25, minReward: 500, maxReward: 1000, failFine: 500 },
};

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.earn',
  cooldown: 2,
  data: new SlashCommandBuilder()
    .setName('earn-crime')
    .setDescription('Commit crimes for coins (120s cooldown)'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      // Check cooldown
      const cooldownRemaining = await checkEarnCooldown(guildId, userId, 'crime');
      if (cooldownRemaining > 0) {
        const container = errorContainer('On Cooldown', `You need to lay low. Wait ${cooldownRemaining}s.`);
        return interaction.reply({ ...v2Payload([container]), ephemeral: true });
      }

      // Create crime buttons
      const buttons = [
        new ButtonBuilder()
          .setCustomId('pickpocket')
          .setLabel('👜 Pickpocket')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('hack')
          .setLabel('🖥️ Hack ATM')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('heist')
          .setLabel('💎 Bank Heist')
          .setStyle(ButtonStyle.Danger)
      ];

      const container = moduleContainer('currency');
      addText(container, '### 🚨 Choose a Crime');
      addText(container, 'Select a criminal activity:');
      addFields(container, [
        { name: '👜 Pickpocket', value: '60% success | 50-200 coins | 100 coin fine', inline: false },
        { name: '🖥️ Hack ATM', value: '40% success | 200-600 coins | 300 coin fine', inline: false },
        { name: '💎 Bank Heist', value: '25% success | 500-1000 coins | 500 coin fine + jail', inline: false }
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

        const crimeType = buttonInteraction.customId as keyof typeof CRIMES;
        const crime = CRIMES[crimeType];

        const config = await getCurrencyConfig(guildId);
        const finalFine = Math.floor(crime.failFine * (config as any).crimeMultiplier || 1.0);

        const success = Math.random() < crime.successChance;
        let description = '';
        let amount = 0;

        const db = getDb();

        if (success) {
          amount = Math.floor(Math.random() * (crime.maxReward - crime.minReward + 1)) + crime.minReward;
          description = `🎉 Success! You committed **${crime.name}** and earned **${amount} coins**!`;

          await addCurrency(guildId, userId, 'coins', amount, 'crime', { crimeType });

          await db.execute(sql`
            INSERT INTO crime_logs (guild_id, user_id, action_type, crime_type, success, amount_gained, created_at)
            VALUES (${guildId}, ${userId}, 'crime', ${crimeType}, true, ${amount}, NOW())
          `);
        } else {
          const balance = await getBalance(guildId, userId);
          const actualFine = Math.min(finalFine, balance.coins);

          if (actualFine > 0) {
            await removeCurrency(guildId, userId, 'coins', actualFine, 'crime_fine', { crimeType });
            description = `❌ You got caught! You paid a **${actualFine} coin fine**.`;
          } else {
            description = `❌ You got caught! You had no coins for the fine.`;
          }

          // Heist gives jail time
          if (crimeType === 'heist') {
            const jailDuration = (config as any).jailDuration || 600;
            await setJail(guildId, userId, jailDuration);
            description += `\n\n🔒 You've been jailed for ${jailDuration} seconds!`;
          }

          await db.execute(sql`
            INSERT INTO crime_logs (guild_id, user_id, action_type, crime_type, success, amount_lost, created_at)
            VALUES (${guildId}, ${userId}, 'crime', ${crimeType}, false, ${actualFine}, NOW())
          `);
        }

        const newBalance = await getBalance(guildId, userId);
        const resultContainer = moduleContainer('currency');
        addText(resultContainer, '### 🚨 Crime Results');
        addText(resultContainer, description);
        addFields(resultContainer, [
          { name: 'Balance', value: `${newBalance.coins.toLocaleString()} coins`, inline: true }
        ]);

        // Set cooldown
        await setEarnCooldown(guildId, userId, 'crime', 120);

        await buttonInteraction.editReply(v2Payload([resultContainer]));
      });

      collector.on('end', async (_, reason) => {
        if (!collected && reason === 'time') {
          const endContainer = errorContainer('Crime Cancelled', 'You took too long to decide. The opportunity passed.');

          // Set cooldown anyway
          await setEarnCooldown(guildId, userId, 'crime', 120);

          try {
            await response.edit(v2Payload([endContainer]));
          } catch {
            // Message already deleted
          }
        }
      });
    } catch (error) {
      console.error('[Earn Crime Error]', error);
      const container = errorContainer('Crime Error', 'An error occurred while planning the crime.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
