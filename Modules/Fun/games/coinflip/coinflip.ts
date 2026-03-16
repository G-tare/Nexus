import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types';
import {
  checkCooldown,
  setCooldown,
  placeBet,
  awardWinnings,
  emitGameWon,
  emitGameLost,
  getFunConfig,
} from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';


type CoinSide = 'heads' | 'tails';

export default {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin and test your luck!')
    .addStringOption((option) =>
      option
        .setName('call')
        .setDescription('Your call')
        .setRequired(false)
        .addChoices(
          { name: 'Heads', value: 'heads' },
          { name: 'Tails', value: 'tails' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('Amount to bet (optional)')
        .setRequired(false)
        .setMinValue(1)
    ),

  module: 'fun',
  permissionPath: 'fun.games.coinflip',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'coinflip');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const call = interaction.options.getString('call') as CoinSide | null;
    const bet = interaction.options.getInteger('bet');

    // If no call provided, just flip (no betting possible)
    if (!call) {
      const flip = Math.random() < 0.5 ? 'heads' : 'tails';
      const emoji = flip === 'heads' ? '🪙 Heads' : '🪙 Tails';

      const container = moduleContainer('fun');
      addText(container, `### Coin Flip\nThe coin landed on: **${emoji}**`);

      await interaction.reply(v2Payload([container]));
      await setCooldown(interaction.guildId!, interaction.user.id, 'coinflip', 3);
      return;
    }

    // With call, check if we're betting
    if (bet && bet > 0) {
      const config = await getFunConfig(interaction.guildId!);
      const betResult = await placeBet(interaction.guildId!, interaction.user.id, bet, config);
      if (!betResult.success) {
        return interaction.reply({
          content: '❌ Insufficient currency to place this bet!',
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    const flip = Math.random() < 0.5 ? 'heads' : 'tails';
    const emoji = flip === 'heads' ? '🪙' : '🪙';
    const won = flip === call;

    const container = moduleContainer('fun');
    const title = won ? '### ✅ You Won!' : '### ❌ You Lost!';
    addText(container, title);

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'You Called', value: call.charAt(0).toUpperCase() + call.slice(1), inline: true },
      { name: 'Result', value: `${emoji} ${flip.charAt(0).toUpperCase() + flip.slice(1)}`, inline: true },
    ];

    if (won && bet && bet > 0) {
      const winnings = bet * 2;
      await awardWinnings(interaction.guildId!, interaction.user.id, winnings);
      emitGameWon(interaction.guildId!, interaction.user.id, 'coinflip', bet, winnings);
      fields.push({ name: 'Winnings', value: `+${winnings}`, inline: false });
    } else if (!won && bet && bet > 0) {
      emitGameLost(interaction.guildId!, interaction.user.id, 'coinflip', bet);
    }

    addFields(container, fields);
    await interaction.reply(v2Payload([container]));
    await setCooldown(interaction.guildId!, interaction.user.id, 'coinflip', 3);
  },
  category: 'fun',
} as BotCommand;
