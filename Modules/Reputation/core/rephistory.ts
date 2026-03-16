import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { getRepHistory, formatDelta, relativeTimestamp } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rephistory')
    .setDescription('View reputation change history')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to check (defaults to yourself)')) as SlashCommandBuilder,

  module: 'reputation',
  permissionPath: 'reputation.rephistory',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const target = interaction.options.getUser('user') || interaction.user;

    const history = await getRepHistory(guild.id, target.id, 20);

    if (history.length === 0) {
      await interaction.reply({
        content: `${target.id === interaction.user.id ? 'You have' : `${target.displayName} has`} no reputation history.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const lines = history.map(h => {
      const delta = formatDelta(h.delta);
      const who = h.givenBy === 'system' ? '🤖 System' : `<@${h.givenBy}>`;
      const reason = h.reason ? ` — *${h.reason}*` : '';
      return `${delta} by ${who} ${relativeTimestamp(h.createdAt)}${reason}`;
    });

    const container = moduleContainer('reputation');
    addText(container, `### ⭐ ${target.displayName}'s Rep History\n${lines.join('\n')}`);
    addFooter(container, `Showing last ${history.length} changes`);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
