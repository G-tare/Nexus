import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  errorContainer,
  moduleContainer,
  addText,
  addFields,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';
import { addCurrency, getBalance, checkEarnCooldown, setEarnCooldown } from '../helpers';

const BEG_MESSAGES = [
  { text: 'A kind stranger gave you **{amount} coins**!', amount: [5, 150] },
  { text: 'You found **{amount} coins** on the ground!', amount: [20, 120] },
  { text: 'Someone tipped you **{amount} coins**!', amount: [10, 100] },
  { text: 'You earned **{amount} coins** busking!', amount: [15, 80] },
  { text: 'A friend gave you **{amount} coins**!', amount: [25, 150] },
  { text: 'You found **{amount} coins** in your couch!', amount: [5, 50] },
];

const FAILURE_MESSAGES = [
  'Nobody felt generous today...',
  'You had no luck begging.',
  'People walked right past you.',
  'You got no sympathy today.',
  'Tough luck! Nobody gave you anything.',
];

const BONUS_MESSAGES = [
  'A rich person felt generous and doubled your earnings!',
  'You got really lucky - someone gave you extra!',
  'A miracle happened - you found a bonus!',
];

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.earn',
  cooldown: 2,
  data: new SlashCommandBuilder()
    .setName('earn-beg')
    .setDescription('Beg for coins (30s cooldown)'),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const guildId = interaction.guildId!;
      const userId = interaction.user.id;

      // Check cooldown
      const cooldownRemaining = await checkEarnCooldown(guildId, userId, 'beg');
      if (cooldownRemaining > 0) {
        const container = errorContainer('On Cooldown', `You're too tired to beg right now. Wait ${cooldownRemaining}s.`);
        return interaction.reply({ ...v2Payload([container]), ephemeral: true });
      }

      await interaction.deferReply();

      const random = Math.random();
      let description = '';
      let amount = 0;

      if (random < 0.7) {
        // 70% success
        const msg = BEG_MESSAGES[Math.floor(Math.random() * BEG_MESSAGES.length)];
        const [min, max] = msg.amount;
        amount = Math.floor(Math.random() * (max - min + 1)) + min;

        if (Math.random() < 0.1) {
          // 10% bonus
          amount *= 2;
          description = `${msg.text.replace('{amount}', amount.toString())}\n\n${BONUS_MESSAGES[Math.floor(Math.random() * BONUS_MESSAGES.length)]}`;
        } else {
          description = msg.text.replace('{amount}', amount.toString());
        }
      } else if (random < 0.9) {
        // 20% nothing
        description = FAILURE_MESSAGES[Math.floor(Math.random() * FAILURE_MESSAGES.length)];
        amount = 0;
      } else {
        // 10% bonus
        const msg = BEG_MESSAGES[Math.floor(Math.random() * BEG_MESSAGES.length)];
        const [min, max] = msg.amount;
        amount = Math.floor(Math.random() * (max - min + 1)) + min;
        amount *= 2;
        description = `${msg.text.replace('{amount}', amount.toString())}\n\n${BONUS_MESSAGES[Math.floor(Math.random() * BONUS_MESSAGES.length)]}`;
      }

      if (amount > 0) {
        await addCurrency(guildId, userId, 'coins', amount, 'beg');
      }

      const balance = await getBalance(guildId, userId);
      const container = moduleContainer('currency');
      addText(container, '### 🤲 Begging Results');
      addText(container, description);
      addFields(container, [
        { name: 'Your Balance', value: `${balance.coins.toLocaleString()} coins`, inline: true }
      ]);

      // Set cooldown
      await setEarnCooldown(guildId, userId, 'beg', 30);

      return interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('[Earn Beg Error]', error);
      const container = errorContainer('Begging Error', 'An error occurred while begging for coins.');
      return interaction.editReply(v2Payload([container]));
    }
  },
} as BotCommand;

export default command;
