import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types';
import { checkCooldown, setCooldown } from '../../helpers';


interface DiceResult {
  count: number;
  sides: number;
  rolls: number[];
  total: number;
}

function parseDiceNotation(notation: string): DiceResult | null {
  const match = notation.toLowerCase().match(/^(\d+)?d(\d+)$/);
  if (!match) return null;

  const count = parseInt(match[1] || '1');
  const sides = parseInt(match[2]);

  if (count < 1 || count > 100 || sides < 1 || sides > 1000) {
    return null;
  }

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }

  const total = rolls.reduce((a, b) => a + b, 0);

  return { count, sides, rolls, total };
}

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice with XdY notation (e.g., 2d20)')
    .addStringOption((option) =>
      option
        .setName('dice')
        .setDescription('Dice notation (default: 1d6)')
        .setRequired(false)
    ),

  module: 'fun',
  permissionPath: 'fun.games.roll',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'roll');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before rolling again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const diceInput = interaction.options.getString('dice') || '1d6';
    const result = parseDiceNotation(diceInput);

    if (!result) {
      return interaction.reply({
        content:
          '❌ Invalid dice notation! Use format like `2d20` or `3d6`. Max 100 dice, max 1000 sides.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const rollsDisplay =
      result.rolls.length <= 10
        ? result.rolls.join(', ')
        : `${result.rolls.slice(0, 10).join(', ')}... (${result.rolls.length} total)`;

    const embed = new EmbedBuilder()
      .setTitle('🎲 Dice Roll')
      .addFields({
        name: 'Notation',
        value: `${result.count}d${result.sides}`,
        inline: true,
      })
      .addFields({
        name: 'Total',
        value: result.total.toString(),
        inline: true,
      })
      .addFields({
        name: 'Rolls',
        value: rollsDisplay,
        inline: false,
      });

    if (result.count === 1) {
      embed.setColor(0x3498db);
    } else if (result.total >= result.count * result.sides * 0.8) {
      embed.setColor(0x00ff00);
    } else if (result.total <= result.count * result.sides * 0.2) {
      embed.setColor(0xff0000);
    } else {
      embed.setColor(0xffff00);
    }

    await interaction.reply({ embeds: [embed] });
    await setCooldown(interaction.guildId!, interaction.user.id, 'roll', 2);
  },
  category: 'fun',
} as BotCommand;
