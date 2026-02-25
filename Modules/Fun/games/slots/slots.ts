import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder, MessageFlags } from 'discord.js';
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


const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];

function spinReel(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function getPayoutMultiplier(reel1: string, reel2: string, reel3: string): number {
  // 3 matching symbols
  if (reel1 === reel2 && reel2 === reel3) {
    return 10;
  }

  // Cherries on first reel (any other symbols)
  if (reel1 === '🍒') {
    // 2 matching on second and third
    if (reel2 === reel3) {
      return 2;
    }
    // Just cherries
    return 1.5;
  }

  // 2 matching symbols anywhere
  if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
    return 2;
  }

  return 0;
}

export default {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Play the slot machine!')
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('Amount to bet (minimum 10)')
        .setRequired(true)
        .setMinValue(10)
    ),

  module: 'fun',
  permissionPath: 'fun.games.slots',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'slots');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const bet = interaction.options.getInteger('bet', true);
    const config = await getFunConfig(interaction.guildId!);

    const betResult = await placeBet(interaction.guildId!, interaction.user.id, bet, config);
    if (!betResult.success) {
      return interaction.reply({
        content: '❌ Insufficient currency to place this bet!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Spinning animation
    const embed = new EmbedBuilder()
      .setTitle('🎰 Slot Machine')
      .setDescription('Spinning...')
      .setColor(0x3498db);

    const message = await interaction.reply({
      embeds: [embed],
      fetchReply: true,
    });

    // Spin 1
    await new Promise((resolve) => setTimeout(resolve, 500));
    let reel1 = spinReel();
    let reel2 = spinReel();
    let reel3 = spinReel();

    embed.setDescription(`${reel1} ${reel2} ${reel3}\n\nSpinning...`);
    await message.edit({ embeds: [embed] });

    // Spin 2
    await new Promise((resolve) => setTimeout(resolve, 500));
    reel1 = spinReel();
    reel2 = spinReel();
    reel3 = spinReel();

    embed.setDescription(`${reel1} ${reel2} ${reel3}\n\nSpinning...`);
    await message.edit({ embeds: [embed] });

    // Spin 3 (final)
    await new Promise((resolve) => setTimeout(resolve, 500));
    reel1 = spinReel();
    reel2 = spinReel();
    reel3 = spinReel();

    const multiplier = getPayoutMultiplier(reel1, reel2, reel3);

    embed.setDescription(`${reel1} ${reel2} ${reel3}`);

    if (multiplier > 0) {
      const winnings = bet * multiplier;
      await awardWinnings(interaction.guildId!, interaction.user.id, winnings);
      emitGameWon(interaction.guildId!, interaction.user.id, 'slots', bet, winnings);

      embed
        .setColor(0x00ff00)
        .setTitle('✅ You Won!')
        .addFields({
          name: 'Payout',
          value: `${multiplier}x = +${winnings}`,
          inline: false,
        });
    } else {
      emitGameLost(interaction.guildId!, interaction.user.id, 'slots', bet);

      embed
        .setColor(0xff0000)
        .setTitle('❌ You Lost!')
        .setDescription(`${reel1} ${reel2} ${reel3}\n\nBetter luck next time!`);
    }

    await message.edit({ embeds: [embed] });
    await setCooldown(interaction.guildId!, interaction.user.id, 'slots', 3);
  },
  category: 'fun',
} as BotCommand;
