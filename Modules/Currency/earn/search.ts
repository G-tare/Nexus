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

const SEARCH_LOCATIONS = [
  { name: 'Couch Cushions', emoji: '🛋️', min: 5, max: 150, riskLevel: 'low' },
  { name: 'Old Jacket', emoji: '🧥', min: 10, max: 200, riskLevel: 'low' },
  { name: 'Car', emoji: '🚗', min: 20, max: 300, riskLevel: 'medium' },
  { name: 'Dumpster', emoji: '🗑️', min: 15, max: 400, riskLevel: 'high' },
  { name: 'Wallet', emoji: '👛', min: 50, max: 500, riskLevel: 'medium' },
  { name: 'Mattress', emoji: '🛏️', min: 25, max: 350, riskLevel: 'medium' },
  { name: 'Attic', emoji: '🪜', min: 30, max: 250, riskLevel: 'low' },
  { name: 'Basement', emoji: '🕷️', min: 40, max: 200, riskLevel: 'medium' },
  { name: 'Trash Can', emoji: '♻️', min: 10, max: 180, riskLevel: 'high' },
  { name: 'Park Bench', emoji: '🪑', min: 15, max: 220, riskLevel: 'low' },
  { name: 'Phone Drawer', emoji: '📱', min: 5, max: 100, riskLevel: 'low' },
  { name: 'Under Bed', emoji: '🛌', min: 20, max: 280, riskLevel: 'medium' },
  { name: 'Car Trunk', emoji: '🎒', min: 30, max: 350, riskLevel: 'high' },
  { name: 'Kitchen Cabinet', emoji: '🚪', min: 10, max: 150, riskLevel: 'low' },
  { name: 'Junk Drawer', emoji: '📦', min: 15, max: 200, riskLevel: 'medium' },
];

function getRandomLocations(count: number = 3) {
  const shuffled = [...SEARCH_LOCATIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.earn',
  cooldown: 2,
  data: new SlashCommandBuilder()
    .setName('earn-search')
    .setDescription('Search for coins in random locations (45s cooldown)'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      // Check cooldown
      const cooldownRemaining = await checkEarnCooldown(guildId, userId, 'search');
      if (cooldownRemaining > 0) {
        const container = errorContainer('On Cooldown', `You're too tired to search. Wait ${cooldownRemaining}s.`);
        return interaction.reply({ ...v2Payload([container]), ephemeral: true });
      }

      const locations = getRandomLocations(3);
      const selected = locations[Math.floor(Math.random() * locations.length)];

      // Create buttons for location selection
      const buttons = locations.map((loc, idx) =>
        new ButtonBuilder()
          .setCustomId(`search_${idx}`)
          .setLabel(`${loc.emoji} ${loc.name}`)
          .setStyle(ButtonStyle.Primary)
      );

      const container = moduleContainer('currency');
      addText(container, '### 🔍 Where would you like to search?');
      addText(container, 'Choose a location to search for coins!');
      addButtons(container, buttons);

      const response = await interaction.reply(v2Payload([container]));

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

        const selectedIdx = parseInt(buttonInteraction.customId.split('_')[1]);
        const selectedLocation = locations[selectedIdx];

        // Determine results based on risk level
        let amount = 0;
        let outcome = '';

        const roll = Math.random();

        if (selectedLocation.riskLevel === 'low') {
          // Low risk: 70% good, 30% nothing
          if (roll < 0.7) {
            amount = Math.floor(Math.random() * (selectedLocation.max - selectedLocation.min + 1)) + selectedLocation.min;
            outcome = `Found **${amount} coins** in the ${selectedLocation.name.toLowerCase()}!`;
          } else {
            outcome = `The ${selectedLocation.name.toLowerCase()} was empty...`;
          }
        } else if (selectedLocation.riskLevel === 'medium') {
          // Medium: 60% good, 35% nothing, 5% loss
          if (roll < 0.6) {
            amount = Math.floor(Math.random() * (selectedLocation.max - selectedLocation.min + 1)) + selectedLocation.min;
            outcome = `Found **${amount} coins** in the ${selectedLocation.name.toLowerCase()}!`;
          } else if (roll < 0.95) {
            outcome = `Nothing but dust in the ${selectedLocation.name.toLowerCase()}...`;
          } else {
            const balance = await getBalance(guildId, userId);
            const loss = Math.min(50, balance.coins);
            if (loss > 0) {
              await removeCurrency(guildId, userId, 'coins', loss, 'search_loss');
              outcome = `A rat stole **${loss} coins** from you!`;
            } else {
              outcome = 'A rat tried to steal from you, but you had nothing!';
            }
          }
        } else {
          // High: 50% good, 40% nothing, 10% loss
          if (roll < 0.5) {
            amount = Math.floor(Math.random() * (selectedLocation.max - selectedLocation.min + 1)) + selectedLocation.min;
            outcome = `Found **${amount} coins** in the ${selectedLocation.name.toLowerCase()}!`;
          } else if (roll < 0.9) {
            outcome = `The ${selectedLocation.name.toLowerCase()} had nothing valuable...`;
          } else {
            const balance = await getBalance(guildId, userId);
            const loss = Math.min(100, balance.coins);
            if (loss > 0) {
              await removeCurrency(guildId, userId, 'coins', loss, 'search_loss');
              outcome = `You got caught and had to pay **${loss} coins** to escape!`;
            } else {
              outcome = 'You got caught, but had nothing to pay!';
            }
          }
        }

        if (amount > 0) {
          await addCurrency(guildId, userId, 'coins', amount, 'search');
        }

        const newBalance = await getBalance(guildId, userId);
        const resultContainer = moduleContainer('currency');
        addText(resultContainer, '### 🔍 Search Results');
        addText(resultContainer, outcome);
        addFields(resultContainer, [
          { name: 'Balance', value: `${newBalance.coins.toLocaleString()} coins`, inline: true }
        ]);

        // Set cooldown
        await setEarnCooldown(guildId, userId, 'search', 45);

        await buttonInteraction.editReply(v2Payload([resultContainer]));
      });

      collector.on('end', async (_, reason) => {
        if (!collected && reason === 'time') {
          const endContainer = errorContainer('Search Cancelled', 'You took too long to choose a location!');

          try {
            await response.edit(v2Payload([endContainer]));
          } catch {
            // Message already deleted
          }
        }
      });
    } catch (error) {
      console.error('[Earn Search Error]', error);
      const container = errorContainer('Search Error', 'An error occurred while searching.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
