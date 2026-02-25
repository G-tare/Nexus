import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  validateHex,
  hexToInt,
  getColorPalette,
  getColorByName,
  canUseColors,
  findSimilarColor,
  getColorConfig,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('colorsuggest')
    .setDescription('Suggest a new color to be added to the palette')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Name for the color')
        .setRequired(true)
        .setMaxLength(32))
    .addStringOption(opt =>
      opt.setName('hex')
        .setDescription('Hex color code (e.g. FF69B4 or #FF69B4)')
        .setRequired(true)) as SlashCommandBuilder,

  module: 'colorroles',
  permissionPath: 'colorroles.colorsuggest',
  premiumFeature: 'colorroles.basic',
  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;

    // Check whitelist
    if (!(await canUseColors(guild, interaction.user.id))) {
      await interaction.reply({
        content: 'You don\'t have a whitelisted role to use color commands.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const name = interaction.options.getString('name', true).trim();
    const hexInput = interaction.options.getString('hex', true);

    // Validate hex
    const hex = validateHex(hexInput);
    if (!hex) {
      await interaction.reply({
        content: 'Invalid hex color. Please use a valid 6-digit hex code like `FF69B4` or `#FF69B4`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check if name already exists
    const existing = await getColorByName(guild.id, name);
    if (existing) {
      await interaction.reply({
        content: `A color named **${existing.name}** already exists.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check palette limit
    const config = await getColorConfig(guild.id);
    const colors = await getColorPalette(guild.id);
    if (colors.length >= config.maxColors) {
      await interaction.reply({
        content: `The server has reached the maximum of ${config.maxColors} colors.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check for similar colors
    let similarWarning = '';
    if (config.overlapWarning) {
      const similar = await findSimilarColor(guild.id, hex, config.overlapThreshold);
      if (similar) {
        similarWarning = `\n⚠️ This color is similar to **${similar.name}** (\`#${similar.hex}\`)`;
      }
    }

    // Create suggestion embed for staff to review
    const embed = new EmbedBuilder()
      .setColor(hexToInt(hex))
      .setTitle('🎨 Color Suggestion')
      .setDescription(`**${interaction.user.tag}** suggests adding a new color:`)
      .addFields(
        { name: 'Name', value: name, inline: true },
        { name: 'Hex', value: `\`#${hex}\``, inline: true },
        { name: 'Suggested By', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setTimestamp();

    if (similarWarning) {
      embed.addFields({ name: 'Warning', value: similarWarning });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`colorroles:approve:${name}:${hex}:${interaction.user.id}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`colorroles:deny:${name}:${hex}:${interaction.user.id}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌'),
    );

    // Post in the channel (staff will see the buttons)
    await interaction.reply({
      content: '✅ Your color suggestion has been submitted for review!',
      flags: MessageFlags.Ephemeral,
    });

    // Also post the suggestion embed publicly
    const channel = interaction.channel as any;
    if (channel?.send) {
      await channel.send({
        embeds: [embed],
        components: [row],
      });
    }
  },
};

export default command;
