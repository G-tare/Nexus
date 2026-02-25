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

      const embed = new EmbedBuilder()
        .setTitle('Coin Flip')
        .setDescription(`The coin landed on: **${emoji}**`)
        .setColor(0x3498db);

      await interaction.reply({ embeds: [embed] });
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

    const embed = new EmbedBuilder()
      .setTitle('Coin Flip')
      .addFields({
        name: 'You Called',
        value: call.charAt(0).toUpperCase() + call.slice(1),
        inline: true,
      })
      .addFields({
        name: 'Result',
        value: `${emoji} ${flip.charAt(0).toUpperCase() + flip.slice(1)}`,
        inline: true,
      });

    if (won) {
      embed.setColor(0x00ff00).setTitle('✅ You Won!');

      if (bet && bet > 0) {
        const winnings = bet * 2;
        await awardWinnings(interaction.guildId!, interaction.user.id, winnings);
        emitGameWon(interaction.guildId!, interaction.user.id, 'coinflip', bet, winnings);
        embed.addFields({
          name: 'Winnings',
          value: `+${winnings}`,
          inline: false,
        });
      }
    } else {
      embed.setColor(0xff0000).setTitle('❌ You Lost!');

      if (bet && bet > 0) {
        emitGameLost(interaction.guildId!, interaction.user.id, 'coinflip', bet);
      }
    }

    await interaction.reply({ embeds: [embed] });
    await setCooldown(interaction.guildId!, interaction.user.id, 'coinflip', 3);
  },
  category: 'fun',
} as BotCommand;
