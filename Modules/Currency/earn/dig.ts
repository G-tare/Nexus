import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { addCurrency, removeCurrency, getBalance, checkEarnCooldown, setEarnCooldown } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.earn',
  cooldown: 2,
  data: new SlashCommandBuilder()
    .setName('earn-dig')
    .setDescription('Dig for treasure (45s cooldown)'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      // Check cooldown
      const cooldownRemaining = await checkEarnCooldown(guildId, userId, 'dig');
      if (cooldownRemaining > 0) {
        const container = errorContainer('On Cooldown', `You're too tired to dig. Wait ${cooldownRemaining}s.`);
        return interaction.reply({ ...v2Payload([container]), ephemeral: true });
      }

      await interaction.deferReply();

      const random = Math.random();
      let description = '';
      let amount = 0;

      if (random < 0.3) {
        // 30% nothing
        description = '⛏️ You dug and dug... but found nothing. Better luck next time!';
        amount = 0;
      } else if (random < 0.8) {
        // 50% coins
        amount = Math.floor(Math.random() * (400 - 10 + 1)) + 10;
        description = `⛏️ You found **${amount} coins** buried in the ground!`;
        await addCurrency(guildId, userId, 'coins', amount, 'dig');
      } else {
        // 20% hit pipe - lose coins
        const balance = await getBalance(guildId, userId);
        const lossAmount = Math.min(100, Math.floor(Math.random() * (100 - 50 + 1)) + 50);

        if (balance.coins >= lossAmount) {
          await removeCurrency(guildId, userId, 'coins', lossAmount, 'dig_accident');
          description = `⛏️ Oh no! You hit a pipe and lost **${lossAmount} coins** in repairs!`;
        } else if (balance.coins > 0) {
          await removeCurrency(guildId, userId, 'coins', balance.coins, 'dig_accident');
          description = `⛏️ Oh no! You hit a pipe and lost **${balance.coins} coins** in repairs!`;
        } else {
          description = '⛏️ You hit a pipe! (Lucky you had no coins to lose)';
        }
      }

      const newBalance = await getBalance(guildId, userId);
      const container = moduleContainer('currency');
      addText(container, '### ⛏️ Digging Results');
      addText(container, description);
      addFields(container, [
        { name: 'Balance', value: `${newBalance.coins.toLocaleString()} coins`, inline: true }
      ]);

      // Set cooldown
      await setEarnCooldown(guildId, userId, 'dig', 45);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Earn Dig Error]', error);
      const container = errorContainer('Digging Error', 'An error occurred while digging.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
