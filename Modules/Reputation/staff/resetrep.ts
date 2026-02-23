import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { resetUserRep, getRepConfig } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('resetrep')
    .setDescription('Reset a user\'s reputation to the default value')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user to reset')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  module: 'reputation',
  permissionPath: 'reputation.resetrep',
  premiumFeature: 'reputation.basic',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const target = interaction.options.getUser('user', true);
    const config = await getRepConfig(guild.id);

    await resetUserRep(guild.id, target.id);

    await interaction.reply({
      content: `✅ Reset **${target.displayName}**'s reputation to **${config.defaultRep}** and cleared their history.`,
    });
  },
};

export default command;
