import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
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


const CHOICES = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️',
};

type Choice = keyof typeof CHOICES;

export default {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock Paper Scissors against the bot!')
    .addStringOption((option) =>
      option
        .setName('choice')
        .setDescription('Your choice')
        .setRequired(true)
        .addChoices(
          { name: 'Rock', value: 'rock' },
          { name: 'Paper', value: 'paper' },
          { name: 'Scissors', value: 'scissors' }
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
  permissionPath: 'fun.games.rps',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'rps');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        ephemeral: true,
      });
    }

    const choice = interaction.options.getString('choice') as Choice;
    const bet = interaction.options.getInteger('bet');

    if (bet && bet > 0) {
      const config = await getFunConfig(interaction.guildId!);
      const betResult = await placeBet(interaction.guildId!, interaction.user.id, bet, config);
      if (!betResult.success) {
        return interaction.reply({
          content: '❌ Insufficient currency to place this bet!',
          ephemeral: true,
        });
      }
    }

    const botChoice = (['rock', 'paper', 'scissors'] as Choice[])[
      Math.floor(Math.random() * 3)
    ];

    let result: 'win' | 'lose' | 'draw';
    if (choice === botChoice) {
      result = 'draw';
    } else if (
      (choice === 'rock' && botChoice === 'scissors') ||
      (choice === 'paper' && botChoice === 'rock') ||
      (choice === 'scissors' && botChoice === 'paper')
    ) {
      result = 'win';
    } else {
      result = 'lose';
    }

    const embed = new EmbedBuilder()
      .setTitle('🎮 Rock Paper Scissors')
      .addFields(
        {
          name: 'Your Choice',
          value: `${CHOICES[choice]} ${choice.toUpperCase()}`,
          inline: true,
        },
        {
          name: 'Bot Choice',
          value: `${CHOICES[botChoice]} ${botChoice.toUpperCase()}`,
          inline: true,
        }
      );

    if (result === 'win') {
      embed
        .setColor(0x00ff00)
        .setTitle('✅ You Won!')
        .setDescription('Great job!');

      if (bet && bet > 0) {
        const winnings = bet * 2;
        await awardWinnings(interaction.guildId!, interaction.user.id, winnings);
        emitGameWon(interaction.guildId!, interaction.user.id, 'rps', bet, winnings);
        embed.addFields({
          name: 'Winnings',
          value: `+${winnings}`,
          inline: false,
        });
      }
    } else if (result === 'lose') {
      embed.setColor(0xff0000).setTitle('❌ You Lost!');

      if (bet && bet > 0) {
        emitGameLost(interaction.guildId!, interaction.user.id, 'rps', bet);
      }
    } else {
      embed.setColor(0xffff00).setTitle('🤝 It\'s a Draw!');

      if (bet && bet > 0) {
        // Return bet on draw
        embed.addFields({
          name: 'Bet Returned',
          value: `+${bet}`,
          inline: false,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
    await setCooldown(interaction.guildId!, interaction.user.id, 'rps', 3);
  },
  category: 'fun',
} as BotCommand;
