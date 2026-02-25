import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types';
import { checkCooldown, setCooldown } from '../../helpers';


interface WYRScenario {
  question: string;
  optionA: string;
  optionB: string;
}

const SCENARIOS: WYRScenario[] = [
  {
    question: 'Would you rather...',
    optionA: 'Have spaghetti for hair',
    optionB: 'Have maple syrup for sweat',
  },
  {
    question: 'Would you rather...',
    optionA: 'Fight one horse-sized duck',
    optionB: '100 duck-sized horses',
  },
  {
    question: 'Would you rather...',
    optionA: 'Be able to fly',
    optionB: 'Be invisible',
  },
  {
    question: 'Would you rather...',
    optionA: 'Live without music',
    optionB: 'Live without movies',
  },
  {
    question: 'Would you rather...',
    optionA: 'Always be cold',
    optionB: 'Always be hot',
  },
  {
    question: 'Would you rather...',
    optionA: 'Speak every language',
    optionB: 'Speak to animals',
  },
  {
    question: 'Would you rather...',
    optionA: 'Have a rewind button for life',
    optionB: 'Have a pause button',
  },
  {
    question: 'Would you rather...',
    optionA: 'Never have to sleep again',
    optionB: 'Never have to eat again',
  },
  {
    question: 'Would you rather...',
    optionA: 'Travel to the past',
    optionB: 'Travel to the future',
  },
  {
    question: 'Would you rather...',
    optionA: 'Have unlimited money',
    optionB: 'Have unlimited time',
  },
  {
    question: 'Would you rather...',
    optionA: 'Be able to teleport anywhere',
    optionB: 'Be able to stop time',
  },
  {
    question: 'Would you rather...',
    optionA: 'Have a photographic memory',
    optionB: 'Be extremely intelligent',
  },
  {
    question: 'Would you rather...',
    optionA: 'Be famous for good reasons',
    optionB: 'Be rich and unknown',
  },
  {
    question: 'Would you rather...',
    optionA: 'Never be sick again',
    optionB: 'Never be injured again',
  },
  {
    question: 'Would you rather...',
    optionA: 'Have the ability to read minds',
    optionB: 'Have the ability to see the future',
  },
  {
    question: 'Would you rather...',
    optionA: 'Always say the truth',
    optionB: 'Always be able to lie undetected',
  },
  {
    question: 'Would you rather...',
    optionA: 'Have a pet dragon',
    optionB: 'Have a pet unicorn',
  },
  {
    question: 'Would you rather...',
    optionA: 'Only be able to eat pizza',
    optionB: 'Only be able to eat ice cream',
  },
  {
    question: 'Would you rather...',
    optionA: 'Visit every country',
    optionB: 'Visit every planet in the solar system',
  },
  {
    question: 'Would you rather...',
    optionA: 'Have the power of super strength',
    optionB: 'Have the power of super speed',
  },
  {
    question: 'Would you rather...',
    optionA: 'Be able to control fire',
    optionB: 'Be able to control water',
  },
  {
    question: 'Would you rather...',
    optionA: 'Have dinner with your favorite celebrity',
    optionB: 'Have dinner with your favorite historical figure',
  },
  {
    question: 'Would you rather...',
    optionA: 'Always find things easily',
    optionB: 'Never lose anything',
  },
  {
    question: 'Would you rather...',
    optionA: 'Be the funniest person in the room',
    optionB: 'Be the smartest person in the room',
  },
  {
    question: 'Would you rather...',
    optionA: 'Have the ability to speak to plants',
    optionB: 'Have the ability to speak to animals',
  },
  {
    question: 'Would you rather...',
    optionA: 'Live in a world without internet',
    optionB: 'Live in a world without electricity',
  },
  {
    question: 'Would you rather...',
    optionA: 'Always be early',
    optionB: 'Always have just enough time',
  },
  {
    question: 'Would you rather...',
    optionA: 'Have a life where you travel constantly',
    optionB: 'Have a life where you stay in one place',
  },
  {
    question: 'Would you rather...',
    optionA: 'Be able to control the weather',
    optionB: 'Be able to control emotions',
  },
  {
    question: 'Would you rather...',
    optionA: 'Win the lottery',
    optionB: 'Find your true love',
  },
];

