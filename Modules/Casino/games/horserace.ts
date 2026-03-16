import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getCasinoConfig,
  placeBet,
  awardWinnings,
  logCasinoGame,
  checkCooldown,
  setCooldown,
  getRandomNumber,
  sleep,
} from '../helpers';
import {
  moduleContainer,
  successContainer,
  errorContainer,
  addText,
  addFields,
  addSeparator,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

interface Horse {
  name: string;
  emoji: string;
  speed: number;
  position: number;
}

const horses: Omit<Horse, 'speed' | 'position'>[] = [
  { name: 'Thunder', emoji: '🐴' },
  { name: 'Lightning', emoji: '🐎' },
  { name: 'Storm', emoji: '🏇' },
  { name: 'Blaze', emoji: '🐴' },
  { name: 'Shadow', emoji: '🐎' },
  { name: 'Wind', emoji: '🏇' },
];

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.horserace',
  data: new SlashCommandBuilder()
    .setName('horserace')
    .setDescription('Bet on a horse in the race!')
    .addIntegerOption((opt) =>
      opt
        .setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('horse')
        .setDescription('Horse to bet on (1-6)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(6)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger('bet')!;
    const horseChoice = interaction.options.getInteger('horse')! - 1;

    // Check cooldown
    const hasCooldown = await checkCooldown(guildId, userId, 'horserace');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for horse race.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get config
    const config = await getCasinoConfig(guildId);

    // Place bet
    const betResult = await placeBet(guildId, userId, betAmount, config);
    if (!betResult.success) {
      await interaction.reply({
        content: betResult.error || 'Failed to place bet',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    // Initialize race
    const raceHorses: Horse[] = horses.map((h, i) => ({
      ...h,
      speed: getRandomNumber(1, 5),
      position: 0,
    }));

    const initialContainer = buildRaceContainer(raceHorses, horseChoice, 'Starting the race...', betAmount);
    const message = await interaction.editReply(v2Payload([initialContainer]));

    // Race loop
    let finished = false;
    let winner = -1;
    const finishLine = 50;

    for (let lap = 0; lap < 6 && !finished; lap++) {
      await sleep(800);

      for (let i = 0; i < raceHorses.length; i++) {
        raceHorses[i].position += raceHorses[i].speed;
        if (raceHorses[i].position >= finishLine) {
          if (winner === -1) {
            winner = i;
            finished = true;
          }
        }
      }

      const statusText = finished
        ? `🏁 ${raceHorses[winner].name} wins!`
        : `Lap ${lap + 1}/5...`;

      const raceContainer = buildRaceContainer(
        raceHorses,
        horseChoice,
        statusText,
        betAmount
      );

      await message.edit(v2Payload([raceContainer]));
    }

    // Determine payout
    let result: 'win' | 'loss' = 'loss';
    let winAmount = 0;
    let multiplier = 0;

    const topTwo = raceHorses
      .map((h, i) => ({ index: i, position: h.position }))
      .sort((a, b) => b.position - a.position)
      .slice(0, 2);

    if (winner === horseChoice) {
      result = 'win';
      multiplier = 5;
      winAmount = betAmount * multiplier;
      await awardWinnings(guildId, userId, winAmount);
    } else if (topTwo.some((t: { index: number; position: number }) => t.index === horseChoice)) {
      result = 'win';
      multiplier = 2;
      winAmount = betAmount * multiplier;
      await awardWinnings(guildId, userId, winAmount);
    }

    const resultEmoji = winner === horseChoice ? '🥇' : topTwo.some((t: { index: number; position: number }) => t.index === horseChoice) ? '🥈' : '❌';

    const finalContainer = result === 'win'
      ? successContainer(`Race Finished - ${raceHorses[winner].name} Wins! ${resultEmoji}`,
          `You bet on ${raceHorses[horseChoice].name}\n\n✅ YOU WIN ${winAmount}! (${multiplier}x)`)
      : errorContainer(`Race Finished - ${raceHorses[winner].name} Wins! ${resultEmoji}`,
          `You bet on ${raceHorses[horseChoice].name}\n\n❌ You did not win`);

    addSeparator(finalContainer, 'small');

    const horseFields = raceHorses.map((h, i) => ({
      name: `${i === winner ? '🥇' : ''} #${i + 1} - ${h.name}`,
      value: `Position: ${h.position}`,
      inline: true,
    }));
    addFields(finalContainer, horseFields);
    addFooter(finalContainer, 'Horse Race Game');

    await message.edit(v2Payload([finalContainer]));

    await logCasinoGame(
      guildId,
      userId,
      'horserace',
      betAmount,
      winAmount,
      multiplier,
      result,
      { winner: raceHorses[winner].name, chosen: raceHorses[horseChoice].name }
    );

    // Set cooldown
    await setCooldown(guildId, userId, 'horserace', config.cooldown);
  },
};

function buildRaceContainer(
  raceHorses: Horse[],
  selectedHorse: number,
  status: string,
  betAmount: number
) {
  const finishLine = 50;

  const raceDisplay = raceHorses
    .map((h, i) => {
      const progress = Math.min(h.position, finishLine);
      const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(10 - Math.floor(progress / 5));
      const marker = i === selectedHorse ? '⭐' : '  ';
      return `${marker} #${i + 1} ${h.emoji} ${progressBar} ${h.position}`;
    })
    .join('\n');

  const container = moduleContainer('casino');
  addText(container, `### 🏇 Horse Race`);
  addSeparator(container, 'small');
  addText(container, `\`\`\`\n${raceDisplay}\n\`\`\`\n${status}`);
  addFields(container, [{ name: 'Your Bet', value: `${betAmount}`, inline: true }]);
  addFooter(container, 'Horse Race Game');

  return container;
}

export default command;
