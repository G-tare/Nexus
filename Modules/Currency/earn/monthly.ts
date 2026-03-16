import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { addCurrency, getCurrencyConfig, checkEarnCooldown, setEarnCooldown } from '../helpers';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.earn',
  cooldown: 3,
  data: new SlashCommandBuilder()
    .setName('earn-monthly')
    .setDescription('Claim your monthly bonus (30 day cooldown)'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      await interaction.deferReply();

      const config = await getCurrencyConfig(guildId);

      // Check monthly cooldown (30 days = 2592000 seconds)
      const cooldownRemaining = await checkEarnCooldown(guildId, userId, 'monthly_bonus');
      if (cooldownRemaining > 0) {
        const remainingDays = Math.ceil(cooldownRemaining / (24 * 60 * 60));
        const container = errorContainer('Monthly Bonus on Cooldown', `You can claim your monthly bonus in **${remainingDays} days**.`);
        return interaction.editReply(v2Payload([container]));
      }

      const monthlyAmount = (config as any).monthlyAmount || 5000;
      const monthlyGems = (config as any).monthlyGems || 50;

      // Grant coins
      await addCurrency(guildId, userId, 'coins', monthlyAmount, 'monthly_bonus');

      // Grant gems if configured
      if (monthlyGems > 0) {
        await addCurrency(guildId, userId, 'gems', monthlyGems, 'monthly_bonus');
      }

      // Set cooldown (30 days = 2592000 seconds)
      await setEarnCooldown(guildId, userId, 'monthly_bonus', 2592000);

      const container = moduleContainer('currency');
      addText(container, '### 🎁 Monthly Bonus Claimed!');
      addText(container, 'Thank you for being an active member!');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: 'Coins Earned', value: `${monthlyAmount.toLocaleString()} 🪙`, inline: true }
      ];

      if (monthlyGems > 0) {
        fields.push({ name: 'Gems Earned', value: `${monthlyGems} 💎`, inline: true });
      }

      addFields(container, fields);
      addFooter(container, `Claimed at ${new Date().toLocaleString()}`);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Earn Monthly Error]', error);
      const container = errorContainer('Monthly Bonus Error', 'An error occurred while claiming your monthly bonus.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
