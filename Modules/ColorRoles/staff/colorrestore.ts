import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  restoreSave,
  getSaves,
  canManageColors,
} from '../helpers';
import { moduleContainer, addText, addButtons, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorrestore')
    .setDescription('Restore a saved palette (replaces current palette)')
    .addIntegerOption(opt =>
      opt.setName('save_id')
        .setDescription('The save ID to restore (use /colorsaves to see available saves)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorrestore',
  premiumFeature: 'colorroles.management',
  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    if (!(await canManageColors(guild, interaction.user.id))) {
      await interaction.reply({ content: 'You don\'t have permission to manage colors.' });
      return;
    }

    const saveId = interaction.options.getInteger('save_id', true);

    const saves = await getSaves(guild.id);
    const save = saves.find(s => s.id === saveId);

    if (!save) {
      await interaction.reply({
        content: `Save with ID \`${saveId}\` not found. Use \`/colorsaves\` to see available saves.`,
      });
      return;
    }

    const colorCount = Array.isArray(save.colors) ? save.colors.length : 0;

    // Confirmation
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('colorrestore:confirm')
        .setLabel(`Yes, restore "${save.name}"`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('colorrestore:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    const reply = await interaction.reply({
      content: `⚠️ This will **delete all current colors** and restore save **"${save.name}"** (${colorCount} colors). Continue?`,
      components: [row],
      fetchReply: true,
    });

    try {
      const btn = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 30_000,
      });

      if (btn.customId === 'colorrestore:confirm') {
        await btn.update({ content: '🔄 Restoring palette... This may take a moment.', components: [] });

        const success = await restoreSave(guild, saveId);

        if (success) {
          const container = moduleContainer('color_roles').setAccentColor(0x2ECC71);
          addText(container, `✅ Palette **"${save.name}"** restored with ${colorCount} colors!`);
          await interaction.editReply(v2Payload([container]));
        } else {
          await interaction.editReply({ content: '❌ Failed to restore the save.', components: [] });
        }
      } else {
        await btn.update({ content: '❌ Cancelled.', components: [] });
      }
    } catch {
      await interaction.editReply({ content: '⏰ Timed out.', components: [] });
    }
  },
};

export default command;
