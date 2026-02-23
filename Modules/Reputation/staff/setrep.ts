import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { setUserRep, updateRepRoles } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('setrep')
    .setDescription('Set a user\'s reputation to an exact value')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Reputation value to set')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'reputation',
  permissionPath: 'reputation.setrep',
  premiumFeature: 'reputation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);

    await setUserRep(guild.id, target.id, amount);
    await updateRepRoles(guild, target.id, amount);

    await interaction.reply({
      content: `✅ Set **${target.displayName}**'s reputation to **${amount}**.`,
    });
  },
};

export default command;
