import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { successReply, errorReply } from '../../../Shared/src/utils/componentsV2';
import {
  getRepConfig,
  adjustRep,
  canGiveRep,
  setRepCooldowns,
  updateRepRoles,
  formatDelta,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('giverep')
    .setDescription('Give +1 reputation to a user')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to give rep to')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason for giving rep')
        .setMaxLength(256)) as SlashCommandBuilder,

  module: 'reputation',
  permissionPath: 'reputation.giverep',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || undefined;
    const config = await getRepConfig(guild.id);

    // No self-rep
    if (!config.allowSelfRep && target.id === interaction.user.id) {
      await interaction.reply({ content: '❌ You can\'t give reputation to yourself.', flags: MessageFlags.Ephemeral });
      return;
    }

    // No bot rep
    if (target.bot) {
      await interaction.reply({ content: '❌ You can\'t give reputation to bots.', flags: MessageFlags.Ephemeral });
      return;
    }

    // Check cooldown
    const { allowed, remaining } = await canGiveRep(guild.id, interaction.user.id, target.id);
    if (!allowed) {
      const mins = Math.ceil((remaining || 0) / 60);
      await interaction.reply({
        content: `⏳ You need to wait **${mins > 0 ? `${mins} minute${mins > 1 ? 's' : ''}` : 'a moment'}** before giving rep again.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { newRep, oldRep } = await adjustRep(guild.id, target.id, 1, interaction.user.id, reason);
    await setRepCooldowns(guild.id, interaction.user.id, target.id);
    await updateRepRoles(guild, target.id, newRep);

    await interaction.reply(successReply(
      'Reputation Given',
      `⭐ **${interaction.user.displayName}** gave +1 rep to **${target.displayName}**!\n\n${target.displayName} now has **${newRep}** reputation.${reason ? `\n*Reason: ${reason}*` : ''}`
    ));
  },
};

export default command;
