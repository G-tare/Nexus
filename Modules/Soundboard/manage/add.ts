import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { addSound, getAllSounds } from '../helpers';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('soundboard-add')
    .setDescription('Add a custom sound to the soundboard')
    .addStringOption((opt) =>
      opt
        .setName('name')
        .setDescription('Sound name')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('url')
        .setDescription('Direct audio file URL')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Sound category')
        .addChoices(
          { name: 'Memes', value: 'memes' },
          { name: 'Windows', value: 'windows' },
          { name: 'Discord', value: 'discord' },
          { name: 'Effects', value: 'effects' },
          { name: 'Custom', value: 'custom' }
        )
        .setRequired(true)
    ),

  module: 'soundboard',
  permissionPath: 'soundboard.manage.add',

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const name = interaction.options.getString('name', true);
    const url = interaction.options.getString('url', true);
    const category = interaction.options.getString('category', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      // Check permissions
      const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'soundboard');
      const config = (_cfgResult?.config ?? {}) as Record<string, any>;

      const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      const allowUserUpload = config.allowUserUpload !== false;

      if (!isStaff && !allowUserUpload) {
        await interaction.editReply({
          content: '❌ Only staff can add sounds. User uploads are disabled.',
        });
        return;
      }

      // Check sound limit
      const sounds = await getAllSounds(guildId);
      const customSounds = sounds.filter(s => !s.isDefault).length;
      const maxCustom = config.maxCustomSounds || 25;

      if (customSounds >= maxCustom) {
        await interaction.editReply({
          content: `❌ Maximum custom sounds (${maxCustom}) reached.`,
        });
        return;
      }

      // Validate URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        await interaction.editReply({
          content: '❌ URL must start with http:// or https://',
        });
        return;
      }

      // Add the sound (duration defaulting to 5 seconds)
      const sound = await addSound(
        guildId,
        name,
        category,
        url,
        5,
        interaction.user.id,
        false
      );

      if (!sound) {
        await interaction.editReply({
          content: '❌ Failed to add sound. It might already exist.',
        });
        return;
      }

      const container = moduleContainer('soundboard');
      addText(container, '### ✅ Sound Added');
      addFields(container, [
        {
          name: 'Name',
          value: `\`${sound.name}\``,
          inline: true,
        },
        {
          name: 'Category',
          value: sound.category,
          inline: true,
        },
        {
          name: 'Duration',
          value: '5s (default)',
          inline: true,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in soundboard add command:', error);
      await interaction.editReply({
        content: 'An error occurred while adding the sound.',
      });
    }
  },
};

export default command;
