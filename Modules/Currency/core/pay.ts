import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { Colors, successEmbed } from '../../../Shared/src/utils/embed';
import { getCurrencyConfig, getBalance, transferCurrency, trackTransfer, ensureMember, CurrencyType } from '../helpers';
import { eventBus } from '../../../Shared/src/events/eventBus';

const command: BotCommand = {
  module: 'currency',
  permissionPath: 'currency.pay',
  premiumFeature: 'currency.multi',
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Transfer currency to another user')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to send currency to')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('The amount to send')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName('currency_type')
        .setDescription('The type of currency to send (default: coins)')
        .setRequired(false)
        .addChoices(
          { name: 'coins', value: 'coins' },
          { name: 'gems', value: 'gems' },
          { name: 'event_tokens', value: 'event_tokens' }
        )
    ),
  
  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId!;
      const fromUserId = interaction.user.id;
      const toUser = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);
      const currencyType = (interaction.options.getString('currency_type') || 'coins') as CurrencyType;

      if (!guildId) {
        return interaction.editReply({
          embeds: [
            successEmbed()
              .setColor(Colors.Error)
              .setTitle('Error')
              .setDescription('This command can only be used in a server.')
          ]
        });
      }

      // Can't pay self
      if (fromUserId === toUser.id) {
        return interaction.editReply({
          embeds: [
            successEmbed()
              .setColor(Colors.Error)
              .setTitle('Error')
              .setDescription('You cannot send currency to yourself!')
          ]
        });
      }

      // Can't pay bots
      if (toUser.bot) {
        return interaction.editReply({
          embeds: [
            successEmbed()
              .setColor(Colors.Error)
              .setTitle('Error')
              .setDescription('You cannot send currency to bots!')
          ]
        });
      }

      const config = await getCurrencyConfig(guildId);

      // Ensure both users exist in the database
      await ensureMember(guildId, fromUserId);
      await ensureMember(guildId, toUser.id);

      const senderBalance = await getBalance(guildId, fromUserId);

      // Check if sender has enough balance
      const currentBalance = currencyType === 'coins' ? senderBalance.coins : currencyType === 'gems' ? senderBalance.gems : senderBalance.eventTokens;
      if (currentBalance < amount) {
        return interaction.editReply({
          embeds: [
            successEmbed()
              .setColor(Colors.Error)
              .setTitle('Insufficient Balance')
              .setDescription(`You don't have enough ${config.currencies[currencyType].name} to send ${amount}. You have ${currentBalance}.`)
          ]
        });
      }

      // Execute transfer
      const transferResult = await transferCurrency(guildId, fromUserId, toUser.id, currencyType, amount, config);

      if (!transferResult.success) {
        return interaction.editReply({
          embeds: [
            successEmbed()
              .setColor(Colors.Error)
              .setTitle('Transfer Failed')
              .setDescription(transferResult.error || 'An error occurred during the transfer.')
          ]
        });
      }

      // Track the transfer
      await trackTransfer(guildId, fromUserId, toUser.id, amount, transferResult.netAmount);

      // Get updated balances
      const senderNewBalance = await getBalance(guildId, fromUserId);
      const receiverNewBalance = await getBalance(guildId, toUser.id);

      const currencyInfo = config.currencies[currencyType];
      const taxAmount = transferResult.tax;
      const netAmount = transferResult.netAmount;

      // Emit event
      eventBus.emit('currencyTransfer', {
        guildId,
        fromUserId,
        toUserId: toUser.id,
        amount,
        tax: taxAmount,
        currencyType
      });

      const senderNewBalanceAmount = currencyType === 'coins' ? senderNewBalance.coins : currencyType === 'gems' ? senderNewBalance.gems : senderNewBalance.eventTokens;
      const receiverNewBalanceAmount = currencyType === 'coins' ? receiverNewBalance.coins : currencyType === 'gems' ? receiverNewBalance.gems : receiverNewBalance.eventTokens;

      const description = `${interaction.user.username} sent currency to ${toUser.username}\n\n` +
        `**Amount Sent:** ${currencyInfo.emoji} ${amount.toLocaleString()} ${currencyInfo.name}\n` +
        `**Tax Deducted:** ${currencyInfo.emoji} ${taxAmount.toLocaleString()}\n` +
        `**Amount Received:** ${currencyInfo.emoji} ${netAmount.toLocaleString()}\n\n` +
        `**${interaction.user.username}'s Balance:**\n${currencyInfo.emoji} ${senderNewBalanceAmount.toLocaleString()} ${currencyInfo.name}\n\n` +
        `**${toUser.username}'s Balance:**\n${currencyInfo.emoji} ${receiverNewBalanceAmount.toLocaleString()} ${currencyInfo.name}`;

      return interaction.editReply({
        embeds: [
          successEmbed()
            .setTitle('Transfer Successful')
            .setDescription(description)
            .setColor(Colors.Success)
        ]
      });
    } catch (error) {
      console.error('[Pay Command Error]', error);
      return interaction.editReply({
        embeds: [
          successEmbed()
            .setColor(Colors.Error)
            .setTitle('Error')
            .setDescription('An error occurred while processing the transfer.')
        ]
      });
    }
  }
};

export default command;
