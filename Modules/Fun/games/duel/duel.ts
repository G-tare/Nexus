import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

interface DuelState {
  player1: { hp: number; username: string; id: string };
  player2: { hp: number; username: string; id: string };
  currentTurn: 0 | 1;
  cooldown: number;
}

export default {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Challenge another player to a duel')
    .addUserOption((option) =>
      option
        .setName('opponent')
        .setDescription('Who to duel')
        .setRequired(true)
    ),

  module: 'fun',
  permissionPath: 'fun.games.duel',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'duel');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const opponent = interaction.options.getUser('opponent');

    if (!opponent) {
      return interaction.reply({
        content: 'Could not find the specified user!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: 'You cannot duel yourself!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (opponent.bot) {
      return interaction.reply({
        content: 'You cannot duel a bot!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const challengeRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('accept_duel')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('decline_duel')
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
      );

    const challengeContainer = moduleContainer('fun');
    addText(challengeContainer, '### Duel Challenge!');
    addText(challengeContainer, `${interaction.user.username} challenges you to a duel!`);
    challengeContainer.addActionRowComponents(challengeRow);

    const msg = await interaction.reply({ ...v2Payload([challengeContainer]), fetchReply: true });

    try {
      const buttonInteraction = await msg.awaitMessageComponent({
        filter: (i) => i.user.id === opponent.id,
        time: 30000,
      });

      if (buttonInteraction.customId === 'decline_duel') {
        const declineContainer = moduleContainer('fun');
        addText(declineContainer, '### Duel Declined');
        addText(declineContainer, `${opponent.username} declined the challenge.`);
        await buttonInteraction.reply(v2Payload([declineContainer]));
        await setCooldown(interaction.guildId!, interaction.user.id, 'duel', 3);
        return;
      }

      const state: DuelState = {
        player1: { hp: 100, username: interaction.user.username, id: interaction.user.id },
        player2: { hp: 100, username: opponent.username, id: opponent.id },
        currentTurn: 0,
        cooldown: 0,
      };

      const hpBar = (hp: number) => {
        const filled = Math.round(hp / 10);
        return '█'.repeat(filled) + '░'.repeat(10 - filled);
      };

      const buildDuelContainer = () => {
        const p1 = state.player1;
        const p2 = state.player2;
        const container = moduleContainer('fun');
        addText(container, '### ⚔️ Duel');
        addFields(container, [
          { name: p1.username, value: `HP: ${p1.hp}\n${hpBar(p1.hp)}` },
          { name: p2.username, value: `HP: ${p2.hp}\n${hpBar(p2.hp)}` },
        ]);
        addText(container, `**${state.currentTurn === 0 ? p1.username : p2.username}'s turn**`);
        return container;
      };

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('attack')
            .setLabel('⚔️ Attack')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('defend')
            .setLabel('🛡️ Defend')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('special')
            .setLabel('⚡ Special')
            .setStyle(ButtonStyle.Secondary)
        );

      let duelContainer = buildDuelContainer();
      duelContainer.addActionRowComponents(actionRow);
      let duelMessage = await buttonInteraction.reply({ ...v2Payload([duelContainer]), fetchReply: true });

      const duelCollector = duelMessage.createMessageComponentCollector({ time: 600000 });
      let defenseMode = [false, false];
      let specialCooldown = [0, 0];

      duelCollector.on('collect', async (duelButton) => {
        const currentPlayer = state.currentTurn === 0 ? state.player1 : state.player2;
        const opponent = state.currentTurn === 0 ? state.player2 : state.player1;

        if (duelButton.user.id !== currentPlayer.id) {
          await duelButton.reply({ content: 'Not your turn!', flags: MessageFlags.Ephemeral });
          return;
        }

        let damage = 0;

        if (duelButton.customId === 'attack') {
          damage = Math.floor(Math.random() * 15) + 10;
          if (defenseMode[state.currentTurn === 0 ? 1 : 0]) {
            damage = Math.floor(damage / 2);
          }
          opponent.hp -= damage;
        } else if (duelButton.customId === 'defend') {
          defenseMode[state.currentTurn] = true;
          const defendContainer = moduleContainer('fun');
          addText(defendContainer, `${currentPlayer.username} defends!`);
          await duelButton.reply(v2Payload([defendContainer]));
          duelButton.deferUpdate();
        } else if (duelButton.customId === 'special') {
          if (specialCooldown[state.currentTurn] > 0) {
            await duelButton.reply({ content: `Special ability on cooldown for ${specialCooldown[state.currentTurn]} turns!`, flags: MessageFlags.Ephemeral });
            await duelButton.deferUpdate();
            state.currentTurn = state.currentTurn === 0 ? 1 : 0;
            defenseMode[state.currentTurn === 0 ? 1 : 0] = false;
            duelMessage = await interaction.channel!.messages.fetch(duelMessage.id);
            duelContainer = buildDuelContainer();
            duelContainer.addActionRowComponents(actionRow);
            await duelMessage.edit(v2Payload([duelContainer]));
            return;
          }
          damage = Math.floor(Math.random() * 25) + 30;
          if (defenseMode[state.currentTurn === 0 ? 1 : 0]) {
            damage = Math.floor(damage / 2);
          }
          opponent.hp -= damage;
          specialCooldown[state.currentTurn] = 3;
        }

        specialCooldown[0] = Math.max(0, specialCooldown[0] - 1);
        specialCooldown[1] = Math.max(0, specialCooldown[1] - 1);

        if (opponent.hp <= 0) {
          const winContainer = moduleContainer('fun');
          addText(winContainer, '### Victory!');
          addText(winContainer, `${currentPlayer.username} wins the duel!`);
          await interaction.followUp(v2Payload([winContainer]));
          duelCollector.stop();
        } else {
          state.currentTurn = state.currentTurn === 0 ? 1 : 0;
          defenseMode[state.currentTurn === 0 ? 1 : 0] = false;
          duelMessage = await interaction.channel!.messages.fetch(duelMessage.id);
          duelContainer = buildDuelContainer();
          duelContainer.addActionRowComponents(actionRow);
          await duelMessage.edit(v2Payload([duelContainer]));
        }

        if (!duelButton.replied) await duelButton.deferUpdate();
      });
    } catch (error) {
      const timeoutContainer = moduleContainer('fun');
      addText(timeoutContainer, '### Duel Expired');
      addText(timeoutContainer, 'Challenge was not accepted in time.');
      await interaction.followUp(v2Payload([timeoutContainer]));
    }

    await setCooldown(interaction.guildId!, interaction.user.id, 'duel', 3);
  },
} as BotCommand;