export default {
  data: new SlashCommandBuilder()
    .setName('wouldyourather')
    .setDescription('Would You Rather? Vote on different scenarios!'),

  module: 'fun',
  permissionPath: 'fun.games.wouldyourather',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'wouldyourather');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('wyr_a')
        .setLabel('Option A')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wyr_b')
        .setLabel('Option B')
        .setStyle(ButtonStyle.Primary)
    );

    const embed = new EmbedBuilder()
      .setTitle('🤔 Would You Rather?')
      .setDescription(scenario.question)
      .addFields({
        name: 'A)',
        value: scenario.optionA,
        inline: false,
      })
      .addFields({
        name: 'B)',
        value: scenario.optionB,
        inline: false,
      })
      .addFields({
        name: 'Results',
        value: 'Click a button to vote!',
        inline: false,
      });

    const message = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      fetchReply: true,
    });

    const voteA = new Set<string>();
    const voteB = new Set<string>();

    const collector = message.createMessageComponentCollector({
      time: 30000,
    });

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      const userId = buttonInteraction.user.id;

      if (buttonInteraction.customId === 'wyr_a') {
        voteB.delete(userId);
        voteA.add(userId);
      } else {
        voteA.delete(userId);
        voteB.add(userId);
      }

      const total = voteA.size + voteB.size;
      const percentA = total > 0 ? Math.round((voteA.size / total) * 100) : 0;
      const percentB = total > 0 ? Math.round((voteB.size / total) * 100) : 0;

      const progressA = Math.round(percentA / 5);
      const progressB = Math.round(percentB / 5);
      const emptyA = 20 - progressA;
      const emptyB = 20 - progressB;

      const barA = '█'.repeat(progressA) + '░'.repeat(emptyA);
      const barB = '█'.repeat(progressB) + '░'.repeat(emptyB);

      const updatedEmbed = new EmbedBuilder()
        .setTitle('🤔 Would You Rather?')
        .setDescription(scenario.question)
        .addFields({
          name: 'A)',
          value: scenario.optionA,
          inline: false,
        })
        .addFields({
          name: 'B)',
          value: scenario.optionB,
          inline: false,
        })
        .addFields(
          {
            name: `Results (${total} votes)`,
            value: `\`${barA}\` **${percentA}%** (${voteA.size})`,
            inline: false,
          },
          {
            name: '\u200B',
            value: `\`${barB}\` **${percentB}%** (${voteB.size})`,
            inline: false,
          }
        );

      await buttonInteraction.update({
        embeds: [updatedEmbed],
      });
    });

    collector.on('end', async () => {
      const total = voteA.size + voteB.size;
      const percentA = total > 0 ? Math.round((voteA.size / total) * 100) : 0;
      const percentB = total > 0 ? Math.round((voteB.size / total) * 100) : 0;

      const progressA = Math.round(percentA / 5);
      const progressB = Math.round(percentB / 5);
      const emptyA = 20 - progressA;
      const emptyB = 20 - progressB;

      const barA = '█'.repeat(progressA) + '░'.repeat(emptyA);
      const barB = '█'.repeat(progressB) + '░'.repeat(emptyB);

      let winner = '';
      if (voteA.size > voteB.size) {
        winner = `🏆 **Option A wins!** (${voteA.size} vs ${voteB.size})`;
      } else if (voteB.size > voteA.size) {
        winner = `🏆 **Option B wins!** (${voteB.size} vs ${voteA.size})`;
      } else if (total > 0) {
        winner = `🤝 **It's a tie!** (${voteA.size} vs ${voteB.size})`;
      } else {
        winner = '❌ No votes cast!';
      }

      const finalEmbed = new EmbedBuilder()
        .setTitle('🤔 Would You Rather? - Final Results')
        .setDescription(scenario.question)
        .addFields({
          name: 'A)',
          value: scenario.optionA,
          inline: false,
        })
        .addFields({
          name: 'B)',
          value: scenario.optionB,
          inline: false,
        })
        .addFields(
          {
            name: `Results (${total} total votes)`,
            value: `\`${barA}\` **${percentA}%** (${voteA.size})\n\`${barB}\` **${percentB}%** (${voteB.size})\n\n${winner}`,
            inline: false,
          }
        );

      await message.edit({
        embeds: [finalEmbed],
        components: [],
      });
    });

    await setCooldown(interaction.guildId!, interaction.user.id, 'wouldyourather', 3);
  },
  category: 'fun',
} as BotCommand;
