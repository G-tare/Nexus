import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  addButtons,
  V2Colors,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { addCurrency, getBalance, checkEarnCooldown, setEarnCooldown } from '../helpers';

const FISH_CATCHES = [
  // Common (50%)
  { name: 'Small Trout', emoji: '🐟', min: 20, max: 50, rarity: 'common', weight: 50 },
  { name: 'Minnow', emoji: '🐟', min: 15, max: 40, rarity: 'common', weight: 50 },

  // Uncommon (30%)
  { name: 'Bass', emoji: '🎣', min: 60, max: 150, rarity: 'uncommon', weight: 30 },
  { name: 'Catfish', emoji: '🎣', min: 70, max: 120, rarity: 'uncommon', weight: 30 },

  // Rare (15%)
  { name: 'Salmon', emoji: '🐠', min: 200, max: 400, rarity: 'rare', weight: 15 },
  { name: 'Pike', emoji: '🐠', min: 180, max: 380, rarity: 'rare', weight: 15 },

  // Legendary (5%)
  { name: 'Golden Fish', emoji: '✨🐟', min: 500, max: 1000, rarity: 'legendary', weight: 5 },
];

function selectRandomCatch() {
  const roll = Math.random() * 100;
  let accumulated = 0;

  for (const fish of FISH_CATCHES) {
    accumulated += fish.weight;
    if (roll <= accumulated) {
      return fish;
    }
  }

  return FISH_CATCHES[0];
}

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.earn',
  cooldown: 2,
  data: new SlashCommandBuilder()
    .setName('earn-fish')
    .setDescription('Go fishing for coins (60s cooldown)'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      // Check cooldown
      const cooldownRemaining = await checkEarnCooldown(guildId, userId, 'fish');
      if (cooldownRemaining > 0) {
        const container = errorContainer('On Cooldown', `You need to rest. Wait ${cooldownRemaining}s.`);
        return interaction.reply({ ...v2Payload([container]), ephemeral: true });
      }

      await interaction.deferReply();

      // Casting phase
      const castContainer = moduleContainer('currency');
      addText(castContainer, '### 🎣 Fishing');
      addText(castContainer, 'Casting line...\n\n*Waiting for a bite...*');

      const response = await interaction.editReply(v2Payload([castContainer]));

      // Wait 2-3 seconds
      const waitTime = Math.random() * 1000 + 2000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Reel in button
      const reelButton = new ButtonBuilder()
        .setCustomId('reel_in')
        .setLabel('🎣 Reel In!')
        .setStyle(ButtonStyle.Success);

      const bitingContainer = moduleContainer('currency');
      addText(bitingContainer, '### 🎣 You Got a Bite!');
      addText(bitingContainer, 'A fish is on the line! Click the button to reel it in before it gets away!');
      addButtons(bitingContainer, [reelButton]);

      await response.edit(v2Payload([bitingContainer]));

      // Collector for reel
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 5000,
        filter: (i) => i.user.id === userId,
      });

      let reeled = false;

      collector.on('collect', async (buttonInteraction) => {
        reeled = true;
        collector.stop();

        await buttonInteraction.deferReply();

        // Determine catch
        const fish = selectRandomCatch();
        const amount = Math.floor(Math.random() * (fish.max - fish.min + 1)) + fish.min;

        await addCurrency(guildId, userId, 'coins', amount, 'fish');
        const balance = await getBalance(guildId, userId);

        const rarityColor = {
          common: 0x95a5a6,
          uncommon: 0x2ecc71,
          rare: 0x3498db,
          legendary: 0xf39c12,
        }[fish.rarity] as number;

        const catchContainer = moduleContainer('currency');
        (catchContainer as any).setAccentColor(rarityColor);
        addText(catchContainer, `### 🎣 Caught! - You caught a **${fish.name}**!`);
        addFields(catchContainer, [
          { name: 'Coins Earned', value: `${amount.toLocaleString()}`, inline: true },
          { name: 'Rarity', value: fish.rarity.charAt(0).toUpperCase() + fish.rarity.slice(1), inline: true },
          { name: 'Balance', value: `${balance.coins.toLocaleString()}`, inline: true }
        ]);

        // Set cooldown
        await setEarnCooldown(guildId, userId, 'fish', 60);

        await buttonInteraction.editReply(v2Payload([catchContainer]));
      });

      collector.on('end', async (_, reason) => {
        if (!reeled && reason === 'time') {
          const missContainer = errorContainer('🎣 Missed!', 'The fish got away! You were too slow!');

          // Set cooldown anyway
          await setEarnCooldown(guildId, userId, 'fish', 60);

          try {
            await response.edit(v2Payload([missContainer]));
          } catch {
            // Message already deleted
          }
        }
      });
    } catch (error) {
      console.error('[Earn Fish Error]', error);
      const container = errorContainer('Fishing Error', 'An error occurred while fishing.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
