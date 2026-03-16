import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { guildModuleConfigs } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { getImagesConfig } from '../helpers';
import { moduleContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('images-config')
    .setDescription('Configure images module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('cooldown')
        .setDescription('Set command cooldown')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('Cooldown in seconds')
            .setMinValue(1)
            .setMaxValue(60)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Set default embed color')
        .addStringOption((opt) =>
          opt
            .setName('hex')
            .setDescription('Hex color (#RRGGBB)')
            .setMaxLength(7)
            .setRequired(true)
        )
    ),

  module: 'images',
  permissionPath: 'images.config',

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command only works in servers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      const config = await getImagesConfig(interaction.guildId!);

      const container = moduleContainer('images');
      addFields(container, [
        { name: 'Enabled', value: config.enabled ? 'Yes' : 'No', inline: true },
        { name: 'Default Embed Color', value: config.embedColor, inline: true },
        { name: 'Cooldown', value: `${config.cooldown}s`, inline: true },
        { name: 'NSFW Allowed', value: config.nsfwAllowed ? 'Yes' : 'No', inline: true },
      ]);

      await interaction.reply(v2Payload([container]));
      return;
    }

    const db = await getDb();

    if (subcommand === 'cooldown') {
      const seconds = interaction.options.getInteger('seconds', true);

      const existing = await db
        .select()
        .from(guildModuleConfigs)
        .where(
          and(eq(guildModuleConfigs.guildId, interaction.guildId!), eq(guildModuleConfigs.module, 'images'))
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guildModuleConfigs).values({
          guildId: interaction.guildId!,
          module: 'images',
          enabled: true,
          config: { embedColor: '#3498DB', cooldown: seconds, nsfwAllowed: false },
          updatedAt: new Date(),
        });
      } else {
        const config = (existing[0].config as Record<string, unknown>) || {};
        await db
          .update(guildModuleConfigs)
          .set({
            config: { ...config, cooldown: seconds },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(guildModuleConfigs.guildId, interaction.guildId!),
              eq(guildModuleConfigs.module, 'images')
            )
          );
      }

      await interaction.reply({
        content: `✅ Cooldown set to ${seconds}s`,
      });
      return;
    }

    if (subcommand === 'color') {
      const hex = interaction.options.getString('hex', true);

      const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexRegex.test(hex)) {
        await interaction.reply({
          content: '❌ Invalid hex color. Please use format #RRGGBB',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const existing = await db
        .select()
        .from(guildModuleConfigs)
        .where(
          and(eq(guildModuleConfigs.guildId, interaction.guildId!), eq(guildModuleConfigs.module, 'images'))
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guildModuleConfigs).values({
          guildId: interaction.guildId!,
          module: 'images',
          enabled: true,
          config: { embedColor: hex, cooldown: 5, nsfwAllowed: false },
          updatedAt: new Date(),
        });
      } else {
        const config = (existing[0].config as Record<string, unknown>) || {};
        await db
          .update(guildModuleConfigs)
          .set({
            config: { ...config, embedColor: hex },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(guildModuleConfigs.guildId, interaction.guildId!),
              eq(guildModuleConfigs.module, 'images')
            )
          );
      }

      await interaction.reply({
        content: `✅ Default embed color set to ${hex}`,
      });
    }
  },
};

export default command;
