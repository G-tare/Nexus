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
        flags: MessageFlags.Ephemeral,
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
          flags: MessageFlags.Ephemeral,
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

    const container = moduleContainer('fun');
    let title = '🎮 Rock Paper Scissors';

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Your Choice', value: `${CHOICES[choice]} ${choice.toUpperCase()}`, inline: true },
      { name: 'Bot Choice', value: `${CHOICES[botChoice]} ${botChoice.toUpperCase()}`, inline: true }
    ];

    if (result === 'win') {
      title = '### ✅ You Won!';

      if (bet && bet > 0) {
        const winnings = bet * 2;
        await awardWinnings(interaction.guildId!, interaction.user.id, winnings);
        emitGameWon(interaction.guildId!, interaction.user.id, 'rps', bet, winnings);
        fields.push({ name: 'Winnings', value: `+${winnings}`, inline: false });
      }
    } else if (result === 'lose') {
      title = '### ❌ You Lost!';

      if (bet && bet > 0) {
        emitGameLost(interaction.guildId!, interaction.user.id, 'rps', bet);
      }
    } else {
      title = '### 🤝 It\'s a Draw!';

      if (bet && bet > 0) {
        fields.push({ name: 'Bet Returned', value: `+${bet}`, inline: false });
      }
    }

    addText(container, title);
    addFields(container, fields);
    await interaction.reply(v2Payload([container]));
    await setCooldown(interaction.guildId!, interaction.user.id, 'rps', 3);
  },
  category: 'fun',
} as BotCommand;
