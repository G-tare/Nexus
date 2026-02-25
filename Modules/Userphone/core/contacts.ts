import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getContacts, removeContact } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('contacts')
    .setDescription('View and manage your server\'s saved userphone contacts')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View all saved contacts'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a saved contact')
        .addStringOption(opt =>
          opt.setName('server_id')
            .setDescription('The server ID of the contact to remove')
            .setRequired(true))) as SlashCommandBuilder,

  module: 'userphone',
  permissionPath: 'userphone.contacts',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const contacts = await getContacts(guild.id);

      if (contacts.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle('📒 Contacts')
          .setDescription('No saved contacts yet.\n\nAfter a userphone call, click the **Save Contact** button to save a server you enjoyed chatting with!');

        await interaction.reply({ embeds: [embed] });
        return;
      }

      const lines = contacts.map((c, i) => {
        const name = c.contactGuildName;
        return `**${i + 1}.** ${name} (\`${c.contactGuildId}\`)`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('📒 Contacts')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${contacts.length} contact${contacts.length !== 1 ? 's' : ''} • Use /directcall to call a contact` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'remove') {
      const serverId = interaction.options.getString('server_id', true);
      const removed = await removeContact(guild.id, serverId);

      if (removed) {
        await interaction.reply({ content: `✅ Removed contact \`${serverId}\` from both servers' contact lists.` });
      } else {
        await interaction.reply({ content: '❌ That server is not in your contacts.', flags: MessageFlags.Ephemeral });
      }
      return;
    }
  },
};

export default command;
