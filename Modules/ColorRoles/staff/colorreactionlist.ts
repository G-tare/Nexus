import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getReactionLists,
  canManageColors,
} from '../helpers';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorreactionlist')
    .setDescription('View all active reaction color messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorreactionlist',
  premiumFeature: 'colorroles.management',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const lists = await getReactionLists(guild.id);

    if (lists.length === 0) {
      await interaction.reply({
        content: 'No active reaction color messages. Use `/colorreaction` to create one.',
      });
      return;
    }

    const lines = lists.map((l, i) =>
      `**${i + 1}.** <#${l.channelId}> — ${l.colorIds.length} colors — ID: \`${l.id}\` — [Jump](https://discord.com/channels/${guild.id}/${l.channelId}/${l.messageId})`
    );

    const container = moduleContainer('color_roles').setAccentColor(0x3498DB);
    addText(container, `### 🎨 Reaction Color Messages`);
    addText(container, lines.join('\n'));
    addFooter(container, 'Use /colorreactiondelete <id> to remove one');

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
