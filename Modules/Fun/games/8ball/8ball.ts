import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types';
import { checkCooldown, setCooldown } from '../../helpers';


const POSITIVE_RESPONSES = [
  'It is certain',
  'It is decidedly so',
  'Without a doubt',
  'Yes definitely',
  'You may rely on it',
  'As I see it, yes',
  'Most likely',
  'Outlook good',
];

const NEUTRAL_RESPONSES = [
  'Reply hazy try again',
  'Ask again later',
  'Better not tell you now',
  'Cannot predict now',
  'Concentrate and ask again',
];

const NEGATIVE_RESPONSES = [
  "Don't count on it",
  'My reply is no',
  'My sources say no',
  'Outlook not so good',
  'Very doubtful',
  'Absolutely not',
  'No way',
];

const ALL_RESPONSES = [
  ...POSITIVE_RESPONSES,
  ...NEUTRAL_RESPONSES,
  ...NEGATIVE_RESPONSES,
];

export default {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question!')
    .addStringOption((option) =>
      option
        .setName('question')
        .setDescription('Your question for the magic 8-ball')
        .setRequired(true)
        .setMaxLength(256)
    ),

  module: 'fun',
  category: 'fun',
  permissionPath: 'fun.games.8ball',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, '8ball');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before asking again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const question = interaction.options.getString('question', true);
    const response = ALL_RESPONSES[Math.floor(Math.random() * ALL_RESPONSES.length)];

    let color = 0x3498db;
    if (POSITIVE_RESPONSES.includes(response)) {
      color = 0x00ff00;
    } else if (NEGATIVE_RESPONSES.includes(response)) {
      color = 0xff0000;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎱 Magic 8-Ball')
      .addFields({
        name: 'Question',
        value: question,
        inline: false,
      })
      .addFields({
        name: 'Answer',
        value: `*${response}*`,
        inline: false,
      });

    await interaction.reply({ embeds: [embed] });
    await setCooldown(interaction.guildId!, interaction.user.id, '8ball', 2);
  },
} as BotCommand;
