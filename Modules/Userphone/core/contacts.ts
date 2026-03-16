import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getContacts, removeContact } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

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
        const container = moduleContainer('userphone');
        addText(container, `### 📒 Contacts\nNo saved contacts yet.\n\nAfter a userphone call, click the **Save Contact** button to save a server you enjoyed chatting with!`);

        await interaction.reply(v2Payload([container]));
        return;
      }

      const lines = contacts.map((c, i) => {
        const name = c.contactGuildName;
        return `**${i + 1}.** ${name} (\`${c.contactGuildId}\`)`;
      });

      const container = moduleContainer('userphone');
      addText(container, `### 📒 Contacts\n${lines.join('\n')}`);
      addText(container, `-# ${contacts.length} contact${contacts.length !== 1 ? 's' : ''} • Use /directcall to call a contact`);

      await interaction.reply(v2Payload([container]));
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
